import { ChannelManager } from '../../modules/scheduler/channel-manager';
import type { IChannelManager, ChannelConfig } from '../../modules/scheduler/channel-manager';
import type { IPlexLibrary } from '../../modules/plex/library';
import { MAX_CHANNEL_NUMBER } from '../../modules/scheduler/channel-manager/constants';
import { redactSensitiveTokens } from '../../utils/redact';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupConfig,
} from './types';
import { diffChannelPlans, type PendingChannel, type ChannelDiffResult } from './ChannelSetupPlanner';
import type { ChannelSetupPlanningService } from './ChannelSetupPlanningService';

export interface ChannelSetupBuildExecutorDeps {
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    storageRemove: (key: string) => void;
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }) => Promise<void>;
    planningService: ChannelSetupPlanningService;
}

export class ChannelSetupBuildExecutor {
    constructor(private readonly _deps: ChannelSetupBuildExecutorDeps) {}

	    async createChannelsFromSetup(
	        config: ChannelSetupConfig,
	        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
	    ): Promise<ChannelBuildSummary> {
        const signal = options?.signal;
        const reportProgress = (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ): void => {
            options?.onProgress?.({ task, label, detail, current, total });
        };

        const checkCanceled = (): boolean => {
            return signal?.aborted ?? false;
        };

        if (checkCanceled()) {
            return { created: 0, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: true, lastTask: 'init' };
        }

        reportProgress('fetch_playlists', 'Preparing...', 'Loading libraries', 0, null);

        let libraries;
        let epgRefreshFailed = false;

        try {
            libraries = await this._deps.planningService.getLibrariesForSetup(signal ?? null);
        } catch (e) {
            if (isAbortLike(e, signal ?? undefined)) {
                reportProgress('fetch_playlists', 'Preparing...', 'Canceled', 0, null);
                return { created: 0, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: true, lastTask: 'fetch_playlists' };
            }
            throw e;
        }

        const normalizedConfig = this._deps.planningService.normalizeConfig(config);
        const planResult = await this._deps.planningService.buildSetupPlan(
            normalizedConfig,
            libraries,
            signal ?? null,
            reportProgress
        );

        if (planResult.canceled || !planResult.plan) {
            return {
                created: 0,
                skipped: 0,
                reachedMaxChannels: false,
                errorCount: planResult.errorsTotal,
                canceled: true,
                lastTask: planResult.lastTask ?? 'build_pending',
            };
        }

        const pending = planResult.plan.pendingChannels;
        let skippedCount = planResult.plan.skipped;
        let reachedMax = planResult.plan.reachedMaxChannels;

        if (checkCanceled()) {
            return { created: 0, skipped: skippedCount, reachedMaxChannels: reachedMax, errorCount: planResult.errorsTotal, canceled: true, lastTask: 'build_pending' };
        }

        const existingChannels = this._deps.channelManager.getAllChannels();
        const diff = diffChannelPlans(existingChannels, pending);
        const pendingToCreate = this._deps.planningService.getPendingChannelsForMode(normalizedConfig.buildMode, pending, diff);

        reportProgress('create_channels', 'Shuffling...', 'Setting up lineup', 0, pendingToCreate.length);

        const tempKeyId = String(Date.now());
        const tempKey = `lineup_channels_build_tmp_v1:${tempKeyId}`;
        const tempCurrentKey = `lineup_current_channel_build_tmp_v1:${tempKeyId}`;
        const builder = new ChannelManager({
            plexLibrary: this._deps.plexLibrary,
            storageKey: tempKey,
            currentChannelKey: tempCurrentKey,
            logger: {
                warn: (msg, ...args): void => console.warn(msg, ...args.map(summarizeErrorForLog)),
                error: (msg, ...args): void => console.error(msg, ...args.map(summarizeErrorForLog)),
            },
        });

        const safeCleanup = (label: string, fn: () => void): void => {
            try {
                fn();
            } catch (error: unknown) {
                console.warn(`[ChannelSetup] cleanup failed (${label}):`, summarizeErrorForLog(error));
            }
        };

        const finalSummary: ChannelBuildSummary = {
            created: 0,
            skipped: skippedCount,
            reachedMaxChannels: false,
            errorCount: planResult.errorsTotal,
            canceled: false,
            lastTask: 'Initializing...',
        };

        try {
            let pIndex = 0;
            const buildMode = normalizedConfig.buildMode ?? 'replace';
            const availableNumbers = buildMode === 'replace'
                ? []
                : this._getAvailableChannelNumbers(existingChannels);

            if (buildMode !== 'replace' && pendingToCreate.length > availableNumbers.length) {
                reachedMax = true;
            }

            const maxCreates = buildMode === 'replace'
                ? pendingToCreate.length
                : Math.min(pendingToCreate.length, availableNumbers.length);
            const cappedSkippedCount = Math.max(0, pendingToCreate.length - maxCreates);

            finalSummary.skipped = skippedCount + cappedSkippedCount;

            for (const p of pendingToCreate) {
                pIndex++;
                if (finalSummary.created >= maxCreates) {
                    break;
                }

                if (checkCanceled()) {
                    finalSummary.reachedMaxChannels = reachedMax;
                    finalSummary.canceled = true;
                    finalSummary.lastTask = 'create_channels';
                    return finalSummary;
                }

                if (pIndex % 5 === 0) {
                    reportProgress('create_channels', 'Creating channels...', `Channel ${finalSummary.created + 1}`, pIndex, pendingToCreate.length);
                }

                try {
                    const channelParams: Partial<ChannelConfig> = {
                        name: p.name,
                        contentSource: p.contentSource,
                        playbackMode: p.playbackMode,
                        shuffleSeed: p.shuffleSeed,
                        isAutoGenerated: p.isAutoGenerated === true,
                    };
                    if (p.lineupReplicaIndex !== undefined) {
                        channelParams.lineupReplicaIndex = p.lineupReplicaIndex;
                    }
                    if (p.isSequentialVariant !== undefined) {
                        channelParams.isSequentialVariant = p.isSequentialVariant;
                    }
                    if (p.contentFilters) {
                        channelParams.contentFilters = p.contentFilters;
                    }
                    if (p.sortOrder) {
                        channelParams.sortOrder = p.sortOrder;
                    }
                    if (typeof p.blockSize === 'number' && Number.isFinite(p.blockSize)) {
                        channelParams.blockSize = p.blockSize;
                    }
                    if (p.buildStrategy !== undefined) channelParams.buildStrategy = p.buildStrategy;
                    if (p.sourceLibraryId !== undefined) channelParams.sourceLibraryId = p.sourceLibraryId;
                    if (p.sourceLibraryName !== undefined) channelParams.sourceLibraryName = p.sourceLibraryName;
                    if (buildMode !== 'replace') {
                        const nextNumber = availableNumbers.shift();
                        if (!nextNumber) {
                            reachedMax = true;
                            break;
                        }
                        channelParams.number = nextNumber;
                    }

                    await builder.createChannel(channelParams, { signal: signal ?? null });

                    finalSummary.created++;
                } catch (e) {
                    if (isAbortLike(e, signal ?? undefined)) {
                        finalSummary.reachedMaxChannels = reachedMax;
                        finalSummary.canceled = true;
                        finalSummary.lastTask = 'create_channels';
                        return finalSummary;
                    }
                    console.warn(`Failed to create channel ${p.name}:`, summarizeErrorForLog(e));
                    finalSummary.errorCount++;
                }
            }
            finalSummary.reachedMaxChannels = reachedMax;

            if (checkCanceled()) {
                finalSummary.canceled = true;
                finalSummary.lastTask = 'apply_channels';
                return finalSummary;
            }

            reportProgress('apply_channels', 'Saving...', 'Saving library', finalSummary.created, finalSummary.created);
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

            reportProgress('refresh_epg', 'Refreshing guide...', 'Loading schedules', 0, null);
            try {
                this._deps.primeEpgChannels();
                await this._deps.refreshEpgSchedules({ reason: 'channel-setup', debounceMs: 0 });
            } catch (error: unknown) {
                epgRefreshFailed = true;
                console.warn('[ChannelSetup] EPG refresh failed after commit:', summarizeErrorForLog(error));
                reportProgress('refresh_epg', 'Refreshing guide...', 'Guide refresh failed (channels saved)', 0, null);
            }
        } catch (e) {
            console.error('[ChannelSetup] Channel build failed:', summarizeErrorForLog(e));
            throw e;
        } finally {
            safeCleanup('builder.dispose', () => builder.dispose());
            safeCleanup(`storageRemove(${tempKey})`, () => this._deps.storageRemove(tempKey));
            safeCleanup(`storageRemove(${tempCurrentKey})`, () => this._deps.storageRemove(tempCurrentKey));
        }

        const finalDetail = epgRefreshFailed
            ? `Built ${finalSummary.created} channels (guide refresh failed)`
            : `Built ${finalSummary.created} channels`;
        reportProgress('done', 'Done!', finalDetail, finalSummary.created, finalSummary.created);
        return finalSummary;
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
        if (planned.contentFilters) {
            updated.contentFilters = planned.contentFilters;
        } else {
            delete updated.contentFilters;
        }
        if (planned.sortOrder) {
            updated.sortOrder = planned.sortOrder;
        } else {
            delete updated.sortOrder;
        }
        if (typeof planned.blockSize === 'number' && Number.isFinite(planned.blockSize)) {
            updated.blockSize = planned.blockSize;
        } else {
            delete updated.blockSize;
        }
        if (planned.buildStrategy !== undefined) {
            updated.buildStrategy = planned.buildStrategy;
        } else {
            delete updated.buildStrategy;
        }
        if (planned.sourceLibraryId !== undefined) {
            updated.sourceLibraryId = planned.sourceLibraryId;
        } else {
            delete updated.sourceLibraryId;
        }
        if (planned.sourceLibraryName !== undefined) {
            updated.sourceLibraryName = planned.sourceLibraryName;
        } else {
            delete updated.sourceLibraryName;
        }
        if (planned.lineupReplicaIndex !== undefined) {
            updated.lineupReplicaIndex = planned.lineupReplicaIndex;
        } else {
            delete updated.lineupReplicaIndex;
        }
        if (planned.isSequentialVariant !== undefined) {
            updated.isSequentialVariant = planned.isSequentialVariant;
        } else {
            delete updated.isSequentialVariant;
        }
        if (existing.isAutoGenerated === true) {
            updated.name = planned.name;
        }
        return updated;
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

function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true;
    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') return true;
    if (error && typeof error === 'object' && 'name' in error) {
        const namedError = error as { name?: unknown };
        if (namedError.name === 'AbortError') return true;
    }
    return false;
}

function compareChannelsByNumber(left: ChannelConfig, right: ChannelConfig): number {
    return left.number - right.number;
}
