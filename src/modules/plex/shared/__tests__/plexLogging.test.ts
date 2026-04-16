import { createPlexConsoleLogger, logPlexError, logPlexWarning } from '../plexLogging';

describe('plexLogging', () => {
    it('redacts token-bearing strings before writing warnings', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const logger = createPlexConsoleLogger();

        logger.warn('token=X-Plex-Token=secret', { authToken: 'secret-token' });

        expect(warnSpy).toHaveBeenCalledWith(
            expect.not.stringContaining('secret'),
            expect.objectContaining({ authToken: 'REDACTED' })
        );
        warnSpy.mockRestore();
    });

    it('redacts token-bearing fields even when their values are non-string objects', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const logger = createPlexConsoleLogger();

        logger.warn('safe', {
            authToken: { raw: 'secret-token' },
            refreshTokenList: ['a', 'b'],
        });

        expect(warnSpy).toHaveBeenCalledWith(
            'safe',
            expect.objectContaining({
                authToken: 'REDACTED',
                refreshTokenList: 'REDACTED',
            })
        );
        warnSpy.mockRestore();
    });

    it('summarizes errors before writing error logs', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        logPlexWarning('warning', new Error('warning boom'));
        logPlexError('error', new Error('error boom'));

        expect(warnSpy).toHaveBeenCalledWith('warning', expect.anything());
        expect(errorSpy).toHaveBeenCalledWith('error', expect.anything());
        expect(errorSpy.mock.calls[0]?.[1]).not.toBeInstanceOf(Error);
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });
});
