import type { ResolvedChannelContent } from '../../../scheduler/channel-manager';
import type { AppendIssueDiagnostic } from '../../../debug/IssueDiagnosticsStore';
import { summarizeErrorForLog } from '../../../../utils/errors';
import type { RefreshPhase, RefreshSession } from './EPGScheduleRefreshRuntimeTypes';

const QA_003B_ISSUE_ID = 'QA-003b';

export function getEpgScheduleRangeKey(startTime: number, endTime: number): string {
    return `${startTime}-${endTime}`;
}

export function cloneEpgResolvedItems(
    items: ResolvedChannelContent['items']
): ResolvedChannelContent['items'] {
    return items.map((item) => ({ ...item }));
}

export function getEpgLocalDayKey(timeMs: number): number {
    const date = new Date(timeMs);
    return (date.getFullYear() * 10000) + ((date.getMonth() + 1) * 100) + date.getDate();
}

export function reportEpgBackgroundWarmQueueFailure(
    appendIssueDiagnostic: AppendIssueDiagnostic,
    error: unknown,
    payload: Record<string, unknown> = {}
): void {
    reportIssue(appendIssueDiagnostic, 'epg.backgroundWarmQueueFailed', error, payload);
}

export function reportEpgChannelLoadFailure(
    appendIssueDiagnostic: AppendIssueDiagnostic,
    session: RefreshSession,
    channelId: string,
    phase: RefreshPhase,
    error: unknown
): void {
    const payload = {
        channelId,
        phase,
        refreshId: session.refreshId,
        rangeKey: session.rangeKey,
        reason: session.reason,
    };
    if (phase === 'background') {
        reportEpgBackgroundWarmQueueFailure(appendIssueDiagnostic, error, payload);
        return;
    }
    reportIssue(appendIssueDiagnostic, 'epg.scheduleLoadFailed', error, payload);
}

function reportIssue(
    appendIssueDiagnostic: AppendIssueDiagnostic,
    event: string,
    error: unknown,
    payload: Record<string, unknown>
): void {
    appendIssueDiagnostic(QA_003B_ISSUE_ID, event, {
        ...payload,
        safeError: summarizeErrorForLog(error),
    });
}
