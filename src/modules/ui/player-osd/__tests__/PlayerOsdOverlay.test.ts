/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview Player OSD overlay unit tests.
 * @module modules/ui/player-osd/__tests__/PlayerOsdOverlay.test
 */

import { PlayerOsdOverlay } from '../PlayerOsdOverlay';
import { PLAYER_OSD_CLASSES } from '../constants';
import type { PlayerOsdConfig, PlayerOsdViewModel } from '../types';

describe('PlayerOsdOverlay', () => {
    let overlay: PlayerOsdOverlay;
    let container: HTMLElement;

    const baseViewModel: PlayerOsdViewModel = {
        reason: 'status',
        statusLabel: 'PLAYING',
        channelPrefix: '12 Comedy',
        title: 'Test Title',
        subtitle: 'Test Subtitle',
        isLive: false,
        currentTimeMs: 10_000,
        durationMs: 100_000,
        playedRatio: 0.1,
        bufferedRatio: 0.4,
        timecode: '0:10 / 1:40',
        endsAtText: 'Ends 9:15 PM',
        bufferText: 'Buffer +30s',
        actionIds: {
            subtitles: 'player-osd-action-subtitles',
            sleep: 'player-osd-action-sleep',
            audio: 'player-osd-action-audio',
        },
    };

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'player-osd-container';
        document.body.appendChild(container);
        overlay = new PlayerOsdOverlay();
        const config: PlayerOsdConfig = { containerId: 'player-osd-container' };
        overlay.initialize(config);
    });

    afterEach(() => {
        overlay.destroy();
        container.remove();
    });

    it('initializes hidden', () => {
        expect(overlay.isVisible()).toBe(false);
        expect(container.classList.contains(PLAYER_OSD_CLASSES.VISIBLE)).toBe(false);
    });

    it('exposes status label semantics for assistive tech', () => {
        const status = container.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`) as HTMLElement;
        expect(status.getAttribute('role')).toBe('status');
    });

    it('shows and hides', () => {
        overlay.setViewModel(baseViewModel);
        overlay.show();
        expect(overlay.isVisible()).toBe(true);
        expect(container.classList.contains(PLAYER_OSD_CLASSES.VISIBLE)).toBe(true);

        overlay.hide();
        expect(overlay.isVisible()).toBe(false);
        expect(container.classList.contains(PLAYER_OSD_CLASSES.VISIBLE)).toBe(false);
    });

    it('renders text and progress values', () => {
        overlay.setViewModel({
            ...baseViewModel,
            upNextText: 'Up next • 9:30 PM — Next',
            audioLabel: 'Stereo',
            subtitleLabel: 'English',
        });
        overlay.show();

        const status = container.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`) as HTMLElement;
        expect(status.getAttribute('aria-label')).toBe('PLAYING');
        expect(status.querySelector('svg')).not.toBeNull();
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.CHANNEL}`)?.textContent).toBe('12 Comedy');
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.TITLE}`)?.textContent).toBe('Test Title');
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.SUBTITLE}`)?.textContent).toBe('Test Subtitle');
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.UP_NEXT}`)?.textContent).toBe(
            'Up next • 9:30 PM — Next'
        );
        const info = container.querySelector(`.${PLAYER_OSD_CLASSES.INFO_LINE}`) as HTMLElement;
        const pills = Array.from(info.querySelectorAll(`.${PLAYER_OSD_CLASSES.PILL}`)).map(el => el.textContent);
        expect(pills).toEqual(['Audio: Stereo', 'Subs: English']);
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.TIMECODE}`)?.textContent).toBe('0:10 / 1:40');
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.ENDS}`)?.textContent).toBe('Ends 9:15 PM');
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.BUFFER_TEXT}`)?.textContent).toBe('Buffer +30s');
        expect(container.querySelector('.player-osd-playback')).toBeNull();
        expect(container.querySelector('.player-osd-hint')).toBeNull();
        expect(
            (container.querySelector(`.${PLAYER_OSD_CLASSES.ACTION}[data-action="subtitles"]`) as HTMLElement).id
        ).toBe('player-osd-action-subtitles');
        expect(
            (container.querySelector(`.${PLAYER_OSD_CLASSES.ACTION}[data-action="sleep"]`) as HTMLElement).id
        ).toBe('player-osd-action-sleep');
        expect(
            (container.querySelector(`.${PLAYER_OSD_CLASSES.ACTION}[data-action="audio"]`) as HTMLElement).id
        ).toBe('player-osd-action-audio');

        const played = container.querySelector(`.${PLAYER_OSD_CLASSES.BAR_PLAYED}`) as HTMLElement;
        const buffered = container.querySelector(`.${PLAYER_OSD_CLASSES.BAR_BUFFER}`) as HTMLElement;
        expect(parseFloat(played.style.width)).toBeCloseTo(10, 2);
        expect(parseFloat(buffered.style.width)).toBeCloseTo(40, 2);
    });

    it('hides optional fields when missing', () => {
        overlay.setViewModel({
            ...baseViewModel,
            channelPrefix: '',
            subtitle: null,
            endsAtText: null,
            bufferText: null,
            upNextText: null,
        });
        overlay.show();

        expect((container.querySelector(`.${PLAYER_OSD_CLASSES.CHANNEL}`) as HTMLElement).style.display).toBe('none');
        expect((container.querySelector(`.${PLAYER_OSD_CLASSES.SUBTITLE}`) as HTMLElement).style.display).toBe('none');
        expect((container.querySelector(`.${PLAYER_OSD_CLASSES.INFO_LINE}`) as HTMLElement).style.display).toBe('none');
        expect((container.querySelector(`.${PLAYER_OSD_CLASSES.UP_NEXT}`) as HTMLElement).style.display).toBe('none');
        expect((container.querySelector(`.${PLAYER_OSD_CLASSES.ENDS}`) as HTMLElement).style.display).toBe('none');
        expect((container.querySelector(`.${PLAYER_OSD_CLASSES.BUFFER_TEXT}`) as HTMLElement).style.display).toBe(
            'none'
        );
    });

    it('clears action IDs when view model omits them', () => {
        overlay.setViewModel(baseViewModel);
        overlay.show();

        const withoutActionIds = { ...baseViewModel } as PlayerOsdViewModel;
        delete (withoutActionIds as Partial<PlayerOsdViewModel>).actionIds;
        overlay.setViewModel(withoutActionIds);

        expect(
            (container.querySelector(`.${PLAYER_OSD_CLASSES.ACTION}[data-action="subtitles"]`) as HTMLElement).id
        ).toBe('');
        expect(
            (container.querySelector(`.${PLAYER_OSD_CLASSES.ACTION}[data-action="sleep"]`) as HTMLElement).id
        ).toBe('');
        expect(
            (container.querySelector(`.${PLAYER_OSD_CLASSES.ACTION}[data-action="audio"]`) as HTMLElement).id
        ).toBe('');
    });

    it('renders clear logo when clearLogoUrl is present and uses title for alt text', () => {
        overlay.setViewModel({ ...baseViewModel, clearLogoUrl: 'http://example/logo.png' });
        overlay.show();

        const logo = container.querySelector(`.${PLAYER_OSD_CLASSES.CLEAR_LOGO}`) as HTMLImageElement;
        const title = container.querySelector(`.${PLAYER_OSD_CLASSES.TITLE}`) as HTMLElement;
        expect(logo.style.display).not.toBe('none');
        expect(logo.style.visibility).toBe('hidden');
        expect(logo.getAttribute('src')).toBe('http://example/logo.png');
        expect(logo.getAttribute('alt')).toBe(baseViewModel.title);
        expect(title.style.display).toBe('');

        Object.defineProperty(logo, 'getBoundingClientRect', {
            value: () => ({ height: 30 } as unknown as DOMRect),
        });
        (logo.onload as unknown as (() => void))?.();
        expect(logo.style.visibility).toBe('');
        expect(title.style.display).toBe('none');

        overlay.setViewModel({ ...baseViewModel, clearLogoUrl: null });
        expect(logo.style.display).toBe('none');
        expect(logo.style.visibility).toBe('');
        expect(logo.getAttribute('src')).toBeNull();
        expect(logo.getAttribute('alt')).toBe('');
        expect(title.style.display).toBe('');
    });

    it('restores title and clears image when clear logo fails to load', () => {
        overlay.setViewModel({ ...baseViewModel, clearLogoUrl: 'http://example/bad.png' });
        overlay.show();

        const logo = container.querySelector(`.${PLAYER_OSD_CLASSES.CLEAR_LOGO}`) as HTMLImageElement;
        const title = container.querySelector(`.${PLAYER_OSD_CLASSES.TITLE}`) as HTMLElement;
        expect(title.style.display).toBe('');

        (logo.onerror as unknown as (() => void))?.();

        expect(logo.getAttribute('src')).toBeNull();
        expect(logo.style.display).toBe('none');
        expect(title.style.display).toBe('');
        expect(logo.onerror).toBeNull();
        expect(logo.onload).toBeNull();
    });

    it('clears error handler and hides title when clear logo loads and is usable', () => {
        overlay.setViewModel({ ...baseViewModel, clearLogoUrl: 'http://example/good.png' });
        overlay.show();

        const logo = container.querySelector(`.${PLAYER_OSD_CLASSES.CLEAR_LOGO}`) as HTMLImageElement;
        const title = container.querySelector(`.${PLAYER_OSD_CLASSES.TITLE}`) as HTMLElement;

        Object.defineProperty(logo, 'getBoundingClientRect', {
            value: () => ({ height: 30 } as unknown as DOMRect),
        });

        (logo.onload as unknown as (() => void))?.();

        expect(logo.getAttribute('src')).toBe('http://example/good.png');
        expect(title.style.display).toBe('none');
        expect(logo.onerror).toBeNull();
        expect(logo.onload).toBeNull();
    });

    it('clears clear logo handlers when clearLogoUrl is removed', () => {
        overlay.setViewModel({ ...baseViewModel, clearLogoUrl: 'http://example/logo.png' });
        overlay.show();

        const logo = container.querySelector(`.${PLAYER_OSD_CLASSES.CLEAR_LOGO}`) as HTMLImageElement;
        expect(logo.onerror).not.toBeNull();
        expect(logo.onload).not.toBeNull();

        overlay.setViewModel({ ...baseViewModel, clearLogoUrl: null });
        expect(logo.onerror).toBeNull();
        expect(logo.onload).toBeNull();
    });

    it('falls back to title when clear logo renders too small', () => {
        overlay.setViewModel({ ...baseViewModel, clearLogoUrl: 'http://example/tiny.png' });
        overlay.show();

        const logo = container.querySelector(`.${PLAYER_OSD_CLASSES.CLEAR_LOGO}`) as HTMLImageElement;
        const title = container.querySelector(`.${PLAYER_OSD_CLASSES.TITLE}`) as HTMLElement;

        Object.defineProperty(logo, 'getBoundingClientRect', {
            value: () => ({ height: 10 } as unknown as DOMRect),
        });

        (logo.onload as unknown as (() => void))?.();

        expect(logo.style.display).toBe('none');
        expect(title.style.display).toBe('');
    });

    it('toggles sleep timer text visibility', () => {
        overlay.setViewModel({ ...baseViewModel, sleepTimerText: 'Sleep 45:00' });
        overlay.show();
        const sleep = container.querySelector(`.${PLAYER_OSD_CLASSES.SLEEP_TIMER}`) as HTMLElement;
        expect(sleep.textContent).toBe('Sleep 45:00');
        expect(sleep.style.display).toBe('');

        overlay.setViewModel({ ...baseViewModel, sleepTimerText: null });
        expect(sleep.textContent).toBe('');
        expect(sleep.style.display).toBe('none');
    });

    it('renders PLAYING as an icon with aria label', () => {
        overlay.setViewModel(baseViewModel);
        overlay.show();

        const status = container.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`) as HTMLElement;
        const icon = status.querySelector('svg');

        expect(status.getAttribute('aria-label')).toBe('PLAYING');
        expect(icon).not.toBeNull();
        expect(icon?.querySelectorAll('path')).toHaveLength(1);
    });

    it('renders PAUSED icon with two bars', () => {
        overlay.setViewModel({
            ...baseViewModel,
            statusLabel: 'PAUSED',
        });
        overlay.show();

        const status = container.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`) as HTMLElement;
        const icon = status.querySelector('svg');

        expect(icon).not.toBeNull();
        expect(icon?.querySelectorAll('rect')).toHaveLength(2);
    });

    it('renders BUFFERING as spinner icon', () => {
        overlay.setViewModel({
            ...baseViewModel,
            statusLabel: 'BUFFERING',
        });
        overlay.show();

        const status = container.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`) as HTMLElement;
        const icon = status.querySelector('svg');

        expect(icon).not.toBeNull();
        expect(icon?.classList.contains('player-osd-spinner')).toBe(true);
    });

    it('falls back to text when icon is not defined', () => {
        overlay.setViewModel({
            ...baseViewModel,
            statusLabel: 'STOPPED',
        });
        overlay.show();

        const status = container.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`) as HTMLElement;

        expect(status.textContent).toBe('STOPPED');
        expect(status.querySelector('svg')).toBeNull();
    });

    it('falls back to text for SEEKING', () => {
        overlay.setViewModel({
            ...baseViewModel,
            statusLabel: 'SEEKING',
        });
        overlay.show();

        const status = container.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`) as HTMLElement;

        expect(status.textContent).toBe('SEEKING');
        expect(status.querySelector('svg')).toBeNull();
    });

    it('falls back to text for LOADING', () => {
        overlay.setViewModel({
            ...baseViewModel,
            statusLabel: 'LOADING',
        });
        overlay.show();

        const status = container.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`) as HTMLElement;

        expect(status.textContent).toBe('LOADING');
        expect(status.querySelector('svg')).toBeNull();
    });

    it('dims played and buffered bars during BUFFERING', () => {
        overlay.setViewModel({
            ...baseViewModel,
            statusLabel: 'BUFFERING',
        });
        overlay.show();

        const played = container.querySelector(`.${PLAYER_OSD_CLASSES.BAR_PLAYED}`) as HTMLElement;
        const buffered = container.querySelector(`.${PLAYER_OSD_CLASSES.BAR_BUFFER}`) as HTMLElement;
        expect(played.style.opacity).toBe('0.3');
        expect(buffered.style.opacity).toBe('0.3');
    });

    it('restores bar opacity after leaving BUFFERING', () => {
        overlay.setViewModel({
            ...baseViewModel,
            statusLabel: 'BUFFERING',
        });
        overlay.show();
        overlay.setViewModel({
            ...baseViewModel,
            statusLabel: 'PLAYING',
        });

        const played = container.querySelector(`.${PLAYER_OSD_CLASSES.BAR_PLAYED}`) as HTMLElement;
        const buffered = container.querySelector(`.${PLAYER_OSD_CLASSES.BAR_BUFFER}`) as HTMLElement;
        expect(played.style.opacity).toBe('');
        expect(buffered.style.opacity).toBe('');
    });

    it('applies info-only class when vm.infoOnly is true', () => {
        overlay.setViewModel({ ...baseViewModel, infoOnly: true });
        overlay.show();
        const panel = container.querySelector(`.${PLAYER_OSD_CLASSES.PANEL}`) as HTMLElement;
        expect(panel.classList.contains(PLAYER_OSD_CLASSES.INFO_ONLY)).toBe(true);
    });

    it('removes info-only class when vm.infoOnly becomes falsy', () => {
        overlay.setViewModel({ ...baseViewModel, infoOnly: true });
        overlay.show();
        const panel = container.querySelector(`.${PLAYER_OSD_CLASSES.PANEL}`) as HTMLElement;
        expect(panel.classList.contains(PLAYER_OSD_CLASSES.INFO_ONLY)).toBe(true);

        overlay.setViewModel({ ...baseViewModel, infoOnly: false });
        overlay.show();
        expect(panel.classList.contains(PLAYER_OSD_CLASSES.INFO_ONLY)).toBe(false);
    });
});
