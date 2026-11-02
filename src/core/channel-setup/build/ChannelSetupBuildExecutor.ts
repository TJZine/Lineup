import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type {
    ChannelBuildProgress,
    ChannelSetupApplyResult,
    ChannelSetupApplyFailure,
    ChannelSetupConfig,
} from '../types';
import type { ChannelSetupPlanningService } from '../planning/ChannelSetupPlanningService';
import type { ChannelSetupBuildCommitter } from './ChannelSetupBuildCommitter';
import { normalizeChannelSetupConfig } from '../config/normalizeChannelSetupConfig';
import type { ChannelStructuralBase } from '../../../modules/scheduler/channel-manager';
import type { ChannelSetupInventory } from '../planning/ChannelSetupInventory';
import { buildChannelSetupCandidate, type ChannelSetupCandidate } from './ChannelSetupPreparedCandidate';
import type { ChannelSetupReview } from '../types';

type PreparedReview = {
    id: string;
    scopeKey: string;
    base: ChannelStructuralBase;
    configKey: string;
    inventoryGeneration: number;
    acceptedLibraryIds: readonly string[];
    candidate: ChannelSetupCandidate;
    protectedHandle: string | null;
    noChange: boolean;
};

export interface ChannelSetupBuildExecutorDeps {
    channelManager: IChannelManager;
    planningService: ChannelSetupPlanningService;
    buildCommitter: ChannelSetupBuildCommitter;
}

export class ChannelSetupBuildExecutor {
    private _prepared: PreparedReview | null = null;
    private _prepareGeneration = 0;
    constructor(private readonly _deps: ChannelSetupBuildExecutorDeps) {}

    async prepareSetupReview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; acceptedReadyLibraryIds?: readonly string[];
            confirmedDeselectedLibraryIds?: readonly string[] }
    ): Promise<ChannelSetupReview> {
        this._retirePrepared();
        const prepareGeneration = this._prepareGeneration;
        const normalized = normalizeChannelSetupConfig(config);
        const base = this._deps.channelManager.getStructuralBase();
        const inventory = await this._deps.planningService.scanSetupInventory(normalized,
            options?.signal ? { signal: options.signal } : undefined);
        if (prepareGeneration !== this._prepareGeneration || options?.signal?.aborted) {
            return blockedReview('Review canceled or superseded.', inventory);
        }
        const ready = new Set(inventory.acceptedReadyLibraryIds);
        const incomplete = inventory.libraries.some((fact) => fact.status !== 'ready');
        if (incomplete && !options?.acceptedReadyLibraryIds) {
            return blockedReview('Inventory is incomplete. Explicitly select a ready subset before Review.', inventory);
        }
        const accepted = options?.acceptedReadyLibraryIds ?? inventory.acceptedReadyLibraryIds;
        if (accepted.length === 0 || new Set(accepted).size !== accepted.length
            || accepted.some((id) => !ready.has(id))) {
            return blockedReview('Select at least one fully ready library before Review.', inventory);
        }
        const confirmedDeselected = options?.confirmedDeselectedLibraryIds ?? [];
        if (confirmedDeselected.some((id) => normalized.selectedLibraryIds.includes(id)
            || !this._deps.planningService.isLibraryInventoryReady(id, normalized))) {
            return blockedReview('Deselected library inventory changed. Scan again before removing its channels.', inventory);
        }
        const result = await this._deps.planningService.buildAcceptedPlan(normalized, accepted, options?.signal);
        if (prepareGeneration !== this._prepareGeneration || options?.signal?.aborted) {
            return blockedReview('Review canceled or superseded.', inventory);
        }
        if (!result.plan) return blockedReview(result.blockedMessage ?? 'Unable to prepare Review.', inventory);
        if (!sameBase(base, this._deps.channelManager.getStructuralBase())
            || inventory.generation !== this._deps.planningService.inventoryGeneration) {
            return blockedReview('Lineup or inventory changed. Refresh Review.', inventory);
        }
        const load = this._deps.channelManager.getLastLoadOutcome();
        if (load.kind === 'read-failed' || load.kind === 'unloaded') {
            return blockedReview('Saved lineup could not be read. Retry restore before Review.', inventory);
        }
        let protectedLoad: ReturnType<IChannelManager['prepareProtectedReplacement']> | null = null;
        if (load.kind === 'unreadable' || load.kind === 'unsupported') {
            try {
                protectedLoad = this._deps.channelManager.prepareProtectedReplacement();
            } catch {
                return blockedReview('Saved lineup changed or could not be rechecked. Retry restore before Review.', inventory);
            }
        }
        if (protectedLoad && protectedLoad.kind !== 'unreadable' && protectedLoad.kind !== 'unsupported') {
            return blockedReview('Saved lineup changed. Retry restore before Review.', inventory);
        }
        const existing = protectedLoad ? [] : this._deps.channelManager.getAllChannels();
        const unknown = normalized.selectedLibraryIds.filter((id) => !accepted.includes(id));
        const candidate = buildChannelSetupCandidate(normalized, existing, result.plan.pendingChannels,
            unknown, confirmedDeselected, Date.now, undefined, inventory.sharedPlaylistsStatus === 'ready');
        if (candidate.channels.length === 0) {
            if (protectedLoad?.replacementHandle) {
                this._deps.channelManager.cancelProtectedReplacement(protectedLoad.replacementHandle);
            }
            return blockedReview('No channels match these libraries and strategies. Change the selection before Review.', inventory);
        }
        if (candidate.reachedMaxChannels && candidate.rows.every((row) => row.action === 'retained')) {
            if (protectedLoad?.replacementHandle) {
                this._deps.channelManager.cancelProtectedReplacement(protectedLoad.replacementHandle);
            }
            return blockedReview('No channel numbers are available within 1–500. Change the selection before Review.', inventory);
        }
        const noChange = !protectedLoad && candidate.rows.every((row) => row.action === 'retained')
            && candidate.channels.length === existing.length;
        const prepared: PreparedReview = {
            id: `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            scopeKey: inventory.scopeKey,
            base,
            configKey: JSON.stringify(normalized),
            inventoryGeneration: inventory.generation,
            acceptedLibraryIds: [...accepted],
            candidate,
            protectedHandle: protectedLoad?.replacementHandle ?? null,
            noChange,
        };
        if (prepareGeneration !== this._prepareGeneration || options?.signal?.aborted) {
            if (prepared.protectedHandle) this._deps.channelManager.cancelProtectedReplacement(prepared.protectedHandle);
            return blockedReview('Review canceled or superseded.', inventory);
        }
        this._prepared = prepared;
        const created = candidate.rows.filter((row) => row.action === 'created');
        const removed = candidate.rows.filter((row) => row.action === 'removed');
        const unchanged = candidate.rows.filter((row) => row.action === 'retained' || row.action === 'changed');
        return {
            preparedId: prepared.id,
            rows: candidate.rows.map((row) => ({ ...row })),
            inventory,
            oldChannelCount: protectedLoad ? null : existing.length,
            requiresWholeLineupReplacement: protectedLoad !== null,
            preview: {
                estimates: result.plan.estimates,
                warnings: result.warnings,
                reachedMaxChannels: result.plan.reachedMaxChannels || candidate.reachedMaxChannels,
                status: 'ready',
            },
            diff: {
                summary: { created: created.length, removed: removed.length, unchanged: unchanged.length },
                samples: {
                    created: created.slice(0, 6).map((row) => row.name),
                    removed: removed.slice(0, 6).map((row) => row.name),
                    unchanged: unchanged.slice(0, 6).map((row) => row.name),
                },
            },
        };
    }

    async applySetupReview(
        reviewId: string,
        config: ChannelSetupConfig,
        consent: { removalConfirmedForReviewId: string | null;
            wholeLineupReplacementConfirmedForReviewId: string | null },
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelSetupApplyResult> {
        const prepared = this._prepared;
        if (!prepared || prepared.id !== reviewId) return blockedSummary('Review expired. Prepare it again.', 'stale');
        if (prepared.candidate.rows.some((row) => row.action === 'removed')
            && consent.removalConfirmedForReviewId !== prepared.id) {
            return blockedSummary('Confirm the complete removal set before Apply.', 'consent');
        }
        if (prepared.protectedHandle && consent.wholeLineupReplacementConfirmedForReviewId !== prepared.id) {
            return blockedSummary('Confirm replacement of the unreadable saved lineup before Apply.', 'consent');
        }
        const normalized = normalizeChannelSetupConfig(config);
        const current = (): boolean => !options?.signal?.aborted
            && this._prepared === prepared
            && JSON.stringify(normalized) === prepared.configKey
            && sameBase(prepared.base, this._deps.channelManager.getStructuralBase())
            && prepared.inventoryGeneration === this._deps.planningService.inventoryGeneration
            && prepared.scopeKey === this._deps.planningService.getCurrentScopeKey()
            && prepared.acceptedLibraryIds.every((id) =>
                this._deps.planningService.isLibraryInventoryReady(id, normalized));
        if (!current()) return blockedSummary('Lineup, configuration or inventory changed. Refresh Review.', 'stale');
        if (prepared.noChange) {
            this._retirePrepared();
            return { kind: 'no-change', summary: { created: 0, skipped: prepared.candidate.skipped,
                reachedMaxChannels: false, errorCount: 0, canceled: false, lastTask: 'done', noChange: true } };
        }
        const result = await this._deps.buildCommitter.commitPreparedCandidate({
            channels: prepared.candidate.channels,
            sourceCheckIds: prepared.candidate.rows.filter((row) => row.action === 'created' || row.action === 'changed')
                .map((row) => row.channelId),
            minItemsPerChannel: normalized.minItemsPerChannel,
            expectedBase: prepared.base,
            protectedReplacementHandle: prepared.protectedHandle,
            isCurrent: current,
            signal: options?.signal ?? null,
            ...(options?.onProgress ? { onProgress: options.onProgress } : {}),
            created: prepared.candidate.rows.filter((row) => row.action === 'created').length,
            skipped: prepared.candidate.skipped,
            reachedMaxChannels: prepared.candidate.reachedMaxChannels,
        });
        if (result.kind === 'committed') this._retirePrepared();
        return result;
    }

    cancelPreparedReview(): void { this._retirePrepared(); }

    private _retirePrepared(): void {
        this._prepareGeneration++;
        if (this._prepared?.protectedHandle) this._deps.channelManager.cancelProtectedReplacement(this._prepared.protectedHandle);
        this._prepared = null;
    }


}

function sameBase(a: ChannelStructuralBase, b: ChannelStructuralBase): boolean {
    return a.generation === b.generation && a.revision === b.revision;
}

function blockedSummary(message: string, kind: ChannelSetupApplyFailure): ChannelSetupApplyResult {
    return { kind: 'blocked', message, reason: kind };
}

function blockedReview(message: string, inventory: ChannelSetupInventory): ChannelSetupReview {
    return { inventory, oldChannelCount: null,
        preview: { estimates: { total: 0, collections: 0, playlists: 0, genres: 0, directors: 0,
            decades: 0, recentlyAdded: 0, studios: 0, actors: 0 }, warnings: [], reachedMaxChannels: false,
            status: 'blocked', message },
        diff: { summary: { created: 0, removed: 0, unchanged: 0 },
            samples: { created: [], removed: [], unchanged: [] } } };
}
