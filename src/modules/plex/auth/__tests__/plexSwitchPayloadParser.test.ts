import { parseSwitchPayloadData } from '../plexSwitchPayloadParser';

describe('plexSwitchPayloadParser', () => {
    it('accepts auth tokens from JSON payloads', () => {
        expect(parseSwitchPayloadData({ authenticationToken: 'child-token' })).toEqual({
            authToken: 'child-token',
        });
    });

    it('accepts auth tokens from XML payloads', () => {
        expect(
            parseSwitchPayloadData(
                '<MediaContainer><User authToken="child-token" /></MediaContainer>'
            )
        ).toEqual({ authToken: 'child-token' });
    });

    it('accepts auth tokens from XML payloads when DOMParser is unavailable', () => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            value: undefined,
        });

        try {
            expect(
                parseSwitchPayloadData(
                    '<MediaContainer><User authToken="child-token" /></MediaContainer>'
                )
            ).toEqual({ authToken: 'child-token' });
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                value: originalDomParser,
            });
        }
    });

    it('accepts auth tokens from nested JSON objects', () => {
        expect(
            parseSwitchPayloadData({
                MediaContainer: {
                    User: {
                        authToken: 'child-token',
                    },
                },
            })
        ).toEqual({ authToken: 'child-token' });
    });

    it('accepts auth tokens from nested arrays of wrapped objects', () => {
        expect(
            parseSwitchPayloadData({
                MediaContainer: [
                    {
                        User: { authToken: 'child-token' },
                    },
                ],
            })
        ).toEqual({ authToken: 'child-token' });
    });

    it('accepts structured auth-token strings nested under Plex wrapper keys', () => {
        expect(
            parseSwitchPayloadData({
                MediaContainer: [
                    {
                        User: '{"authToken":"child-token"}',
                    },
                ],
            })
        ).toEqual({ authToken: 'child-token' });
    });

    it('rejects unrelated structured strings nested inside wrapper objects', () => {
        expect(() =>
            parseSwitchPayloadData({
                message: '{"authToken":"stale-token"}',
            })
        ).toThrow('Plex Home switch response did not include auth token');
    });

    it('throws a JSON parse error for malformed JSON string payloads', () => {
        expect(() => parseSwitchPayloadData('{invalid json}')).toThrow(
            'Unable to parse Plex Home switch JSON payload'
        );
    });

    it('preserves the missing-token error for valid JSON string payloads without an auth token', () => {
        expect(() => parseSwitchPayloadData('{}')).toThrow(
            'Plex Home switch response did not include auth token'
        );
    });

    it('throws the missing-token error for empty object payloads', () => {
        expect(() => parseSwitchPayloadData({})).toThrow(
            'Plex Home switch response did not include auth token'
        );
    });

    it('falls back cleanly when DOMParser is present but not callable', () => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            value: {},
        });

        try {
            expect(
                parseSwitchPayloadData(
                    '<MediaContainer><User authToken="child-token" /></MediaContainer>'
                )
            ).toEqual({ authToken: 'child-token' });
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                value: originalDomParser,
            });
        }
    });
});
