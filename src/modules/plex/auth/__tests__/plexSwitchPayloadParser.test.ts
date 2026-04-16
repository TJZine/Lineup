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
});
