import type { ChannelConfig, ResolvedChannelContent } from '../../../modules/scheduler/channel-manager';
import { OrchestratorSchedulePolicy } from '../policy/OrchestratorSchedulePolicy';
import { buildScheduleIndex, calculateProgramAtTime } from '../../../modules/scheduler/scheduler/ScheduleCalculator';
import { ShuffleGenerator } from '../../../modules/scheduler/scheduler/ShuffleGenerator';

describe('OrchestratorSchedulePolicy', () => {
    it('uses explicit fixed timestamps in live program calculation while legacy timestamps retain daily phase timing', () => {
        const policy = new OrchestratorSchedulePolicy();
        const reference = new Date('2026-03-25T10:30:00-04:00').getTime();
        const dayStart = policy.getLocalMidnightMs(reference);
        const channel = {
            id: 'anchor-channel', playbackMode: 'sequential', phaseSeed: 0,
            shuffleSeed: 7, startTimeAnchor: dayStart + 15_000,
        } as ChannelConfig;
        const items: ResolvedChannelContent['items'] = [
            { ratingKey: 'one', durationMs: 30_000 },
            { ratingKey: 'two', durationMs: 30_000 },
        ] as ResolvedChannelContent['items'];
        const oldA = policy.buildDailyScheduleConfig(channel, items, reference);
        const oldB = policy.buildDailyScheduleConfig({ ...channel, startTimeAnchor: dayStart + 45_000 }, items, reference);
        expect(oldA.anchorTime).toBe(dayStart);
        expect(oldB).toEqual(oldA);

        const fixedA = policy.buildDailyScheduleConfig({ ...channel, scheduleAnchorMode: 'fixed' }, items, reference);
        const fixedB = policy.buildDailyScheduleConfig({ ...channel, scheduleAnchorMode: 'fixed',
            startTimeAnchor: dayStart + 45_000 }, items, reference);
        const shuffler = new ShuffleGenerator();
        const at = dayStart + 20_000;
        const programA = calculateProgramAtTime(at, buildScheduleIndex(fixedA, shuffler), fixedA.anchorTime);
        const programB = calculateProgramAtTime(at, buildScheduleIndex(fixedB, shuffler), fixedB.anchorTime);
        expect(fixedA.anchorTime).toBe(dayStart + 15_000);
        expect(fixedB.anchorTime).toBe(dayStart + 45_000);
        expect(programA.item.ratingKey).toBe('one');
        expect(programB.item.ratingKey).toBe('two');
        expect(fixedA.shuffleSeed).toBe(oldA.shuffleSeed);
    });

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
