import { EPG_CONSTANTS } from '../constants';
import type { EPGProgramCell, ScheduledProgram } from '../types';

export function positionCell(
    program: ScheduledProgram,
    gridAnchorTime: number,
    pixelsPerMinute: number = EPG_CONSTANTS.PIXELS_PER_MINUTE,
    now: number = Date.now()
): EPGProgramCell {
    const minutesFromStart = (program.scheduledStartTime - gridAnchorTime) / 60000;
    const durationMinutes = (program.scheduledEndTime - program.scheduledStartTime) / 60000;

    return {
        program,
        left: minutesFromStart * pixelsPerMinute,
        width: Math.max(durationMinutes * pixelsPerMinute, 20),
        isPartial: false,
        isCurrent: now >= program.scheduledStartTime && now < program.scheduledEndTime,
        isFocused: false,
    };
}
