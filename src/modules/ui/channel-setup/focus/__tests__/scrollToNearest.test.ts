/**
 * @jest-environment jsdom
 */

import { scrollToNearest } from '../scrollToNearest';

const rect = (top: number, bottom: number): DOMRect => ({
    x: 0,
    y: top,
    top,
    right: 100,
    bottom,
    left: 0,
    width: 100,
    height: bottom - top,
    toJSON: () => ({}),
} as DOMRect);

describe('scrollToNearest', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    const setupScrollableElements = (): {
        container: HTMLDivElement;
        element: HTMLButtonElement;
        scrollIntoView: jest.Mock;
    } => {
        const container = document.createElement('div');
        container.style.overflowY = 'auto';
        const element = document.createElement('button');
        container.appendChild(element);
        document.body.appendChild(container);

        Object.defineProperty(container, 'scrollHeight', {
            configurable: true,
            value: 100,
        });
        Object.defineProperty(container, 'clientHeight', {
            configurable: true,
            value: 50,
        });

        const scrollIntoView = jest.fn((arg?: unknown) => {
            if (arg && typeof arg === 'object') {
                throw new Error('options object not supported');
            }
        });
        element.scrollIntoView = scrollIntoView as unknown as typeof element.scrollIntoView;

        return { container, element, scrollIntoView };
    };

    it('falls back to align-to-top when target is above scrollable viewport', () => {
        const { container, element, scrollIntoView } = setupScrollableElements();
        container.getBoundingClientRect = jest.fn(() => rect(100, 200));
        element.getBoundingClientRect = jest.fn(() => rect(80, 90));

        scrollToNearest(element);

        expect(scrollIntoView).toHaveBeenNthCalledWith(1, { block: 'nearest', inline: 'nearest' });
        expect(scrollIntoView).toHaveBeenNthCalledWith(2, true);
        expect(scrollIntoView).toHaveBeenCalledTimes(2);
    });

    it('falls back to align-to-bottom when target is below scrollable viewport', () => {
        const { container, element, scrollIntoView } = setupScrollableElements();
        container.getBoundingClientRect = jest.fn(() => rect(100, 200));
        element.getBoundingClientRect = jest.fn(() => rect(220, 240));

        scrollToNearest(element);

        expect(scrollIntoView).toHaveBeenNthCalledWith(1, { block: 'nearest', inline: 'nearest' });
        expect(scrollIntoView).toHaveBeenNthCalledWith(2, false);
        expect(scrollIntoView).toHaveBeenCalledTimes(2);
    });

    it('does not issue a second scroll when target is already visible', () => {
        const { container, element, scrollIntoView } = setupScrollableElements();
        container.getBoundingClientRect = jest.fn(() => rect(100, 200));
        element.getBoundingClientRect = jest.fn(() => rect(120, 180));

        scrollToNearest(element);

        expect(scrollIntoView).toHaveBeenNthCalledWith(1, { block: 'nearest', inline: 'nearest' });
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
});
