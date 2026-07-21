import type { PlexAuthData, PlexAuthToken } from '../interfaces';
import {
    reconstructAccountFallbackCredentials,
    reconstructActiveValidCredentials,
} from '../plexStoredCredentialsValidation';

const token = (value: string, userId: string): PlexAuthToken => ({
    token: value,
    userId,
    username: userId,
    email: `${userId}@example.com`,
    thumb: '',
    expiresAt: null,
    issuedAt: new Date('2026-01-01T00:00:00Z'),
});

const stored: PlexAuthData = {
    accountToken: token('account-old', 'account'),
    activeToken: token('active-old', 'active'),
    activeUserId: 'active',
    selectedServerByUserId: {
        active: { serverId: 'active-server', serverUri: 'http://active' },
        foreign: { serverId: 'foreign-server', serverUri: 'http://foreign' },
    },
    deviceKey: null,
};

describe('stored credential reconstruction', () => {
    it('replaces only the validated active token and preserves metadata', () => {
        const validated = token('active-old', 'active');
        const result = reconstructActiveValidCredentials(stored, validated);
        expect(result.activeToken).toBe(validated);
        expect(result.accountToken).toBe(stored.accountToken);
        expect(result.selectedServerByUserId).toEqual(stored.selectedServerByUserId);
        expect(result.deviceKey).toBeNull();
    });

    it('preserves the selected Home user scope for a distinct managed-profile token', () => {
        const validated = token('active-old', 'validated-active');
        const result = reconstructActiveValidCredentials(stored, validated);

        expect(result.activeUserId).toBe('active');
        expect(result.selectedServerByUserId.active).toEqual(stored.selectedServerByUserId.active);
    });

    it('uses the validated identity when the active token is the account token', () => {
        const accountScopedStored: PlexAuthData = {
            ...stored,
            accountToken: token('shared-token', 'stale-account'),
            activeToken: token('shared-token', 'stale-account'),
            activeUserId: 'stale-account',
        };
        const validated = token('shared-token', 'validated-account');

        const result = reconstructActiveValidCredentials(accountScopedStored, validated);

        expect(result.activeUserId).toBe('validated-account');
        expect(result.selectedServerByUserId['validated-account']).toEqual({
            serverId: null,
            serverUri: null,
        });
    });

    it('promotes the validated account token and preserves foreign server metadata', () => {
        const validated = token('account-old', 'account');
        const result = reconstructAccountFallbackCredentials(stored, validated);
        expect(result.accountToken).toBe(validated);
        expect(result.activeToken).toBe(validated);
        expect(result.activeUserId).toBe('account');
        expect(result.selectedServerByUserId.foreign).toEqual(
            stored.selectedServerByUserId.foreign
        );
        expect(result.selectedServerByUserId.account).toEqual({
            serverId: null,
            serverUri: null,
        });
    });
});
