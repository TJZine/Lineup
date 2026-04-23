import { AppOrchestrator } from '../../Orchestrator';
import { expectConsoleWarn } from '../helpers';
describe('AppOrchestrator playback flow suite', () => {
    it('intentionally returns safely (best-effort) when switchToChannel modules are unavailable', async () => {
        const orchestrator = new AppOrchestrator();
        const stop = jest.fn();
        const warning = expectConsoleWarn([
            'switchToChannel: channel tuning unavailable',
            expect.objectContaining({
                missingModules: ['_channelTuning', '_channelManager', '_scheduler'],
            }),
        ]);

        Reflect.set(orchestrator as object, '_videoPlayer', { stop });

        await expect(orchestrator.switchToChannel('channel-1')).resolves.toBeUndefined();

        const switchPayload = warning.getLastCall()?.[1] as {
            missingModules: string[];
        };
        expect(switchPayload.missingModules).toHaveLength(3);
        expect(stop).not.toHaveBeenCalled();
    });

    it('intentionally returns safely (best-effort) when switchToChannelByNumber modules are unavailable', async () => {
        const orchestrator = new AppOrchestrator();
        const warning = expectConsoleWarn([
            'switchToChannelByNumber: channel tuning unavailable',
            expect.objectContaining({
                missingModules: ['_channelTuning', '_videoPlayer'],
            }),
        ]);

        Reflect.set(orchestrator as object, '_channelManager', {});
        Reflect.set(orchestrator as object, '_scheduler', {});

        await expect(orchestrator.switchToChannelByNumber(101)).resolves.toBeUndefined();

        const switchByNumberPayload = warning.getLastCall()?.[1] as {
            missingModules: string[];
        };
        expect(switchByNumberPayload.missingModules).toHaveLength(2);
    });
});
