import { AppErrorCode } from '../../../lifecycle';
import { isPlexAuthRecoverable } from '../plexAuthErrors';

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
});
