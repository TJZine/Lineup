import type { PlexAuthToken } from './interfaces';

export function clonePlexAuthToken(token: PlexAuthToken | null): PlexAuthToken | null {
    if (!token) {
        return null;
    }
    return {
        ...token,
        issuedAt: new Date(token.issuedAt),
        expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
    };
}

export function normalizePlexAuthTokenDates(
    token: PlexAuthToken | null | undefined
): PlexAuthToken | null {
    if (!token) return null;
    const issuedAt = new Date(token.issuedAt);
    if (isNaN(issuedAt.getTime())) {
        return null;
    }
    let expiresAt: Date | null = null;
    if (token.expiresAt !== null && typeof token.expiresAt !== 'undefined') {
        const converted = new Date(token.expiresAt);
        if (isNaN(converted.getTime())) {
            return null;
        }
        expiresAt = converted;
    }

    return {
        ...token,
        issuedAt,
        expiresAt,
    };
}
