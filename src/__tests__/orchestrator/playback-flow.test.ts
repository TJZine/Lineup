import { AppOrchestrator } from '../../Orchestrator';
import type { ChannelConfig, ResolvedChannelContent } from '../../modules/scheduler/channel-manager';

describe('AppOrchestrator playback flow suite', () => {
    it('returns safely when channel tuning modules are not initialized', async () => {
        const orchestrator = new AppOrchestrator();
        await expect(orchestrator.switchToChannel('channel-1')).resolves.toBeUndefined();
        await expect(orchestrator.switchToChannelByNumber(101)).resolves.toBeUndefined();
    });

    it('builds deterministic random-mode daily shuffle seed when shuffleSeed is missing', () => {
        const orchestrator = new AppOrchestrator() as unknown as {
            _buildDailyScheduleConfig: (
                channel: ChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ) => { playbackMode: string; shuffleSeed: number };
        };

        const channel = {
            id: 'random-channel',
            name: 'Random Channel',
            number: 7,
            contentSource: { type: 'manual', items: [] },
            playbackMode: 'random',
            startTimeAnchor: 0,
            skipIntros: false,
            skipCredits: false,
            createdAt: 0,
            updatedAt: 0,
            lastContentRefresh: 0,
            itemCount: 0,
            totalDurationMs: 0,
        } as ChannelConfig;
        const items: ResolvedChannelContent['items'] = [{
            ratingKey: 'item-1',
            type: 'movie',
            title: 'One',
            fullTitle: 'One',
            durationMs: 30_000,
            thumb: null,
            year: 2024,
            scheduledIndex: 0,
        }];

        const nowSpy = jest.spyOn(Date, 'now')
            .mockReturnValueOnce(111_111_111)
            .mockReturnValueOnce(222_222_222);
        try {
            const sameDayReferenceTime = new Date('2026-03-25T10:30:00-04:00').getTime();
            const configA = orchestrator._buildDailyScheduleConfig(channel, items, sameDayReferenceTime);
            const configB = orchestrator._buildDailyScheduleConfig(channel, items, sameDayReferenceTime);

            expect(configA.playbackMode).toBe('shuffle');
            expect(configA.shuffleSeed).toBe(configB.shuffleSeed);

            const nextDayReferenceTime = new Date('2026-03-26T10:30:00-04:00').getTime();
            const nextDayConfig = orchestrator._buildDailyScheduleConfig(channel, items, nextDayReferenceTime);
            expect(nextDayConfig.shuffleSeed).not.toBe(configA.shuffleSeed);
        } finally {
            nowSpy.mockRestore();
        }
    });
});
