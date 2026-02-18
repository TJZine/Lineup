/**
 * @jest-environment jsdom
 */
import { ChannelNumberOverlay } from '../ChannelNumberOverlay';
import { CHANNEL_NUMBER_CLASSES } from '../constants';

describe('ChannelNumberOverlay', () => {
    let overlay: ChannelNumberOverlay;
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'channel-number-overlay-container';
        document.body.appendChild(container);
        overlay = new ChannelNumberOverlay();
        overlay.initialize('channel-number-overlay-container');
    });

    afterEach(() => {
        overlay.destroy();
        container.remove();
    });

    it('adds base class on initialize', () => {
        expect(container.classList.contains(CHANNEL_NUMBER_CLASSES.CONTAINER)).toBe(true);
    });

    it('shows digits with placeholders', () => {
        overlay.showDigits('4', 3);
        expect(container.classList.contains(CHANNEL_NUMBER_CLASSES.VISIBLE)).toBe(true);
        expect(container.querySelector(`.${CHANNEL_NUMBER_CLASSES.DIGITS}`)?.textContent).toBe('4 __');
    });

    it('shows error state and is visible', () => {
        overlay.showError(99);
        expect(container.classList.contains(CHANNEL_NUMBER_CLASSES.VISIBLE)).toBe(true);
        expect(container.classList.contains(CHANNEL_NUMBER_CLASSES.ERROR)).toBe(true);
    });
});
