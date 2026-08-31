import type { EPGCoordinatorDeps } from '../../../modules/ui/epg/coordinator/EPGCoordinator';
import type { OrchestratorEpgCoordinatorBuilderInput } from '../assembly/OrchestratorCoordinatorContracts';

let capturedDeps: EPGCoordinatorDeps | null = null;

jest.mock('../../../modules/ui/epg/coordinator/EPGCoordinator', () => ({
    EPGCoordinator: jest.fn((deps: EPGCoordinatorDeps) => {
        capturedDeps = deps;
        return { kind: 'epg-coordinator' };
    }),
}));

import { buildEpgCoordinator } from '../assembly/EpgChannelSetupCoordinatorAssembly';

describe('EpgChannelSetupCoordinatorAssembly', () => {
    beforeEach(() => {
        capturedDeps = null;
    });

    it('wires config, schedule, selection, and visibility callbacks to their owners', async () => {
        const getRuntimeStatus = jest.fn(
            (id: string) => id === 'epg-ui' ? 'ready' as const : undefined
        );
        const input = {
            epgDebugRuntime: null,
            config: { epgConfig: { containerId: 'epg' } },
            moduleStatus: { getRuntimeStatus },
            init: { ensureEpgInitialized: jest.fn().mockResolvedValue(undefined) },
            modules: {
                epg: { kind: 'epg' },
                channelManager: { kind: 'channel-manager' },
                scheduler: { kind: 'scheduler' },
            },
            stores: { epgPreferencesStore: { kind: 'preferences' } },
            diagnostics: { appendIssueDiagnostic: jest.fn() },
            schedule: {
                lastChannelChangeSource: jest.fn().mockReturnValue('guide'),
                setLastChannelChangeSource: jest.fn(),
                getLocalMidnightMs: jest.fn().mockReturnValue(123),
                buildDailyScheduleConfig: jest.fn().mockReturnValue({ channelId: 'c1' }),
            },
            actions: {
                switchToChannel: jest.fn(),
                switchToChannelWithOutcome: jest.fn().mockResolvedValue({ kind: 'switched' }),
                onOverlayVisibilityChange: jest.fn(),
            },
            nowPlaying: { handler: jest.fn().mockReturnValue(jest.fn()) },
        } as unknown as OrchestratorEpgCoordinatorBuilderInput;

        expect(buildEpgCoordinator(input)).toEqual({ kind: 'epg-coordinator' });
        expect(capturedDeps).not.toBeNull();
        if (!capturedDeps) return;

        expect(capturedDeps.getEpg()).toBe(input.modules.epg);
        expect(capturedDeps.getChannelManager()).toBe(input.modules.channelManager);
        expect(capturedDeps.getScheduler()).toBe(input.modules.scheduler);
        expect(capturedDeps.getEpgUiStatus()).toBe('ready');
        expect(getRuntimeStatus).toHaveBeenCalledWith('epg-ui');
        await expect(capturedDeps.ensureEpgInitialized()).resolves.toBeUndefined();
        expect(capturedDeps.getEpgConfig()).toBe(input.config?.epgConfig);
        expect(capturedDeps.epgPreferencesStore).toBe(input.stores.epgPreferencesStore);
        expect(capturedDeps.appendIssueDiagnostic).toBe(input.diagnostics.appendIssueDiagnostic);
        expect(capturedDeps.getLocalMidnightMs(456)).toBe(123);
        expect(capturedDeps.buildDailyScheduleConfig({ id: 'c1' } as never, [], 456))
            .toEqual({ channelId: 'c1' });
        expect(capturedDeps.getPreserveFocusOnOpen()).toBe(true);

        capturedDeps.setLastChannelChangeSourceToGuide();
        await expect(capturedDeps.switchToChannel('c1')).resolves.toEqual({ kind: 'switched' });
        capturedDeps.onVisibilityChange?.(true);

        expect(input.schedule.setLastChannelChangeSource).toHaveBeenCalledWith('guide');
        expect(input.actions.switchToChannelWithOutcome).toHaveBeenCalledWith('c1', undefined);
        expect(input.actions.onOverlayVisibilityChange).toHaveBeenCalledWith(true);
    });
});
