import type { AppShellPlaybackInfoSnapshot } from '../AppShellRuntimeContracts';
import { formatAppDiagnosticsPlaybackInfo } from '../AppDiagnosticsPlaybackInfoFormatter';

const createSnapshot = (
    elapsedMs: number,
    remainingMs: number
): AppShellPlaybackInfoSnapshot => ({
    channel: { id: 'channel-1', number: 1, name: 'Test Channel' },
    program: {
        itemKey: 'item-1',
        title: 'Test Program',
        fullTitle: 'Test Program',
        type: 'episode',
        scheduledStartTime: 0,
        scheduledEndTime: 120_000,
        elapsedMs,
        remainingMs,
    },
    stream: null,
});

describe('formatAppDiagnosticsPlaybackInfo', () => {
    it('formats non-finite playback durations as unknown', () => {
        const formatted = formatAppDiagnosticsPlaybackInfo(
            createSnapshot(Number.NaN, Number.POSITIVE_INFINITY)
        );

        expect(formatted.summary).toContain('elapsed unknown / remaining unknown');
        expect(formatted.display).not.toContain('NaN');
        expect(formatted.display).not.toContain('Infinity');
    });

    it('formats finite playback durations as clock values', () => {
        const formatted = formatAppDiagnosticsPlaybackInfo(
            createSnapshot(65_000, 3_725_000)
        );

        expect(formatted.summary).toContain('elapsed 1:05 / remaining 1:02:05');
    });
});
