/**
 * @jest-environment jsdom
 */
import { ChannelBadgeOverlay } from '../ChannelBadgeOverlay';
import { CHANNEL_BADGE_CLASSES, CHANNEL_BADGE_CONTAINER_ID } from '../constants';

describe('ChannelBadgeOverlay', () => {
    let container: HTMLElement;
    let overlay: ChannelBadgeOverlay;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = CHANNEL_BADGE_CONTAINER_ID;
        document.body.appendChild(container);
        overlay = new ChannelBadgeOverlay();
        overlay.initialize({ containerId: CHANNEL_BADGE_CONTAINER_ID });
    });

    afterEach(() => {
        overlay.destroy();
        container.remove();
    });

    it('initializes container class and hidden state', () => {
        expect(container.classList.contains(CHANNEL_BADGE_CLASSES.CONTAINER)).toBe(true);
        expect(container.classList.contains(CHANNEL_BADGE_CLASSES.VISIBLE)).toBe(false);
        expect(overlay.isVisible()).toBe(false);
    });

    it('shows number and name', () => {
        overlay.show({ channelNumber: 4, channelName: 'Comedy Movies' });
        expect(container.classList.contains(CHANNEL_BADGE_CLASSES.VISIBLE)).toBe(true);
        const text = container.querySelector(`.${CHANNEL_BADGE_CLASSES.TEXT}`);
        expect(text?.textContent).toBe('4 · Comedy Movies');
    });

    it('shows number only as CH <n>', () => {
        overlay.show({ channelNumber: 12 });
        const text = container.querySelector(`.${CHANNEL_BADGE_CLASSES.TEXT}`);
        expect(text?.textContent).toBe('CH 12');
    });

    it('shows name only', () => {
        overlay.show({ channelName: 'HBO' });
        const text = container.querySelector(`.${CHANNEL_BADGE_CLASSES.TEXT}`);
        expect(text?.textContent).toBe('HBO');
    });

    it('hides when no usable channel info', () => {
        overlay.show({});
        expect(container.classList.contains(CHANNEL_BADGE_CLASSES.VISIBLE)).toBe(false);
    });
});
