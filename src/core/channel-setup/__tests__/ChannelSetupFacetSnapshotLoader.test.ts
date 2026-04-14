/**
 * @jest-environment jsdom
 */

import {
    assertRecoveredTagCount,
    ChannelSetupPlanningError,
} from '../ChannelSetupFacetSnapshotLoader';

describe('ChannelSetupFacetSnapshotLoader', () => {
    it('throws a typed planning error when a recovered tag count is unavailable', () => {
        expect(() => assertRecoveredTagCount(null, 'actor', 'Alex Star')).toThrow(ChannelSetupPlanningError);
        expect(() => assertRecoveredTagCount(null, 'actor', 'Alex Star')).toThrow(
            expect.objectContaining({
                name: 'ChannelSetupPlanningError',
                code: 'COUNT_UNAVAILABLE',
            })
        );
    });

    it('returns the recovered count when available', () => {
        expect(assertRecoveredTagCount(7, 'actor', 'Alex Star')).toBe(7);
    });
});
