import type { ServerSelectSelectionResult } from './types';

export function getSelectedServerStatusDetail(
    result: Extract<ServerSelectSelectionResult, { kind: 'selected' }>
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
    if (result.startupResume.startup === 'skipped_no_coordinator') {
        return 'Connected; startup will continue when the app is ready.';
    }
    if (result.readiness === 'startup_pending') {
        return 'Continuing startup...';
    }
    return 'Ready.';
}
