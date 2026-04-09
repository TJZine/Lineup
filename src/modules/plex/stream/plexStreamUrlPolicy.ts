export function buildPlexMetadataPath(itemKey: string | null | undefined): string | null {
    const normalizedItemKey = (itemKey ?? '')
        .trim()
        .replace(/^\/+/, '')
        .replace(/^library\/metadata\/+/i, '')
        .trim();

    return normalizedItemKey.length > 0 ? `/library/metadata/${normalizedItemKey}` : null;
}

export function applyPlexSessionQueryParams(
    params: URLSearchParams,
    sessionId: string | null | undefined
): void {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
        return;
    }
    params.set('session', sessionId);
    params.set('X-Plex-Session-Identifier', sessionId);
}

export function ensurePlexClientProfileName(
    params: URLSearchParams,
    profileName: string | null | undefined = null
): void {
    const trimmedProfileName = typeof profileName === 'string' ? profileName.trim() : '';
    if (trimmedProfileName.length > 0) {
        params.set('X-Plex-Client-Profile-Name', trimmedProfileName);
        return;
    }
    if (!params.has('X-Plex-Client-Profile-Name')) {
        params.set('X-Plex-Client-Profile-Name', 'HTML TV App');
    }
}
