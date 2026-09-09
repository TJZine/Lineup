import type { ResolvedChannelContent } from '../../../scheduler/channel-manager';
import type { AppendIssueDiagnostic } from '../../../debug/IssueDiagnosticsStore';

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
    payload: Record<string, unknown> = {}
): void {
    appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.backgroundWarmQueueFailed', {
        ...payload,
        errorKind: 'non-abort',
    });
}
