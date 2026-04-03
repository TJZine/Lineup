import { createDefaultPlexAuthConfig } from '../../modules/plex/auth';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { webosPlatformServices } from '../../platform';
import { createOrchestratorModules } from '../../core/orchestrator/OrchestratorModuleFactory';
import type { OrchestratorConfig } from '../../core/orchestrator/OrchestratorTypes';

describe('createOrchestratorModules wiring', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('wires sleep timer sleep + tick callbacks to pause playback and onSleepTimerTick', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));

        const onSleepTimerTick = jest.fn();
        const modules = createOrchestratorModules({
            config: {
                plexConfig: createDefaultPlexAuthConfig('test-client'),
            } as unknown as OrchestratorConfig,
            platformServices: webosPlatformServices,
            debugOverridesStore: new DebugOverridesStore(),
            onSleepTimerTick,
        });

        const pauseSpy = jest.spyOn(modules.videoPlayer, 'pause').mockImplementation(() => undefined);

        modules.sleepTimer.start(1);
        jest.advanceTimersByTime(60_000);

        expect(pauseSpy).toHaveBeenCalled();
        expect(onSleepTimerTick).toHaveBeenCalled();
        expect(modules.epgReadinessPort).toBe(modules.epg);

        pauseSpy.mockRestore();
        modules.sleepTimer.destroy();
    });
});
