import type { StoredChannelData } from '../types';
import { decodeStoredChannelData, encodeStoredChannelData } from '../StoredChannelDataCodec';

describe('StoredChannelDataCodec', () => {
    it('returns null for malformed JSON', () => {
        expect(decodeStoredChannelData('{bad-json')).toBeNull();
    });

    it('returns null when top-level shape is invalid', () => {
        expect(
            decodeStoredChannelData(
                JSON.stringify({
                    channels: 'bad',
                    channelOrder: [],
                }),
            ),
        ).toBeNull();
    });

    it('returns parsed data for a valid payload', () => {
        const validPayload: StoredChannelData = {
            channels: [],
            channelOrder: [],
            currentChannelId: null,
            savedAt: Date.now(),
        };

        expect(decodeStoredChannelData(JSON.stringify(validPayload))).toEqual(validPayload);
    });

    it('round-trips via encode and decode', () => {
        const validPayload: StoredChannelData = {
            channels: [],
            channelOrder: ['chan-1'],
            currentChannelId: 'chan-1',
            savedAt: Date.now(),
        };
        const encoded = encodeStoredChannelData(validPayload);

        expect(decodeStoredChannelData(encoded)).toEqual(validPayload);
    });
});
