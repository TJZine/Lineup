import { AppOrchestrator } from '../../Orchestrator';
import { expectConsoleWarn } from '../helpers';
describe('AppOrchestrator playback flow suite', () => {
    it('intentionally returns safely (best-effort) when channel tuning modules are not initialized', async () => {
        const orchestrator = new AppOrchestrator();
        expectConsoleWarn([
            'switchToChannel: channel tuning unavailable',
            expect.objectContaining({
                missingModules: ['_channelTuning', '_channelManager', '_scheduler', '_videoPlayer'],
            }),
        ]);
        expectConsoleWarn([
            'switchToChannelByNumber: channel tuning unavailable',
            expect.objectContaining({
                missingModules: ['_channelTuning', '_channelManager', '_scheduler', '_videoPlayer'],
            }),
        ]);
        await expect(orchestrator.switchToChannel('channel-1')).resolves.toBeUndefined();
        await expect(orchestrator.switchToChannelByNumber(101)).resolves.toBeUndefined();
    });
});
