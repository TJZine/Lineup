/**
 * @jest-environment jsdom
 */

import { ChannelTransitionOverlay } from '../ChannelTransitionOverlay';
import { CHANNEL_TRANSITION_CLASSES } from '../constants';

describe('ChannelTransitionOverlay', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('throws when container is missing', () => {
        const overlay = new ChannelTransitionOverlay();
        expect(() => overlay.initialize({ containerId: 'missing-container' })).toThrow(
            'Channel transition container #missing-container not found'
        );
    });

    it('initializes template and toggles visibility', () => {
        const container = document.createElement('div');
        container.id = 'channel-transition-container';
        document.body.appendChild(container);

        const overlay = new ChannelTransitionOverlay();
        overlay.initialize({ containerId: 'channel-transition-container' });

        expect(container.classList.contains(CHANNEL_TRANSITION_CLASSES.CONTAINER)).toBe(true);
        expect(container.querySelector(`.${CHANNEL_TRANSITION_CLASSES.PANEL}`)).not.toBeNull();
        expect(container.querySelector(`.${CHANNEL_TRANSITION_CLASSES.SPINNER}`)).not.toBeNull();
        expect(container.querySelector(`.${CHANNEL_TRANSITION_CLASSES.TITLE}`)).not.toBeNull();
        expect(container.querySelector(`.${CHANNEL_TRANSITION_CLASSES.SUBTITLE}`)).not.toBeNull();
        expect(overlay.isVisible()).toBe(false);

        overlay.show();
        expect(overlay.isVisible()).toBe(true);
        expect(container.classList.contains(CHANNEL_TRANSITION_CLASSES.VISIBLE)).toBe(true);

        overlay.hide();
        expect(overlay.isVisible()).toBe(false);
        expect(container.classList.contains(CHANNEL_TRANSITION_CLASSES.VISIBLE)).toBe(false);
    });

    it('updates spinner, title, and subtitle from view model', () => {
        const container = document.createElement('div');
        container.id = 'channel-transition-container';
        document.body.appendChild(container);

        const overlay = new ChannelTransitionOverlay();
        overlay.initialize({ containerId: 'channel-transition-container' });

        overlay.setViewModel({
            title: 'Switching channel',
            subtitle: 'Preparing playback',
            showSpinner: true,
        });

        const spinner = container.querySelector(`.${CHANNEL_TRANSITION_CLASSES.SPINNER}`) as HTMLElement | null;
        const title = container.querySelector(`.${CHANNEL_TRANSITION_CLASSES.TITLE}`) as HTMLElement | null;
        const subtitle = container.querySelector(`.${CHANNEL_TRANSITION_CLASSES.SUBTITLE}`) as HTMLElement | null;

        expect(spinner?.style.display).toBe('block');
        expect(title?.textContent).toBe('Switching channel');
        expect(subtitle?.textContent).toBe('Preparing playback');
        expect(subtitle?.style.display).toBe('block');

        overlay.setViewModel({
            title: 'Ready',
            subtitle: null,
            showSpinner: false,
        });

        expect(spinner?.style.display).toBe('none');
        expect(title?.textContent).toBe('Ready');
        expect(subtitle?.textContent).toBe('');
        expect(subtitle?.style.display).toBe('none');
    });

    it('destroy clears container and cached state', () => {
        const container = document.createElement('div');
        container.id = 'channel-transition-container';
        document.body.appendChild(container);

        const overlay = new ChannelTransitionOverlay();
        overlay.initialize({ containerId: 'channel-transition-container' });
        overlay.show();

        overlay.destroy();

        expect(container.childElementCount).toBe(0);
        expect(container.classList.contains(CHANNEL_TRANSITION_CLASSES.VISIBLE)).toBe(false);
        expect(overlay.isVisible()).toBe(false);
    });
});
