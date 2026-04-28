import type {
    IPlexLibrary,
    PlexLibrarySection,
} from '../../../modules/plex/library';
import type { ChannelBuildProgress, ChannelSetupConfig } from '../types';
import {
    ChannelSetupFacetSnapshotLoadSession,
} from './ChannelSetupFacetSnapshotLoadSession';
import { createAbortError } from './ChannelSetupFacetSnapshotAbort';
import type {
    ChannelSetupFacetSnapshot,
    ChannelSetupPlanningIntent,
    ChannelSetupPlexRequestIntent,
} from './ChannelSetupPlanningTypes';

export {
    assertRecoveredTagCount,
    ChannelSetupPlanningError,
} from './ChannelSetupFacetCountRecoveryWorker';
export type {
    ChannelSetupFacetSnapshot,
    ChannelSetupFacetSnapshotData,
    ChannelSetupPlanningIntent,
    ChannelSetupPlexRequestIntent,
} from './ChannelSetupPlanningTypes';

export interface ChannelSetupFacetSnapshotLoaderDeps {
    plexLibrary: IPlexLibrary;
}

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

type ChannelSetupFacetSnapshotInflightLoad = {
    key: string;
    promise: Promise<ChannelSetupFacetSnapshot>;
    controller: AbortController;
    lastTask: ChannelBuildProgress['task'] | undefined;
    progress: ChannelSetupFacetSnapshotProgress | null;
    waiters: Set<ChannelSetupFacetSnapshotWaiter>;
};

export class ChannelSetupFacetSnapshotLoader {
    // Single-entry by design: setup normally reuses one active snapshot key; inflight loads cover overlap.
    private _cachedKey: string | null = null;
    private _cachedSnapshot: ChannelSetupFacetSnapshot | null = null;
    private readonly _inflightLoads = new Map<string, ChannelSetupFacetSnapshotInflightLoad>();

    constructor(private readonly _deps: ChannelSetupFacetSnapshotLoaderDeps) {}

    invalidate(): void {
        this._cachedKey = null;
        this._cachedSnapshot = null;
        for (const load of this._inflightLoads.values()) {
            load.controller.abort();
            load.waiters.clear();
        }
        this._inflightLoads.clear();
    }

    private _shouldCacheSnapshot(snapshot: ChannelSetupFacetSnapshot): boolean {
        if (snapshot.status === 'ready') {
            return !snapshot.hasTransientLoadFailure;
        }
        return snapshot.failureReason === 'unsupported' || snapshot.failureReason === 'empty';
    }

    private _throwIfSignalAborted(signal: AbortSignal | null | undefined): void {
        if (signal?.aborted) {
            throw createAbortError(undefined);
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
        const inflightLoad = this._inflightLoads.get(key);
        if (inflightLoad) {
            return this._awaitSnapshot(inflightLoad, options);
        }

        this._throwIfSignalAborted(options.signal);
        const snapshotAbortController = new AbortController();
        let startLoad: () => void = () => undefined;
        const loadPromise = new Promise<ChannelSetupFacetSnapshot>((resolve, reject) => {
            startLoad = (): void => {
                try {
                    resolve(this._loadSnapshotUncached(
                        config,
                        libraries,
                        options.detachFromSignal ? null : options.signal,
                        options.requestIntent,
                        snapshotAbortController,
                        (task, label, detail, current, total) => {
                            this._emitInflightProgress(load, task, label, detail, current, total);
                        }
                    ));
                } catch (error) {
                    reject(error);
                }
            };
        });
        const load: ChannelSetupFacetSnapshotInflightLoad = {
            key,
            promise: loadPromise,
            controller: snapshotAbortController,
            lastTask: undefined,
            progress: null,
            waiters: new Set(),
        };
        this._inflightLoads.set(key, load);
        startLoad();

        void loadPromise.then(
            (snapshot) => {
                if (
                    this._inflightLoads.get(key) === load
                    && this._shouldCacheSnapshot(snapshot)
                ) {
                    this._cachedKey = key;
                    this._cachedSnapshot = snapshot;
                }
            },
            () => undefined
        ).finally(() => {
            if (this._inflightLoads.get(key) === load) {
                this._inflightLoads.delete(key);
                load.waiters.clear();
            }
        });

        return this._awaitSnapshot(load, options);
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
        load: ChannelSetupFacetSnapshotInflightLoad,
        options: ChannelSetupFacetSnapshotWaitOptions
    ): Promise<ChannelSetupFacetSnapshot> {
        const promise = load.promise;
        const waiter = this._registerWaiter(load, options.reportProgress);
        const cleanup = (): void => {
            if (waiter) {
                load.waiters.delete(waiter);
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
            return Promise.reject(createAbortError(load.lastTask));
        }
        return new Promise<ChannelSetupFacetSnapshot>((resolve, reject) => {
            const onAbort = (): void => {
                cleanup();
                reject(createAbortError(load.lastTask));
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
        load: ChannelSetupFacetSnapshotInflightLoad,
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
        load.waiters.add(waiter);
        if (load.progress) {
            const progress = load.progress;
            reportProgress(progress.task, progress.label, progress.detail, progress.current, progress.total);
        }
        return waiter;
    }

    private _emitInflightProgress(
        load: ChannelSetupFacetSnapshotInflightLoad,
        task: ChannelBuildProgress['task'],
        label: string,
        detail: string,
        current: number,
        total: number | null
    ): void {
        if (this._inflightLoads.get(load.key) !== load) {
            return;
        }
        load.lastTask = task;
        load.progress = { task, label, detail, current, total };
        for (const waiter of load.waiters) {
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
