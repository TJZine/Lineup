/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Time Header unit tests
 * @module modules/ui/epg/__tests__/EPGTimeHeader.test
 */

import { EPGTimeHeader } from '../view/EPGTimeHeader';
import { EPG_CLASSES } from '../constants';
import type { EPGConfig } from '../types';

describe('EPGTimeHeader', () => {
    let container: HTMLElement;
    let timeHeader: EPGTimeHeader;
    let config: EPGConfig;
    const gridAnchorTime = new Date('2026-01-07T00:00:00').getTime();

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        config = {
            containerId: 'test-container',
            visibleChannels: 5,
            timeSlotMinutes: 30,
            visibleHours: 3,
            totalHours: 24,
            pixelsPerMinute: 4,
            autoFitPixelsPerMinute: false,
            rowHeight: 80,
            showCurrentTimeIndicator: true,
            autoScrollToNow: false,
        };
        timeHeader = new EPGTimeHeader();
        timeHeader.initialize(container, config, gridAnchorTime);
    });

    afterEach(() => {
        timeHeader.destroy();
        container.remove();
    });

    it('keeps container stationary and updates sticky label on scroll', () => {
        timeHeader.updateScrollPosition(60);

        const header = container.querySelector(`.${EPG_CLASSES.TIME_HEADER}`) as HTMLElement;
        const slots = container.querySelector(`.${EPG_CLASSES.TIME_HEADER_SLOTS}`) as HTMLElement;
        const sticky = container.querySelector(`.${EPG_CLASSES.TIME_HEADER_STICKY}`) as HTMLElement;

        expect(header).not.toBeNull();
        expect(slots).not.toBeNull();
        expect(sticky).not.toBeNull();
        expect(slots.style.transform).toContain('translateX(');
        expect(header.style.transform).toBe('');
        expect(sticky.textContent).toBe('1:00 AM');
    });

    it('does not append debug log when debug logging is disabled', () => {
        const debugRuntime = {
            isEnabled: jest.fn().mockReturnValue(false),
            append: jest.fn(),
            destroy: jest.fn(),
        };
        timeHeader.destroy();
        config = { ...config, debugRuntime };
        timeHeader = new EPGTimeHeader();
        timeHeader.initialize(container, config, gridAnchorTime);

        timeHeader.updateScrollPosition(75);

        expect(debugRuntime.isEnabled).toHaveBeenCalledTimes(1);
        expect(debugRuntime.append).not.toHaveBeenCalled();
    });

    it('syncs slot clip inset width from sticky label offset', () => {
        const slots = container.querySelector(`.${EPG_CLASSES.TIME_HEADER_SLOTS}`) as HTMLElement;
        const sticky = container.querySelector(`.${EPG_CLASSES.TIME_HEADER_STICKY}`) as HTMLElement;

        expect(slots).not.toBeNull();
        expect(sticky).not.toBeNull();

        Object.defineProperty(sticky, 'offsetWidth', { configurable: true, value: 53 });
        timeHeader.updateScrollPosition(30);
        expect(slots.style.getPropertyValue('--epg-time-header-sticky-width-px')).toBe('53px');

        Object.defineProperty(sticky, 'offsetWidth', { configurable: true, value: 0 });
        timeHeader.updateScrollPosition(45);
        expect(slots.style.getPropertyValue('--epg-time-header-sticky-width-px')).toBe('0px');
    });

    it('resyncs sticky occlusion width when grid anchor time changes', () => {
        const slots = container.querySelector(`.${EPG_CLASSES.TIME_HEADER_SLOTS}`) as HTMLElement;
        const sticky = container.querySelector(`.${EPG_CLASSES.TIME_HEADER_STICKY}`) as HTMLElement;

        expect(slots).not.toBeNull();
        expect(sticky).not.toBeNull();

        Object.defineProperty(sticky, 'offsetWidth', { configurable: true, value: 0 });
        timeHeader.updateScrollPosition(0);
        expect(slots.style.getPropertyValue('--epg-time-header-sticky-width-px')).toBe('0px');

        Object.defineProperty(sticky, 'offsetWidth', { configurable: true, value: 61 });
        timeHeader.setGridAnchorTime(new Date('2026-01-07T12:00:00').getTime());

        expect(slots.style.getPropertyValue('--epg-time-header-sticky-width-px')).toBe('61px');
    });
});
