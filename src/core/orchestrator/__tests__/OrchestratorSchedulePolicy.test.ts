import type { ChannelConfig, ResolvedChannelContent } from '../../../modules/scheduler/channel-manager';
import { OrchestratorSchedulePolicy } from '../policy/OrchestratorSchedulePolicy';

describe('OrchestratorSchedulePolicy', () => {
    it('builds deterministic daily random-mode schedule seeds without reading Date.now when shuffleSeed is missing', () => {
        const policy = new OrchestratorSchedulePolicy();
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

        const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
            throw new Error('Date.now should not be used by buildDailyScheduleConfig');
        });
        try {
            const sameDayReferenceTime = new Date('2026-03-25T10:30:00-04:00').getTime();
            const configA = policy.buildDailyScheduleConfig(channel, items, sameDayReferenceTime);
            const configB = policy.buildDailyScheduleConfig(channel, items, sameDayReferenceTime);

            expect(configA.playbackMode).toBe('shuffle');
            expect(configA.shuffleSeed).toBe(configB.shuffleSeed);

            const nextDayReferenceTime = new Date('2026-03-26T10:30:00-04:00').getTime();
            const nextDayConfig = policy.buildDailyScheduleConfig(channel, items, nextDayReferenceTime);
            expect(nextDayConfig.shuffleSeed).not.toBe(configA.shuffleSeed);
            expect(nowSpy).not.toHaveBeenCalled();
        } finally {
            nowSpy.mockRestore();
        }
    });
});
