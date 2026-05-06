/**
 * @fileoverview Unit tests for Plex subtitle delivery policy helpers.
 */

import type { PlexStream } from '../contracts/types';
import { BURN_IN_SUBTITLE_FORMATS, TEXT_SUBTITLE_FORMATS } from '../policy/constants';
import { getSubtitleDelivery, shouldRequestBurnInSubtitles } from '../policy/subtitleDeliveryPolicy';

function streamFor(format?: string, codec?: string): PlexStream {
    return {
        id: 'stream-1',
        streamType: 3,
        codec: codec ?? 'sub',
        ...(typeof format === 'string' ? { format } : {}),
    };
}

describe('getSubtitleDelivery', () => {
    it('returns none when subtitle is null', () => {
        expect(getSubtitleDelivery(null, false)).toBe('none');
    });

    it('returns burn for burn-in subtitle formats', () => {
        for (const format of BURN_IN_SUBTITLE_FORMATS) {
            expect(getSubtitleDelivery(streamFor(format), false)).toBe('burn');
        }
    });

    it('returns sidecar for text formats when not transcoding', () => {
        for (const format of TEXT_SUBTITLE_FORMATS) {
            expect(getSubtitleDelivery(streamFor(format), false)).toBe('sidecar');
        }
    });

    it('returns sidecar for text formats while transcoding', () => {
        for (const format of TEXT_SUBTITLE_FORMATS) {
            expect(getSubtitleDelivery(streamFor(format), true)).toBe('sidecar');
        }
    });

    it('returns embed for non-text/burn formats when not transcoding', () => {
        expect(getSubtitleDelivery(streamFor('unknown'), false)).toBe('embed');
    });

    it('treats codec-only text subtitles as sidecar', () => {
        expect(getSubtitleDelivery(streamFor(undefined, 'srt'), false)).toBe('sidecar');
        expect(getSubtitleDelivery(streamFor(undefined, 'srt'), true)).toBe('sidecar');
    });

    it('treats codec-only burn-in subtitles as burn regardless of transcoding state', () => {
        expect(getSubtitleDelivery(streamFor(undefined, 'pgs'), false)).toBe('burn');
        expect(getSubtitleDelivery(streamFor(undefined, 'pgs'), true)).toBe('burn');
    });
});

describe('shouldRequestBurnInSubtitles', () => {
    it('forces burn-in when request mode is burn and subtitle exists', () => {
        expect(
            shouldRequestBurnInSubtitles({
                requestSubtitleMode: 'burn',
                subtitle: streamFor('srt'),
            })
        ).toBe(true);
    });

    it('requests burn-in when subtitle format is burn-in format', () => {
        expect(
            shouldRequestBurnInSubtitles({
                requestSubtitleMode: 'none',
                subtitle: streamFor('pgs'),
            })
        ).toBe(true);
    });

    it('does not request burn-in when subtitle is absent', () => {
        expect(
            shouldRequestBurnInSubtitles({
                requestSubtitleMode: 'burn',
                subtitle: null,
            })
        ).toBe(false);
    });

    it('preserves format-or-codec asymmetry for burn-in formats', () => {
        expect(
            shouldRequestBurnInSubtitles({
                requestSubtitleMode: 'none',
                subtitle: streamFor(undefined, 'pgs'),
            })
        ).toBe(true);
    });
});
