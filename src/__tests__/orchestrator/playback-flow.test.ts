import { AppOrchestrator } from '../../Orchestrator';

describe('AppOrchestrator playback flow suite', () => {
    it('returns safely when channel tuning modules are not initialized', async () => {
        const orchestrator = new AppOrchestrator();
        await expect(orchestrator.switchToChannel('channel-1')).resolves.toBeUndefined();
        await expect(orchestrator.switchToChannelByNumber(101)).resolves.toBeUndefined();
    });

    it('shows a toast when setSubtitleTrack fails', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const toastSpy = jest.fn();

        const orchestrator = new AppOrchestrator();
        orchestrator.setNowPlayingHandler(toastSpy);

        const orchestratorAny = orchestrator as unknown as {
            _videoPlayer: { setSubtitleTrack: (trackId: string | null) => Promise<void> } | null;
        };
        orchestratorAny._videoPlayer = {
            setSubtitleTrack: jest.fn().mockRejectedValue(new Error('boom')),
        };

        await orchestrator.setSubtitleTrack(null);

        expect(warnSpy).toHaveBeenCalled();
        expect(toastSpy).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });
});
