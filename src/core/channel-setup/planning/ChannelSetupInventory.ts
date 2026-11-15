import type { IPlexLibrary, PlexLibrarySection } from '../../../modules/plex/library';
import { getPlexRequestIntentForChannelSetup } from '../../../modules/plex/library';
import type { ChannelBuildProgress, ChannelSetupConfig, SetupStrategyKey } from '../types';
import { ChannelSetupFacetSnapshotLoader } from './ChannelSetupFacetSnapshotLoader';
import type { ChannelSetupFacetSnapshot } from './ChannelSetupPlanningTypes';
import { createAbortError } from './ChannelSetupFacetSnapshotAbort';
import { CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS } from './ChannelSetupFacetFamilies';
import { shouldLoadNativeFacetForLibrary } from './ChannelSetupNativeFacetEligibility';

export type ChannelSetupInventoryStatus = 'pending' | 'ready' | 'empty' | 'failed' | 'unsupported' | 'canceled';

export interface ChannelSetupInventoryLibrary {
    libraryId: string;
    libraryName: string;
    requiredFamilies: readonly SetupStrategyKey[];
    status: ChannelSetupInventoryStatus;
    generation: number;
    reason?: string;
    progress?: ChannelBuildProgress;
}

export interface ChannelSetupInventory {
    scopeKey: string;
    generation: number;
    libraries: readonly ChannelSetupInventoryLibrary[];
    acceptedReadyLibraryIds: readonly string[];
    sharedPlaylistsStatus: ChannelSetupInventoryStatus | 'unused';
}

type LibraryEntry = {
    key: string;
    loader: ChannelSetupFacetSnapshotLoader;
    controller: AbortController;
    waiters: number;
    listeners: Set<() => void>;
    generation: number;
    snapshot: ChannelSetupFacetSnapshot | null;
    status: ChannelSetupInventoryStatus;
    reason: string | undefined;
    progress?: ChannelBuildProgress;
    inflight: Promise<void> | undefined;
};

type SharedPlaylistLoad = {
    controller: AbortController;
    waiters: number;
    promise: Promise<void>;
};

function requiredFamiliesFor(config: ChannelSetupConfig, library: PlexLibrarySection): SetupStrategyKey[] {
    return (Object.keys(config.strategyConfig) as SetupStrategyKey[])
        .filter((family) => config.strategyConfig[family].enabled)
        .filter((family) => {
            const descriptor = CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS.find((item) => item.family === family);
            return !descriptor || shouldLoadNativeFacetForLibrary(descriptor, library);
        });
}

function awaitForCaller(promise: Promise<void>, signal?: AbortSignal | null): Promise<void> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
        const onAbort = (): void => { cleanup(); resolve(); };
        const cleanup = (): void => { signal.removeEventListener('abort', onAbort); };
        signal.addEventListener('abort', onAbort, { once: true });
        void promise.then(() => { cleanup(); resolve(); }, (error: unknown) => { cleanup(); reject(error); });
    });
}

/** Facet ownership is per library. Retrying one failed source never invalidates another. */
export class ChannelSetupInventoryOwner {
    private readonly _entries = new Map<string, LibraryEntry>();
    private readonly _sharedPlaylistLoader: ChannelSetupFacetSnapshotLoader;
    private _sharedPlaylistSnapshot: ChannelSetupFacetSnapshot | null = null;
    private _sharedPlaylistStatus: ChannelSetupInventoryStatus = 'pending';
    private _sharedPlaylistLoad: SharedPlaylistLoad | null = null;
    private _sharedPlaylistGeneration = 0;
    private _generation = 0;
    private _scopeGeneration = 0;
    private _scopeKey = '';

    constructor(private readonly _plexLibrary: IPlexLibrary) {
        this._sharedPlaylistLoader = new ChannelSetupFacetSnapshotLoader({ plexLibrary: _plexLibrary });
    }

    invalidate(): void {
        this._generation++;
        this._scopeGeneration++;
        for (const entry of this._entries.values()) {
            entry.controller.abort();
            entry.loader.invalidate();
        }
        this._entries.clear();
        this._retireSharedPlaylistLoad('pending');
    }

    retry(libraryId: string): void {
        const entry = this._entries.get(libraryId);
        if (!entry && this._sharedPlaylistStatus === 'ready') return;
        if (entry) {
            entry.controller.abort();
            entry.loader.invalidate();
            this._entries.delete(libraryId);
        }
        if (this._sharedPlaylistStatus !== 'ready') {
            this._retireSharedPlaylistLoad('pending');
        }
        this._generation++;
    }

    get generation(): number { return this._generation; }

    getSnapshot(library: PlexLibrarySection, config: ChannelSetupConfig): ChannelSetupFacetSnapshot | null {
        const entry = this._entries.get(library.id);
        return entry?.status === 'ready' && entry.key === JSON.stringify(requiredFamiliesFor(config, library))
            ? entry.snapshot : null;
    }

    getSharedPlaylistSnapshot(): ChannelSetupFacetSnapshot | null {
        return this._sharedPlaylistStatus === 'ready' ? this._sharedPlaylistSnapshot : null;
    }

    isReadyForConfig(library: PlexLibrarySection, config: ChannelSetupConfig): boolean {
        const entry = this._entries.get(library.id);
        return entry?.status === 'ready'
            && entry.key === JSON.stringify(requiredFamiliesFor(config, library))
            && (!config.strategyConfig.playlists.enabled || this._sharedPlaylistStatus === 'ready');
    }

    async scan(
        scopeKey: string,
        config: ChannelSetupConfig,
        libraries: readonly PlexLibrarySection[],
        signal?: AbortSignal | null,
        onProgress?: (inventory: ChannelSetupInventory) => void,
        includeSharedPlaylists = false
    ): Promise<ChannelSetupInventory> {
        if (this._scopeKey !== scopeKey) {
            this.invalidate();
            this._scopeKey = scopeKey;
        }
        const selected = libraries.filter((library) => config.selectedLibraryIds.includes(library.id));
        for (const library of selected) {
            const key = JSON.stringify(requiredFamiliesFor(config, library));
            const entry = this._entries.get(library.id);
            if (entry && entry.key !== key) {
                entry.controller.abort();
                entry.loader.invalidate();
                this._entries.delete(library.id);
                this._generation++;
            }
        }
        const capturedGeneration = this._generation;
        const capturedScopeGeneration = this._scopeGeneration;
        const sharedRequired = config.strategyConfig.playlists.enabled || includeSharedPlaylists;
        const publish = (): ChannelSetupInventory => {
            const callerCanceled = signal?.aborted === true;
            const facts = selected.map((library): ChannelSetupInventoryLibrary => {
                const entry = this._entries.get(library.id);
                const currentEntry = entry?.key === JSON.stringify(requiredFamiliesFor(config, library)) ? entry : undefined;
                return {
                    libraryId: library.id,
                    libraryName: library.title,
                    requiredFamilies: requiredFamiliesFor(config, library),
                    status: callerCanceled
                        ? 'canceled' : config.strategyConfig.playlists.enabled && this._sharedPlaylistStatus !== 'ready'
                            ? this._sharedPlaylistStatus : currentEntry?.status ?? 'pending',
                    generation: currentEntry?.generation ?? capturedGeneration,
                    ...(config.strategyConfig.playlists.enabled && this._sharedPlaylistStatus === 'failed'
                        ? { reason: 'Shared playlists are unavailable. Retry this scan.' }
                        : currentEntry?.reason ? { reason: currentEntry.reason } : {}),
                    ...(currentEntry?.progress ? { progress: currentEntry.progress } : {}),
                };
            });
            for (const id of config.selectedLibraryIds) {
                if (!selected.some((library) => library.id === id)) facts.push({
                    libraryId: id, libraryName: id, requiredFamilies: [],
                    status: 'failed', generation: capturedGeneration,
                    reason: 'Selected library is unavailable in the current server scope.',
                });
            }
            return {
                scopeKey,
                generation: this._generation,
                libraries: facts,
                acceptedReadyLibraryIds: facts.filter((fact) => fact.status === 'ready').map((fact) => fact.libraryId),
                sharedPlaylistsStatus: sharedRequired
                    ? callerCanceled ? 'canceled' : this._sharedPlaylistStatus : 'unused',
            };
        };
        const sharedLoad = sharedRequired && this._sharedPlaylistStatus !== 'ready' && !signal?.aborted
            ? this._sharedPlaylistLoad ?? this._startSharedPlaylistLoad(config) : null;
        const sharedGeneration = this._sharedPlaylistGeneration;
        try { onProgress?.(publish()); } catch { /* View callbacks cannot fail scanning. */ }
        if (sharedLoad) {
            const load = sharedLoad;
            if (sharedGeneration !== this._sharedPlaylistGeneration || this._sharedPlaylistLoad !== load) {
                throw createAbortError();
            }
            load.waiters++;
            try {
                await awaitForCaller(load.promise, signal);
            } finally {
                load.waiters--;
                if (load.waiters === 0 && this._sharedPlaylistLoad === load) {
                    this._retireSharedPlaylistLoad('canceled');
                }
            }
            if (capturedScopeGeneration !== this._scopeGeneration || scopeKey !== this._scopeKey) {
                throw createAbortError();
            }
            if (!signal?.aborted && sharedGeneration !== this._sharedPlaylistGeneration) {
                throw createAbortError();
            }
            try { onProgress?.(publish()); } catch { /* View callbacks cannot fail scanning. */ }
            if (signal?.aborted) return publish();
        }
        const queue = [...selected];
        const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
            while (queue.length > 0) {
                if (signal?.aborted || capturedScopeGeneration !== this._scopeGeneration || scopeKey !== this._scopeKey) return;
                const library = queue.shift();
                if (!library) return;
                let entry = this._entries.get(library.id);
                if (!entry) {
                    entry = {
                        key: JSON.stringify(requiredFamiliesFor(config, library)),
                        loader: new ChannelSetupFacetSnapshotLoader({ plexLibrary: this._plexLibrary }),
                        controller: new AbortController(),
                        waiters: 0,
                        listeners: new Set(),
                        generation: capturedGeneration,
                        snapshot: null,
                        status: 'pending',
                        reason: undefined,
                        inflight: undefined,
                    };
                    this._entries.set(library.id, entry);
                }
                if (entry.status === 'ready' || entry.status === 'empty' || entry.status === 'unsupported') continue;
                const current = entry;
                const notify = (): void => {
                    if (signal?.aborted || capturedScopeGeneration !== this._scopeGeneration) return;
                    try { onProgress?.(publish()); } catch { /* A view callback cannot fail inventory acquisition. */ }
                };
                current.waiters++;
                current.listeners.add(notify);
                current.inflight ??= (async (): Promise<void> => {
                    try {
                        const snapshot = await current.loader.loadSnapshot(
                            { ...config, selectedLibraryIds: [library.id], strategyConfig: {
                                ...config.strategyConfig,
                                playlists: { ...config.strategyConfig.playlists, enabled: false },
                            } }, [library], 'build',
                            {
                                signal: current.controller.signal,
                                requestIntent: getPlexRequestIntentForChannelSetup('build'),
                                detachFromSignal: false,
                                reportProgress: (progress) => {
                                    if (this._entries.get(library.id) !== current || capturedScopeGeneration !== this._scopeGeneration) return;
                                    current.progress = progress;
                                    for (const listener of current.listeners) listener();
                                },
                            }
                        );
                        if (this._entries.get(library.id) !== current || capturedScopeGeneration !== this._scopeGeneration) return;
                        current.snapshot = snapshot;
                        current.status = snapshot.status === 'ready' && !snapshot.hasTransientLoadFailure
                            ? library.contentCount === 0 ? 'empty' : 'ready'
                            : snapshot.status !== 'ready' && snapshot.failureReason === 'unsupported' ? 'unsupported'
                            : snapshot.status !== 'ready' && snapshot.failureReason === 'empty' ? 'empty' : 'failed';
                        current.reason = snapshot.status === 'ready'
                            ? snapshot.hasTransientLoadFailure ? 'Required inventory is incomplete.'
                                : current.status === 'empty' ? 'Library contains no items.' : undefined
                            : snapshot.message || 'Required inventory is unavailable.';
                    } catch {
                        if (this._entries.get(library.id) !== current || capturedScopeGeneration !== this._scopeGeneration) return;
                        current.status = current.controller.signal.aborted ? 'canceled' : 'failed';
                        current.reason = current.controller.signal.aborted
                            ? 'Scan canceled. Retry this library.' : 'Inventory request failed. Retry this library.';
                    } finally {
                        current.inflight = undefined;
                        if (this._entries.get(library.id) === current && capturedScopeGeneration === this._scopeGeneration) {
                            for (const listener of current.listeners) listener();
                        }
                    }
                })();
                try {
                    await awaitForCaller(current.inflight, signal);
                } finally {
                    current.listeners.delete(notify);
                    current.waiters--;
                    if (current.waiters === 0 && current.status === 'pending') current.controller.abort();
                }
            }
        });
        await Promise.all(workers);
        if (capturedScopeGeneration !== this._scopeGeneration || scopeKey !== this._scopeKey) throw createAbortError();
        return publish();
    }

    private _startSharedPlaylistLoad(config: ChannelSetupConfig): SharedPlaylistLoad {
        this._sharedPlaylistSnapshot = null;
        this._sharedPlaylistStatus = 'pending';
        const playlistConfig: ChannelSetupConfig = {
            ...config,
            selectedLibraryIds: [],
            strategyConfig: Object.fromEntries(Object.entries(config.strategyConfig).map(([family, value]) =>
                [family, { ...value, enabled: family === 'playlists' }])) as ChannelSetupConfig['strategyConfig'],
        };
        const generation = this._sharedPlaylistGeneration;
        const load: SharedPlaylistLoad = {
            controller: new AbortController(),
            waiters: 0,
            promise: Promise.resolve(),
        };
        this._sharedPlaylistLoad = load;
        load.promise = (async (): Promise<void> => {
            try {
                const snapshot = await this._sharedPlaylistLoader.loadSnapshot(playlistConfig, [], 'build', {
                    signal: load.controller.signal,
                    detachFromSignal: false,
                    requestIntent: getPlexRequestIntentForChannelSetup('build'),
                });
                if (this._sharedPlaylistLoad !== load || generation !== this._sharedPlaylistGeneration) return;
                this._sharedPlaylistSnapshot = snapshot;
                this._sharedPlaylistStatus = snapshot.status === 'ready' && !snapshot.hasTransientLoadFailure
                    ? 'ready' : 'failed';
            } catch {
                if (this._sharedPlaylistLoad !== load || generation !== this._sharedPlaylistGeneration) return;
                this._sharedPlaylistStatus = load.controller.signal.aborted ? 'canceled' : 'failed';
            } finally {
                if (this._sharedPlaylistLoad === load && generation === this._sharedPlaylistGeneration) {
                    this._sharedPlaylistLoad = null;
                }
            }
        })();
        return load;
    }

    private _retireSharedPlaylistLoad(status: 'pending' | 'canceled'): void {
        this._sharedPlaylistGeneration++;
        this._sharedPlaylistLoad?.controller.abort();
        this._sharedPlaylistLoad = null;
        this._sharedPlaylistLoader.invalidate();
        this._sharedPlaylistSnapshot = null;
        this._sharedPlaylistStatus = status;
    }
}
