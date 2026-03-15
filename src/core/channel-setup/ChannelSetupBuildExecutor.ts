import { ChannelManager } from '../../modules/scheduler/channel-manager';
import type { IChannelManager, ChannelConfig } from '../../modules/scheduler/channel-manager';
import type { IPlexLibrary, PlexLibraryType } from '../../modules/plex/library';
import { MAX_CHANNEL_NUMBER } from '../../modules/scheduler/channel-manager/constants';
import { redactSensitiveTokens } from '../../utils/redact';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupConfig,
} from './types';
import { diffChannelPlans, type PendingChannel, type ChannelDiffResult } from './ChannelSetupPlanner';
import type { ChannelSetupPlanBuildResult, ChannelSetupPlanningService } from './ChannelSetupPlanningService';

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

        let libraries: PlexLibraryType[];
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
	        let planResult: ChannelSetupPlanBuildResult;
	        try {
	            planResult = await this._deps.planningService.buildSetupPlan(
	                normalizedConfig,
	                libraries,
	                signal ?? null,
	                reportProgress
	            );
	        } catch (e) {
	            if (isAbortLike(e, signal ?? undefined)) {
	                reportProgress('build_pending', 'Preparing...', 'Canceled', 0, null);
	                return { created: 0, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: true, lastTask: 'build_pending' };
	            }
	            throw e;
	        }

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

	        const tempKeyId = `${Date.now()}-${generateUUID()}`;
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
            lastTask: 'create_channels',
        };

	        try {
	            let pIndex = 0;
	            let attemptedCount = 0;
	            const computeSkipped = (): number =>
	                skippedCount + Math.max(0, pendingToCreate.length - attemptedCount);
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
            for (const p of pendingToCreate) {
                pIndex++;
                if (finalSummary.created >= maxCreates) {
                    break;
                }

	                if (checkCanceled()) {
	                    finalSummary.skipped = computeSkipped();
	                    finalSummary.reachedMaxChannels = reachedMax;
	                    finalSummary.canceled = true;
	                    finalSummary.lastTask = 'create_channels';
	                    return finalSummary;
	                }

                if (pIndex % 5 === 0) {
                    reportProgress('create_channels', 'Creating channels...', `Channel ${finalSummary.created + 1}`, pIndex, pendingToCreate.length);
                }

                try {
                    attemptedCount++;
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

                    await builder.createChannel(channelParams, { signal: signal ?? null });
                    if (pendingNumberReserved) {
                        availableNumbers.shift();
                    }

                    finalSummary.created++;
	                } catch (e) {
	                    if (isAbortLike(e, signal ?? undefined)) {
	                        finalSummary.skipped = computeSkipped();
	                        finalSummary.reachedMaxChannels = reachedMax;
	                        finalSummary.canceled = true;
	                        finalSummary.lastTask = 'create_channels';
	                        return finalSummary;
	                    }
	                    console.warn(`Failed to create channel ${p.name}:`, summarizeErrorForLog(e));
	                    finalSummary.errorCount++;
	                }
	            }
	            finalSummary.skipped = computeSkipped();
	            finalSummary.reachedMaxChannels = reachedMax;

            if (checkCanceled()) {
                finalSummary.canceled = true;
                finalSummary.lastTask = 'apply_channels';
                return finalSummary;
            }

            reportProgress('apply_channels', 'Saving...', 'Saving library', finalSummary.created, finalSummary.created);
            finalSummary.lastTask = 'apply_channels';
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
            finalSummary.lastTask = 'refresh_epg';
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
	        finalSummary.lastTask = 'done';
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

	        const mergeOptionalField = <T>(
	            value: T | undefined,
	            apply: (v: T) => void,
	            remove: () => void,
	            isValid: (v: T) => boolean = () => true
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
	            planned.isSequentialVariant,
	            (value) => { updated.isSequentialVariant = value; },
	            () => { delete updated.isSequentialVariant; }
	        );
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

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch {
            // Fall back to Math.random implementation.
        }
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function compareChannelsByNumber(left: ChannelConfig, right: ChannelConfig): number {
    return left.number - right.number;
}
