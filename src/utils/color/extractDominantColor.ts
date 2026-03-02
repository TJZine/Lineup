/**
 * @fileoverview Extract a subtle, pre-mixed dominant color from an image for the EPG info panel.
 * @module utils/color/extractDominantColor
 */

const SAMPLE_SIZE = 8;
const MAX_LUMINANCE = 0.38;
const BLEND_BASE_R = 8;
const BLEND_BASE_G = 12;
const BLEND_BASE_B = 18;
const SOURCE_WEIGHT = 0.6;
const BASE_WEIGHT = 0.4;
const OUTPUT_ALPHA = 0.32;

export function extractDominantColor(img: HTMLImageElement): string | null {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }

    try {
        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const pixels = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let count = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3] ?? 0;
            if (alpha === 0) continue;

            totalR += pixels[i] ?? 0;
            totalG += pixels[i + 1] ?? 0;
            totalB += pixels[i + 2] ?? 0;
            count += 1;
        }

        if (count === 0) {
            return null;
        }

        let r = Math.round(totalR / count);
        let g = Math.round(totalG / count);
        let b = Math.round(totalB / count);

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (luminance > MAX_LUMINANCE) {
            const factor = MAX_LUMINANCE / luminance;
            r = Math.max(0, Math.floor(r * factor));
            g = Math.max(0, Math.floor(g * factor));
            b = Math.max(0, Math.floor(b * factor));
        }

        r = Math.round((r * SOURCE_WEIGHT) + (BLEND_BASE_R * BASE_WEIGHT));
        g = Math.round((g * SOURCE_WEIGHT) + (BLEND_BASE_G * BASE_WEIGHT));
        b = Math.round((b * SOURCE_WEIGHT) + (BLEND_BASE_B * BASE_WEIGHT));

        return `rgba(${r}, ${g}, ${b}, ${OUTPUT_ALPHA})`;
    } catch (error: unknown) {
        if (__LINEUP_DEV_BUILD__) {
            if (error instanceof DOMException && error.name === 'SecurityError') {
                console.warn('extractDominantColor: canvas pixel sampling blocked (cross-origin / tainted canvas).');
            } else {
                console.warn('extractDominantColor: failed to sample canvas pixels.');
            }
        }
        return null;
    }
}
