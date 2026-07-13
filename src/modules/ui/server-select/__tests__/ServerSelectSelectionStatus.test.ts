import {
    getSelectedServerStatusDetail,
    getSelectedServerStatusTone,
} from '../ServerSelectSelectionStatus';
import type { ServerSelectSelectionResult } from '../types';

const READY_REFRESH = {
    readiness: 'ready' as const,
    attemptedChannelCount: 2,
    immediateReadyChannelCount: 2,
    backgroundQueuedChannelCount: 0,
    failedChannelCount: 0,
    staleCacheChannelCount: 0,
    firstVisibleScheduleReady: true,
};

const selected = (
    overrides: Partial<Extract<ServerSelectSelectionResult, { kind: 'selected' }>> = {}
): Extract<ServerSelectSelectionResult, { kind: 'selected' }> => ({
    kind: 'selected',
    persistedSelection: 'updated',
    epgRefresh: { kind: 'succeeded', result: READY_REFRESH },
    ...overrides,
});

describe('ServerSelectSelectionStatus', () => {
    it('uses exact EPG outcome policy without obsolete startup fields', () => {
        expect(getSelectedServerStatusTone(selected())).toBe('success');
        expect(getSelectedServerStatusDetail(selected())).toBe('Ready.');
        expect(getSelectedServerStatusTone(selected({
            epgRefresh: { kind: 'failed', error: new Error('failed') },
        }))).toBe('warning');
        expect(getSelectedServerStatusDetail(selected({
            epgRefresh: { kind: 'failed', error: new Error('failed') },
        }))).toBe('Connected, but guide refresh needs retry.');
    });

    it('prioritizes persistence warnings while preserving successful tone', () => {
        const result = selected({ persistedSelection: 'skipped_missing_credentials' });
        expect(getSelectedServerStatusTone(result)).toBe('success');
        expect(getSelectedServerStatusDetail(result)).toContain('credentials are unavailable');
    });

    it('describes degraded and local-superseded refresh outcomes', () => {
        expect(getSelectedServerStatusDetail(selected({
            epgRefresh: {
                kind: 'degraded',
                result: {
                    ...READY_REFRESH,
                    readiness: 'partial',
                    immediateReadyChannelCount: 1,
                },
            },
        }))).toContain('1/2 schedules ready');
        expect(getSelectedServerStatusDetail(selected({
            epgRefresh: {
                kind: 'superseded',
                result: { ...READY_REFRESH, readiness: 'superseded' },
            },
        }))).toBe('Connected; guide refresh continued with a newer request.');
    });
});
