import { ChannelImportNormalizer } from '../ChannelImportNormalizer';

describe('ChannelImportNormalizer error formatting', () => {
    it('formats primitive import errors through the shared channel setup detail formatter', () => {
        const normalizer = new ChannelImportNormalizer();

        expect(normalizer.formatErrorMessage('plain failure')).toBe('plain failure');
    });

    it('formats Error and object import errors consistently', () => {
        const normalizer = new ChannelImportNormalizer();

        expect(normalizer.formatErrorMessage(new Error('Plex timeout'))).toBe('Plex timeout');
        expect(normalizer.formatErrorMessage({ code: 'NETWORK_TIMEOUT' }))
            .toBe('{"code":"NETWORK_TIMEOUT"}');
    });

    it('formats plain-object message import errors without including auxiliary fields', () => {
        const normalizer = new ChannelImportNormalizer();
        const detail = { message: 'oops', code: 'X', ignored: true };

        expect(normalizer.formatErrorMessage(detail)).toBe('oops');
    });

    it('formats unserializable object import errors without throwing', () => {
        const normalizer = new ChannelImportNormalizer();
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        const message = normalizer.formatErrorMessage({ code: circular });

        expect(message).toContain('"unserializable":true');
    });
});

describe('ChannelImportNormalizer seed handling', () => {
    it('drops non-finite imported seeds while preserving valid finite values', () => {
        const normalizer = new ChannelImportNormalizer();

        const channel = normalizer.buildCreateInput({
            contentSource: {
                type: 'library',
                libraryId: 'library-1',
                libraryType: 'movie',
                includeWatched: true,
            },
            shuffleSeed: Number.NEGATIVE_INFINITY,
            phaseSeed: 42,
        });

        expect(channel).toEqual({
            contentSource: {
                type: 'library',
                libraryId: 'library-1',
                libraryType: 'movie',
                includeWatched: true,
            },
            phaseSeed: 42,
        });
    });
});

describe('ChannelImportNormalizer legacy color handling', () => {
    it('omits imported color fields from create input', () => {
        const normalizer = new ChannelImportNormalizer();

        const channel = normalizer.buildCreateInput({
            name: 'Imported Color',
            contentSource: {
                type: 'library',
                libraryId: 'library-1',
                libraryType: 'movie',
                includeWatched: true,
            },
            color: '#ff0000',
        });

        expect(channel).toEqual({
            name: 'Imported Color',
            contentSource: {
                type: 'library',
                libraryId: 'library-1',
                libraryType: 'movie',
                includeWatched: true,
            },
        });
    });
});
