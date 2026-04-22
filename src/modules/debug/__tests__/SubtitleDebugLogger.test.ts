/**
 * @jest-environment jsdom
 */

import { SubtitleDebugLogger } from '../SubtitleDebugLogger';

describe('SubtitleDebugLogger', () => {
    it('logs through the default console sink when subtitle debug logging is enabled', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const logger = new SubtitleDebugLogger({
            scope: 'SubtitleManager',
            settingsReader: {
                readSubtitleDebugLoggingEnabledAndClean: (): boolean => true,
            },
        });

        try {
            logger.log('subtitle_tracks_discovered', () => ({
                count: 1,
                token: 'sensitive-token',
            }));

            expect(warnSpy).toHaveBeenCalledWith(
                'subtitle_debug',
                'SubtitleManager',
                'subtitle_tracks_discovered',
                expect.stringContaining('"count":1')
            );
            expect(
                warnSpy.mock.calls.some((call) => call.some((arg) => String(arg).includes('sensitive-token')))
            ).toBe(false);
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('does not log when subtitle debug logging is disabled', () => {
        const sink = jest.fn();
        const logger = new SubtitleDebugLogger({
            scope: 'VideoPlayer',
            sink,
            settingsReader: {
                readSubtitleDebugLoggingEnabledAndClean: (): boolean => false,
            },
        });

        logger.log('subtitle_track_selected', { id: 'sub-1' });

        expect(sink).not.toHaveBeenCalled();
    });

    it('uses a custom sink and swallows sink failures', () => {
        const sink = jest.fn(() => {
            throw new Error('sink failed');
        });
        const logger = new SubtitleDebugLogger({
            scope: 'PlexStreamResolver',
            sink,
            settingsReader: {
                readSubtitleDebugLoggingEnabledAndClean: (): boolean => true,
            },
        });

        expect(() => {
            logger.log('subtitle_stream_probe', { ok: true });
        }).not.toThrow();
        expect(sink).toHaveBeenCalledWith(
            'PlexStreamResolver',
            'subtitle_stream_probe',
            expect.stringContaining('"ok":true')
        );
    });

    it('swallows settings-reader failures when checking whether logging is enabled', () => {
        const sink = jest.fn();
        const logger = new SubtitleDebugLogger({
            scope: 'SubtitleManager',
            sink,
            settingsReader: {
                readSubtitleDebugLoggingEnabledAndClean: (): boolean => {
                    throw new Error('storage unavailable');
                },
            },
        });

        expect(() => {
            logger.log('subtitle_tracks_discovered', { count: 1 });
        }).not.toThrow();
        expect(sink).not.toHaveBeenCalled();
    });

    it('returns false when the settings reader throws during isEnabled()', () => {
        const logger = new SubtitleDebugLogger({
            scope: 'SubtitleManager',
            settingsReader: {
                readSubtitleDebugLoggingEnabledAndClean: (): boolean => {
                    throw new Error('storage unavailable');
                },
            },
        });

        expect(logger.isEnabled()).toBe(false);
    });
});
