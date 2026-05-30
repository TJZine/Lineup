import { normalizePlexAuthTokenDates } from '../plexAuthTokenOwnership';

describe('normalizePlexAuthTokenDates', () => {
    it('returns null when required credential fields are missing', () => {
        expect(normalizePlexAuthTokenDates({
            token: '',
            userId: 'user-1',
            username: 'user',
            email: 'user@example.com',
            thumb: '',
            issuedAt: new Date().toISOString(),
            expiresAt: null,
        } as never)).toBeNull();

        expect(normalizePlexAuthTokenDates({
            token: 'token-1',
            userId: '',
            username: 'user',
            email: 'user@example.com',
            thumb: '',
            issuedAt: new Date().toISOString(),
            expiresAt: null,
        } as never)).toBeNull();
    });

    it('normalizes valid persisted tokens and sanitizes optional fields', () => {
        const issuedAt = new Date('2026-05-01T12:00:00.000Z');
        const expiresAt = new Date('2026-05-02T12:00:00.000Z');

        const normalized = normalizePlexAuthTokenDates({
            token: 'token-1',
            userId: 'user-1',
            username: 'user',
            email: 'user@example.com',
            thumb: '/thumb.jpg',
            issuedAt: issuedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            preferredSubtitleLanguage: 7,
        });

        expect(normalized).toEqual({
            token: 'token-1',
            userId: 'user-1',
            username: 'user',
            email: 'user@example.com',
            thumb: '/thumb.jpg',
            issuedAt,
            expiresAt,
            preferredSubtitleLanguage: null,
        });
    });

    it('returns null when thumb is not a string', () => {
        expect(normalizePlexAuthTokenDates({
            token: 'token-1',
            userId: 'user-1',
            username: 'user',
            email: 'user@example.com',
            thumb: 42,
            issuedAt: new Date().toISOString(),
            expiresAt: null,
        })).toBeNull();
    });
});
