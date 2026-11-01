/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview Mini Guide overlay unit tests.
 * @module modules/ui/mini-guide/__tests__/MiniGuideOverlay.test
 */

import { MiniGuideOverlay } from '../MiniGuideOverlay';
import { MINI_GUIDE_CLASSES, MINI_GUIDE_CONTAINER_ID } from '../constants';
import type { MiniGuideConfig, MiniGuideViewModel } from '../types';

const makeViewModel = (): MiniGuideViewModel => ({
    channels: [
        {
            channelId: 'ch1',
            channelNumber: 1,
            channelName: 'Channel One',
            nowTitle: 'Now One',
            nextTitle: 'Next One',
            nowProgress: 0.25,
        },
        {
            channelId: 'ch2',
            channelNumber: 2,
            channelName: 'Channel Two',
            nowTitle: 'Now Two',
            nextTitle: null,
            nowProgress: 0.5,
        },
        {
            channelId: 'ch3',
            channelNumber: 3,
            channelName: 'Channel Three',
            nowTitle: 'Now Three',
            nextTitle: 'Next Three',
            nowProgress: 1,
        },
        {
            channelId: 'ch4',
            channelNumber: 4,
            channelName: 'Channel Four',
            nowTitle: 'Now Four',
            nextTitle: null,
            nowProgress: 0.75,
        },
        {
            channelId: 'ch5',
            channelNumber: 5,
            channelName: 'Channel Five',
            nowTitle: 'Now Five',
            nextTitle: 'Next Five',
            nowProgress: 0.1,
        },
    ],
});

describe('MiniGuideOverlay', () => {
    let overlay: MiniGuideOverlay;
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = MINI_GUIDE_CONTAINER_ID;
        document.body.appendChild(container);
        overlay = new MiniGuideOverlay();
        const config: MiniGuideConfig = { containerId: MINI_GUIDE_CONTAINER_ID };
        overlay.initialize(config);
    });

    afterEach(() => {
        overlay.destroy();
        container.remove();
    });

    it('initializes hidden', () => {
        expect(overlay.isVisible()).toBe(false);
        expect(container.classList.contains(MINI_GUIDE_CLASSES.VISIBLE)).toBe(false);
    });

    it('shows and hides', () => {
        overlay.setViewModel(makeViewModel());
        overlay.show();
        expect(overlay.isVisible()).toBe(true);
        expect(container.classList.contains(MINI_GUIDE_CLASSES.VISIBLE)).toBe(true);

        overlay.hide();
        expect(overlay.isVisible()).toBe(false);
        expect(container.classList.contains(MINI_GUIDE_CLASSES.VISIBLE)).toBe(false);
    });

    it('uses the visible clock interval for projection ticks and stops it on hide and destroy', () => {
        jest.useFakeTimers();
        try {
            const tick = jest.fn();
            overlay.setActions({ select: jest.fn(), fullGuide: jest.fn(), close: jest.fn(), tick });
            overlay.show();
            jest.advanceTimersByTime(30_000);
            expect(tick).toHaveBeenCalledTimes(1);
            overlay.hide();
            jest.advanceTimersByTime(60_000);
            expect(tick).toHaveBeenCalledTimes(1);
            overlay.show();
            jest.advanceTimersByTime(30_000);
            expect(tick).toHaveBeenCalledTimes(2);
            overlay.destroy();
            jest.advanceTimersByTime(30_000);
            expect(tick).toHaveBeenCalledTimes(2);
        } finally {
            jest.useRealTimers();
        }
    });

    it('shows a bounded empty state and hides unused rows', () => {
        overlay.setViewModel({ channels: [], emptyMessage: 'No channels available' });
        overlay.show();

        expect(document.querySelector(`.${MINI_GUIDE_CLASSES.EMPTY}`)?.textContent).toBe('No channels available');
        expect(document.getElementById('mini-guide-row-0')?.hidden).toBe(true);
        expect(document.getElementById('mini-guide-row-4')?.hidden).toBe(true);
    });

    it('shows watching separately from focus and routes visible pointer actions once', () => {
        const select = jest.fn();
        const fullGuide = jest.fn();
        const close = jest.fn();
        const vm = makeViewModel();
        vm.channels[0]!.isWatching = true;
        overlay.setActions({ select, fullGuide, close });
        overlay.setViewModel(vm);
        overlay.setFocusedIndex(2);
        overlay.show();

        expect(document.getElementById('mini-guide-row-0')?.classList.contains('watching')).toBe(true);
        expect(document.getElementById('mini-guide-row-0')?.classList.contains('focused')).toBe(false);
        document.getElementById('mini-guide-row-1')?.click();
        document.querySelector<HTMLElement>('.mini-guide-full-guide')?.click();
        document.querySelector<HTMLElement>('.mini-guide-close')?.click();
        expect(select).toHaveBeenCalledTimes(1);
        expect(select).toHaveBeenCalledWith(1);
        expect(fullGuide).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);

        overlay.hide();
        document.getElementById('mini-guide-row-1')?.click();
        expect(select).toHaveBeenCalledTimes(1);
    });

    it('renders text and progress values', () => {
        const vm = makeViewModel();
        overlay.setViewModel(vm);
        overlay.show();

        expect(document.getElementById('mini-guide-num-0')?.textContent).toBe('1');
        expect(document.getElementById('mini-guide-name-0')?.textContent).toBe('Channel One');
        expect(document.getElementById('mini-guide-now-0')?.textContent).toBe('Now One');
        expect(document.getElementById('mini-guide-next-0')?.textContent).toBe('Next One');

        const progress0 = document.getElementById('mini-guide-progress-0') as HTMLElement;
        const progress1 = document.getElementById('mini-guide-progress-1') as HTMLElement;
        const progress2 = document.getElementById('mini-guide-progress-2') as HTMLElement;
        expect(parseFloat(progress0.style.width)).toBeCloseTo(25, 1);
        expect(parseFloat(progress1.style.width)).toBeCloseTo(50, 1);
        expect(parseFloat(progress2.style.width)).toBeCloseTo(100, 1);

        const next1 = document.getElementById('mini-guide-next-1') as HTMLElement;
        expect(next1.textContent).toBe('—');
    });

    it('renders footer hint text', () => {
        overlay.setViewModel(makeViewModel());
        overlay.show();

        const hint = document.querySelector(`.${MINI_GUIDE_CLASSES.FOOTER_HINT}`) as HTMLElement;
        expect(hint).toBeTruthy();
        expect(hint.textContent).toContain('Up/Down Browse');
        expect(hint.textContent).toContain('Select Tune');
    });

    it('toggles focused row class', () => {
        overlay.setViewModel(makeViewModel());
        overlay.show();

        overlay.setFocusedIndex(1);
        expect(document.getElementById('mini-guide-row-1')?.classList.contains('focused')).toBe(true);
        expect(document.getElementById('mini-guide-row-0')?.classList.contains('focused')).toBe(false);

        overlay.setFocusedIndex(4);
        expect(document.getElementById('mini-guide-row-4')?.classList.contains('focused')).toBe(true);
        expect(document.getElementById('mini-guide-row-1')?.classList.contains('focused')).toBe(false);
    });

    it('renders now start time when provided', () => {
        const vm = makeViewModel();
        (vm.channels[0] as { nowStartTime?: string | null }).nowStartTime = '9:30 PM';

        overlay.setViewModel(vm);
        overlay.show();

        const now = document.getElementById('mini-guide-now-0') as HTMLElement;
        const start = document.getElementById('mini-guide-now-time-0');
        expect(start?.textContent).toBe('9:30 PM');
        expect(now.textContent).toContain('Now One');
    });

    it('does not render now start time when null', () => {
        const vm = makeViewModel();
        (vm.channels[0] as { nowStartTime?: string | null }).nowStartTime = null;

        overlay.setViewModel(vm);
        overlay.show();

        expect(document.getElementById('mini-guide-now-time-0')?.textContent).toBe('');
    });

    it('does not set row build strategy data attribute when present', () => {
        const vm = makeViewModel();
        (vm.channels[0] as { buildStrategy?: string | null }).buildStrategy = 'collections';

        overlay.setViewModel(vm);
        overlay.show();

        const row = document.getElementById('mini-guide-row-0') as HTMLElement;
        expect(row.dataset.buildStrategy).toBeUndefined();
    });

    it('destroy clears DOM and visibility', () => {
        overlay.setViewModel(makeViewModel());
        overlay.show();
        overlay.setFocusedIndex(1);

        overlay.destroy();

        expect(container.innerHTML).toBe('');
        expect(container.classList.contains(MINI_GUIDE_CLASSES.VISIBLE)).toBe(false);
        expect(document.querySelectorAll('.mini-guide-row.focused').length).toBe(0);
    });
});
