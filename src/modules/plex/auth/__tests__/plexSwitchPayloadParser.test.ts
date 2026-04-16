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
});
