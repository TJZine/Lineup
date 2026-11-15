/** @jest-environment jsdom */

import { EPG_CLASSES } from '../constants';
import { EPGShellView } from '../view/shell/EPGShellView';

describe('EPGShellView', () => {
    it('builds one Classic shell with a toolbar, one menu trigger, and a picture status', () => {
        const container = document.createElement('div');
        const view = new EPGShellView();
        const elements = view.create(container);
        expect(container.className).toBe(EPG_CLASSES.CONTAINER);
        expect([...container.children]).toEqual([
            elements.classicHeader, elements.classicShowcase, elements.toolbar, elements.grid,
        ]);
        expect(container.querySelector('.epg-overlay-showcase')).toBeNull();
        expect(elements.menuTrigger.dataset.action).toBe('menu');
        expect(elements.menuTrigger.querySelector('.epg-classic-header-glyph svg')).not.toBeNull();
        expect(elements.classicNowPlaying.parentElement).toBe(elements.classicHeader);
        expect(elements.programArea.querySelectorAll(`.${EPG_CLASSES.PROGRAM_EDGE_MASK}`)).toHaveLength(2);
        expect(elements.pictureStatus.getAttribute('role')).toBe('status');
    });

    it('keeps shell and picture status visible only for the current Guide state', () => {
        const container = document.createElement('div');
        const view = new EPGShellView();
        const elements = view.create(container);
        view.syncVisibility(true);
        expect(elements.classicHeader.hidden).toBe(false);
        expect(elements.classicHeaderClock.textContent).toMatch(/\d/);
        expect(elements.toolbar.hidden).toBe(false);
        view.updatePictureStatus('untuned');
        expect(elements.pictureStatus.textContent).toContain('Choose a program');
        view.updatePictureStatus('error');
        expect(elements.pictureStatus.textContent).toContain('unavailable');
        view.updatePictureStatus('playing');
        expect(elements.pictureStatus.hidden).toBe(true);
        view.syncVisibility(false);
        expect(elements.classicHeader.getAttribute('aria-hidden')).toBe('true');
        expect(elements.toolbar.hidden).toBe(true);
    });

    it('shows watched channel identity in the header independently of the inspected program', () => {
        const container = document.createElement('div');
        const view = new EPGShellView();
        const elements = view.create(container);
        view.updateNowWatchingBanner({
            enabled: true,
            getCurrentChannelInfo: () => ({
                channelNumber: 7, channelName: 'News', programTitle: 'Morning Report', timeLabel: '8–9',
            }),
        });
        expect(elements.classicNowPlaying.hidden).toBe(false);
        expect(elements.classicNowPlayingChannel.textContent).toBe('7 • News');
        view.updateNowWatchingBanner({ enabled: false, getCurrentChannelInfo: () => null });
        expect(elements.classicNowPlaying.hidden).toBe(true);
    });
});
