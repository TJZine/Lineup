import { ChannelManager } from '../../../modules/scheduler/channel-manager';
import type {
    IChannelManager,
    ChannelConfig,
    ChannelCreateInput,
} from '../../../modules/scheduler/channel-manager';
import { MAX_CHANNEL_NUMBER } from '../../../modules/scheduler/channel-manager/constants';
import type { IPlexLibrary } from '../../../modules/plex/library';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupConfig,
    ChannelSetupGuideRefreshFailureStage,
} from '../types';
import type { PendingChannel, ChannelDiffResult } from '../planning/ChannelSetupPlanningTypes';
import type { ChannelSetupBuildScratchStore } from './ChannelSetupBuildScratchStore';
import { formatChannelSetupWarning } from '../shared/formatChannelSetupWarning';
import { isAbortLikeError } from '../../../utils/errors';
import type { EpgScheduleRefreshResult } from '../../../shared/epgRefresh';

export type ChannelSetupEpgRefreshOptions = {
    reason?: string;
    debounceMs?: number;
    signal?: AbortSignal | null;
};

type BuildProgressReporter = (
    task: ChannelBuildProgress['task'],
    label: string,
    detail: string,
    current: number,
    total: number | null
) => void;

export interface ChannelSetupBuildCommitterDeps {
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    scratchStore: Pick<ChannelSetupBuildScratchStore, 'createTempKeys' | 'cleanupKeys'>;
    ensureEpgInitialized: () => Promise<void>;
    clearSelectedChannelScheduleSnapshot: () => void;
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: ChannelSetupEpgRefreshOptions) => Promise<EpgScheduleRefreshResult>;
}

export interface ChannelSetupBuildCommitRequest {
    buildMode: ChannelSetupConfig['buildMode'];
    existingChannels: ChannelConfig[];
    pendingToCreate: PendingChannel[];
    skippedCount: number;
    reachedMaxChannels: boolean;
    errorCount: number;
    diff: ChannelDiffResult;
    signal: AbortSignal | null;
    reportProgress: BuildProgressReporter;
}

export interface ChannelSetupBuildCommitResult {
    summary: ChannelBuildSummary;
    epgRefreshFailed: boolean;
}

export class ChannelSetupBuildCommitter {
    constructor(private readonly _deps: ChannelSetupBuildCommitterDeps) {}

    async commitBuild(request: ChannelSetupBuildCommitRequest): Promise<ChannelSetupBuildCommitResult> {
        const warnings: string[] = [];
        const addWarning = (message: string, ...details: unknown[]): void => {
            warnings.push(formatChannelSetupWarning(message, ...details));
        };
        const tempKeys = this._deps.scratchStore.createTempKeys();
        const builder = new ChannelManager({
            plexLibrary: this._deps.plexLibrary,
            storageKey: tempKeys.channelsKey,
            currentChannelKey: tempKeys.currentChannelKey,
            logger: {
                warn: (message, ...details): void => addWarning(message, ...details),
                error: (message, ...details): void => addWarning(message, ...details),
            },
        });
        const result = await this._commitBuildWithBuilder(request, builder, addWarning)
            .finally(() => {
                this._safeCleanup(
                    'builder.dispose',
                    () => builder.dispose(),
                    addWarning
                );
                this._safeCleanup(
                    'scratchStore.cleanupKeys',
                    () => this._deps.scratchStore.cleanupKeys(tempKeys),
                    addWarning
                );
            });
        return warnings.length > 0
            ? { ...result, summary: { ...result.summary, warnings: [...warnings] } }
            : result;
    }

    private async _commitBuildWithBuilder(
        request: ChannelSetupBuildCommitRequest,
        builder: Pick<IChannelManager, 'createChannel' | 'getAllChannels' | 'dispose'>,
        addWarning: (message: string, ...details: unknown[]) => void
    ): Promise<ChannelSetupBuildCommitResult> {
        const {
            buildMode,
            existingChannels,
            pendingToCreate,
            skippedCount,
            reachedMaxChannels: initialReachedMaxChannels,
            errorCount,
            diff,
            signal,
            reportProgress,
        } = request;
        const checkCanceled = (): boolean => signal?.aborted ?? false;

        let epgRefreshFailed = false;
        let reachedMax = initialReachedMaxChannels;
        const summary: ChannelBuildSummary = {
            created: 0,
            skipped: skippedCount,
            reachedMaxChannels: false,
            errorCount,
            canceled: false,
            lastTask: 'create_channels',
        };

        let pendingIndex = 0;
        let attemptedCount = 0;
        const computeSkipped = (): number => skippedCount + Math.max(0, pendingToCreate.length - attemptedCount);
        const availableNumbers = buildMode === 'replace'
            ? []
            : this._getAvailableChannelNumbers(existingChannels);

        if (buildMode !== 'replace' && pendingToCreate.length > availableNumbers.length) {
            reachedMax = true;
        }

        const maxCreates = buildMode === 'replace'
            ? pendingToCreate.length
            : Math.min(pendingToCreate.length, availableNumbers.length);

        for (const pending of pendingToCreate) {
            pendingIndex++;
            if (summary.created >= maxCreates) {
                break;
            }

            if (checkCanceled()) {
                summary.skipped = computeSkipped();
                summary.reachedMaxChannels = reachedMax;
                summary.canceled = true;
                summary.lastTask = 'create_channels';
                return { summary, epgRefreshFailed };
            }

            if (pendingIndex % 5 === 0) {
                reportProgress('create_channels', 'Creating channels...', `Channel ${summary.created + 1}`, pendingIndex, pendingToCreate.length);
            }

            try {
                attemptedCount++;
                const channelParams: ChannelCreateInput = { ...pending };

                let pendingNumberReserved = false;
                if (buildMode !== 'replace') {
                    const nextNumber = availableNumbers[0];
                    if (nextNumber === undefined) {
                        reachedMax = true;
                        break;
                    }
                    channelParams.number = nextNumber;
                    pendingNumberReserved = true;
                }

                await builder.createChannel(channelParams, { signal });
                if (pendingNumberReserved) {
                    availableNumbers.shift();
                }
                summary.created++;
            } catch (error) {
                if (checkCanceled()) {
                    summary.skipped = computeSkipped();
                    summary.reachedMaxChannels = reachedMax;
                    summary.canceled = true;
                    summary.lastTask = 'create_channels';
                    return { summary, epgRefreshFailed };
                }
                addWarning(`Failed to create channel ${pending.name}`, error);
                summary.errorCount++;
            }
        }

        summary.skipped = computeSkipped();
        summary.reachedMaxChannels = reachedMax;

        if (checkCanceled()) {
            summary.canceled = true;
            summary.lastTask = 'apply_channels';
            return { summary, epgRefreshFailed };
        }

        reportProgress('apply_channels', 'Saving...', 'Saving library', summary.created, summary.created);
        summary.lastTask = 'apply_channels';
        const builtChannels = builder.getAllChannels();
        const currentChannelId = this._deps.channelManager.getCurrentChannel()?.id ?? null;
        let finalChannels = builtChannels;
        if (buildMode === 'append') {
            finalChannels = [...existingChannels, ...builtChannels].sort(compareChannelsByNumber);
        } else if (buildMode === 'merge') {
            const mergedExisting = this._mergeExistingChannels(existingChannels, diff);
            finalChannels = [...mergedExisting, ...builtChannels].sort(compareChannelsByNumber);
        }

        await this._deps.channelManager.replaceAllChannels(finalChannels, { currentChannelId });
        summary.commitState = 'committed';
        const initialChannelNumber = chooseInitialChannelNumber(finalChannels, currentChannelId);
        if (initialChannelNumber !== undefined) {
            summary.initialChannelNumber = initialChannelNumber;
        }

        summary.lastTask = 'refresh_epg';
        let refreshStage: ChannelSetupGuideRefreshFailureStage = 'prepare';
        const markGuideInterrupted = (): void => {
            summary.guideRefresh = {
                kind: 'interrupted',
                interruption: {
                    kind: 'aborted',
                    stage: refreshStage,
                },
            };
            reportProgress(
                'refresh_epg',
                'Refreshing guide...',
                'Guide refresh interrupted (channels saved)',
                0,
                null
            );
        };

        const refreshGuideAfterCommit = async (): Promise<void> => {
            if (checkCanceled()) {
                markGuideInterrupted();
                return;
            }

            reportProgress('refresh_epg', 'Refreshing guide...', 'Loading schedules', 0, null);
            this._deps.clearSelectedChannelScheduleSnapshot();
            if (checkCanceled()) {
                markGuideInterrupted();
                return;
            }

            refreshStage = 'ensure_initialized';
            await this._deps.ensureEpgInitialized();
            if (checkCanceled()) {
                markGuideInterrupted();
                return;
            }

            refreshStage = 'prime_channels';
            this._deps.primeEpgChannels();
            if (checkCanceled()) {
                markGuideInterrupted();
                return;
            }

            refreshStage = 'refresh_schedules';
            const guideRefresh = await this._deps.refreshEpgSchedules({
                reason: 'channel-setup',
                debounceMs: 0,
                signal: request.signal,
            });
            if (checkCanceled()) {
                markGuideInterrupted();
                return;
            }

            summary.guideRefresh = {
                kind: 'completed',
                result: guideRefresh,
            };
            if (guideRefresh.readiness !== 'ready' && guideRefresh.readiness !== 'superseded') {
                epgRefreshFailed = true;
                addWarning('[ChannelSetup] EPG refresh completed with degraded guide readiness', guideRefresh);
            }
        };

        try {
            await refreshGuideAfterCommit();
        } catch (error: unknown) {
            if (isAbortLikeError(error, request.signal ?? undefined)) {
                markGuideInterrupted();
            } else {
                epgRefreshFailed = true;
                summary.guideRefresh = {
                    kind: 'failed',
                    failure: {
                        kind: 'thrown',
                        stage: refreshStage,
                    },
                };
                addWarning('[ChannelSetup] EPG refresh failed after commit', error);
                reportProgress('refresh_epg', 'Refreshing guide...', 'Guide refresh failed (channels saved)', 0, null);
            }
        }

        const finalDetail = summary.guideRefresh?.kind === 'interrupted'
            ? `Built ${summary.created} channels (guide refresh interrupted)`
            : epgRefreshFailed
            ? `Built ${summary.created} channels (guide refresh failed)`
            : `Built ${summary.created} channels`;
        summary.lastTask = 'done';
        reportProgress('done', 'Done!', finalDetail, summary.created, summary.created);

        return { summary, epgRefreshFailed };
    }

    private _safeCleanup(
        label: string,
        fn: () => void,
        addWarning: (message: string, ...details: unknown[]) => void
    ): void {
        try {
            fn();
        } catch (error: unknown) {
            addWarning(`[ChannelSetup] cleanup failed (${label})`, error);
        }
    }

    private _getAvailableChannelNumbers(existingChannels: ChannelConfig[]): number[] {
        const used = new Set(existingChannels.map((channel) => channel.number));
        const available: number[] = [];
        for (let i = 1; i <= MAX_CHANNEL_NUMBER; i++) {
            if (!used.has(i)) {
                available.push(i);
            }
        }
        return available;
    }

    private _mergeExistingChannels(existingChannels: ChannelConfig[], diff: ChannelDiffResult): ChannelConfig[] {
        const plannedById = new Map<string, PendingChannel>();
        for (const pair of diff.matchedPairs) {
            plannedById.set(pair.existing.id, pair.planned);
        }
        return existingChannels.map((existing) => {
            const planned = plannedById.get(existing.id);
            if (!planned) {
                return existing;
            }
            return this._mergeChannel(existing, planned);
        });
    }

    private _mergeChannel(existing: ChannelConfig, planned: PendingChannel): ChannelConfig {
        const updated: ChannelConfig = {
            ...existing,
            contentSource: planned.contentSource,
            playbackMode: planned.playbackMode,
            shuffleSeed: planned.shuffleSeed,
            updatedAt: Date.now(),
        };

        const mergeOptionalField = <T>(
            value: T | undefined,
            apply: (input: T) => void,
            remove: () => void,
            isValid: (input: T) => boolean = () => true
        ): void => {
            if (value !== undefined && isValid(value)) {
                apply(value);
                return;
            }
            remove();
        };

        mergeOptionalField(
            planned.contentFilters,
            (value) => { updated.contentFilters = value; },
            () => { delete updated.contentFilters; }
        );
        mergeOptionalField(
            planned.sortOrder,
            (value) => { updated.sortOrder = value; },
            () => { delete updated.sortOrder; },
            (value) => Boolean(value)
        );
        mergeOptionalField(
            planned.blockSize,
            (value) => { updated.blockSize = value; },
            () => { delete updated.blockSize; },
            (value) => typeof value === 'number' && Number.isFinite(value)
        );
        mergeOptionalField(
            planned.buildStrategy,
            (value) => { updated.buildStrategy = value; },
            () => { delete updated.buildStrategy; }
        );
        mergeOptionalField(
            planned.sourceLibraryId,
            (value) => { updated.sourceLibraryId = value; },
            () => { delete updated.sourceLibraryId; }
        );
        mergeOptionalField(
            planned.sourceLibraryName,
            (value) => { updated.sourceLibraryName = value; },
            () => { delete updated.sourceLibraryName; }
        );
        mergeOptionalField(
            planned.lineupReplicaIndex,
            (value) => { updated.lineupReplicaIndex = value; },
            () => { delete updated.lineupReplicaIndex; }
        );
        mergeOptionalField(
            planned.isPlaybackModeVariant,
            (value) => { updated.isPlaybackModeVariant = value; },
            () => { delete updated.isPlaybackModeVariant; }
        );
        if (existing.isAutoGenerated === true) {
            updated.name = planned.name;
        }
        return updated;
    }
}

function compareChannelsByNumber(left: ChannelConfig, right: ChannelConfig): number {
    return left.number - right.number;
}

function chooseInitialChannelNumber(
    channels: ChannelConfig[],
    currentChannelId: string | null
): number | undefined {
    const current = currentChannelId
        ? channels.find((channel) => channel.id === currentChannelId)
        : null;
    return (current ?? channels[0])?.number;
}
