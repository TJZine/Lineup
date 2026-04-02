import { ChannelManager } from '../../modules/scheduler/channel-manager';
import type { IChannelManager, ChannelConfig } from '../../modules/scheduler/channel-manager';
import { MAX_CHANNEL_NUMBER } from '../../modules/scheduler/channel-manager/constants';
import type { IPlexLibrary } from '../../modules/plex/library';
import { summarizeErrorForLog } from '../../utils/errors';
import type { ChannelBuildProgress, ChannelBuildSummary, ChannelSetupConfig } from './types';
import type { PendingChannel, ChannelDiffResult } from './ChannelSetupPlanner';
import { isSignalAborted } from './utils';

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
    storageRemove: (key: string) => void;
    ensureEpgInitialized: () => Promise<void>;
    clearSelectedChannelScheduleSnapshot: () => void;
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }) => Promise<void>;
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

        try {
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
                    const channelParams: Partial<ChannelConfig> = {
                        name: pending.name,
                        contentSource: pending.contentSource,
                        playbackMode: pending.playbackMode,
                        shuffleSeed: pending.shuffleSeed,
                        isAutoGenerated: pending.isAutoGenerated === true,
                    };
                    if (pending.lineupReplicaIndex !== undefined) {
                        channelParams.lineupReplicaIndex = pending.lineupReplicaIndex;
                    }
                    if (pending.isSequentialVariant !== undefined) {
                        channelParams.isSequentialVariant = pending.isSequentialVariant;
                    }
                    if (pending.contentFilters) {
                        channelParams.contentFilters = pending.contentFilters;
                    }
                    if (pending.sortOrder) {
                        channelParams.sortOrder = pending.sortOrder;
                    }
                    if (typeof pending.blockSize === 'number' && Number.isFinite(pending.blockSize)) {
                        channelParams.blockSize = pending.blockSize;
                    }
                    if (pending.buildStrategy !== undefined) channelParams.buildStrategy = pending.buildStrategy;
                    if (pending.sourceLibraryId !== undefined) channelParams.sourceLibraryId = pending.sourceLibraryId;
                    if (pending.sourceLibraryName !== undefined) channelParams.sourceLibraryName = pending.sourceLibraryName;

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
                    if (isSignalAborted(signal ?? undefined)) {
                        summary.skipped = computeSkipped();
                        summary.reachedMaxChannels = reachedMax;
                        summary.canceled = true;
                        summary.lastTask = 'create_channels';
                        return { summary, epgRefreshFailed };
                    }
                    console.warn(`Failed to create channel ${pending.name}:`, summarizeErrorForLog(error));
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

            reportProgress('refresh_epg', 'Refreshing guide...', 'Loading schedules', 0, null);
            summary.lastTask = 'refresh_epg';
            try {
                this._deps.clearSelectedChannelScheduleSnapshot();
                await this._deps.ensureEpgInitialized();
                this._deps.primeEpgChannels();
                await this._deps.refreshEpgSchedules({ reason: 'channel-setup', debounceMs: 0 });
            } catch (error: unknown) {
                epgRefreshFailed = true;
                console.warn('[ChannelSetup] EPG refresh failed after commit:', summarizeErrorForLog(error));
                reportProgress('refresh_epg', 'Refreshing guide...', 'Guide refresh failed (channels saved)', 0, null);
            }
        } catch (error) {
            console.error('[ChannelSetup] Channel build failed:', summarizeErrorForLog(error));
            throw error;
        } finally {
            safeCleanup('builder.dispose', () => builder.dispose());
            safeCleanup(`storageRemove(${tempKey})`, () => this._deps.storageRemove(tempKey));
            safeCleanup(`storageRemove(${tempCurrentKey})`, () => this._deps.storageRemove(tempCurrentKey));
        }

        const finalDetail = epgRefreshFailed
            ? `Built ${summary.created} channels (guide refresh failed)`
            : `Built ${summary.created} channels`;
        summary.lastTask = 'done';
        reportProgress('done', 'Done!', finalDetail, summary.created, summary.created);

        return { summary, epgRefreshFailed };
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
