import { AppErrorCode } from '../../../../types/app-errors';
import {
    PlexAuthOperationSupersededError,
    isPlexAuthOperationSupersededError,
    isPlexAuthRecoverable,
} from '../plexAuthErrors';

describe('isPlexAuthRecoverable', () => {
    it.each([
        AppErrorCode.AUTH_REQUIRED,
        AppErrorCode.AUTH_INVALID,
        AppErrorCode.AUTH_EXPIRED,
    ])('accepts %s as a Plex auth recovery code', (code) => {
        expect(isPlexAuthRecoverable({ code })).toBe(true);
    });

    it.each([
        AppErrorCode.ACCESS_DENIED,
        AppErrorCode.SERVER_UNREACHABLE,
        undefined,
    ])('rejects %s as a Plex auth recovery code', (code) => {
        expect(isPlexAuthRecoverable({ code })).toBe(false);
    });

    it.each([
        null,
        undefined,
        'error',
        [],
    ])('rejects non-AppError input %#', (error) => {
        expect(isPlexAuthRecoverable(error)).toBe(false);
    });
});

describe('PlexAuthOperationSupersededError', () => {
    it('is recognized without being classified as recoverable invalid auth', () => {
        const error = new PlexAuthOperationSupersededError();
        expect(isPlexAuthOperationSupersededError(error)).toBe(true);
        expect(isPlexAuthRecoverable(error)).toBe(false);
    });
});
