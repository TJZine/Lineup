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

        expect(
            decodeStoredChannelData(
                JSON.stringify({
                    channels: [],
                    channelOrder: 'bad',
                }),
            ),
        ).toBeNull();

        expect(
            decodeStoredChannelData(
                JSON.stringify({
                    channelOrder: [],
                }),
            ),
        ).toBeNull();

        expect(
            decodeStoredChannelData(
                JSON.stringify({
                    channels: [],
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

    it('strips legacy isSequentialVariant fields while encoding', () => {
        const payload = {
            channels: [{
                id: 'channel-1',
                number: 1,
                name: 'Legacy',
                contentSource: {
                    type: 'library',
                    libraryId: 'library-1',
                    libraryType: 'movie',
                    includeWatched: true,
                },
                playbackMode: 'shuffle',
                shuffleSeed: 1,
                phaseSeed: 2,
                startTimeAnchor: 0,
                skipIntros: false,
                skipCredits: false,
                createdAt: 0,
                updatedAt: 0,
                lastContentRefresh: 0,
                itemCount: 0,
                totalDurationMs: 0,
                isSequentialVariant: true,
            }],
            channelOrder: ['channel-1'],
            currentChannelId: 'channel-1',
            savedAt: Date.now(),
        } as unknown as StoredChannelData;

        const encoded = encodeStoredChannelData(payload);
        const parsed = JSON.parse(encoded) as {
            channels: Array<Record<string, unknown>>;
        };

        expect(parsed.channels[0]).not.toHaveProperty('isSequentialVariant');
    });
});
