/**
 * @jest-environment jsdom
 */

import { extractDominantColor } from '../extractDominantColor';

describe('extractDominantColor', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns a pre-mixed darkened color string for a bright image', () => {
        const getContextSpy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage: jest.fn(),
            getImageData: jest.fn(() => ({
                data: new Uint8ClampedArray([
                    255, 255, 255, 255,
                    255, 255, 255, 255,
                    255, 255, 255, 255,
                    255, 255, 255, 255,
                ]),
            })),
        } as unknown as CanvasRenderingContext2D);

        expect(getContextSpy).toBeDefined();

        const img = document.createElement('img');
        Object.defineProperty(img, 'complete', { configurable: true, get: () => true });
        Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => 64 });
        Object.defineProperty(img, 'naturalHeight', { configurable: true, get: () => 64 });

        const result = extractDominantColor(img);

        expect(result).toBe('rgba(61, 62, 65, 0.32)');
    });
});
