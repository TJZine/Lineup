import {
    buildScheduledProgramIdentity,
    buildScheduledProgramIdentityFromState,
    scheduledProgramIdentitiesMatch,
    type ScheduledProgram,
} from '../index';

const makeProgram = (overrides: Partial<ScheduledProgram> = {}): ScheduledProgram =>
    ({
        item: {
            ratingKey: 'item-1',
            title: 'Test Item',
            durationMs: 60_000,
            type: 'movie',
        } as ScheduledProgram['item'],
        elapsedMs: 5_000,
        scheduledStartTime: 1_000,
        scheduledEndTime: 61_000,
        remainingMs: 55_000,
        scheduleIndex: 0,
        loopNumber: 0,
        isCurrent: true,
        ...overrides,
    } as ScheduledProgram);

describe('scheduled program identity', () => {
    it('captures scheduler-owned occurrence fields including channel ownership', () => {
        const program = makeProgram({
            scheduledEndTime: 91_000,
            scheduleIndex: 3,
            loopNumber: 2,
        });

        expect(buildScheduledProgramIdentity('channel-7', program)).toEqual({
            channelId: 'channel-7',
            itemKey: 'item-1',
            scheduledStartTime: 1_000,
            scheduledEndTime: 91_000,
            scheduleIndex: 3,
            loopNumber: 2,
        });
    });

    it('derives the same identity from scheduler state', () => {
        const program = makeProgram();

        expect(buildScheduledProgramIdentityFromState({
            channelId: 'channel-7',
            currentProgram: program,
        })).toEqual(buildScheduledProgramIdentity('channel-7', program));
    });

    it('treats channel ownership changes as a different scheduled occurrence', () => {
        const program = makeProgram();
        const expected = buildScheduledProgramIdentity('channel-1', program);
        const changedChannel = buildScheduledProgramIdentity('channel-2', program);

        expect(expected).not.toBeNull();
        expect(changedChannel).not.toBeNull();
        expect(
            scheduledProgramIdentitiesMatch(
                changedChannel,
                expected!
            )
        ).toBe(false);
    });
});
