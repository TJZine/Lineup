import type {
    IPlexLibrary,
    PlexLibrarySection,
    PlexTagDirectoryItem,
    PlexTagDirectoryUnsupportedReason,
} from '../../../modules/plex/library';
import { summarizeErrorForLog } from '../../../utils/errors';
import type { ChannelBuildProgress, ChannelSetupConfig } from '../types';
import { isSignalAborted } from '../shared/utils';
import { createAbortError } from './ChannelSetupFacetSnapshotAbort';
import {
    ChannelSetupFacetLibraryExecutor,
} from './ChannelSetupFacetLibraryExecutor';
import {
    ChannelSetupFacetSnapshotLoadState,
    ChannelSetupFacetSnapshotFailureBuilder,
    type ChannelSetupNativeFacetFamily,
    type ChannelSetupRequiredTagDirectoryLabel,
} from './ChannelSetupFacetSnapshotFailures';
import type {
    ChannelSetupFacetSnapshot,
    ChannelSetupFacetSnapshotData,
    ChannelSetupPlexRequestIntent,
} from './ChannelSetupPlanningTypes';

type ChannelSetupFacetSnapshotLoadSessionOptions = {
    plexLibrary: IPlexLibrary;
    config: ChannelSetupConfig;
    libraries: PlexLibrarySection[];
    signal: AbortSignal | null;
    requestIntent: ChannelSetupPlexRequestIntent;
    snapshotAbortController: AbortController;
    reportProgress: ((progress: ChannelBuildProgress) => void) | undefined;
};

const MAX_FACET_LIBRARY_CONCURRENCY = 2;

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
    private readonly _loadState = new ChannelSetupFacetSnapshotLoadState();
    private readonly _failureBuilder = new ChannelSetupFacetSnapshotFailureBuilder({
        addWarning: (message): void => this._loadState.addWarning(message),
        incrementErrors: (): void => {
            this._loadState.errorsTotal++;
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
                ...this._snapshotData(this._loadState.errorsTotal > 0),
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
        this._reportSnapshotProgress({
            task: 'fetch_playlists',
            label: 'Fetching playlists...',
            detail: 'Scanning server',
            current: 0,
            total: null,
        });
        const playlistsStart = performance.now();
        try {
            const fetched = await this._options.plexLibrary.getPlaylists({
                signal: this._requestSignal,
                requestIntent: this._options.requestIntent,
            });
            this._loadState.playlists.push(...fetched);
        } catch (error) {
            if (this._callerCanceled()) {
                throw createAbortError(this._lastTask);
            }
            if (this._failureStopRequested()) {
                return;
            }
            console.warn('Failed to fetch playlists:', summarizeErrorForLog(error));
            this._addPartialWarning('fetch_playlists', 'fetch_playlists failed', error);
            this._loadState.errorsTotal++;
        } finally {
            this._loadState.playlistMs += performance.now() - playlistsStart;
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
        const failure = await new ChannelSetupFacetLibraryExecutor({
            plexLibrary: this._options.plexLibrary,
            config: this._options.config,
            requestIntent: this._options.requestIntent,
            requestSignal: this._requestSignal,
            selectedLibraryCount: this._selectedLibraries.length,
            control: {
                getLastTask: (): ChannelBuildProgress['task'] | undefined => this._lastTask,
                callerCanceled: (): boolean => this._callerCanceled(),
                failureStopRequested: (): boolean => this._failureStopRequested(),
                requestAbortRequiresThrow: (): boolean => this._requestSignal.aborted && !this._failureAbortActive,
                reportSnapshotProgress: (progress): void => this._reportSnapshotProgress(progress),
                addPartialWarning: (task, detail, error): void => this._addPartialWarning(task, detail, error),
                abortSiblingRequests: (): void => this._abortSiblingRequests(),
            },
            state: {
                incrementErrors: (): void => {
                    this._loadState.errorsTotal++;
                },
                addCollectionsMs: (durationMs): void => {
                    this._loadState.collectionsMs += durationMs;
                },
                addLibraryQueryMs: (durationMs): void => {
                    this._loadState.libraryQueryMs += durationMs;
                },
                collectionsByLibraryId: this._loadState.collectionsByLibraryId,
                genresByLibraryId: this._loadState.genresByLibraryId,
                directorsByLibraryId: this._loadState.directorsByLibraryId,
                yearsByLibraryId: this._loadState.yearsByLibraryId,
                actorsByLibraryId: this._loadState.actorsByLibraryId,
                studiosByLibraryId: this._loadState.studiosByLibraryId,
                markFacetEntries: (family, mediaType, tags): void =>
                    this._markFacetEntries(family, mediaType, tags),
                deferEmptyTagDirectoryFailure: (family, label, libraryTitle, type): void =>
                    this._deferEmptyTagDirectoryFailure(family, label, libraryTitle, type),
            },
            buildRequiredTagDirectoryFailure: (label, libraryTitle, type, reason, error): ChannelSetupFacetSnapshot =>
                this._buildRequiredTagDirectoryFailure(label, libraryTitle, type, reason, error),
            buildRequiredTagCountRecoveryFailure: (label, libraryTitle, type, error): ChannelSetupFacetSnapshot =>
                this._buildRequiredTagCountRecoveryFailure(label, libraryTitle, type, error),
        }).loadLibraryFacets(library, libIndex);
        this._firstFailure = this._firstFailure ?? failure;
        return failure;
    }

    private _snapshotData(hasTransientLoadFailure: boolean): ChannelSetupFacetSnapshotData {
        return this._loadState.snapshotData(hasTransientLoadFailure, this._lastTask);
    }
    private _reportSnapshotProgress(progress: ChannelBuildProgress): void {
        this._lastTask = progress.task;
        this._options.reportProgress?.(progress);
    }

    private _addPartialWarning(
        task: ChannelBuildProgress['task'],
        detail: string,
        error: unknown
    ): void {
        this._loadState.addPartialWarning(task, detail, error);
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
        mediaType: number,
        tags: PlexTagDirectoryItem[]
    ): void {
        this._loadState.markFacetEntries(family, mediaType, tags);
    }

    private _deferEmptyTagDirectoryFailure(
        family: ChannelSetupNativeFacetFamily,
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number
    ): void {
        this._loadState.deferEmptyTagDirectoryFailure(family, label, libraryTitle, type);
    }

    private _resolveDeferredEmptyTagDirectoryFailure(): ChannelSetupFacetSnapshot | null {
        const failure = this._loadState.resolveDeferredEmptyTagDirectoryFailure();
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
