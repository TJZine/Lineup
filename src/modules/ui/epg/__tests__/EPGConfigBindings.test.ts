import { withEpgVisibleRangeChangeBinding } from '../component/EPGConfigBindings';
import type { EPGConfig, EpgVisibleRange } from '../types';

describe('withEpgVisibleRangeChangeBinding', () => {
    it('wraps visible-range callbacks without mutating caller-owned config and preserves callback order', () => {
        const callOrder: string[] = [];
        const previousOnVisibleRangeChange = jest.fn(() => {
            callOrder.push('previous');
        });
        const boundOnVisibleRangeChange = jest.fn(() => {
            callOrder.push('bound');
        });
        const epgConfig: EPGConfig = {
            containerId: 'epg',
            visibleChannels: 5,
            timeSlotMinutes: 30,
            visibleHours: 3,
            totalHours: 24,
            pixelsPerMinute: 4,
            rowHeight: 80,
            showCurrentTimeIndicator: true,
            autoScrollToNow: false,
            onVisibleRangeChange: previousOnVisibleRangeChange,
        };
        const range: EpgVisibleRange = {
            channelStart: 1,
            channelEndExclusive: 3,
            timeStartMs: 1_000,
            timeEndMs: 2_000,
        };

        const wrappedConfig = withEpgVisibleRangeChangeBinding(epgConfig, boundOnVisibleRangeChange);

        expect(wrappedConfig).not.toBe(epgConfig);
        expect(wrappedConfig?.onVisibleRangeChange).not.toBe(previousOnVisibleRangeChange);
        expect(epgConfig.onVisibleRangeChange).toBe(previousOnVisibleRangeChange);

        wrappedConfig?.onVisibleRangeChange?.(range);

        expect(callOrder).toEqual(['previous', 'bound']);
        expect(previousOnVisibleRangeChange).toHaveBeenCalledWith(range);
        expect(boundOnVisibleRangeChange).toHaveBeenCalledWith(range);
    });

    it('returns null when config is missing', () => {
        expect(withEpgVisibleRangeChangeBinding(null, jest.fn())).toBeNull();
        expect(withEpgVisibleRangeChangeBinding(undefined, jest.fn())).toBeNull();
    });
});
