import type {
    IPlexLibrary,
    PlexLibrarySection,
    PlexTagDirectoryItem,
    PlexTagDirectoryUnsupportedReason,
} from '../../../modules/plex/library';
import { getTagDirectoryMediaTypesForLibraryType } from '../../../modules/plex/library';
import { isPlexLibraryScopeSupersededError } from '../../../modules/plex/library';
import { summarizeErrorForLog } from '../../../utils/errors';
import type { ChannelBuildProgress, ChannelSetupConfig } from '../types';
import { createAbortError } from './ChannelSetupFacetSnapshotAbort';
import {
    ChannelSetupFacetCountRecoveryWorker,
    type FacetCountRecoveryLimiter,
} from './ChannelSetupFacetCountRecoveryWorker';
import { createFacetCountRecoveryLimiter } from './ChannelSetupFacetCountRecoveryLimiter';
import type {
    ChannelSetupFacetSnapshotFailureBuilder,
    ChannelSetupFacetSnapshotLoadState,
} from './ChannelSetupFacetSnapshotFailures';
import type {
    ChannelSetupFacetCountRecoveryFamily,
    ChannelSetupNativeFacetFamily,
    ChannelSetupRequiredTagDirectoryLabel,
    ChannelSetupNativeFacetFamilyDescriptor,
} from './ChannelSetupFacetFamilies';
import {
    CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS,
} from './ChannelSetupFacetFamilies';
import { shouldLoadNativeFacetForLibrary } from './ChannelSetupNativeFacetEligibility';
import { buildChannelSetupPeopleSeriesIndexForLibrary } from './ChannelSetupPeopleSeriesIndex';
import type {
    ChannelSetupFacetSnapshot,
    ChannelSetupPlexRequestIntent,
} from './ChannelSetupPlanningTypes';

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

type ChannelSetupFacetLibraryExecutorOptions = {
    plexLibrary: IPlexLibrary;
    config: ChannelSetupConfig;
    requestIntent: ChannelSetupPlexRequestIntent;
    requestSignal: AbortSignal;
    selectedLibraryCount: number;
    loadState: ChannelSetupFacetSnapshotLoadState;
    failureBuilder: ChannelSetupFacetSnapshotFailureBuilder;
    getLastTask: () => ChannelBuildProgress['task'] | undefined;
    callerCanceled: () => boolean;
    failureStopRequested: () => boolean;
    requestAbortRequiresThrow: () => boolean;
    reportSnapshotProgress: (progress: ChannelBuildProgress) => void;
    addPartialWarning: (task: ChannelBuildProgress['task'], detail: string, error: unknown) => void;
    abortSiblingRequests: () => void;
    checkpoint: () => Promise<void>;
};
const MAX_FACET_COUNT_RECOVERY_CONCURRENCY = 8;
export class ChannelSetupFacetLibraryExecutor {
    constructor(private readonly _options: ChannelSetupFacetLibraryExecutorOptions) {}
    async loadLibraryFacets(
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
            && !this._options.callerCanceled()
            && !this._options.failureStopRequested();
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
            this._options.reportSnapshotProgress({
                task: 'scan_library_items',
                label: 'Resolving filters...',
                detail: library.title,
                current: libIndex,
                total: this._options.selectedLibraryCount,
            });
            const libraryFailure = await this._awaitFirstLibraryFacetFailure(
                nativeFacetTasks,
                abortLibraryFacetRequests
            );
            if (libraryFailure) {
                this._options.abortSiblingRequests();
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
                this._options.abortSiblingRequests();
                return countRecoveryFailure;
            }
            await this._loadPeopleSeriesIndex(library, librarySignal, libraryFailureStopRequested);
            return null;
        } finally {
            removeLibrarySignalForwarder?.();
        }
    }
    private async _loadCollections(library: PlexLibrarySection, libIndex: number): Promise<boolean> {
        this._options.reportSnapshotProgress({
            task: 'fetch_collections',
            label: 'Fetching collections...',
            detail: library.title,
            current: libIndex,
            total: this._options.selectedLibraryCount,
        });
        const collectionsStart = performance.now();
        try {
            const collections = await this._options.plexLibrary.getCollections(library.id, {
                signal: this._options.requestSignal,
                requestIntent: this._options.requestIntent,
            });
            this._options.loadState.collectionsByLibraryId.set(library.id, collections);
            return true;
        } catch (error) {
            if (isPlexLibraryScopeSupersededError(error)) {
                throw error;
            }
            if (this._options.callerCanceled()) {
                throw createAbortError(this._options.getLastTask());
            }
            if (this._options.failureStopRequested()) {
                return false;
            }
            console.warn(`Failed to fetch collections for library ${library.title}:`, summarizeErrorForLog(error));
            this._options.addPartialWarning('fetch_collections', `fetch_collections failed for ${library.title}`, error);
            this._options.loadState.incrementErrors();
            this._options.loadState.collectionsByLibraryId.set(library.id, []);
            return true;
        } finally {
            this._options.loadState.addCollectionsMs(performance.now() - collectionsStart);
        }
    }
    private _forwardRequestAbortToLibrary(libraryAbortController: AbortController): (() => void) | null {
        if (this._options.requestSignal.aborted) {
            libraryAbortController.abort();
            return null;
        }
        const onRequestAbort = (): void => {
            libraryAbortController.abort();
        };
        this._options.requestSignal.addEventListener('abort', onRequestAbort, { once: true });
        return (): void => {
            this._options.requestSignal.removeEventListener('abort', onRequestAbort);
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
                if (this._options.requestAbortRequiresThrow()) {
                    throw createAbortError(this._options.getLastTask());
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
        const setFirstFailureOnce = (failure: ChannelSetupFacetSnapshot | null): void => {
            if (!failure || firstFailure) {
                return;
            }
            firstFailure = failure;
            abortLibraryFacetRequests();
        };
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
            setFirstFailureOnce(countRecoveryFailure);
            return countRecoveryFailure;
        });
        try {
            await Promise.all(recoveryTasks);
        } catch (error) {
            if (!isPlexLibraryScopeSupersededError(error)) {
                throw error;
            }
            abortLibraryFacetRequests();
            await Promise.allSettled(recoveryTasks);
            throw error;
        }
        return firstFailure;
    }
    private _createNativeFacetDefinitions(library: PlexLibrarySection): NativeFacetTaskDefinition[] {
        const { genreType, detailType } = getTagDirectoryMediaTypesForLibraryType(library.type);
        return CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS
            .filter((descriptor) => this._options.config.strategyConfig[descriptor.strategyKey].enabled)
            .filter((descriptor) => shouldLoadNativeFacetForLibrary(descriptor, library))
            .map((descriptor) => {
                const mediaType = descriptor.mediaTypeSource === 'genre' ? genreType : detailType;
                return {
                    family: descriptor.family,
                    label: descriptor.label,
                    mediaType,
                    countRecoveryFamily: descriptor.countRecoveryFamily,
                    tagsByLibraryId: this._options.loadState[descriptor.stateKey],
                    fetchTags: (options) => this._fetchNativeFacetTags(
                        descriptor,
                        library.id,
                        mediaType,
                        options
                    ),
                };
            });
    }
    private async _loadPeopleSeriesIndex(library: PlexLibrarySection, librarySignal: AbortSignal, libraryFailureStopRequested: () => boolean): Promise<void> {
        if (library.type !== 'show' || !this._requiresPeopleSeriesIndex() || libraryFailureStopRequested() || this._options.failureStopRequested()) {
            return;
        }
        const startedAt = performance.now();
        try {
            const index = await buildChannelSetupPeopleSeriesIndexForLibrary({
                plexLibrary: this._options.plexLibrary,
                library,
                signal: librarySignal,
                checkpoint: this._options.checkpoint,
            });
            this._options.loadState.peopleSeriesIndexByLibraryId.set(library.id, index);
        } catch (error) {
            if (isPlexLibraryScopeSupersededError(error)) {
                throw error;
            }
            if (this._options.callerCanceled()) {
                throw createAbortError(this._options.getLastTask());
            }
            if (this._options.failureStopRequested() || libraryFailureStopRequested()) {
                return;
            }
            console.warn(`Failed to build TV people breadth index for ${library.title}:`, summarizeErrorForLog(error));
            this._options.loadState.markWarningOnlyTransientLoadFailure();
            this._options.addPartialWarning('scan_library_items', `TV people breadth index failed for ${library.title}; actor/director TV channels from this library were skipped`, error);
        } finally {
            this._options.loadState.addLibraryQueryMs(performance.now() - startedAt);
        }
    }
    private _requiresPeopleSeriesIndex(): boolean {
        return this._options.config.strategyConfig.actors.enabled || this._options.config.strategyConfig.directors.enabled;
    }
    private _fetchNativeFacetTags(
        descriptor: ChannelSetupNativeFacetFamilyDescriptor,
        libraryId: string,
        mediaType: number,
        options: {
            signal: AbortSignal;
            requireEntries: boolean;
            requestIntent: ChannelSetupPlexRequestIntent;
            onUnsupported: (reason: PlexTagDirectoryUnsupportedReason) => void;
        }
    ): Promise<PlexTagDirectoryItem[]> {
        const fetchTags = this._options.plexLibrary[descriptor.directoryMethod];
        return fetchTags.call(this._options.plexLibrary, libraryId, {
            type: mediaType,
            ...options,
        });
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
                this._options.loadState.addLibraryQueryMs(performance.now() - tagStart);
            }
            const recordFacetTags = (): void => {
                definition.tagsByLibraryId.set(libraryId, tags);
            };
            if (unsupportedReason === 'empty') {
                recordFacetTags();
                if (tags.length === 0) {
                    this._options.loadState.addEmptyTagDirectoryWarning(
                        definition.family,
                        definition.label,
                        libraryTitle,
                        definition.mediaType
                    );
                }
                return null;
            }
            if (unsupportedReason) {
                return this._options.failureBuilder.buildRequiredTagDirectoryFailure(
                    definition.label,
                    libraryTitle,
                    definition.mediaType,
                    unsupportedReason
                );
            }
            recordFacetTags();
            return null;
        } catch (error) {
            if (isPlexLibraryScopeSupersededError(error)) {
                throw error;
            }
            if (this._options.callerCanceled()) {
                throw createAbortError(this._options.getLastTask());
            }
            if (this._options.failureStopRequested() || libraryFailureStopRequested()) {
                return null;
            }
            console.warn(`Failed to fetch ${definition.family} for ${libraryTitle}:`, summarizeErrorForLog(error));
            return this._options.failureBuilder.buildRequiredTagDirectoryFailure(
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
        if (tags.length === 0) {
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
            if (isPlexLibraryScopeSupersededError(error)) {
                throw error;
            }
            if (this._options.callerCanceled()) {
                throw createAbortError(this._options.getLastTask());
            }
            if (this._options.failureStopRequested() || libraryFailureStopRequested()) {
                return null;
            }
            console.warn(
                `Failed to recover ${definition.countRecoveryFamily} counts for ${library.title}:`,
                summarizeErrorForLog(error)
            );
            return this._options.failureBuilder.buildRequiredTagCountRecoveryFailure(
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
            getLastTask: this._options.getLastTask,
            addLibraryQueryMs: (durationMs): void => this._options.loadState.addLibraryQueryMs(durationMs),
            maxConcurrency: MAX_FACET_COUNT_RECOVERY_CONCURRENCY,
            checkpoint: this._options.checkpoint,
        }).recover();
    }
}
