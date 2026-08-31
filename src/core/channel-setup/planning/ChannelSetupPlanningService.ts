import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type {
    IPlexLibrary,
    PlexLibrarySection,
} from '../../../modules/plex/library';
import { getPlexRequestIntentForChannelSetup } from '../../../modules/plex/library';
import { readAbortSignalReason } from '../../../utils/abortSignalReason';
import type {
    ChannelSetupConfig,
    ChannelBuildProgress,
    ChannelSetupPreview,
    ChannelSetupPreviewFailureReason,
    ChannelSetupPreviewStatus,
    ChannelSetupReview,
} from '../types';
import {
    buildChannelSetupPlan,
    buildChannelSetupPlanCooperatively,
    buildChannelSetupPlanDiagnostics,
} from './ChannelSetupPlanner';
import {
    diffChannelPlans,
    createChannelIdentityKey,
    type PendingChannel,
    type ChannelDiffResult,
} from './ChannelSetupPlanningTypes';
import type { ChannelSetupPlanDiagnosticsResult } from './ChannelSetupPlanDiagnostics';
import {
    ChannelSetupFacetSnapshotLoader,
    type ChannelSetupFacetSnapshot,
    type ChannelSetupPlanningIntent,
} from './ChannelSetupFacetSnapshotLoader';
import { createEmptyChannelSetupEstimates } from './ChannelSetupPlanningTypes';
import { normalizeChannelSetupConfig } from '../config/normalizeChannelSetupConfig';
import { yieldForChannelSetupPlanning } from './ChannelSetupPlanningCheckpoint';

function throwIfChannelSetupAborted(signal: AbortSignal | null | undefined): void {
    if (signal?.aborted) {
        throw readAbortSignalReason(signal);
    }
}

export interface ChannelSetupPlanningServiceDeps {
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    getActiveUserId?: () => string | null;
    getSelectedServerId?: () => string | null;
}

type ChannelSetupLibraryScope = {
    key: string;
    generation: number;
};

type ChannelSetupLibraryAcquisition = ChannelSetupLibraryScope & {
    controller: AbortController;
    promise: Promise<PlexLibrarySection[]>;
};

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

export class ChannelSetupPlanningService {
    private readonly _facetSnapshotLoader: ChannelSetupFacetSnapshotLoader;
    private _sessionLibraries: PlexLibrarySection[] | null = null;
    private _sessionScopeKey: string | null = null;
    private _sessionGeneration = 0;
    private _inflightLibraryAcquisition: ChannelSetupLibraryAcquisition | null = null;

    constructor(private readonly _deps: ChannelSetupPlanningServiceDeps) {
        this._facetSnapshotLoader = new ChannelSetupFacetSnapshotLoader(this._deps);
    }

    async getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibrarySection[]> {
        throwIfChannelSetupAborted(signal);
        const scope = this._ensureCurrentScope();
        if (this._sessionLibraries) {
            return this._awaitLibraryAcquisition(Promise.resolve(this._sessionLibraries), signal);
        }

        const acquisition = this._getOrCreateLibraryAcquisition(scope);
        return this._awaitLibraryAcquisition(acquisition.promise, signal);
    }

    normalizeConfig(config: ChannelSetupConfig): ChannelSetupConfig {
        return normalizeChannelSetupConfig(config);
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
                ...(planResult.blockedMessage !== undefined ? { message: planResult.blockedMessage } : {}),
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
                    ...(planResult.blockedMessage !== undefined ? { message: planResult.blockedMessage } : {}),
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

    async getSetupPlanDiagnostics(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPlanDiagnosticsResult> {
        const normalizedConfig = this.normalizeConfig(config);
        const libraries = await this.getLibrariesForSetup(options?.signal ?? null);

        const snapshot = await this._facetSnapshotLoader.loadSnapshot(
            normalizedConfig,
            libraries,
            'build',
            {
                signal: options?.signal ?? null,
                requestIntent: getPlexRequestIntentForChannelSetup('build'),
                detachFromSignal: true,
            }
        );

        if (snapshot.status !== 'ready') {
            return {
                status: snapshot.status,
                diagnostics: null,
                warnings: [...snapshot.warnings],
                reachedMaxChannels: false,
                message: snapshot.message,
                failureReason: snapshot.failureReason,
            };
        }

        const diagnostics = buildChannelSetupPlanDiagnostics({
            config: normalizedConfig,
            libraries,
            playlists: snapshot.playlists,
            collectionsByLibraryId: snapshot.collectionsByLibraryId,
            genresByLibraryId: snapshot.genresByLibraryId,
            directorsByLibraryId: snapshot.directorsByLibraryId,
            yearsByLibraryId: snapshot.yearsByLibraryId,
            actorsByLibraryId: snapshot.actorsByLibraryId,
            studiosByLibraryId: snapshot.studiosByLibraryId,
            peopleSeriesIndexByLibraryId: snapshot.peopleSeriesIndexByLibraryId,
            warnings: snapshot.warnings,
            seedFor: (value: string): number => this._hashSeed(value),
        });

        return {
            status: 'ready',
            diagnostics,
            warnings: [...snapshot.warnings],
            reachedMaxChannels: diagnostics.lostToMaxChannels.total > 0,
        };
    }

    async buildSetupPlan(
        config: ChannelSetupConfig,
        libraries: PlexLibrarySection[],
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
            const snapshotOptions = {
                signal,
                requestIntent: getPlexRequestIntentForChannelSetup(intent),
                detachFromSignal: reportProgress === undefined,
                ...(reportProgress
                    ? {
                        reportProgress: (progress: ChannelBuildProgress): void => {
                            reportProgress(
                                progress.task,
                                progress.label,
                                progress.detail,
                                progress.current,
                                progress.total
                            );
                        },
                    }
                    : {}),
            };
            snapshot = await this._facetSnapshotLoader.loadSnapshot(config, libraries, intent, snapshotOptions);
        } catch (error) {
            if (signal?.aborted) {
                if (reportProgress === undefined) {
                    throw error;
                }
                const abortedTask = getAbortErrorTask(error);
                return createCanceledPlanBuildResult(abortedTask ?? 'scan_library_items');
            }
            throw error;
        }

        if (snapshot.status !== 'ready') {
            return {
                plan: null,
                warnings: [...snapshot.warnings],
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

        let plan: ReturnType<typeof buildChannelSetupPlan>;
        try {
            plan = await buildChannelSetupPlanCooperatively({
                config,
                libraries,
                playlists: snapshot.playlists,
                collectionsByLibraryId: snapshot.collectionsByLibraryId,
                genresByLibraryId: snapshot.genresByLibraryId,
                directorsByLibraryId: snapshot.directorsByLibraryId,
                yearsByLibraryId: snapshot.yearsByLibraryId,
                actorsByLibraryId: snapshot.actorsByLibraryId,
                studiosByLibraryId: snapshot.studiosByLibraryId,
                peopleSeriesIndexByLibraryId: snapshot.peopleSeriesIndexByLibraryId,
                warnings: snapshot.warnings,
                seedFor: (value: string): number => this._hashSeed(value),
            }, () => yieldForChannelSetupPlanning(signal));
        } catch (error) {
            if (signal?.aborted && reportProgress !== undefined) {
                const abortedTask = getAbortErrorTask(error);
                return createCanceledPlanBuildResult(abortedTask ?? 'scan_library_items');
            }
            throw error;
        }
        if (plan.pendingChannels.length === 0 && snapshot.errorsTotal === 0) {
            const hasTransientLoadFailure = snapshot.hasTransientLoadFailure;
            return {
                plan: null,
                warnings: [...snapshot.warnings],
                canceled: false,
                blockedMessage: hasTransientLoadFailure
                    ? 'Channel setup could not build channels because Plex returned incomplete setup data. Try again later, or retry after Plex finishes refreshing metadata.'
                    : 'Channel setup could not build any channels from the selected libraries and enabled channel types. Try another channel type, another library, or a lower minimum item count.',
                previewStatus: 'blocked',
                failureReason: hasTransientLoadFailure ? 'transient' : 'empty',
                errorsTotal: snapshot.errorsTotal,
                playlistMs: snapshot.playlistMs,
                collectionsMs: snapshot.collectionsMs,
                libraryQueryMs: snapshot.libraryQueryMs,
            };
        }

        return {
            plan,
            warnings: [...snapshot.warnings],
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

    invalidateSessionData(): void {
        this._sessionGeneration += 1;
        this._sessionLibraries = null;
        const inflight = this._inflightLibraryAcquisition;
        this._inflightLibraryAcquisition = null;
        inflight?.controller.abort();
        this.invalidateFacetSnapshot();
    }

    private _ensureCurrentScope(): ChannelSetupLibraryScope {
        const key = this._readCurrentScopeKey();
        if (this._sessionScopeKey !== key) {
            this.invalidateSessionData();
            this._sessionScopeKey = key;
        }
        return { key, generation: this._sessionGeneration };
    }

    private _readCurrentScopeKey(): string {
        return JSON.stringify([
            this._deps.getActiveUserId?.() ?? null,
            this._deps.getSelectedServerId?.() ?? null,
        ]);
    }

    private _getOrCreateLibraryAcquisition(
        scope: ChannelSetupLibraryScope
    ): ChannelSetupLibraryAcquisition {
        const existing = this._inflightLibraryAcquisition;
        if (existing?.generation === scope.generation && existing.key === scope.key) {
            return existing;
        }

        const controller = new AbortController();
        const libraryRequest = this._deps.plexLibrary.getLibraries({ signal: controller.signal });
        const clearInflight = (): void => {
            if (
                this._inflightLibraryAcquisition?.generation === scope.generation
                && this._inflightLibraryAcquisition.key === scope.key
            ) {
                this._inflightLibraryAcquisition = null;
            }
        };
        const promise = libraryRequest
            .then(
                (libraries) => {
                    try {
                        const filteredLibraries = libraries.filter((lib) => lib.type === 'movie' || lib.type === 'show');
                        if (this._readCurrentScopeKey() !== scope.key) {
                            this._ensureCurrentScope();
                        }
                        if (
                            this._sessionGeneration === scope.generation
                            && this._sessionScopeKey === scope.key
                        ) {
                            this._sessionLibraries = filteredLibraries;
                        }
                        return filteredLibraries;
                    } finally {
                        clearInflight();
                    }
                },
                (error: unknown) => {
                    clearInflight();
                    throw error;
                }
            );
        const acquisition: ChannelSetupLibraryAcquisition = {
            ...scope,
            controller,
            promise,
        };
        this._inflightLibraryAcquisition = acquisition;
        return acquisition;
    }

    private _awaitLibraryAcquisition(
        promise: Promise<PlexLibrarySection[]>,
        signal?: AbortSignal | null
    ): Promise<PlexLibrarySection[]> {
        if (!signal) {
            return promise;
        }
        throwIfChannelSetupAborted(signal);
        return new Promise<PlexLibrarySection[]>((resolve, reject) => {
            const onAbort = (): void => {
                cleanup();
                reject(readAbortSignalReason(signal));
            };
            const cleanup = (): void => {
                signal.removeEventListener('abort', onAbort);
            };
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted) {
                onAbort();
                return;
            }
            void promise.then(
                (libraries) => {
                    cleanup();
                    resolve(libraries);
                },
                (error: unknown) => {
                    cleanup();
                    reject(error);
                }
            );
        });
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

    private _emptyEstimates(): ChannelSetupPreview['estimates'] {
        return createEmptyChannelSetupEstimates();
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

function getAbortErrorTask(error: unknown): ChannelBuildProgress['task'] | undefined {
    if (!error || typeof error !== 'object' || !('lastTask' in error)) {
        return undefined;
    }
    const { lastTask } = error as { lastTask?: unknown };
    return typeof lastTask === 'string' ? lastTask as ChannelBuildProgress['task'] : undefined;
}

function createCanceledPlanBuildResult(
    lastTask: ChannelBuildProgress['task']
): ChannelSetupPlanBuildResult {
    return {
        plan: null,
        warnings: [],
        canceled: true,
        lastTask,
        errorsTotal: 0,
        playlistMs: 0,
        collectionsMs: 0,
        libraryQueryMs: 0,
    };
}
