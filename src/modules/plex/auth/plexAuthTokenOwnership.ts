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

type PersistedPlexAuthTokenCandidate = Partial<
    Omit<PlexAuthToken, 'issuedAt' | 'expiresAt' | 'thumb' | 'preferredSubtitleLanguage'>
> & {
    issuedAt?: unknown;
    expiresAt?: unknown;
    thumb?: unknown;
    preferredSubtitleLanguage?: unknown;
};

export function normalizePlexAuthTokenDates(
    token: unknown
): PlexAuthToken | null {
    if (!token || typeof token !== 'object') {
        return null;
    }

    const candidate = token as PersistedPlexAuthTokenCandidate;
    if (
        !isNonEmptyString(candidate.token)
        || !isNonEmptyString(candidate.userId)
        || !isNonEmptyString(candidate.username)
        || !isNonEmptyString(candidate.email)
    ) {
        return null;
    }

    const issuedAt = normalizeDateValue(candidate.issuedAt);
    if (!issuedAt) {
        return null;
    }
    let expiresAt: Date | null = null;
    if (candidate.expiresAt !== null && typeof candidate.expiresAt !== 'undefined') {
        const converted = normalizeDateValue(candidate.expiresAt);
        if (!converted) {
            return null;
        }
        expiresAt = converted;
    }

    const preferredSubtitleLanguage = normalizeOptionalNullableString(
        candidate.preferredSubtitleLanguage
    );
    const thumb = typeof candidate.thumb === 'string' ? candidate.thumb : '';

    const normalizedToken: PlexAuthToken = {
        token: candidate.token,
        userId: candidate.userId,
        username: candidate.username,
        email: candidate.email,
        thumb,
        issuedAt,
        expiresAt,
    };

    if (preferredSubtitleLanguage !== undefined) {
        normalizedToken.preferredSubtitleLanguage = preferredSubtitleLanguage;
    }

    return normalizedToken;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptionalNullableString(value: unknown): string | null | undefined {
    if (typeof value === 'undefined') {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return typeof value === 'string' ? value : null;
}

function normalizeDateValue(value: unknown): Date | null {
    if (
        typeof value !== 'string'
        && typeof value !== 'number'
        && !(value instanceof Date)
    ) {
        return null;
    }

    const normalizedDate = new Date(value);
    return isNaN(normalizedDate.getTime()) ? null : normalizedDate;
}
