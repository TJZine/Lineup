import type {
    IPlexLibrary,
    PlexCollection,
    PlexLibrarySection,
    PlexPlaylist,
    PlexTagDirectoryItem,
    PlexTagDirectoryUnsupportedReason,
} from '../../../modules/plex/library';
import { getTagDirectoryMediaTypesForLibraryType } from '../../../modules/plex/library';
import { summarizeErrorForLog } from '../../../utils/errors';
import type { ChannelBuildProgress, ChannelSetupConfig } from '../types';
import { isSignalAborted } from '../shared/utils';
import { createAbortError } from './ChannelSetupFacetSnapshotAbort';
import {
    ChannelSetupFacetCountRecoveryWorker,
    type ChannelSetupFacetCountRecoveryFamily,
    type FacetCountRecoveryLimiter,
} from './ChannelSetupFacetCountRecoveryWorker';
import {
    ChannelSetupFacetSnapshotFailureBuilder,
    type ChannelSetupRequiredTagDirectoryLabel,
} from './ChannelSetupFacetSnapshotFailures';
import type {
    ChannelSetupFacetMap,
    ChannelSetupFacetSnapshot,
    ChannelSetupFacetSnapshotData,
    ChannelSetupPlexRequestIntent,
} from './ChannelSetupPlanningTypes';

type ChannelSetupNativeFacetFamily = 'genres' | 'directors' | 'decades' | 'actors' | 'studios';

type DeferredEmptyTagDirectoryFailure = {
    family: ChannelSetupNativeFacetFamily;
    label: ChannelSetupRequiredTagDirectoryLabel;
    libraryTitle: string;
    type: number;
};

type NativeFacetTaskDefinition = {
    family: ChannelSetupNativeFacetFamily;
    label: ChannelSetupRequiredTagDirectoryLabel;
    mediaType: number;
    countRecoveryFamily: ChannelSetupFacetCountRecoveryFamily;
    tagsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    fetchTags: (
        options: {
            signal: AbortSignal;
            requireEntries: boolean;
            requestIntent: ChannelSetupPlexRequestIntent;
            onUnsupported: (reason: PlexTagDirectoryUnsupportedReason) => void;
        }
    ) => Promise<PlexTagDirectoryItem[]>;
};

type ChannelSetupFacetSnapshotLoadSessionOptions = {
    plexLibrary: IPlexLibrary;
    config: ChannelSetupConfig;
    libraries: PlexLibrarySection[];
    signal: AbortSignal | null;
    requestIntent: ChannelSetupPlexRequestIntent;
    snapshotAbortController: AbortController;
    reportProgress: ((
        task: ChannelBuildProgress['task'],
        label: string,
        detail: string,
        current: number,
        total: number | null
    ) => void) | undefined;
};

const MAX_FACET_LIBRARY_CONCURRENCY = 2;
const MAX_FACET_COUNT_RECOVERY_CONCURRENCY = 8;

function createReadonlyFacetMap<T>(source: Map<string, T[]>): ChannelSetupFacetMap<T> {
    const snapshot = new Map<string, readonly T[]>();
    for (const [libraryId, values] of source.entries()) {
        snapshot.set(libraryId, Object.freeze([...values]));
    }
    const readonlyMap: ChannelSetupFacetMap<T> = {
        get size() {
            return snapshot.size;
        },
        get: (key: string): readonly T[] | undefined => snapshot.get(key),
        has: (key: string): boolean => snapshot.has(key),
        entries: (): MapIterator<[string, readonly T[]]> => snapshot.entries(),
        keys: (): MapIterator<string> => snapshot.keys(),
        values: (): MapIterator<readonly T[]> => snapshot.values(),
        forEach: (
            callbackfn: (value: readonly T[], key: string, map: ReadonlyMap<string, readonly T[]>) => void,
            thisArg?: unknown
        ): void => {
            snapshot.forEach((value, key) => {
                callbackfn.call(thisArg, value, key, readonlyMap);
            });
        },
        [Symbol.iterator]: (): MapIterator<[string, readonly T[]]> => snapshot[Symbol.iterator](),
    };
    return Object.freeze(readonlyMap);
}

class ChannelSetupFacetSnapshotDataAccumulator {
    readonly playlists: PlexPlaylist[] = [];
    readonly collectionsByLibraryId = new Map<string, PlexCollection[]>();
    readonly genresByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    readonly directorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    readonly yearsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    readonly actorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    readonly studiosByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    private readonly _warnings = new Set<string>();
    private readonly _facetFamiliesWithEntries = new Set<ChannelSetupNativeFacetFamily>();
    private readonly _deferredEmptyTagDirectoryFailures: DeferredEmptyTagDirectoryFailure[] = [];
    errorsTotal = 0;
    playlistMs = 0;
    collectionsMs = 0;
    libraryQueryMs = 0;

    addPartialWarning(task: ChannelBuildProgress['task'], detail: string, error: unknown): void {
        const summaryObject = getErrorSummaryObject(error);
        const message = typeof summaryObject.message === 'string'
            ? summaryObject.message
            : summaryObject.code !== undefined
                ? String(summaryObject.code)
                : 'unknown error';
        this._warnings.add(`Partial setup plan (${task}): ${detail} (${message})`);
    }

    addWarning(message: string): void {
        this._warnings.add(message);
    }

    markFacetEntries(family: ChannelSetupNativeFacetFamily, tags: PlexTagDirectoryItem[]): void {
        if (tags.length > 0) {
            this._facetFamiliesWithEntries.add(family);
        }
    }

    deferEmptyTagDirectoryFailure(
        family: ChannelSetupNativeFacetFamily,
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number
    ): void {
        this._deferredEmptyTagDirectoryFailures.push({ family, label, libraryTitle, type });
    }

    resolveDeferredEmptyTagDirectoryFailure(): DeferredEmptyTagDirectoryFailure | null {
        const orderedFailures = [...this._deferredEmptyTagDirectoryFailures]
            .sort(compareDeferredEmptyTagDirectoryFailures);

        for (const failure of orderedFailures) {
            if (!this._facetFamiliesWithEntries.has(failure.family)) {
                return failure;
            }
        }
        return null;
    }

    snapshotData(
        hasTransientLoadFailure: boolean,
        lastTask: ChannelBuildProgress['task'] | undefined
    ): ChannelSetupFacetSnapshotData {
        return {
            playlists: Object.freeze([...this.playlists]),
            collectionsByLibraryId: createReadonlyFacetMap(this.collectionsByLibraryId),
            genresByLibraryId: createReadonlyFacetMap(this.genresByLibraryId),
            directorsByLibraryId: createReadonlyFacetMap(this.directorsByLibraryId),
            yearsByLibraryId: createReadonlyFacetMap(this.yearsByLibraryId),
            actorsByLibraryId: createReadonlyFacetMap(this.actorsByLibraryId),
            studiosByLibraryId: createReadonlyFacetMap(this.studiosByLibraryId),
            warnings: Object.freeze(Array.from(this._warnings).sort((a, b) => a.localeCompare(b))),
            hasTransientLoadFailure,
            errorsTotal: this.errorsTotal,
            playlistMs: this.playlistMs,
            collectionsMs: this.collectionsMs,
            libraryQueryMs: this.libraryQueryMs,
            ...(lastTask !== undefined ? { lastTask } : {}),
        };
    }
}

class ChannelSetupFacetSnapshotLibraryQueue {
    private readonly _queue: Array<{ library: PlexLibrarySection; index: number }>;

    constructor(selectedLibraries: PlexLibrarySection[]) {
        this._queue = selectedLibraries.map((library, index) => ({ library, index }));
    }

    get workerCount(): number {
        return Math.min(MAX_FACET_LIBRARY_CONCURRENCY, this._queue.length);
    }

    next(): { library: PlexLibrarySection; index: number } | null {
        return this._queue.shift() ?? null;
    }

    get hasPending(): boolean {
        return this._queue.length > 0;
    }
}

export class ChannelSetupFacetSnapshotLoadSession {
    private readonly _selectedLibraries: PlexLibrarySection[];
    private readonly _snapshotDataAccumulator = new ChannelSetupFacetSnapshotDataAccumulator();
    private readonly _failureBuilder = new ChannelSetupFacetSnapshotFailureBuilder({
        addWarning: (message): void => this._snapshotDataAccumulator.addWarning(message),
        incrementErrors: (): void => {
            this._snapshotDataAccumulator.errorsTotal++;
        },
        snapshotData: (hasTransientLoadFailure): ChannelSetupFacetSnapshotData =>
            this._snapshotData(hasTransientLoadFailure),
    });
    private _lastTask: ChannelBuildProgress['task'] | undefined;
    private _shouldStop = false;
    private _firstFailure: ChannelSetupFacetSnapshot | null = null;
    private _failureAbortActive = false;
    private readonly _requestSignal: AbortSignal;
    private _removeSignalForwarder: (() => void) | null = null;

    constructor(private readonly _options: ChannelSetupFacetSnapshotLoadSessionOptions) {
        this._selectedLibraries = _options.libraries
            .filter((lib) => _options.config.selectedLibraryIds.includes(lib.id))
            .sort((a, b) => {
                const titleDiff = a.title.localeCompare(b.title);
                if (titleDiff !== 0) return titleDiff;
                return a.id.localeCompare(b.id);
            });
        this._requestSignal = _options.snapshotAbortController.signal;
        this._forwardCallerAbort();
    }

    async load(): Promise<ChannelSetupFacetSnapshot> {
        try {
            if (this._options.config.strategyConfig.playlists.enabled) {
                await this._loadPlaylists();
            }
            const workerResults = await Promise.all(this._createLibraryWorkers());
            if (this._requestSignal.aborted && !this._failureAbortActive) {
                throw createAbortError(this._lastTask);
            }
            const libraryFailure = this._firstFailure
                ?? workerResults.find((value): value is ChannelSetupFacetSnapshot => value !== null);
            if (libraryFailure) {
                return libraryFailure;
            }
            const deferredEmptyFailure = this._resolveDeferredEmptyTagDirectoryFailure();
            if (deferredEmptyFailure) {
                return deferredEmptyFailure;
            }

            return {
                status: 'ready',
                ...this._snapshotData(this._snapshotDataAccumulator.errorsTotal > 0),
            };
        } finally {
            this._removeSignalForwarder?.();
        }
    }

    private _forwardCallerAbort(): void {
        const { signal, snapshotAbortController } = this._options;
        if (!signal) {
            return;
        }
        if (signal.aborted) {
            snapshotAbortController.abort();
            return;
        }
        const onAbort = (): void => {
            snapshotAbortController.abort();
        };
        signal.addEventListener('abort', onAbort, { once: true });
        this._removeSignalForwarder = (): void => {
            signal.removeEventListener('abort', onAbort);
        };
    }

    private async _loadPlaylists(): Promise<void> {
        this._reportSnapshotProgress('fetch_playlists', 'Fetching playlists...', 'Scanning server', 0, null);
        const playlistsStart = performance.now();
        try {
            const fetched = await this._options.plexLibrary.getPlaylists({
                signal: this._requestSignal,
                requestIntent: this._options.requestIntent,
            });
            this._snapshotDataAccumulator.playlists.push(...fetched);
        } catch (error) {
            if (this._callerCanceled()) {
                throw createAbortError(this._lastTask);
            }
            if (this._failureStopRequested()) {
                return;
            }
            console.warn('Failed to fetch playlists:', summarizeErrorForLog(error));
            this._addPartialWarning('fetch_playlists', 'fetch_playlists failed', error);
            this._snapshotDataAccumulator.errorsTotal++;
        } finally {
            this._snapshotDataAccumulator.playlistMs += performance.now() - playlistsStart;
        }
    }

    private _createLibraryWorkers(): Array<Promise<ChannelSetupFacetSnapshot | null>> {
        const selectedLibraryQueue = new ChannelSetupFacetSnapshotLibraryQueue(this._selectedLibraries);
        const workerCount = selectedLibraryQueue.workerCount;
        return Array.from({ length: workerCount }, async (): Promise<ChannelSetupFacetSnapshot | null> => {
            while (selectedLibraryQueue.hasPending) {
                if (this._shouldStop) {
                    return null;
                }
                if (this._callerCanceled()) {
                    throw createAbortError(this._lastTask);
                }
                if (this._requestSignal.aborted && !this._failureAbortActive) {
                    throw createAbortError(this._lastTask);
                }
                const entry = selectedLibraryQueue.next();
                if (!entry) {
                    return null;
                }
                const failure = await this._loadLibraryFacets(entry.library, entry.index);
                if (failure) {
                    return failure;
                }
            }
            return null;
        });
    }

    private async _loadLibraryFacets(
        library: PlexLibrarySection,
        libIndex: number
    ): Promise<ChannelSetupFacetSnapshot | null> {
        if (this._options.config.strategyConfig.collections.enabled) {
            const shouldContinue = await this._loadCollections(library, libIndex);
            if (!shouldContinue) {
                return null;
            }
        }

        const nativeFacetDefinitions = this._createNativeFacetDefinitions(library);
        if (nativeFacetDefinitions.length === 0) {
            return null;
        }

        const libraryAbortController = new AbortController();
        const librarySignal = libraryAbortController.signal;
        let libraryFailureActive = false;
        const removeLibrarySignalForwarder = this._forwardRequestAbortToLibrary(libraryAbortController);
        const libraryFailureStopRequested = (): boolean =>
            libraryFailureActive
            && librarySignal.aborted
            && !this._callerCanceled()
            && !this._failureStopRequested();
        const abortLibraryFacetRequests = (): void => {
            libraryFailureActive = true;
            if (!librarySignal.aborted) {
                libraryAbortController.abort();
            }
        };

        try {
            const requireEntries = library.contentCount !== 0;
            const nativeFacetTasks = nativeFacetDefinitions.map((definition) =>
                this._createNativeFacetTask(
                    definition,
                    library.id,
                    library.title,
                    librarySignal,
                    requireEntries,
                    libraryFailureStopRequested
                )
            );

            this._reportSnapshotProgress(
                'scan_library_items',
                'Resolving filters...',
                library.title,
                libIndex,
                this._selectedLibraries.length
            );
            const libraryFailure = await this._awaitFirstLibraryFacetFailure(
                nativeFacetTasks,
                abortLibraryFacetRequests
            );
            if (libraryFailure) {
                this._firstFailure = this._firstFailure ?? libraryFailure;
                this._abortSiblingRequests();
                return libraryFailure;
            }

            const countRecoveryFailure = await this._recoverLibraryFacetCounts(
                nativeFacetDefinitions,
                library,
                librarySignal,
                libraryFailureStopRequested,
                abortLibraryFacetRequests
            );
            if (countRecoveryFailure) {
                this._firstFailure = this._firstFailure ?? countRecoveryFailure;
                this._abortSiblingRequests();
                return countRecoveryFailure;
            }
            return null;
        } finally {
            removeLibrarySignalForwarder?.();
        }
    }

    private async _loadCollections(library: PlexLibrarySection, libIndex: number): Promise<boolean> {
        this._reportSnapshotProgress(
            'fetch_collections',
            'Fetching collections...',
            library.title,
            libIndex,
            this._selectedLibraries.length
        );
        const collectionsStart = performance.now();
        try {
            const collections = await this._options.plexLibrary.getCollections(library.id, {
                signal: this._requestSignal,
                requestIntent: this._options.requestIntent,
            });
            this._snapshotDataAccumulator.collectionsByLibraryId.set(library.id, collections);
            return true;
        } catch (error) {
            if (this._callerCanceled()) {
                throw createAbortError(this._lastTask);
            }
            if (this._failureStopRequested()) {
                return false;
            }
            console.warn(`Failed to fetch collections for library ${library.title}:`, summarizeErrorForLog(error));
            this._addPartialWarning('fetch_collections', `fetch_collections failed for ${library.title}`, error);
            this._snapshotDataAccumulator.errorsTotal++;
            this._snapshotDataAccumulator.collectionsByLibraryId.set(library.id, []);
            return true;
        } finally {
            this._snapshotDataAccumulator.collectionsMs += performance.now() - collectionsStart;
        }
    }

    private _forwardRequestAbortToLibrary(libraryAbortController: AbortController): (() => void) | null {
        if (this._requestSignal.aborted) {
            libraryAbortController.abort();
            return null;
        }
        const onRequestAbort = (): void => {
            libraryAbortController.abort();
        };
        this._requestSignal.addEventListener('abort', onRequestAbort, { once: true });
        return (): void => {
            this._requestSignal.removeEventListener('abort', onRequestAbort);
        };
    }

    private async _awaitFirstLibraryFacetFailure(
        nativeFacetTasks: Array<Promise<ChannelSetupFacetSnapshot | null>>,
        abortLibraryFacetRequests: () => void
    ): Promise<ChannelSetupFacetSnapshot | null> {
        const settledFacetTasks = nativeFacetTasks.map((task, facetIndex) =>
            task.then((result) => ({ facetIndex, result }))
        );
        const pendingFacetIndexes = new Set(settledFacetTasks.map((_, facetIndex) => facetIndex));
        let libraryFailure: ChannelSetupFacetSnapshot | null = null;
        try {
            while (pendingFacetIndexes.size > 0) {
                const settled = await Promise.race(
                    Array.from(pendingFacetIndexes, (facetIndex) => settledFacetTasks[facetIndex])
                );
                if (this._requestSignal.aborted && !this._failureAbortActive) {
                    throw createAbortError(this._lastTask);
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
        } catch (error) {
            await Promise.allSettled(nativeFacetTasks);
            throw error;
        }
        if (libraryFailure) {
            await Promise.allSettled(nativeFacetTasks);
        }
        return libraryFailure;
    }

    private async _recoverLibraryFacetCounts(
        nativeFacetDefinitions: NativeFacetTaskDefinition[],
        library: PlexLibrarySection,
        librarySignal: AbortSignal,
        libraryFailureStopRequested: () => boolean,
        abortLibraryFacetRequests: () => void
    ): Promise<ChannelSetupFacetSnapshot | null> {
        let firstFailure: ChannelSetupFacetSnapshot | null = null;
        const countRecoveryLimiter = createFacetCountRecoveryLimiter(MAX_FACET_COUNT_RECOVERY_CONCURRENCY);
        const recoveryTasks = nativeFacetDefinitions.map(async (definition) => {
            if (libraryFailureStopRequested()) {
                return null;
            }
            const countRecoveryFailure = await this._recoverAndStoreFacetCounts(
                definition,
                library,
                librarySignal,
                libraryFailureStopRequested,
                countRecoveryLimiter
            );
            if (countRecoveryFailure && !firstFailure) {
                firstFailure = countRecoveryFailure;
                abortLibraryFacetRequests();
            }
            return countRecoveryFailure;
        });
        await Promise.all(recoveryTasks);
        return firstFailure;
    }

    private _createNativeFacetDefinitions(library: PlexLibrarySection): NativeFacetTaskDefinition[] {
        const { genreType, detailType } = getTagDirectoryMediaTypesForLibraryType(library.type);
        const definitions: NativeFacetTaskDefinition[] = [];
        if (this._options.config.strategyConfig.genres.enabled) {
            definitions.push({
                family: 'genres',
                label: 'Genres',
                mediaType: genreType,
                countRecoveryFamily: 'genre',
                tagsByLibraryId: this._snapshotDataAccumulator.genresByLibraryId,
                fetchTags: (options) => this._options.plexLibrary.getGenres(library.id, {
                    type: genreType,
                    ...options,
                }),
            });
        }
        if (this._options.config.strategyConfig.directors.enabled) {
            definitions.push({
                family: 'directors',
                label: 'Directors',
                mediaType: detailType,
                countRecoveryFamily: 'director',
                tagsByLibraryId: this._snapshotDataAccumulator.directorsByLibraryId,
                fetchTags: (options) => this._options.plexLibrary.getDirectors(library.id, {
                    type: detailType,
                    ...options,
                }),
            });
        }
        if (this._options.config.strategyConfig.decades.enabled) {
            definitions.push({
                family: 'decades',
                label: 'Years',
                mediaType: detailType,
                countRecoveryFamily: 'year',
                tagsByLibraryId: this._snapshotDataAccumulator.yearsByLibraryId,
                fetchTags: (options) => this._options.plexLibrary.getYears(library.id, {
                    type: detailType,
                    ...options,
                }),
            });
        }
        if (this._options.config.strategyConfig.studios.enabled) {
            definitions.push({
                family: 'studios',
                label: 'Studios',
                mediaType: detailType,
                countRecoveryFamily: 'studio',
                tagsByLibraryId: this._snapshotDataAccumulator.studiosByLibraryId,
                fetchTags: (options) => this._options.plexLibrary.getStudios(library.id, {
                    type: detailType,
                    ...options,
                }),
            });
        }
        if (this._options.config.strategyConfig.actors.enabled) {
            definitions.push({
                family: 'actors',
                label: 'Actors',
                mediaType: detailType,
                countRecoveryFamily: 'actor',
                tagsByLibraryId: this._snapshotDataAccumulator.actorsByLibraryId,
                fetchTags: (options) => this._options.plexLibrary.getActors(library.id, {
                    type: detailType,
                    ...options,
                }),
            });
        }
        return definitions;
    }

    private async _createNativeFacetTask(
        definition: NativeFacetTaskDefinition,
        libraryId: string,
        libraryTitle: string,
        librarySignal: AbortSignal,
        requireEntries: boolean,
        libraryFailureStopRequested: () => boolean
    ): Promise<ChannelSetupFacetSnapshot | null> {
        try {
            const tagStart = performance.now();
            let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
            let tags: PlexTagDirectoryItem[];
            try {
                tags = await definition.fetchTags({
                    signal: librarySignal,
                    requireEntries,
                    requestIntent: this._options.requestIntent,
                    onUnsupported: (reason) => {
                        unsupportedReason = reason;
                    },
                });
            } finally {
                this._snapshotDataAccumulator.libraryQueryMs += performance.now() - tagStart;
            }
            if (unsupportedReason === 'empty') {
                definition.tagsByLibraryId.set(libraryId, tags);
                this._deferEmptyTagDirectoryFailure(
                    definition.family,
                    definition.label,
                    libraryTitle,
                    definition.mediaType
                );
                return null;
            }
            if (unsupportedReason) {
                return this._buildRequiredTagDirectoryFailure(
                    definition.label,
                    libraryTitle,
                    definition.mediaType,
                    unsupportedReason
                );
            }
            this._markFacetEntries(definition.family, tags);
            definition.tagsByLibraryId.set(libraryId, tags);
            return null;
        } catch (error) {
            if (this._callerCanceled()) {
                throw createAbortError(this._lastTask);
            }
            if (this._failureStopRequested() || libraryFailureStopRequested()) {
                return null;
            }
            console.warn(`Failed to fetch ${definition.family} for ${libraryTitle}:`, summarizeErrorForLog(error));
            return this._buildRequiredTagDirectoryFailure(
                definition.label,
                libraryTitle,
                definition.mediaType,
                'error',
                error
            );
        }
    }

    private async _recoverAndStoreFacetCounts(
        definition: NativeFacetTaskDefinition,
        library: PlexLibrarySection,
        librarySignal: AbortSignal,
        libraryFailureStopRequested: () => boolean,
        countRecoveryLimiter: FacetCountRecoveryLimiter
    ): Promise<ChannelSetupFacetSnapshot | null> {
        const tags = definition.tagsByLibraryId.get(library.id) ?? [];
        if (tags.length === 0 || tags.every((tag) => tag.count !== null)) {
            return null;
        }
        try {
            const hydrated = await this._recoverUnknownTagCounts(
                library.id,
                definition.mediaType,
                definition.countRecoveryFamily,
                tags,
                librarySignal,
                countRecoveryLimiter
            );
            definition.tagsByLibraryId.set(library.id, hydrated);
            return null;
        } catch (error) {
            if (this._callerCanceled()) {
                throw createAbortError(this._lastTask);
            }
            if (this._failureStopRequested() || libraryFailureStopRequested()) {
                return null;
            }
            console.warn(
                `Failed to recover ${definition.countRecoveryFamily} counts for ${library.title}:`,
                summarizeErrorForLog(error)
            );
            return this._buildRequiredTagCountRecoveryFailure(
                definition.label,
                library.title,
                definition.mediaType,
                error
            );
        }
    }

    private async _recoverUnknownTagCounts(
        libraryId: string,
        mediaType: number,
        family: ChannelSetupFacetCountRecoveryFamily,
        tags: PlexTagDirectoryItem[],
        tagSignal: AbortSignal,
        countRecoveryLimiter: FacetCountRecoveryLimiter
    ): Promise<PlexTagDirectoryItem[]> {
        return new ChannelSetupFacetCountRecoveryWorker({
            plexLibrary: this._options.plexLibrary,
            libraryId,
            mediaType,
            family,
            tags,
            tagSignal,
            countRecoveryLimiter,
            getLastTask: () => this._lastTask,
            addLibraryQueryMs: (durationMs): void => {
                this._snapshotDataAccumulator.libraryQueryMs += durationMs;
            },
            maxConcurrency: MAX_FACET_COUNT_RECOVERY_CONCURRENCY,
        }).recover();
    }

    private _snapshotData(hasTransientLoadFailure: boolean): ChannelSetupFacetSnapshotData {
        return this._snapshotDataAccumulator.snapshotData(hasTransientLoadFailure, this._lastTask);
    }
    private _reportSnapshotProgress(
        task: ChannelBuildProgress['task'],
        label: string,
        detail: string,
        current: number,
        total: number | null
    ): void {
        this._lastTask = task;
        this._options.reportProgress?.(task, label, detail, current, total);
    }

    private _addPartialWarning(
        task: ChannelBuildProgress['task'],
        detail: string,
        error: unknown
    ): void {
        this._snapshotDataAccumulator.addPartialWarning(task, detail, error);
    }

    private _buildRequiredTagDirectoryFailure(
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number,
        reason: PlexTagDirectoryUnsupportedReason | 'error',
        error?: unknown
    ): ChannelSetupFacetSnapshot {
        return this._failureBuilder.buildRequiredTagDirectoryFailure(label, libraryTitle, type, reason, error);
    }

    private _buildRequiredTagCountRecoveryFailure(
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number,
        error: unknown
    ): ChannelSetupFacetSnapshot {
        return this._failureBuilder.buildRequiredTagCountRecoveryFailure(label, libraryTitle, type, error);
    }

    private _markFacetEntries(
        family: ChannelSetupNativeFacetFamily,
        tags: PlexTagDirectoryItem[]
    ): void {
        this._snapshotDataAccumulator.markFacetEntries(family, tags);
    }

    private _deferEmptyTagDirectoryFailure(
        family: ChannelSetupNativeFacetFamily,
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number
    ): void {
        this._snapshotDataAccumulator.deferEmptyTagDirectoryFailure(family, label, libraryTitle, type);
    }

    private _resolveDeferredEmptyTagDirectoryFailure(): ChannelSetupFacetSnapshot | null {
        const failure = this._snapshotDataAccumulator.resolveDeferredEmptyTagDirectoryFailure();
        if (failure) {
            return this._buildRequiredTagDirectoryFailure(
                failure.label,
                failure.libraryTitle,
                failure.type,
                'empty'
            );
        }
        return null;
    }

    private _callerCanceled(): boolean {
        return isSignalAborted(this._options.signal ?? undefined);
    }

    private _failureStopRequested(): boolean {
        return this._failureAbortActive && this._requestSignal.aborted && !this._callerCanceled();
    }

    private _abortSiblingRequests(): void {
        this._shouldStop = true;
        this._failureAbortActive = true;
        if (!this._requestSignal.aborted) {
            this._options.snapshotAbortController.abort();
        }
    }
}

function compareDeferredEmptyTagDirectoryFailures(
    left: DeferredEmptyTagDirectoryFailure,
    right: DeferredEmptyTagDirectoryFailure
): number {
    const familyDiff = left.family.localeCompare(right.family);
    if (familyDiff !== 0) return familyDiff;

    const labelDiff = left.label.localeCompare(right.label);
    if (labelDiff !== 0) return labelDiff;

    const titleDiff = left.libraryTitle.localeCompare(right.libraryTitle);
    if (titleDiff !== 0) return titleDiff;

    return left.type - right.type;
}

function createFacetCountRecoveryLimiter(maxConcurrency: number): FacetCountRecoveryLimiter {
    const pending: Array<() => void> = [];
    let active = 0;

    const release = (): void => {
        active--;
        const next = pending.shift();
        next?.();
    };

    return <T>(task: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
        const run = (): void => {
            active++;
            void Promise.resolve().then(task).then(resolve, reject).finally(release);
        };

        if (active < maxConcurrency) {
            run();
            return;
        }
        pending.push(run);
    });
}

function getErrorSummaryObject(error: unknown): { message?: unknown; code?: unknown } {
    const summary = summarizeErrorForLog(error);
    return typeof summary === 'object' && summary !== null
        ? summary as { message?: unknown; code?: unknown }
        : {};
}
