import type {
    IPlexLibrary,
    PlexLibraryType,
    PlexTagDirectoryItem,
    PlexPlaylist,
    PlexCollection,
    PlexTagDirectoryUnsupportedReason,
} from '../../modules/plex/library';
import {
    getPlexRequestIntentForChannelSetup,
    getTagDirectoryMediaTypesForLibraryType,
} from '../../modules/plex/library';
import { summarizeErrorForLog } from '../../utils/errors';
import type { ChannelBuildProgress, ChannelSetupConfig, ChannelSetupPreviewFailureReason } from './types';
import { isSignalAborted } from './utils';
import { buildChannelSetupFacetCountFilter } from './ChannelSetupTagFilters';

export type ChannelSetupPlanningIntent = 'preview' | 'build';
export type ChannelSetupPlexRequestIntent = ReturnType<typeof getPlexRequestIntentForChannelSetup>;

export interface ChannelSetupFacetSnapshotLoaderDeps {
    plexLibrary: IPlexLibrary;
}

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
type ChannelSetupRequiredTagDirectoryLabel = 'Genres' | 'Directors' | 'Years' | 'Actors' | 'Studios';
type ChannelSetupNativeFacetFamily = 'genres' | 'directors' | 'decades' | 'actors' | 'studios';
type DeferredEmptyTagDirectoryFailure = {
    family: ChannelSetupNativeFacetFamily;
    label: ChannelSetupRequiredTagDirectoryLabel;
    libraryTitle: string;
    type: number;
};

const MAX_FACET_LIBRARY_CONCURRENCY = 2;
const MAX_FACET_COUNT_RECOVERY_CONCURRENCY = 8;

export class ChannelSetupPlanningError extends Error {
    public readonly code: 'COUNT_UNAVAILABLE' = 'COUNT_UNAVAILABLE';

    constructor(message: string) {
        super(message);
        this.name = 'ChannelSetupPlanningError';
    }
}

export function assertRecoveredTagCount(
    count: number | null,
    family: 'genre' | 'director' | 'year' | 'actor' | 'studio',
    tagTitle: string
): number {
    if (count === null) {
        throw new ChannelSetupPlanningError(`${family} count unavailable for ${tagTitle}`);
    }
    return count;
}

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
        libraries: PlexLibraryType[],
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
        const facetFamiliesWithEntries = new Set<ChannelSetupNativeFacetFamily>();
        const deferredEmptyTagDirectoryFailures: DeferredEmptyTagDirectoryFailure[] = [];

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
            const summaryObject = typeof summary === 'object' && summary !== null
                ? summary as { message?: unknown; code?: unknown }
                : {};
            const message = typeof summaryObject.message === 'string'
                ? summaryObject.message
                : summaryObject.code !== undefined
                    ? String(summaryObject.code)
                    : 'unknown error';
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
            label: ChannelSetupRequiredTagDirectoryLabel,
            libraryTitle: string,
            type: number,
            reason: PlexTagDirectoryUnsupportedReason | 'error',
            error?: unknown
        ): ChannelSetupFacetSnapshot => {
            const baseLabel = label.toLowerCase();
            if (reason === 'error') {
                const summary = summarizeErrorForLog(error);
                const summaryObject = typeof summary === 'object' && summary !== null
                    ? summary as { message?: unknown; code?: unknown }
                    : {};
                const detail = typeof summaryObject.message === 'string'
                    ? summaryObject.message
                    : summaryObject.code !== undefined
                        ? String(summaryObject.code)
                        : 'unknown error';
                if (summaryObject.code === 'NETWORK_TIMEOUT') {
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

        const buildRequiredTagCountRecoveryFailure = (
            label: ChannelSetupRequiredTagDirectoryLabel,
            libraryTitle: string,
            type: number,
            error: unknown
        ): ChannelSetupFacetSnapshot => {
            const baseLabel = label.toLowerCase();
            const summary = summarizeErrorForLog(error);
            const summaryObject = typeof summary === 'object' && summary !== null
                ? summary as { message?: unknown; code?: unknown }
                : {};
            const detail = typeof summaryObject.message === 'string'
                ? summaryObject.message
                : summaryObject.code !== undefined
                    ? String(summaryObject.code)
                    : 'unknown error';
            if (summaryObject.code === 'NETWORK_TIMEOUT') {
                return buildFailureSnapshot(
                    'slow',
                    `Required ${baseLabel} item counts (type=${type}) timed out for ${libraryTitle}; try again after Plex responds.`,
                    'timeout'
                );
            }
            return buildFailureSnapshot(
                'blocked',
                `Required ${baseLabel} item counts (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`,
                'error'
            );
        };

        const markFacetEntries = (
            family: ChannelSetupNativeFacetFamily,
            tags: PlexTagDirectoryItem[]
        ): void => {
            if (tags.length > 0) {
                facetFamiliesWithEntries.add(family);
            }
        };

        const deferEmptyTagDirectoryFailure = (
            family: ChannelSetupNativeFacetFamily,
            label: ChannelSetupRequiredTagDirectoryLabel,
            libraryTitle: string,
            type: number
        ): void => {
            deferredEmptyTagDirectoryFailures.push({ family, label, libraryTitle, type });
        };

        const compareDeferredEmptyTagDirectoryFailures = (
            left: DeferredEmptyTagDirectoryFailure,
            right: DeferredEmptyTagDirectoryFailure
        ): number => {
            const familyDiff = left.family.localeCompare(right.family);
            if (familyDiff !== 0) return familyDiff;

            const labelDiff = left.label.localeCompare(right.label);
            if (labelDiff !== 0) return labelDiff;

            const titleDiff = left.libraryTitle.localeCompare(right.libraryTitle);
            if (titleDiff !== 0) return titleDiff;

            return left.type - right.type;
        };

        const resolveDeferredEmptyTagDirectoryFailure = (): ChannelSetupFacetSnapshot | null => {
            const orderedFailures = [...deferredEmptyTagDirectoryFailures].sort(compareDeferredEmptyTagDirectoryFailures);

            for (const failure of orderedFailures) {
                if (!facetFamiliesWithEntries.has(failure.family)) {
                    return buildRequiredTagDirectoryFailure(
                        failure.label,
                        failure.libraryTitle,
                        failure.type,
                        'empty'
                    );
                }
            }
            return null;
        };

        const recoverUnknownTagCounts = async (
            libraryId: string,
            mediaType: number,
            family: 'genre' | 'director' | 'year' | 'actor' | 'studio',
            tags: PlexTagDirectoryItem[],
            tagSignal: AbortSignal
        ): Promise<PlexTagDirectoryItem[]> => {
            const unknownIndexes = tags
                .map((tag, index) => (tag.count === null ? index : -1))
                .filter((index) => index >= 0);
            if (unknownIndexes.length === 0) {
                return tags;
            }

            const hydratedTags = [...tags];
            const workerCount = Math.min(MAX_FACET_COUNT_RECOVERY_CONCURRENCY, unknownIndexes.length);
            const queue = [...unknownIndexes];
            const workers = Array.from({ length: workerCount }, async (): Promise<void> => {
                while (queue.length > 0) {
                    if (tagSignal.aborted) {
                        return;
                    }
                    const tagIndex = queue.shift();
                    if (tagIndex === undefined) {
                        return;
                    }
                    const tag = hydratedTags[tagIndex];
                    if (!tag || tag.count !== null) {
                        continue;
                    }
                    const countStart = performance.now();
                    let count: number | null;
                    try {
                        count = await this._deps.plexLibrary.getLibraryItemCount(libraryId, {
                            filter: buildChannelSetupFacetCountFilter(tag, family, mediaType),
                            signal: tagSignal,
                        });
                    } finally {
                        libraryQueryMs += performance.now() - countStart;
                    }
                    hydratedTags[tagIndex] = {
                        ...tag,
                        count: assertRecoveredTagCount(count, family, tag.title),
                    };
                }
            });
            await Promise.all(workers);
            return hydratedTags;
        };

        try {
            if (config.strategyConfig.playlists.enabled) {
                reportSnapshotProgress('fetch_playlists', 'Fetching playlists...', 'Scanning server', 0, null);
                try {
                    const playlistsStart = performance.now();
                    const fetched = await this._deps.plexLibrary.getPlaylists({
                        signal: requestSignal,
                        requestIntent,
                    });
                    playlistMs += performance.now() - playlistsStart;
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
                    if (requestSignal.aborted && !failureAbortActive) {
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
                            const collectionsStart = performance.now();
                            const collections = await this._deps.plexLibrary.getCollections(library.id, {
                                signal: requestSignal,
                                requestIntent,
                            });
                            collectionsMs += performance.now() - collectionsStart;
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

                    const { genreType, detailType } = getTagDirectoryMediaTypesForLibraryType(library.type);
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
                                    const tagStart = performance.now();
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
                                    libraryQueryMs += performance.now() - tagStart;
                                    if (unsupportedReason === 'empty') {
                                        genresByLibraryId.set(library.id, genres);
                                        deferEmptyTagDirectoryFailure('genres', 'Genres', library.title, genreType);
                                        return null;
                                    }
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Genres', library.title, genreType, unsupportedReason);
                                    }
                                    markFacetEntries('genres', genres);
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
                                    const tagStart = performance.now();
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
                                    libraryQueryMs += performance.now() - tagStart;
                                    if (unsupportedReason === 'empty') {
                                        directorsByLibraryId.set(library.id, directors);
                                        deferEmptyTagDirectoryFailure('directors', 'Directors', library.title, detailType);
                                        return null;
                                    }
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Directors', library.title, detailType, unsupportedReason);
                                    }
                                    markFacetEntries('directors', directors);
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
                                    const tagStart = performance.now();
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
                                    libraryQueryMs += performance.now() - tagStart;
                                    if (unsupportedReason === 'empty') {
                                        yearsByLibraryId.set(library.id, years);
                                        deferEmptyTagDirectoryFailure('decades', 'Years', library.title, detailType);
                                        return null;
                                    }
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Years', library.title, detailType, unsupportedReason);
                                    }
                                    markFacetEntries('decades', years);
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
                                    const studiosStart = performance.now();
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
                                    libraryQueryMs += performance.now() - studiosStart;
                                    if (unsupportedReason === 'empty') {
                                        studiosByLibraryId.set(library.id, studios);
                                        deferEmptyTagDirectoryFailure('studios', 'Studios', library.title, detailType);
                                        return null;
                                    }
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Studios', library.title, detailType, unsupportedReason);
                                    }
                                    markFacetEntries('studios', studios);
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
                                    const actorsStart = performance.now();
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
                                    libraryQueryMs += performance.now() - actorsStart;
                                    if (unsupportedReason === 'empty') {
                                        actorsByLibraryId.set(library.id, actors);
                                        deferEmptyTagDirectoryFailure('actors', 'Actors', library.title, detailType);
                                        return null;
                                    }
                                    if (unsupportedReason) {
                                        return buildRequiredTagDirectoryFailure('Actors', library.title, detailType, unsupportedReason);
                                    }
                                    markFacetEntries('actors', actors);
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
                                if (requestSignal.aborted && !failureAbortActive) {
                                    throw createAbortError(lastTask);
                                }
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

                            const recoverAndStoreFacetCounts = async (
                                label: ChannelSetupRequiredTagDirectoryLabel,
                                mediaType: number,
                                family: 'genre' | 'director' | 'year' | 'actor' | 'studio',
                                tagsByLibraryId: Map<string, PlexTagDirectoryItem[]>
                            ): Promise<ChannelSetupFacetSnapshot | null> => {
                                const tags = tagsByLibraryId.get(library.id) ?? [];
                                if (tags.length === 0 || tags.every((tag) => tag.count !== null)) {
                                    return null;
                                }
                                try {
                                    const hydrated = await recoverUnknownTagCounts(
                                        library.id,
                                        mediaType,
                                        family,
                                        tags,
                                        librarySignal
                                    );
                                    tagsByLibraryId.set(library.id, hydrated);
                                    return null;
                                } catch (error) {
                                    if (callerCanceled()) {
                                        throw createAbortError(lastTask);
                                    }
                                    if (failureStopRequested() || libraryFailureStopRequested()) {
                                        return null;
                                    }
                                    console.warn(`Failed to recover ${family} counts for ${library.title}:`, summarizeErrorForLog(error));
                                    return buildRequiredTagCountRecoveryFailure(label, library.title, mediaType, error);
                                }
                            };

                            const countRecoveryFailure = await recoverAndStoreFacetCounts('Genres', genreType, 'genre', genresByLibraryId)
                                ?? await recoverAndStoreFacetCounts('Directors', detailType, 'director', directorsByLibraryId)
                                ?? await recoverAndStoreFacetCounts('Years', detailType, 'year', yearsByLibraryId)
                                ?? await recoverAndStoreFacetCounts('Studios', detailType, 'studio', studiosByLibraryId)
                                ?? await recoverAndStoreFacetCounts('Actors', detailType, 'actor', actorsByLibraryId);
                            if (countRecoveryFailure) {
                                firstFailure = firstFailure ?? countRecoveryFailure;
                                abortSiblingRequests();
                                return countRecoveryFailure;
                            }
                        }
                    } finally {
                        removeLibrarySignalForwarder?.();
                    }
                }
                return null;
            });
            const workerResults = await Promise.all(libraryWorkers);
            if (requestSignal.aborted && !failureAbortActive) {
                throw createAbortError(lastTask);
            }
            const libraryFailure = firstFailure
                ?? workerResults.find((value): value is ChannelSetupFacetSnapshot => value !== null);
            if (libraryFailure) {
                return libraryFailure;
            }
            const deferredEmptyFailure = resolveDeferredEmptyTagDirectoryFailure();
            if (deferredEmptyFailure) {
                return deferredEmptyFailure;
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

function createAbortError(lastTask?: ChannelBuildProgress['task']): DOMException & { lastTask?: ChannelBuildProgress['task'] } {
    const error = new DOMException('Aborted', 'AbortError') as DOMException & { lastTask?: ChannelBuildProgress['task'] };
    if (lastTask !== undefined) {
        error.lastTask = lastTask;
    }
    return error;
}
