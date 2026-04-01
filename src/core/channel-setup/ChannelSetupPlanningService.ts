import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type {
    IPlexLibrary,
    PlexLibraryType,
    PlexTagDirectoryItem,
    PlexPlaylist,
    PlexCollection,
    PlexTagDirectoryUnsupportedReason,
    PlexLibraryRequestIntent,
} from '../../modules/plex/library';
import { PLEX_MEDIA_TYPES } from '../../modules/plex/library';
import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../modules/scheduler/channel-manager/constants';
import { redactSensitiveTokens } from '../../utils/redact';
import type {
    ChannelSetupConfig,
    ChannelBuildProgress,
    ChannelSetupPreview,
    ChannelSetupPreviewFailureReason,
    ChannelSetupPreviewStatus,
    ChannelSetupReview,
    SetupStrategyKey,
    SetupStrategyConfig,
    ChannelExpansionConfig,
    SeriesOrderingConfig,
} from './types';
import {
    buildChannelSetupPlan,
    diffChannelPlans,
    createChannelIdentityKey,
    type PendingChannel,
    type ChannelDiffResult,
} from './ChannelSetupPlanner';
import {
    DEFAULT_CHANNEL_EXPANSION,
    DEFAULT_MIN_ITEMS_PER_CHANNEL,
    DEFAULT_SERIES_ORDERING,
    DEFAULT_STRATEGY_PRIORITIES,
    MIXED_SCOPE_STRATEGY_KEYS,
    SETUP_STRATEGY_KEYS,
} from './constants';
import { isSignalAborted } from './utils';

const SELECTABLE_STRATEGY_KEYS: SetupStrategyKey[] = [...SETUP_STRATEGY_KEYS];
type ChannelSetupPlanningIntent = 'preview' | 'build';

export interface ChannelSetupPlanningServiceDeps {
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
}

export type ChannelSetupPlanBuildResult = {
    plan: ReturnType<typeof buildChannelSetupPlan> | null;
    warnings: string[];
    canceled: boolean;
    blockedMessage?: string;
    previewStatus?: Exclude<ChannelSetupPreviewStatus, 'ready'>;
    failureReason?: ChannelSetupPreviewFailureReason;
    lastTask?: ChannelBuildProgress['task'];
    errorsTotal: number;
    playlistMs: number;
    collectionsMs: number;
    libraryQueryMs: number;
};

type ChannelSetupFacetSnapshotData = {
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

type ChannelSetupFacetSnapshot =
    | ({ status: 'ready' } & ChannelSetupFacetSnapshotData)
    | ({
        status: 'blocked' | 'slow';
        message: string;
        failureReason: ChannelSetupPreviewFailureReason;
    } & ChannelSetupFacetSnapshotData);

type ChannelSetupFacetSnapshotWaitOptions = {
    signal: AbortSignal | null;
    requestIntent: PlexLibraryRequestIntent;
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

const MAX_FACET_LIBRARY_CONCURRENCY = 2;

class ChannelSetupFacetSnapshotLoader {
    private _cachedKey: string | null = null;
    private _cachedSnapshot: ChannelSetupFacetSnapshot | null = null;
    private _inflightKey: string | null = null;
    private _inflightPromise: Promise<ChannelSetupFacetSnapshot> | null = null;
    private _inflightLoadToken: ChannelSetupFacetSnapshotLoadToken | null = null;
    private _inflightLastTask: ChannelBuildProgress['task'] | undefined;
    private _inflightProgress: ChannelSetupFacetSnapshotProgress | null = null;
    private readonly _inflightWaiters = new Set<ChannelSetupFacetSnapshotWaiter>();

    constructor(private readonly _deps: ChannelSetupPlanningServiceDeps) {}

    invalidate(): void {
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

    async loadSnapshot(
        config: ChannelSetupConfig,
        libraries: PlexLibraryType[],
        intent: ChannelSetupPlanningIntent,
        options: ChannelSetupFacetSnapshotWaitOptions
    ): Promise<ChannelSetupFacetSnapshot> {
        const key = this._buildSnapshotKey(config, intent);
        if (this._cachedKey === key && this._cachedSnapshot) {
            return this._cachedSnapshot;
        }
        if (this._inflightKey === key && this._inflightPromise) {
            return this._awaitSnapshot(this._inflightPromise, options);
        }

        this.invalidate();
        const loadToken: ChannelSetupFacetSnapshotLoadToken = {};
        this._inflightKey = key;
        this._inflightLoadToken = loadToken;
        const loadPromise = this._loadSnapshotUncached(
            config,
            libraries,
            options.detachFromSignal ? null : options.signal,
            options.requestIntent,
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
        const selectedLibraryIds = [...config.selectedLibraryIds].sort();
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

    private async _loadSnapshotUncached(
        config: ChannelSetupConfig,
        libraries: PlexLibraryType[],
        signal: AbortSignal | null,
        requestIntent: PlexLibraryRequestIntent,
        reportProgress?: (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ) => void
    ): Promise<ChannelSetupFacetSnapshot> {
        const selectedLibraries = libraries.filter((lib) => config.selectedLibraryIds.includes(lib.id));
        const warnings = new Set<string>();
        let errorsTotal = 0;
        let playlistMs = 0;
        let collectionsMs = 0;
        let libraryQueryMs = 0;
        let lastTask: ChannelBuildProgress['task'] | undefined;
        let shouldStop = false;
        let firstFailure: ChannelSetupFacetSnapshot | null = null;
        let failureAbortActive = false;
        const snapshotAbortController = new AbortController();
        const requestSignal = snapshotAbortController.signal;
        let removeSignalForwarder: (() => void) | null = null;

        if (signal) {
            if (signal.aborted) {
                snapshotAbortController.abort();
            } else {
                const onAbort = (): void => {
                    snapshotAbortController.abort();
                };
                signal.addEventListener('abort', onAbort, { once: true });
                removeSignalForwarder = (): void => {
                    signal.removeEventListener('abort', onAbort);
                };
            }
        }

        const playlists: PlexPlaylist[] = [];
        const collectionsByLibraryId = new Map<string, PlexCollection[]>();
        const genresByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const directorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const yearsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const actorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const studiosByLibraryId = new Map<string, PlexTagDirectoryItem[]>();

        const snapshotData = (hasTransientLoadFailure: boolean): ChannelSetupFacetSnapshotData => ({
            playlists,
            collectionsByLibraryId,
            genresByLibraryId,
            directorsByLibraryId,
            yearsByLibraryId,
            actorsByLibraryId,
            studiosByLibraryId,
            warnings: Array.from(warnings),
            hasTransientLoadFailure,
            errorsTotal,
            playlistMs,
            collectionsMs,
            libraryQueryMs,
            ...(lastTask !== undefined ? { lastTask } : {}),
        });

        const reportSnapshotProgress = (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ): void => {
            lastTask = task;
            reportProgress?.(task, label, detail, current, total);
        };

        const addPartialWarning = (
            task: ChannelBuildProgress['task'],
            detail: string,
            error: unknown
        ): void => {
            const summary = summarizeErrorForLog(error);
            const message = summary.message ?? (summary.code !== undefined ? String(summary.code) : 'unknown error');
            warnings.add(`Partial setup plan (${task}): ${detail} (${message})`);
        };

        const callerCanceled = (): boolean => isSignalAborted(signal ?? undefined);

        const failureStopRequested = (): boolean => failureAbortActive && requestSignal.aborted && !callerCanceled();

        const abortSiblingRequests = (): void => {
            shouldStop = true;
            failureAbortActive = true;
            if (!requestSignal.aborted) {
                snapshotAbortController.abort();
            }
        };

        const buildFailureSnapshot = (
            status: 'blocked' | 'slow',
            message: string,
            failureReason: ChannelSetupPreviewFailureReason
        ): ChannelSetupFacetSnapshot => {
            warnings.add(message);
            errorsTotal++;
            return {
                status,
                message,
                failureReason,
                ...snapshotData(false),
            };
        };

        const buildRequiredTagDirectoryFailure = (
            label: 'Genres' | 'Directors' | 'Years' | 'Actors' | 'Studios',
            libraryTitle: string,
            type: number,
            reason: PlexTagDirectoryUnsupportedReason | 'error',
            error?: unknown
        ): ChannelSetupFacetSnapshot => {
            const baseLabel = label.toLowerCase();
            if (reason === 'error') {
                const summary = summarizeErrorForLog(error);
                const detail = summary.message ?? (summary.code !== undefined ? String(summary.code) : 'unknown error');
                if (summary.code === 'NETWORK_TIMEOUT') {
                    return buildFailureSnapshot(
                        'slow',
                        `Required ${baseLabel} tag directory (type=${type}) timed out for ${libraryTitle}; try again after Plex responds.`,
                        'timeout'
                    );
                }
                return buildFailureSnapshot(
                    'blocked',
                    `Required ${baseLabel} tag directory (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`,
                    'error'
                );
            }
            const detail = reason === 'empty' ? 'returned no entries' : 'is unsupported';
            return buildFailureSnapshot(
                'blocked',
                `Required ${baseLabel} tag directory (type=${type}) ${detail} for ${libraryTitle}; stop and re-plan.`,
                reason === 'empty' ? 'empty' : 'unsupported'
            );
        };

        try {
            if (config.strategyConfig.playlists.enabled) {
                reportSnapshotProgress('fetch_playlists', 'Fetching playlists...', 'Scanning server', 0, null);
                try {
                    const playlistsStart = Date.now();
                    const fetched = await this._deps.plexLibrary.getPlaylists({
                        signal: requestSignal,
                        requestIntent,
                    });
                    playlistMs += Date.now() - playlistsStart;
                    playlists.push(...fetched);
                } catch (error) {
                    if (callerCanceled()) {
                        throw createAbortError(lastTask);
                    }
                    if (failureStopRequested()) {
                        return firstFailure ?? {
                            status: 'ready',
                            ...snapshotData(errorsTotal > 0),
                        };
                    }
                    console.warn('Failed to fetch playlists:', summarizeErrorForLog(error));
                    addPartialWarning('fetch_playlists', 'fetch_playlists failed', error);
                    errorsTotal++;
                }
            }

            const selectedLibraryQueue = selectedLibraries
                .map((library, index) => ({ library, index }))
                .filter((entry): entry is { library: PlexLibraryType; index: number } => entry.library !== undefined);
            const workerCount = Math.min(MAX_FACET_LIBRARY_CONCURRENCY, selectedLibraryQueue.length);
            const libraryWorkers = Array.from({ length: workerCount }, async (): Promise<ChannelSetupFacetSnapshot | null> => {
                while (selectedLibraryQueue.length > 0) {
                    if (shouldStop) {
                        return null;
                    }
                    if (callerCanceled()) {
                        throw createAbortError(lastTask);
                    }
                    const entry = selectedLibraryQueue.shift();
                    if (!entry) {
                        return null;
                    }
                    const { library, index: libIndex } = entry;

                    if (config.strategyConfig.collections.enabled) {
                        reportSnapshotProgress('fetch_collections', 'Fetching collections...', library.title, libIndex, selectedLibraries.length);
                        try {
                            const collectionsStart = Date.now();
                            const collections = await this._deps.plexLibrary.getCollections(library.id, {
                                signal: requestSignal,
                                requestIntent,
                            });
                            collectionsMs += Date.now() - collectionsStart;
                            collectionsByLibraryId.set(library.id, collections);
                        } catch (error) {
                            if (callerCanceled()) {
                                throw createAbortError(lastTask);
                            }
                            if (failureStopRequested()) {
                                return null;
                            }
                            console.warn(`Failed to fetch collections for library ${library.title}:`, summarizeErrorForLog(error));
                            addPartialWarning('fetch_collections', `fetch_collections failed for ${library.title}`, error);
                            errorsTotal++;
                            collectionsByLibraryId.set(library.id, []);
                        }
                    }

                    const genreType = library.type === 'show' ? PLEX_MEDIA_TYPES.SHOW : PLEX_MEDIA_TYPES.MOVIE;
                    const detailType = library.type === 'show' ? PLEX_MEDIA_TYPES.EPISODE : PLEX_MEDIA_TYPES.MOVIE;
                    const plexRequestIntent = requestIntent;
                    // `null` means unknown count, not empty. Keep validation enabled so unsupported
                    // native facet endpoints still surface as blocked instead of silently passing through.
                    const requireEntries = library.contentCount !== 0;
                    const libraryAbortController = new AbortController();
                    const librarySignal = libraryAbortController.signal;
                    let removeLibrarySignalForwarder: (() => void) | null = null;
                    let libraryFailureActive = false;
                    if (requestSignal.aborted) {
                        libraryAbortController.abort();
                    } else {
                        const onRequestAbort = (): void => {
                            libraryAbortController.abort();
                        };
                        requestSignal.addEventListener('abort', onRequestAbort, { once: true });
                        removeLibrarySignalForwarder = (): void => {
                            requestSignal.removeEventListener('abort', onRequestAbort);
                        };
                    }
                    const libraryFailureStopRequested = (): boolean =>
                        libraryFailureActive && librarySignal.aborted && !callerCanceled() && !failureStopRequested();
                    const abortLibraryFacetRequests = (): void => {
                        libraryFailureActive = true;
                        if (!librarySignal.aborted) {
                            libraryAbortController.abort();
                        }
                    };
                    const nativeFacetTasks: Array<Promise<ChannelSetupFacetSnapshot | null>> = [];

                    try {
                        if (config.strategyConfig.genres.enabled) {
                            nativeFacetTasks.push((async (): Promise<ChannelSetupFacetSnapshot | null> => {
                                try {
                                    const tagStart = Date.now();
                                    let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
                                    const genres = await this._deps.plexLibrary.getGenres(library.id, {
                                        type: genreType,
                                        signal: librarySignal,
                                        requireEntries,
                                        requestIntent: plexRequestIntent,
                                        onUnsupported: (reason) => {
                                            unsupportedReason = reason;
                                        },
                                    });
                                    libraryQueryMs += Date.now() - tagStart;
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Genres', library.title, genreType, unsupportedReason);
                                    }
                                    genresByLibraryId.set(library.id, genres);
                                    return null;
                                } catch (error) {
                                    if (callerCanceled()) {
                                        throw createAbortError(lastTask);
                                    }
                                    if (failureStopRequested() || libraryFailureStopRequested()) {
                                        return null;
                                    }
                                    console.warn(`Failed to fetch genres for ${library.title}:`, summarizeErrorForLog(error));
                                    return buildRequiredTagDirectoryFailure('Genres', library.title, genreType, 'error', error);
                                }
                            })());
                        }

                        if (config.strategyConfig.directors.enabled) {
                            nativeFacetTasks.push((async (): Promise<ChannelSetupFacetSnapshot | null> => {
                                try {
                                    const tagStart = Date.now();
                                    let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
                                    const directors = await this._deps.plexLibrary.getDirectors(library.id, {
                                        type: detailType,
                                        signal: librarySignal,
                                        requireEntries,
                                        requestIntent: plexRequestIntent,
                                        onUnsupported: (reason) => {
                                            unsupportedReason = reason;
                                        },
                                    });
                                    libraryQueryMs += Date.now() - tagStart;
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Directors', library.title, detailType, unsupportedReason);
                                    }
                                    directorsByLibraryId.set(library.id, directors);
                                    return null;
                                } catch (error) {
                                    if (callerCanceled()) {
                                        throw createAbortError(lastTask);
                                    }
                                    if (failureStopRequested() || libraryFailureStopRequested()) {
                                        return null;
                                    }
                                    console.warn(`Failed to fetch directors for ${library.title}:`, summarizeErrorForLog(error));
                                    return buildRequiredTagDirectoryFailure('Directors', library.title, detailType, 'error', error);
                                }
                            })());
                        }

                        if (config.strategyConfig.decades.enabled) {
                            nativeFacetTasks.push((async (): Promise<ChannelSetupFacetSnapshot | null> => {
                                try {
                                    const tagStart = Date.now();
                                    let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
                                    const years = await this._deps.plexLibrary.getYears(library.id, {
                                        type: detailType,
                                        signal: librarySignal,
                                        requireEntries,
                                        requestIntent: plexRequestIntent,
                                        onUnsupported: (reason) => {
                                            unsupportedReason = reason;
                                        },
                                    });
                                    libraryQueryMs += Date.now() - tagStart;
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Years', library.title, detailType, unsupportedReason);
                                    }
                                    yearsByLibraryId.set(library.id, years);
                                    return null;
                                } catch (error) {
                                    if (callerCanceled()) {
                                        throw createAbortError(lastTask);
                                    }
                                    if (failureStopRequested() || libraryFailureStopRequested()) {
                                        return null;
                                    }
                                    console.warn(`Failed to fetch years for ${library.title}:`, summarizeErrorForLog(error));
                                    return buildRequiredTagDirectoryFailure('Years', library.title, detailType, 'error', error);
                                }
                            })());
                        }

                        if (config.strategyConfig.studios.enabled) {
                            nativeFacetTasks.push((async (): Promise<ChannelSetupFacetSnapshot | null> => {
                                try {
                                    const studiosStart = Date.now();
                                    let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
                                    const studios = await this._deps.plexLibrary.getStudios(library.id, {
                                        type: detailType,
                                        signal: librarySignal,
                                        requireEntries,
                                        requestIntent: plexRequestIntent,
                                        onUnsupported: (reason) => {
                                            unsupportedReason = reason;
                                        },
                                    });
                                    libraryQueryMs += Date.now() - studiosStart;
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Studios', library.title, detailType, unsupportedReason);
                                    }
                                    studiosByLibraryId.set(library.id, studios);
                                    return null;
                                } catch (error) {
                                    if (callerCanceled()) {
                                        throw createAbortError(lastTask);
                                    }
                                    if (failureStopRequested() || libraryFailureStopRequested()) {
                                        return null;
                                    }
                                    console.warn(`Failed to fetch studios for ${library.title}:`, summarizeErrorForLog(error));
                                    return buildRequiredTagDirectoryFailure('Studios', library.title, detailType, 'error', error);
                                }
                            })());
                        }

                        if (config.strategyConfig.actors.enabled) {
                            nativeFacetTasks.push((async (): Promise<ChannelSetupFacetSnapshot | null> => {
                                try {
                                    const actorsStart = Date.now();
                                    let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
                                    const actors = await this._deps.plexLibrary.getActors(library.id, {
                                        type: detailType,
                                        signal: librarySignal,
                                        requireEntries,
                                        requestIntent: plexRequestIntent,
                                        onUnsupported: (reason) => {
                                            unsupportedReason = reason;
                                        },
                                    });
                                    libraryQueryMs += Date.now() - actorsStart;
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Actors', library.title, detailType, unsupportedReason);
                                    }
                                    actorsByLibraryId.set(library.id, actors);
                                    return null;
                                } catch (error) {
                                    if (callerCanceled()) {
                                        throw createAbortError(lastTask);
                                    }
                                    if (failureStopRequested() || libraryFailureStopRequested()) {
                                        return null;
                                    }
                                    console.warn(`Failed to fetch actors for ${library.title}:`, summarizeErrorForLog(error));
                                    return buildRequiredTagDirectoryFailure('Actors', library.title, detailType, 'error', error);
                                }
                            })());
                        }

                        if (nativeFacetTasks.length > 0) {
                            reportSnapshotProgress('scan_library_items', 'Resolving filters...', library.title, libIndex, selectedLibraries.length);
                            const settledFacetTasks = nativeFacetTasks.map((task, facetIndex) =>
                                task.then((result) => ({ facetIndex, result }))
                            );
                            const pendingFacetIndexes = new Set(settledFacetTasks.map((_, facetIndex) => facetIndex));
                            let libraryFailure: ChannelSetupFacetSnapshot | null = null;
                            while (pendingFacetIndexes.size > 0) {
                                const settled = await Promise.race(
                                    Array.from(pendingFacetIndexes, (facetIndex) => settledFacetTasks[facetIndex])
                                );
                                if (!settled) {
                                    break;
                                }
                                pendingFacetIndexes.delete(settled.facetIndex);
                                if (settled.result) {
                                    libraryFailure = settled.result;
                                    abortLibraryFacetRequests();
                                    break;
                                }
                            }
                            if (libraryFailure) {
                                void Promise.allSettled(nativeFacetTasks);
                                firstFailure = firstFailure ?? libraryFailure;
                                abortSiblingRequests();
                                return libraryFailure;
                            }
                        }
                    } finally {
                        removeLibrarySignalForwarder?.();
                    }
                }
                return null;
            });
            const workerResults = await Promise.all(libraryWorkers);
            const libraryFailure = firstFailure
                ?? workerResults.find((value): value is ChannelSetupFacetSnapshot => value !== null);
            if (libraryFailure) {
                return libraryFailure;
            }

            return {
                status: 'ready',
                ...snapshotData(errorsTotal > 0),
            };
        } finally {
            removeSignalForwarder?.();
        }
    }
}

export class ChannelSetupPlanningService {
    private readonly _facetSnapshotLoader: ChannelSetupFacetSnapshotLoader;

    constructor(private readonly _deps: ChannelSetupPlanningServiceDeps) {
        this._facetSnapshotLoader = new ChannelSetupFacetSnapshotLoader(this._deps);
    }

    async getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibraryType[]> {
        const libraries = await this._deps.plexLibrary.getLibraries({
            signal: signal ?? null,
            includeItemCounts: true,
            itemCountConcurrency: 4,
        });
        return libraries.filter((lib) => lib.type === 'movie' || lib.type === 'show');
    }

    normalizeConfig(config: ChannelSetupConfig): ChannelSetupConfig {
        const maxChannels = Number.isFinite(config.maxChannels)
            ? Math.min(Math.max(Math.floor(config.maxChannels), 1), MAX_CHANNELS)
            : DEFAULT_CHANNEL_SETUP_MAX;
        const minItemsPerChannel = Number.isFinite(config.minItemsPerChannel)
            ? Math.max(1, Math.floor(config.minItemsPerChannel))
            : DEFAULT_MIN_ITEMS_PER_CHANNEL;
        const buildMode = config.buildMode ?? 'replace';
        const actorStudioCombineMode = config.actorStudioCombineMode ?? 'separate';
        const strategyConfig = SELECTABLE_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, SetupStrategyConfig>>((acc, key) => {
            const candidate = config.strategyConfig[key];
            const enabled = typeof candidate?.enabled === 'boolean' ? candidate.enabled : true;
            const priority = Number.isFinite(candidate?.priority)
                ? Math.max(1, Math.floor(Number(candidate.priority)))
                : DEFAULT_STRATEGY_PRIORITIES[key];
            const scope = MIXED_SCOPE_STRATEGY_KEYS.has(key) && candidate?.scope === 'cross-library'
                ? 'cross-library'
                : 'per-library';
            acc[key] = { enabled, priority, scope };
            return acc;
        }, {} as Record<SetupStrategyKey, SetupStrategyConfig>);
        const channelExpansion = this._normalizeChannelExpansion(config.channelExpansion);
        const seriesOrdering = this._normalizeSeriesOrdering(config.seriesOrdering);
        return {
            ...config,
            maxChannels,
            minItemsPerChannel,
            buildMode,
            actorStudioCombineMode,
            strategyConfig,
            channelExpansion,
            seriesOrdering,
        };
    }

    async getSetupPreview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPreview> {
        const normalizedConfig = this.normalizeConfig(config);
        const libraries = await this.getLibrariesForSetup(options?.signal ?? null);
        const planResult = await this.buildSetupPlan(
            normalizedConfig,
            libraries,
            options?.signal ?? null,
            'preview'
        );
        if (planResult.canceled || !planResult.plan) {
            return {
                estimates: this._emptyEstimates(),
                warnings: [...planResult.warnings],
                reachedMaxChannels: false,
                ...(planResult.previewStatus ? { status: planResult.previewStatus } : {}),
                ...(planResult.blockedMessage ? { message: planResult.blockedMessage } : {}),
                ...(planResult.failureReason ? { failureReason: planResult.failureReason } : {}),
            };
        }
        return {
            estimates: planResult.plan.estimates,
            warnings: planResult.plan.warnings,
            reachedMaxChannels: planResult.plan.reachedMaxChannels,
            status: 'ready',
        };
    }

    async getSetupReview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupReview> {
        const normalizedConfig = this.normalizeConfig(config);
        const libraries = await this.getLibrariesForSetup(options?.signal ?? null);
        const planResult = await this.buildSetupPlan(
            normalizedConfig,
            libraries,
            options?.signal ?? null,
            'build'
        );
        if (planResult.canceled || !planResult.plan) {
            return {
                preview: {
                    estimates: this._emptyEstimates(),
                    warnings: [...planResult.warnings],
                    reachedMaxChannels: false,
                    ...(planResult.previewStatus ? { status: planResult.previewStatus } : {}),
                    ...(planResult.blockedMessage ? { message: planResult.blockedMessage } : {}),
                    ...(planResult.failureReason ? { failureReason: planResult.failureReason } : {}),
                },
                diff: { summary: { created: 0, removed: 0, unchanged: 0 }, samples: { created: [], removed: [], unchanged: [] } },
            };
        }
        const existingChannels = this._deps.channelManager.getAllChannels();
        const diff = diffChannelPlans(existingChannels, planResult.plan.pendingChannels);
        const normalizedDiff = this._normalizeDiffForMode(diff, normalizedConfig.buildMode);
        return {
            preview: {
                estimates: planResult.plan.estimates,
                warnings: planResult.plan.warnings,
                reachedMaxChannels: planResult.plan.reachedMaxChannels,
            },
            diff: normalizedDiff,
        };
    }

    async buildSetupPlan(
        config: ChannelSetupConfig,
        libraries: PlexLibraryType[],
        signal: AbortSignal | null,
        intent: ChannelSetupPlanningIntent,
        reportProgress?: (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ) => void
    ): Promise<ChannelSetupPlanBuildResult> {
        let snapshot: ChannelSetupFacetSnapshot;
        try {
            const snapshotOptions: {
                signal: AbortSignal | null;
                requestIntent: PlexLibraryRequestIntent;
                reportProgress?: (
                    task: ChannelBuildProgress['task'],
                    label: string,
                    detail: string,
                    current: number,
                    total: number | null
                ) => void;
                detachFromSignal: boolean;
            } = {
                signal,
                requestIntent: this._getPlexRequestIntentProfile(intent),
                detachFromSignal: reportProgress === undefined,
            };
            if (reportProgress) {
                snapshotOptions.reportProgress = reportProgress;
            }
            snapshot = await this._facetSnapshotLoader.loadSnapshot(config, libraries, intent, snapshotOptions);
        } catch (error) {
            if (signal?.aborted) {
                if (reportProgress === undefined) {
                    throw error;
                }
                const abortedTask = getAbortErrorTask(error);
                return {
                    plan: null,
                    warnings: [],
                    canceled: true,
                    lastTask: abortedTask ?? 'scan_library_items',
                    errorsTotal: 0,
                    playlistMs: 0,
                    collectionsMs: 0,
                    libraryQueryMs: 0,
                };
            }
            throw error;
        }

        if (snapshot.status !== 'ready') {
            return {
                plan: null,
                warnings: snapshot.warnings,
                canceled: false,
                blockedMessage: snapshot.message,
                previewStatus: snapshot.status,
                failureReason: snapshot.failureReason,
                lastTask: 'scan_library_items',
                errorsTotal: snapshot.errorsTotal,
                playlistMs: snapshot.playlistMs,
                collectionsMs: snapshot.collectionsMs,
                libraryQueryMs: snapshot.libraryQueryMs,
            };
        }

        const plan = buildChannelSetupPlan({
            config,
            libraries,
            playlists: snapshot.playlists,
            collectionsByLibraryId: snapshot.collectionsByLibraryId,
            genresByLibraryId: snapshot.genresByLibraryId,
            directorsByLibraryId: snapshot.directorsByLibraryId,
            yearsByLibraryId: snapshot.yearsByLibraryId,
            actorsByLibraryId: snapshot.actorsByLibraryId,
            studiosByLibraryId: snapshot.studiosByLibraryId,
            warnings: snapshot.warnings,
            seedFor: (value: string): number => this._hashSeed(value),
        });

        return {
            plan,
            warnings: snapshot.warnings,
            canceled: false,
            errorsTotal: snapshot.errorsTotal,
            playlistMs: snapshot.playlistMs,
            collectionsMs: snapshot.collectionsMs,
            libraryQueryMs: snapshot.libraryQueryMs,
        };
    }

    invalidateFacetSnapshot(): void {
        this._facetSnapshotLoader.invalidate();
    }

    getPendingChannelsForMode(
        buildMode: ChannelSetupConfig['buildMode'],
        pending: PendingChannel[],
        diff: ChannelDiffResult
    ): PendingChannel[] {
        if (buildMode === 'replace') {
            return pending;
        }
        const matchedCounts = new Map<string, number>();
        for (const pair of diff.matchedPairs) {
            const key = createChannelIdentityKey(pair.planned);
            matchedCounts.set(key, (matchedCounts.get(key) ?? 0) + 1);
        }
        const result: PendingChannel[] = [];
        for (const p of pending) {
            const key = createChannelIdentityKey(p);
            const remaining = matchedCounts.get(key) ?? 0;
            if (remaining > 0) {
                matchedCounts.set(key, remaining - 1);
                continue;
            }
            result.push(p);
        }
        return result;
    }

    private _normalizeChannelExpansion(expansion: ChannelExpansionConfig | undefined): ChannelExpansionConfig {
        const addAlternateLineups = expansion?.addAlternateLineups === true;
        const alternateLineupCopies = Number.isFinite(expansion?.alternateLineupCopies)
            ? Math.min(3, Math.max(1, Math.floor(Number(expansion?.alternateLineupCopies))))
            : DEFAULT_CHANNEL_EXPANSION.alternateLineupCopies;
        const variantType =
            expansion?.variantType === 'sequential' || expansion?.variantType === 'block'
                ? expansion.variantType
                : 'none';
        const variantBlockSize = Number.isFinite(expansion?.variantBlockSize)
            ? Math.min(5, Math.max(2, Math.floor(Number(expansion?.variantBlockSize))))
            : DEFAULT_CHANNEL_EXPANSION.variantBlockSize;
        return {
            addAlternateLineups,
            alternateLineupCopies,
            variantType,
            variantBlockSize,
        };
    }

    private _normalizeSeriesOrdering(value: SeriesOrderingConfig | undefined): SeriesOrderingConfig {
        const basePlaybackMode =
            value?.basePlaybackMode === 'sequential' || value?.basePlaybackMode === 'block'
                ? value.basePlaybackMode
                : 'shuffle';
        const baseBlockSize = Number.isFinite(value?.baseBlockSize)
            ? Math.min(5, Math.max(2, Math.floor(Number(value?.baseBlockSize))))
            : DEFAULT_SERIES_ORDERING.baseBlockSize;
        return {
            basePlaybackMode,
            baseBlockSize,
        };
    }

    private _getPlexRequestIntentProfile(
        intent: ChannelSetupPlanningIntent
    ): PlexLibraryRequestIntent {
        return intent === 'preview' ? 'preview' : 'background';
    }

    private _emptyEstimates(): ChannelSetupPreview['estimates'] {
        return {
            total: 0,
            collections: 0,
            playlists: 0,
            genres: 0,
            directors: 0,
            decades: 0,
            recentlyAdded: 0,
            studios: 0,
            actors: 0,
        };
    }

    private _normalizeDiffForMode(
        diff: ChannelDiffResult,
        buildMode: ChannelSetupConfig['buildMode']
    ): ChannelSetupReview['diff'] {
        if (buildMode === 'replace') {
            return {
                summary: diff.summary,
                samples: diff.samples,
            };
        }
        const unchanged = [...diff.unchanged, ...diff.removed];
        const summary = {
            created: diff.created.length,
            removed: 0,
            unchanged: unchanged.length,
        };
        const samples = {
            created: diff.created.slice(0, 6).map((c) => c.name),
            removed: [],
            unchanged: unchanged.slice(0, 6).map((c) => c.name),
        };
        return { summary, samples };
    }

    private _hashSeed(value: string): number {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }
}

function summarizeErrorForLog(error: unknown): { name?: string; code?: unknown; message?: string } {
    if (!error || typeof error !== 'object') return {};
    const e = error as { name?: unknown; code?: unknown; message?: unknown };
    return {
        ...(typeof e.name === 'string' ? { name: e.name } : {}),
        ...('code' in e ? { code: e.code } : {}),
        ...(typeof e.message === 'string' ? { message: redactSensitiveTokens(e.message) } : {}),
    };
}

function createAbortError(lastTask?: ChannelBuildProgress['task']): DOMException & { lastTask?: ChannelBuildProgress['task'] } {
    const error = new DOMException('Aborted', 'AbortError') as DOMException & { lastTask?: ChannelBuildProgress['task'] };
    if (lastTask !== undefined) {
        error.lastTask = lastTask;
    }
    return error;
}

function getAbortErrorTask(error: unknown): ChannelBuildProgress['task'] | undefined {
    if (!error || typeof error !== 'object' || !('lastTask' in error)) {
        return undefined;
    }
    const { lastTask } = error as { lastTask?: unknown };
    return typeof lastTask === 'string' ? lastTask as ChannelBuildProgress['task'] : undefined;
}
