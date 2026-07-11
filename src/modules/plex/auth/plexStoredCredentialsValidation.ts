import type { PlexAuthData, PlexAuthToken } from './interfaces';

function withUserEntry(
    map: PlexAuthData['selectedServerByUserId'],
    userId: string
): PlexAuthData['selectedServerByUserId'] {
    return {
        ...map,
        [userId]: map[userId] ?? { serverId: null, serverUri: null },
    };
}

export function reconstructActiveValidCredentials(
    stored: PlexAuthData,
    validatedActiveToken: PlexAuthToken
): PlexAuthData {
    const activeUserId = stored.activeUserId || validatedActiveToken.userId;
    return {
        accountToken: stored.accountToken.token === validatedActiveToken.token
            ? validatedActiveToken
            : stored.accountToken,
        activeToken: validatedActiveToken,
        activeUserId,
        selectedServerByUserId: withUserEntry(stored.selectedServerByUserId, activeUserId),
        deviceKey: stored.deviceKey ?? null,
    };
}

export function reconstructAccountFallbackCredentials(
    stored: PlexAuthData,
    validatedAccountToken: PlexAuthToken
): PlexAuthData {
    return {
        accountToken: validatedAccountToken,
        activeToken: validatedAccountToken,
        activeUserId: validatedAccountToken.userId,
        selectedServerByUserId: withUserEntry(
            stored.selectedServerByUserId,
            validatedAccountToken.userId
        ),
        deviceKey: stored.deviceKey ?? null,
    };
}
