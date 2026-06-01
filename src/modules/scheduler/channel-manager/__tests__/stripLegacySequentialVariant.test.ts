import { stripLegacySequentialVariant } from '../import-export/stripLegacySequentialVariant';

describe('stripLegacySequentialVariant', () => {
    it('returns non-object values unchanged', () => {
        expect(stripLegacySequentialVariant(null)).toEqual({
            channel: null,
            didMutate: false,
        });
        expect(stripLegacySequentialVariant('channel')).toEqual({
            channel: 'channel',
            didMutate: false,
        });
    });

    it('returns object values unchanged when the legacy field is absent', () => {
        const channel = {
            id: 'channel-1',
            isPlaybackModeVariant: false,
        };

        expect(stripLegacySequentialVariant(channel)).toEqual({
            channel,
            didMutate: false,
        });
    });

    it('strips the legacy field while preserving canonical playback-variant metadata', () => {
        const channel = {
            id: 'channel-1',
            isSequentialVariant: true,
            isPlaybackModeVariant: false,
        };

        const result = stripLegacySequentialVariant(channel);
        const hasLegacyKey: 'isSequentialVariant' extends keyof typeof result.channel ? true : false = false;

        expect(result.didMutate).toBe(true);
        expect(result.channel).toEqual({
            id: 'channel-1',
            isPlaybackModeVariant: false,
        });
        expect(result.channel).not.toBe(channel);
        expect(hasLegacyKey).toBe(false);
    });
});
