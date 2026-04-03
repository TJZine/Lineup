/**
 * @jest-environment jsdom
 */
import { formatCellTimeLabel } from '../utils';

describe('formatCellTimeLabel', () => {
    it('returns full range when forceFull is true', () => {
        expect(formatCellTimeLabel(1700000000000, 1700003600000, { compact: true, forceFull: true }))
            .toContain(' - ');
    });

    it('returns start time only when compact is true and forceFull is false', () => {
        expect(formatCellTimeLabel(1700000000000, 1700003600000, { compact: true, forceFull: false }))
            .toMatch(/^\d{1,2}:\d{2}$/);
    });

    it('returns full range when compact is false and forceFull is false', () => {
        expect(formatCellTimeLabel(1700000000000, 1700003600000, { compact: false, forceFull: false }))
            .toContain(' - ');
    });
});
