import type { StudioAirCheckPort, StudioAirCheckRequest, StudioVerificationStatus } from '../channel-studio/ChannelStudioContracts';
import type { ChannelStructuralBase } from '../../modules/scheduler/channel-manager/contracts/ChannelDurability';
import type { IPlexLibraryMinimal } from '../../modules/scheduler/channel-manager/contracts/interfaces';
import { ContentResolver } from '../../modules/scheduler/channel-manager/resolution/ContentResolver';
import { OrchestratorSchedulePolicy } from '../orchestrator/policy/OrchestratorSchedulePolicy';
import { buildScheduleIndex, generateScheduleWindow, MAX_WINDOW_PROGRAMS } from '../../modules/scheduler/scheduler/ScheduleCalculator';
import { ShuffleGenerator } from '../../modules/scheduler/scheduler/ShuffleGenerator';
import type { ResolvedContentItem, ScheduledProgram } from '../../modules/scheduler/scheduler/types';
import { isAbortLikeError } from '../../utils/errors';
import { AppErrorCode, getAppErrorCode } from '../../types/app-errors';

const MAX_HORIZON_MS = 24 * 60 * 60_000;

/** Extra presentation facts carried with a verified Studio result. */
export type AirCheckVerified = Extract<StudioVerificationStatus, { kind: 'verified' }> & {
    programs: readonly ScheduledProgram[];
    coverageEnd: number;
    loopDurationMs: number;
};

export interface ProductionAirCheckDependencies {
    library: IPlexLibraryMinimal;
    getStructuralBase(): ChannelStructuralBase;
    now(): number;
}

const sameBase = (a: ChannelStructuralBase, b: ChannelStructuralBase): boolean =>
    a.generation === b.generation && a.revision === b.revision;

/** Resolves an unsaved candidate without publishing it to ChannelManager or the live scheduler. */
export class ProductionAirCheck implements Pick<StudioAirCheckPort, 'verify'> {
    private readonly policy = new OrchestratorSchedulePolicy();
    private readonly deps: ProductionAirCheckDependencies;

    constructor(deps: ProductionAirCheckDependencies) {
        this.deps = deps;
    }

    async verify(request: StudioAirCheckRequest, signal: AbortSignal): Promise<StudioVerificationStatus> {
        const checkedAt = this.deps.now();
        if (signal.aborted) return { kind: 'canceled' };
        if (!sameBase(request.expectedBase, this.deps.getStructuralBase())) {
            return { kind: 'stale', reason: 'The lineup changed. Run Air Check again.', checkedAt };
        }
        if (request.sourceIdentity !== JSON.stringify(request.source)
            || JSON.stringify(request.candidate.contentSource) !== request.sourceIdentity) {
            return { kind: 'stale', reason: 'The source changed. Run Air Check again.', checkedAt };
        }
        if (!Number.isFinite(request.asOf) || !Number.isFinite(request.horizonMs)
            || request.horizonMs <= 0 || request.horizonMs > MAX_HORIZON_MS
            || !Number.isSafeInteger(request.asOf + request.horizonMs)
            || !Number.isFinite(request.candidate.shuffleSeed)
            || !Number.isFinite(request.candidate.phaseSeed)) {
            return { kind: 'error', reason: 'Air Check needs a valid time, horizon, and seed.', checkedAt };
        }

        // Mixed collection absence is intentionally tolerated by the live resolver.
        // It is still incomplete evidence for an authored Save.
        let missingPart = false;
        let emptyPart = false;
        let incompleteExpansion = false;
        // Resolution caches and warning evidence belong to this exact check. A Save
        // must not join an older horizon's incomplete producer and call it verified.
        const resolver = new ContentResolver(this.deps.library, {
            warn: (): void => { incompleteExpansion = true; },
        });
        try {
            const raw = await resolver.resolveSource(request.source, {
                signal,
                cacheMode: 'revalidate',
                onSourceDiagnostic: diagnostic => {
                    if (diagnostic.event === 'settled' && diagnostic.outcome === 'failure'
                        && !diagnostic.callerAborted && !diagnostic.consumerAborted) missingPart = true;
                    if (diagnostic.event === 'result' && diagnostic.outcome === 'success'
                        && diagnostic.itemCount === 0) emptyPart = true;
                },
            });
            if (signal.aborted) return { kind: 'canceled' };
            if (!sameBase(request.expectedBase, this.deps.getStructuralBase())) {
                return { kind: 'stale', reason: 'The lineup changed. Run Air Check again.', checkedAt: this.deps.now() };
            }
            if (raw.length === 0) return { kind: 'offair', reason: 'This source has no playable items. It remains available to edit.', checkedAt: this.deps.now() };
            if (missingPart || emptyPart || incompleteExpansion) {
                return { kind: 'partial', reason: 'A source is missing or incomplete. Retry or edit the source.', checkedAt: this.deps.now() };
            }
            const items = resolver.selectChannelItems(request.candidate, raw);
            if (items.length === 0) return { kind: 'offair', reason: 'No items match the current playback and filter choices.', checkedAt: this.deps.now() };
            const end = request.asOf + request.horizonMs;
            const { programs, loopDurationMs } = this.projectSchedule(request, items);
            const coverageEnd = programs[programs.length - 1]?.scheduledEndTime ?? request.asOf;
            if (!Number.isFinite(coverageEnd) || coverageEnd < end) {
                return { kind: 'partial', reason: 'The schedule preview reached its safe program limit. Shorten the horizon or edit the source.', checkedAt: this.deps.now() };
            }
            if (signal.aborted) return { kind: 'canceled' };
            if (!sameBase(request.expectedBase, this.deps.getStructuralBase())) {
                return { kind: 'stale', reason: 'The lineup changed. Run Air Check again.', checkedAt: this.deps.now() };
            }
            const result: AirCheckVerified = { kind: 'verified', request, checkedAt: this.deps.now(), items,
                programs, coverageEnd, loopDurationMs };
            return result;
        } catch (error) {
            if (signal.aborted || isAbortLikeError(error, signal)) return { kind: 'canceled' };
            if (error && typeof error === 'object' && 'code' in error
                && getAppErrorCode((error as { code: unknown }).code) === AppErrorCode.RESOURCE_NOT_FOUND) {
                return { kind: 'offair', reason: 'The saved source is unavailable. It remains available to edit or retry.', checkedAt: this.deps.now() };
            }
            // Plex errors may contain server addresses or credentials; display a fixed message.
            return { kind: 'error', reason: 'Could not verify the source. Retry Air Check.', checkedAt: this.deps.now() };
        } finally {
            resolver.clearCaches();
        }
    }

    private projectSchedule(request: StudioAirCheckRequest, items: ResolvedContentItem[]): {
        programs: ScheduledProgram[];
        loopDurationMs: number;
    } {
        const programs: ScheduledProgram[] = [];
        const end = request.asOf + request.horizonMs;
        let cursor = request.asOf;
        let loopDurationMs = 0;
        while (cursor < end && programs.length < MAX_WINDOW_PROGRAMS) {
            const config = this.policy.buildDailyScheduleConfig(request.candidate, items, cursor);
            const index = buildScheduleIndex(config, new ShuffleGenerator());
            loopDurationMs = index.totalLoopDurationMs;
            const nextMidnight = new Date(cursor);
            nextMidnight.setHours(24, 0, 0, 0);
            const segmentEnd = Math.min(end, nextMidnight.getTime());
            const segment = generateScheduleWindow(cursor, segmentEnd, index, config.anchorTime);
            segment.length = Math.min(segment.length, MAX_WINDOW_PROGRAMS - programs.length);
            if (programs.length > 0 && segment[0] && segment[0].scheduledStartTime < cursor) {
                segment[0] = { ...segment[0], scheduledStartTime: cursor };
            }
            programs.push(...segment);

            // Live day rollover lets the overnight program finish before adopting
            // the new day's policy. Project that boundary without timer/network delay.
            const coverageEnd = programs[programs.length - 1]?.scheduledEndTime ?? cursor;
            if (!(coverageEnd > cursor) || coverageEnd < segmentEnd) break;
            cursor = coverageEnd;
        }
        return { programs, loopDurationMs };
    }
}
