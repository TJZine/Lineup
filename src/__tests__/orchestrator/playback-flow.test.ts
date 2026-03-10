import { AppOrchestrator } from '../../Orchestrator';

describe('AppOrchestrator playback flow suite', () => {
    it('returns safely when channel tuning modules are not initialized', async () => {
        const orchestrator = new AppOrchestrator();
        await expect(orchestrator.switchToChannel('channel-1')).resolves.toBeUndefined();
        await expect(orchestrator.switchToChannelByNumber(101)).resolves.toBeUndefined();
    });
});
