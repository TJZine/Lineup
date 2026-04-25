import type {
    IPlexLibrary,
    PlexCollection,
    PlexLibrarySection,
    PlexPlaylist,
    PlexTagDirectoryItem,
    PlexTagDirectoryUnsupportedReason,
} from '../../../modules/plex/library';
import { getTagDirectoryMediaTypesForLibraryType } from '../../../modules/plex/library';
import { AppErrorCode, getAppErrorCode } from '../../../types/app-errors';
import { summarizeErrorForLog } from '../../../utils/errors';
import type { ChannelBuildProgress, ChannelSetupConfig, ChannelSetupPreviewFailureReason } from '../types';
import { isSignalAborted } from '../shared/utils';
import { buildChannelSetupFacetCountFilter } from './ChannelSetupTagFilters';
import type {
    ChannelSetupFacetSnapshot,
    ChannelSetupFacetSnapshotData,
    ChannelSetupPlexRequestIntent,
} from './ChannelSetupPlanningTypes';

type ChannelSetupRequiredTagDirectoryLabel = 'Genres' | 'Directors' | 'Years' | 'Actors' | 'Studios';
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
    countRecoveryFamily: 'genre' | 'director' | 'year' | 'actor' | 'studio';
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

type FacetCountRecoveryLimiter = <T>(task: () => Promise<T>) => Promise<T>;

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

export function createAbortError(lastTask?: ChannelBuildProgress['task']): DOMException & { lastTask?: ChannelBuildProgress['task'] } {
    const error = new DOMException('Aborted', 'AbortError') as DOMException & { lastTask?: ChannelBuildProgress['task'] };
    if (lastTask !== undefined) {
        error.lastTask = lastTask;
    }
    return error;
}

export class ChannelSetupFacetSnapshotLoadSession {
    private readonly _selectedLibraries: PlexLibrarySection[];
    private readonly _warnings = new Set<string>();
    private _errorsTotal = 0;
    private _playlistMs = 0;
    private _collectionsMs = 0;
    private _libraryQueryMs = 0;
    private _lastTask: ChannelBuildProgress['task'] | undefined;
    private _shouldStop = false;
    private _firstFailure: ChannelSetupFacetSnapshot | null = null;
    private _failureAbortActive = false;
    private readonly _requestSignal: AbortSignal;
    private _removeSignalForwarder: (() => void) | null = null;

    private readonly _playlists: PlexPlaylist[] = [];
    private readonly _collectionsByLibraryId = new Map<string, PlexCollection[]>();
    private readonly _genresByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    private readonly _directorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    private readonly _yearsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    private readonly _actorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    private readonly _studiosByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    private readonly _facetFamiliesWithEntries = new Set<ChannelSetupNativeFacetFamily>();
    private readonly _deferredEmptyTagDirectoryFailures: DeferredEmptyTagDirectoryFailure[] = [];

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
                ...this._snapshotData(this._errorsTotal > 0),
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
        try {
            const playlistsStart = performance.now();
            const fetched = await this._options.plexLibrary.getPlaylists({
                signal: this._requestSignal,
                requestIntent: this._options.requestIntent,
            });
            this._playlistMs += performance.now() - playlistsStart;
            this._playlists.push(...fetched);
        } catch (error) {
            if (this._callerCanceled()) {
                throw createAbortError(this._lastTask);
            }
            if (this._failureStopRequested()) {
                return;
            }
            console.warn('Failed to fetch playlists:', summarizeErrorForLog(error));
            this._addPartialWarning('fetch_playlists', 'fetch_playlists failed', error);
            this._errorsTotal++;
        }
    }

    private _createLibraryWorkers(): Array<Promise<ChannelSetupFacetSnapshot | null>> {
        const selectedLibraryQueue = this._selectedLibraries.map((library, index) => ({ library, index }));
        const workerCount = Math.min(MAX_FACET_LIBRARY_CONCURRENCY, selectedLibraryQueue.length);
        return Array.from({ length: workerCount }, async (): Promise<ChannelSetupFacetSnapshot | null> => {
            while (selectedLibraryQueue.length > 0) {
                if (this._shouldStop) {
                    return null;
                }
                if (this._callerCanceled()) {
                    throw createAbortError(this._lastTask);
                }
                if (this._requestSignal.aborted && !this._failureAbortActive) {
                    throw createAbortError(this._lastTask);
                }
                const entry = selectedLibraryQueue.shift();
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
        try {
            const collectionsStart = performance.now();
            const collections = await this._options.plexLibrary.getCollections(library.id, {
                signal: this._requestSignal,
                requestIntent: this._options.requestIntent,
            });
            this._collectionsMs += performance.now() - collectionsStart;
            this._collectionsByLibraryId.set(library.id, collections);
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
            this._errorsTotal++;
            this._collectionsByLibraryId.set(library.id, []);
            return true;
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
                tagsByLibraryId: this._genresByLibraryId,
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
                tagsByLibraryId: this._directorsByLibraryId,
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
                tagsByLibraryId: this._yearsByLibraryId,
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
                tagsByLibraryId: this._studiosByLibraryId,
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
                tagsByLibraryId: this._actorsByLibraryId,
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
                this._libraryQueryMs += performance.now() - tagStart;
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
        family: 'genre' | 'director' | 'year' | 'actor' | 'studio',
        tags: PlexTagDirectoryItem[],
        tagSignal: AbortSignal,
        countRecoveryLimiter: FacetCountRecoveryLimiter
    ): Promise<PlexTagDirectoryItem[]> {
        const unknownIndexes = tags
            .map((tag, index) => (tag.count === null ? index : -1))
            .filter((index) => index >= 0);
        if (unknownIndexes.length === 0) {
            return tags;
        }

        const hydratedTags = [...tags];
        const workerCount = Math.min(MAX_FACET_COUNT_RECOVERY_CONCURRENCY, unknownIndexes.length);
        const queue = [...unknownIndexes];
        const siblingAbortController = new AbortController();
        let hasFirstError = false;
        let firstError: unknown;
        const linkedAbortSignal = createLinkedAbortSignal([
            tagSignal,
            siblingAbortController.signal,
        ]);
        const workers = Array.from({ length: workerCount }, async (): Promise<void> => {
            try {
                while (queue.length > 0) {
                    if (linkedAbortSignal.signal.aborted) {
                        if (hasFirstError) {
                            throw firstError;
                        }
                        return;
                    }
                    const tagIndex = queue.shift();
                    if (tagIndex === undefined || linkedAbortSignal.signal.aborted) {
                        if (hasFirstError) {
                            throw firstError;
                        }
                        return;
                    }
                    const tag = hydratedTags[tagIndex];
                    if (!tag || tag.count !== null) {
                        continue;
                    }
                    const countStart = performance.now();
                    let count: number | null;
                    try {
                        count = await countRecoveryLimiter(async () => {
                            if (linkedAbortSignal.signal.aborted) {
                                throw createAbortError(this._lastTask);
                            }
                            return this._options.plexLibrary.getLibraryItemCount(libraryId, {
                                filter: buildChannelSetupFacetCountFilter(tag, family, mediaType),
                                signal: linkedAbortSignal.signal,
                            });
                        });
                    } finally {
                        this._libraryQueryMs += performance.now() - countStart;
                    }
                    hydratedTags[tagIndex] = {
                        ...tag,
                        count: assertRecoveredTagCount(count, family, tag.title),
                    };
                }
            } catch (error) {
                const isAbortError = error instanceof Error && error.name === 'AbortError';
                if (!isAbortError && !hasFirstError) {
                    firstError = error;
                    hasFirstError = true;
                }
                if (!siblingAbortController.signal.aborted) {
                    siblingAbortController.abort();
                }
                if (isAbortError && hasFirstError) {
                    throw firstError;
                }
                throw hasFirstError ? firstError : error;
            }
        });
        try {
            await Promise.all(workers);
        } finally {
            linkedAbortSignal.dispose();
        }
        return hydratedTags;
    }

    private _snapshotData(hasTransientLoadFailure: boolean): ChannelSetupFacetSnapshotData {
        return {
            playlists: this._playlists,
            collectionsByLibraryId: this._collectionsByLibraryId,
            genresByLibraryId: this._genresByLibraryId,
            directorsByLibraryId: this._directorsByLibraryId,
            yearsByLibraryId: this._yearsByLibraryId,
            actorsByLibraryId: this._actorsByLibraryId,
            studiosByLibraryId: this._studiosByLibraryId,
            warnings: Array.from(this._warnings).sort((a, b) => a.localeCompare(b)),
            hasTransientLoadFailure,
            errorsTotal: this._errorsTotal,
            playlistMs: this._playlistMs,
            collectionsMs: this._collectionsMs,
            libraryQueryMs: this._libraryQueryMs,
            ...(this._lastTask !== undefined ? { lastTask: this._lastTask } : {}),
        };
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
        const summaryObject = getErrorSummaryObject(error);
        const message = typeof summaryObject.message === 'string'
            ? summaryObject.message
            : summaryObject.code !== undefined
                ? String(summaryObject.code)
                : 'unknown error';
        this._warnings.add(`Partial setup plan (${task}): ${detail} (${message})`);
    }

    private _buildFailureSnapshot(
        status: 'blocked' | 'slow',
        message: string,
        failureReason: ChannelSetupPreviewFailureReason
    ): ChannelSetupFacetSnapshot {
        this._warnings.add(message);
        this._errorsTotal++;
        return {
            status,
            message,
            failureReason,
            ...this._snapshotData(false),
        };
    }

    private _buildRequiredTagDirectoryFailure(
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number,
        reason: PlexTagDirectoryUnsupportedReason | 'error',
        error?: unknown
    ): ChannelSetupFacetSnapshot {
        const baseLabel = label.toLowerCase();
        if (reason === 'error') {
            const summaryObject = getErrorSummaryObject(error);
            const detail = typeof summaryObject.message === 'string'
                ? summaryObject.message
                : summaryObject.code !== undefined
                    ? String(summaryObject.code)
                    : 'unknown error';
            if (getAppErrorCode(summaryObject.code) === AppErrorCode.NETWORK_TIMEOUT) {
                return this._buildFailureSnapshot(
                    'slow',
                    `Required ${baseLabel} tag directory (type=${type}) timed out for ${libraryTitle}; try again after Plex responds.`,
                    'timeout'
                );
            }
            return this._buildFailureSnapshot(
                'blocked',
                `Required ${baseLabel} tag directory (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`,
                'error'
            );
        }
        const detail = reason === 'empty' ? 'returned no entries' : 'is unsupported';
        return this._buildFailureSnapshot(
            'blocked',
            `Required ${baseLabel} tag directory (type=${type}) ${detail} for ${libraryTitle}; stop and re-plan.`,
            reason === 'empty' ? 'empty' : 'unsupported'
        );
    }

    private _buildRequiredTagCountRecoveryFailure(
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number,
        error: unknown
    ): ChannelSetupFacetSnapshot {
        const baseLabel = label.toLowerCase();
        const summaryObject = getErrorSummaryObject(error);
        const detail = typeof summaryObject.message === 'string'
            ? summaryObject.message
            : summaryObject.code !== undefined
                ? String(summaryObject.code)
                : 'unknown error';
        if (getAppErrorCode(summaryObject.code) === AppErrorCode.NETWORK_TIMEOUT) {
            return this._buildFailureSnapshot(
                'slow',
                `Required ${baseLabel} item counts (type=${type}) timed out for ${libraryTitle}; try again after Plex responds.`,
                'timeout'
            );
        }
        return this._buildFailureSnapshot(
            'blocked',
            `Required ${baseLabel} item counts (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`,
            'error'
        );
    }

    private _markFacetEntries(
        family: ChannelSetupNativeFacetFamily,
        tags: PlexTagDirectoryItem[]
    ): void {
        if (tags.length > 0) {
            this._facetFamiliesWithEntries.add(family);
        }
    }

    private _deferEmptyTagDirectoryFailure(
        family: ChannelSetupNativeFacetFamily,
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number
    ): void {
        this._deferredEmptyTagDirectoryFailures.push({ family, label, libraryTitle, type });
    }

    private _resolveDeferredEmptyTagDirectoryFailure(): ChannelSetupFacetSnapshot | null {
        const orderedFailures = [...this._deferredEmptyTagDirectoryFailures]
            .sort(compareDeferredEmptyTagDirectoryFailures);

        for (const failure of orderedFailures) {
            if (!this._facetFamiliesWithEntries.has(failure.family)) {
                return this._buildRequiredTagDirectoryFailure(
                    failure.label,
                    failure.libraryTitle,
                    failure.type,
                    'empty'
                );
            }
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

function createLinkedAbortSignal(signals: AbortSignal[]): { signal: AbortSignal; dispose: () => void } {
    const controller = new AbortController();
    if (signals.some((signal) => signal.aborted)) {
        controller.abort();
        return {
            signal: controller.signal,
            dispose: () => undefined,
        };
    }
    const listeners: Array<{ signal: AbortSignal; listener: () => void }> = [];
    const abort = (): void => {
        if (!controller.signal.aborted) {
            controller.abort();
        }
    };

    for (const signal of signals) {
        signal.addEventListener('abort', abort, { once: true });
        listeners.push({ signal, listener: abort });
    }

    return {
        signal: controller.signal,
        dispose: (): void => {
            for (const { signal, listener } of listeners) {
                signal.removeEventListener('abort', listener);
            }
            listeners.length = 0;
        },
    };
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
