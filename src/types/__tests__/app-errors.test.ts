import { AppErrorCode, getAppErrorCode, isAppErrorCode } from '../app-errors';

describe('app error runtime helpers', () => {
    it('identifies canonical AppErrorCode values', () => {
        expect(isAppErrorCode(AppErrorCode.AUTH_REQUIRED)).toBe(true);
        expect(isAppErrorCode(AppErrorCode.ACCESS_DENIED)).toBe(true);
        expect(isAppErrorCode(AppErrorCode.UNKNOWN)).toBe(true);
    });

    it('rejects non-canonical values', () => {
        expect(isAppErrorCode('NOT_REAL')).toBe(false);
        expect(isAppErrorCode(42)).toBe(false);
        expect(isAppErrorCode(null)).toBe(false);
    });

    it('returns the canonical code or null', () => {
        expect(getAppErrorCode(AppErrorCode.AUTH_REQUIRED)).toBe(AppErrorCode.AUTH_REQUIRED);
        expect(getAppErrorCode('ACCESS_DENIED')).toBe(AppErrorCode.ACCESS_DENIED);
        expect(getAppErrorCode('NOT_REAL')).toBeNull();
        expect(getAppErrorCode({ code: AppErrorCode.UNKNOWN })).toBeNull();
    });

    it('maps string candidates through options.mapString when direct lookup fails', () => {
        expect(
            getAppErrorCode('auth_required', {
                mapString: (candidate) => candidate.toUpperCase(),
            })
        ).toBe(AppErrorCode.AUTH_REQUIRED);
        expect(
            getAppErrorCode('not_real', {
                mapString: (candidate) => candidate.toUpperCase(),
            })
        ).toBeNull();
    });
});
