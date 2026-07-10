import type { ServerSelectSelectionResult } from './types';

type SelectedServerResult = Extract<ServerSelectSelectionResult, { kind: 'selected' }>;

export function getSelectedServerStatusTone(result: SelectedServerResult): 'success' | 'warning' {
    const refreshKind = result.startupResume.epgRefresh.kind;
    return refreshKind === 'degraded' || refreshKind === 'failed' ? 'warning' : 'success';
}

export function getSelectedServerStatusDetail(
    result: SelectedServerResult
): string {
    if (result.persistedSelection === 'skipped_missing_credentials') {
        return 'Connected, but saved-server preference was not updated because credentials are unavailable.';
    }
    if (result.persistedSelection === 'skipped_corrupted_credentials') {
        return 'Connected, but saved-server preference was not updated because credentials need repair.';
    }
    if (result.startupResume.epgRefresh.kind === 'failed') {
        return 'Connected, but guide refresh needs retry.';
    }
    if (result.startupResume.epgRefresh.kind === 'degraded') {
        const refreshResult = result.startupResume.epgRefresh.result;
        switch (refreshResult.readiness) {
            case 'partial':
                return `Connected, but guide refresh is incomplete (${refreshResult.immediateReadyChannelCount}/${refreshResult.attemptedChannelCount} schedules ready).`;
            case 'failed':
                return 'Connected, but guide refresh failed before schedules became ready.';
            case 'skipped':
                return 'Connected, but guide refresh was unavailable.';
            default:
                return assertUnhandledRefreshReadiness(refreshResult.readiness);
        }
    }
    if (result.startupResume.startup === 'skipped_no_coordinator') {
        return 'Connected; startup will continue when the app is ready.';
    }
    if (result.readiness === 'startup_pending') {
        return 'Continuing startup...';
    }
    return 'Ready.';
}

function assertUnhandledRefreshReadiness(readiness: never): never {
    throw new Error(`Unhandled EPG refresh readiness: ${String(readiness)}`);
}
