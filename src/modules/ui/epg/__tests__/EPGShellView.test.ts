/**
 * @jest-environment jsdom
 */

import { EPG_CLASSES } from '../constants';
import { EPGShellView } from '../view/shell/EPGShellView';

describe('EPGShellView', () => {
    let container: HTMLElement;
    let shellView: EPGShellView;

    beforeEach(() => {
        container = document.createElement('div');
        shellView = new EPGShellView();
    });

    it('builds the EPG shell DOM and program-area overlays without changing class hooks', () => {
        const elements = shellView.create(container);

        expect(container.className).toBe(EPG_CLASSES.CONTAINER);
        expect(container.children[0]).toBe(elements.classicHeader);
        expect(container.children[1]).toBe(elements.classicShowcase);
        expect(container.children[2]).toBe(elements.overlayShowcase);
        expect(container.children[3]).toBe(elements.grid);
        expect(container.children[4]).toBe(elements.dashboardBottom);
        expect(container.querySelector('.epg-classic-header-glyph svg')).not.toBeNull();
        expect(container.querySelector('.epg-watermark svg')).not.toBeNull();
        expect(elements.nowWatchingBanner.getAttribute('aria-live')).toBe('polite');
        expect(elements.programArea.querySelectorAll(`.${EPG_CLASSES.PROGRAM_EDGE_MASK}`)).toHaveLength(2);
    });

    it('owns classic shell hidden and aria-hidden presentation state', () => {
        const elements = shellView.create(container);

        shellView.syncClassicShellVisibility('classic', true);
        expect(elements.classicHeader.hidden).toBe(false);
        expect(elements.classicShowcase.hidden).toBe(false);
        expect(elements.classicHeader.hasAttribute('aria-hidden')).toBe(false);

        shellView.syncClassicShellVisibility('overlay', true);
        expect(elements.classicHeader.hidden).toBe(true);
        expect(elements.classicShowcase.hidden).toBe(true);
        expect(elements.classicHeader.getAttribute('aria-hidden')).toBe('true');
        expect(elements.classicShowcase.getAttribute('aria-hidden')).toBe('true');
    });

    it('presents now-watching text in the classic rail or lower banner by layout mode', () => {
        const elements = shellView.create(container);
        const getCurrentChannelInfo = (): {
            channelNumber: number;
            channelName: string;
            programTitle: string;
            timeLabel: string;
        } => ({
            channelNumber: 7,
            channelName: 'News',
            programTitle: 'Morning Report',
            timeLabel: '8:00 AM - 9:00 AM',
        });

        shellView.updateNowWatchingBanner({
            enabled: true,
            getCurrentChannelInfo,
            layoutMode: 'classic',
        });

        expect(elements.classicNowPlaying.hidden).toBe(false);
        expect(elements.nowWatchingBanner.hidden).toBe(true);
        expect(elements.classicNowPlayingChannel.textContent).toBe('7 • News');
        expect(elements.nowWatchingProgram.textContent).toBe('Morning Report');

        shellView.updateNowWatchingBanner({
            enabled: true,
            getCurrentChannelInfo,
            layoutMode: 'overlay',
        });

        expect(elements.classicNowPlaying.hidden).toBe(true);
        expect(elements.nowWatchingBanner.hidden).toBe(false);
    });
});
