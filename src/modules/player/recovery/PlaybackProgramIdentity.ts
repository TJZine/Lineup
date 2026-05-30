import type { ScheduledProgram } from '../../scheduler/scheduler';

export function programsMatchIdentity(
    current: ScheduledProgram | null,
    expected: ScheduledProgram
): boolean {
    if (!current) {
        return false;
    }

    return current.item.ratingKey === expected.item.ratingKey
        && current.scheduledStartTime === expected.scheduledStartTime;
}
