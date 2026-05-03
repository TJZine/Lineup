import { formatErrorDetailForMessage } from '../../../../utils/errors';
import { ChannelImportNormalizer } from '../ChannelImportNormalizer';

describe('ChannelImportNormalizer error formatting', () => {
    it('formats primitive import errors through the shared channel setup detail formatter', () => {
        const normalizer = new ChannelImportNormalizer();

        expect(normalizer.formatErrorMessage('plain failure')).toBe('plain failure');
        expect(formatErrorDetailForMessage('plain failure')).toBe('plain failure');
    });

    it('formats Error and object import errors consistently', () => {
        const normalizer = new ChannelImportNormalizer();

        expect(normalizer.formatErrorMessage(new Error('Plex timeout'))).toBe('Plex timeout');
        expect(normalizer.formatErrorMessage({ code: 'NETWORK_TIMEOUT' }))
            .toBe('{"code":"NETWORK_TIMEOUT"}');
    });

    it('formats unserializable object import errors without throwing', () => {
        const normalizer = new ChannelImportNormalizer();
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        const message = normalizer.formatErrorMessage({ code: circular });

        expect(message).toContain('"unserializable":true');
    });
});
