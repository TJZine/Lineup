/** @jest-environment jsdom */

import { installLayoutCapabilities } from './layoutCapabilities';

describe('flex gap capability', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.documentElement.classList.remove('no-flex-gap');
        document.body.innerHTML = '';
    });

    it.each([
        [1, false],
        [0, true],
    ])('uses measured flex geometry (%i px) to set the fallback class', (height, fallback) => {
        jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(height);
        const originalChildren = document.body.childElementCount;

        installLayoutCapabilities();

        expect(document.documentElement.classList.contains('no-flex-gap')).toBe(fallback);
        expect(document.body.childElementCount).toBe(originalChildren);
    });

    it('removes a stale fallback class when native flex gap becomes available', () => {
        document.documentElement.classList.add('no-flex-gap');
        jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1);

        installLayoutCapabilities();

        expect(document.documentElement.classList.contains('no-flex-gap')).toBe(false);
    });
});
