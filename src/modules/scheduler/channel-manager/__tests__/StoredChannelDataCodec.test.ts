import type { StoredChannelData } from '../types';
import {
    decodeStoredChannelConfigRecord,
    decodeStoredChannelData,
    encodeStoredChannelData,
} from '../StoredChannelDataCodec';

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

    it('constructs a defaulted runtime channel from persisted records', () => {
        const decoded = decodeStoredChannelConfigRecord({
            id: 'persisted-1',
            number: 7,
            contentSource: {
                type: 'library',
                libraryId: 'library-1',
                libraryType: 'movie',
                includeWatched: true,
            },
            playbackMode: 'bad-mode',
            skipIntros: 'yes',
            skipCredits: undefined,
            createdAt: 'bad',
            updatedAt: 12,
            lastContentRefresh: null,
            itemCount: undefined,
            totalDurationMs: 0,
            shuffleSeed: undefined,
            phaseSeed: null,
            unknownPersistedField: 'drop-me',
        });

        expect(decoded).toEqual({
            channel: expect.objectContaining({
                id: 'persisted-1',
                number: 7,
                name: 'Channel 7',
                playbackMode: 'sequential',
                skipIntros: false,
                skipCredits: false,
                createdAt: 0,
                updatedAt: 12,
                lastContentRefresh: 0,
                itemCount: 0,
                totalDurationMs: 0,
                shuffleSeed: expect.any(Number),
                phaseSeed: expect.any(Number),
            }),
            didMutate: true,
        });
        expect(decoded?.channel).not.toHaveProperty('unknownPersistedField');
    });

    it('returns null for persisted channel records without valid domain identity or source', () => {
        expect(decodeStoredChannelConfigRecord(null)).toBeNull();
        expect(decodeStoredChannelConfigRecord({ id: '', contentSource: { type: 'manual', items: [] } })).toBeNull();
        expect(decodeStoredChannelConfigRecord({ id: 'bad-source', contentSource: { type: 'library' } })).toBeNull();
    });
});
