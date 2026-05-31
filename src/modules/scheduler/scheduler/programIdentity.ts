import type { ScheduledProgram, SchedulerState } from './types';

export interface ScheduledProgramIdentity {
    channelId: string;
    itemKey: string;
    scheduledStartTime: number;
    scheduledEndTime: number;
    scheduleIndex: number;
    loopNumber: number;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

export function buildScheduledProgramIdentity(
    channelId: string | null | undefined,
    program: ScheduledProgram | null | undefined
): ScheduledProgramIdentity | null {
    if (!program || !isNonEmptyString(channelId) || !isNonEmptyString(program.item.ratingKey)) {
        return null;
    }

    return {
        channelId,
        itemKey: program.item.ratingKey,
        scheduledStartTime: program.scheduledStartTime,
        scheduledEndTime: program.scheduledEndTime,
        scheduleIndex: program.scheduleIndex,
        loopNumber: program.loopNumber,
    };
}

export function buildScheduledProgramIdentityFromState(
    state: Pick<SchedulerState, 'channelId' | 'currentProgram'> | null | undefined
): ScheduledProgramIdentity | null {
    if (!state) {
        return null;
    }

    return buildScheduledProgramIdentity(state.channelId, state.currentProgram);
}

export function scheduledProgramIdentitiesMatch(
    current: ScheduledProgramIdentity | null,
    expected: ScheduledProgramIdentity
): boolean {
    if (!current) {
        return false;
    }

    return current.channelId === expected.channelId
        && current.itemKey === expected.itemKey
        && current.scheduledStartTime === expected.scheduledStartTime
        && current.scheduledEndTime === expected.scheduledEndTime
        && current.scheduleIndex === expected.scheduleIndex
        && current.loopNumber === expected.loopNumber;
}

export function createScheduledProgramIdentityKey(
    identity: ScheduledProgramIdentity | null
): string | null {
    if (!identity) {
        return null;
    }

    return [
        `channel:${identity.channelId}`,
        `item:${identity.itemKey}`,
        `start:${identity.scheduledStartTime}`,
        `end:${identity.scheduledEndTime}`,
        `index:${identity.scheduleIndex}`,
        `loop:${identity.loopNumber}`,
    ].join('|');
}

export function createScheduledProgramTrackKey(
    identity: ScheduledProgramIdentity | null,
    trackId: string
): string | null {
    const programKey = createScheduledProgramIdentityKey(identity);
    return programKey ? `${programKey}::${trackId}` : null;
}
