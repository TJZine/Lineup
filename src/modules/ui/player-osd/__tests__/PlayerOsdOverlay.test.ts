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
        playbackText: 'Direct Play • H.264/AAC • 1080p',
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
        overlay.setViewModel({ ...baseViewModel, upNextText: 'Up next • 9:30 PM — Next' });
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
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.TIMECODE}`)?.textContent).toBe('0:10 / 1:40');
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.ENDS}`)?.textContent).toBe('Ends 9:15 PM');
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.BUFFER_TEXT}`)?.textContent).toBe('Buffer +30s');
        expect(container.querySelector(`.${PLAYER_OSD_CLASSES.PLAYBACK_TAG}`)?.textContent).toBe(
            'Direct Play • H.264/AAC • 1080p'
        );
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
        expect(panel.classList.contains('info-only')).toBe(true);
    });
});
