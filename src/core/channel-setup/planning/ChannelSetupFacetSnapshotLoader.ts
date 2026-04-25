import type {
    IPlexLibrary,
    PlexLibrarySection,
    PlexTagDirectoryItem,
    PlexPlaylist,
    PlexCollection,
} from '../../../modules/plex/library';
import { getPlexRequestIntentForChannelSetup } from '../../../modules/plex/library';
import type { ChannelBuildProgress, ChannelSetupConfig, ChannelSetupPreviewFailureReason } from '../types';
import {
    ChannelSetupFacetSnapshotLoadSession,
    createAbortError,
} from './ChannelSetupFacetSnapshotLoadSession';

export {
    assertRecoveredTagCount,
    ChannelSetupPlanningError,
} from './ChannelSetupFacetSnapshotLoadSession';

export type ChannelSetupPlanningIntent = 'preview' | 'build';
export type ChannelSetupPlexRequestIntent = ReturnType<typeof getPlexRequestIntentForChannelSetup>;

export interface ChannelSetupFacetSnapshotLoaderDeps {
    plexLibrary: IPlexLibrary;
}

export type ChannelSetupFacetSnapshotData = {
    playlists: PlexPlaylist[];
    collectionsByLibraryId: Map<string, PlexCollection[]>;
    genresByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    directorsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    yearsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    actorsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    studiosByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    warnings: string[];
    hasTransientLoadFailure: boolean;
    errorsTotal: number;
    playlistMs: number;
    collectionsMs: number;
    libraryQueryMs: number;
    lastTask?: ChannelBuildProgress['task'];
};

export type ChannelSetupFacetSnapshot =
    | ({ status: 'ready' } & ChannelSetupFacetSnapshotData)
    | ({
        status: 'blocked' | 'slow';
        message: string;
        failureReason: ChannelSetupPreviewFailureReason;
    } & ChannelSetupFacetSnapshotData);

export type ChannelSetupFacetSnapshotWaitOptions = {
    signal: AbortSignal | null;
    requestIntent: ChannelSetupPlexRequestIntent;
    reportProgress?: (
        task: ChannelBuildProgress['task'],
        label: string,
        detail: string,
        current: number,
        total: number | null
    ) => void;
    detachFromSignal: boolean;
};

type ChannelSetupFacetSnapshotProgress = {
    task: ChannelBuildProgress['task'];
    label: string;
    detail: string;
    current: number;
    total: number | null;
};

type ChannelSetupFacetSnapshotWaiter = {
    reportProgress: (
        task: ChannelBuildProgress['task'],
        label: string,
        detail: string,
        current: number,
        total: number | null
    ) => void;
};

type ChannelSetupFacetSnapshotLoadToken = object;

export class ChannelSetupFacetSnapshotLoader {
    private _cachedKey: string | null = null;
    private _cachedSnapshot: ChannelSetupFacetSnapshot | null = null;
    private _inflightKey: string | null = null;
    private _inflightPromise: Promise<ChannelSetupFacetSnapshot> | null = null;
    private _inflightLoadToken: ChannelSetupFacetSnapshotLoadToken | null = null;
    private _inflightLastTask: ChannelBuildProgress['task'] | undefined;
    private _inflightProgress: ChannelSetupFacetSnapshotProgress | null = null;
    private _activeSnapshotAbortController: AbortController | null = null;
    private readonly _inflightWaiters = new Set<ChannelSetupFacetSnapshotWaiter>();

    constructor(private readonly _deps: ChannelSetupFacetSnapshotLoaderDeps) {}

    invalidate(): void {
        this._activeSnapshotAbortController?.abort();
        this._activeSnapshotAbortController = null;
        this._cachedKey = null;
        this._cachedSnapshot = null;
        this._inflightKey = null;
        this._inflightPromise = null;
        this._inflightLoadToken = null;
        this._inflightLastTask = undefined;
        this._inflightProgress = null;
        this._inflightWaiters.clear();
    }

    private _shouldCacheSnapshot(snapshot: ChannelSetupFacetSnapshot): boolean {
        if (snapshot.status === 'ready') {
            return !snapshot.hasTransientLoadFailure;
        }
        return snapshot.failureReason === 'unsupported' || snapshot.failureReason === 'empty';
    }

    private _throwIfSignalAborted(signal: AbortSignal | null | undefined): void {
        if (signal?.aborted) {
            throw createAbortError(this._inflightLastTask);
        }
    }

    async loadSnapshot(
        config: ChannelSetupConfig,
        libraries: PlexLibrarySection[],
        intent: ChannelSetupPlanningIntent,
        options: ChannelSetupFacetSnapshotWaitOptions
    ): Promise<ChannelSetupFacetSnapshot> {
        const key = this._buildSnapshotKey(config, intent);
        this._throwIfSignalAborted(options.signal);
        if (this._cachedKey === key && this._cachedSnapshot) {
            return this._cachedSnapshot;
        }
        if (this._inflightKey === key && this._inflightPromise) {
            return this._awaitSnapshot(this._inflightPromise, options);
        }

        this.invalidate();
        this._throwIfSignalAborted(options.signal);
        const loadToken: ChannelSetupFacetSnapshotLoadToken = {};
        const snapshotAbortController = new AbortController();
        this._inflightKey = key;
        this._inflightLoadToken = loadToken;
        this._activeSnapshotAbortController = snapshotAbortController;
        const loadPromise = this._loadSnapshotUncached(
            config,
            libraries,
            options.detachFromSignal ? null : options.signal,
            options.requestIntent,
            snapshotAbortController,
            (task, label, detail, current, total) => {
                this._emitInflightProgress(loadToken, task, label, detail, current, total);
            }
        );
        this._inflightPromise = loadPromise;

        void loadPromise.then(
            (snapshot) => {
                if (
                    this._inflightPromise === loadPromise
                    && this._inflightKey === key
                    && this._inflightLoadToken === loadToken
                    && this._shouldCacheSnapshot(snapshot)
                ) {
                    this._cachedKey = key;
                    this._cachedSnapshot = snapshot;
                }
            },
            () => undefined
        ).finally(() => {
            if (
                this._inflightPromise === loadPromise
                && this._inflightKey === key
                && this._inflightLoadToken === loadToken
            ) {
                this._activeSnapshotAbortController = null;
                this._inflightPromise = null;
                this._inflightKey = null;
                this._inflightLoadToken = null;
                this._inflightLastTask = undefined;
                this._inflightProgress = null;
                this._inflightWaiters.clear();
            }
        });

        return this._awaitSnapshot(loadPromise, options);
    }

    private _buildSnapshotKey(config: ChannelSetupConfig, intent: ChannelSetupPlanningIntent): string {
        const selectedLibraryIds = [...config.selectedLibraryIds].sort((left, right) => left.localeCompare(right));
        const families = ([
            'playlists',
            'collections',
            'genres',
            'directors',
            'decades',
            'studios',
            'actors',
        ] as const).filter((family) => config.strategyConfig[family].enabled);
        return JSON.stringify({
            serverId: config.serverId,
            selectedLibraryIds,
            families,
            intent,
        });
    }

    private _awaitSnapshot(
        promise: Promise<ChannelSetupFacetSnapshot>,
        options: ChannelSetupFacetSnapshotWaitOptions
    ): Promise<ChannelSetupFacetSnapshot> {
        const waiter = this._registerWaiter(options.reportProgress);
        const cleanup = (): void => {
            if (waiter) {
                this._inflightWaiters.delete(waiter);
            }
        };
        const signal = options.signal;

        if (!signal) {
            if (!waiter) {
                return promise;
            }
            return new Promise<ChannelSetupFacetSnapshot>((resolve, reject) => {
                void promise.then(
                    (value) => {
                        cleanup();
                        resolve(value);
                    },
                    (error) => {
                        cleanup();
                        reject(error);
                    }
                );
            });
        }
        if (signal.aborted) {
            cleanup();
            return Promise.reject(createAbortError(this._inflightLastTask));
        }
        return new Promise<ChannelSetupFacetSnapshot>((resolve, reject) => {
            const onAbort = (): void => {
                cleanup();
                reject(createAbortError(this._inflightLastTask));
            };
            signal.addEventListener('abort', onAbort, { once: true });
            void promise.then(
                (value) => {
                    signal.removeEventListener('abort', onAbort);
                    cleanup();
                    resolve(value);
                },
                (error) => {
                    signal.removeEventListener('abort', onAbort);
                    cleanup();
                    reject(error);
                }
            );
        });
    }

    private _registerWaiter(
        reportProgress?: (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ) => void
    ): ChannelSetupFacetSnapshotWaiter | null {
        if (!reportProgress) {
            return null;
        }
        const waiter: ChannelSetupFacetSnapshotWaiter = { reportProgress };
        this._inflightWaiters.add(waiter);
        if (this._inflightProgress) {
            const progress = this._inflightProgress;
            reportProgress(progress.task, progress.label, progress.detail, progress.current, progress.total);
        }
        return waiter;
    }

    private _emitInflightProgress(
        loadToken: ChannelSetupFacetSnapshotLoadToken,
        task: ChannelBuildProgress['task'],
        label: string,
        detail: string,
        current: number,
        total: number | null
    ): void {
        if (this._inflightLoadToken !== loadToken) {
            return;
        }
        this._inflightLastTask = task;
        this._inflightProgress = { task, label, detail, current, total };
        for (const waiter of this._inflightWaiters) {
            waiter.reportProgress(task, label, detail, current, total);
        }
    }

    private _loadSnapshotUncached(
        config: ChannelSetupConfig,
        libraries: PlexLibrarySection[],
        signal: AbortSignal | null,
        requestIntent: ChannelSetupPlexRequestIntent,
        snapshotAbortController: AbortController,
        reportProgress?: (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ) => void
    ): Promise<ChannelSetupFacetSnapshot> {
        return new ChannelSetupFacetSnapshotLoadSession({
            plexLibrary: this._deps.plexLibrary,
            config,
            libraries,
            signal,
            requestIntent,
            snapshotAbortController,
            reportProgress,
        }).load();
    }

}
