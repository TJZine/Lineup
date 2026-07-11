import type { PlexAuthData, PlexAuthToken } from '../../../modules/plex/auth';
import {
    SelectedServerPersistenceAdapter,
    type SelectedServerCredentialsPort,
} from '../SelectedServerPersistenceAdapter';

const makeToken = (userId: string): PlexAuthToken => ({
    token: `${userId}-token`,
    userId,
    username: userId,
    email: `${userId}@example.invalid`,
    thumb: '',
    expiresAt: null,
    issuedAt: new Date(0),
});

const makeCredentials = (overrides: Partial<PlexAuthData> = {}): PlexAuthData => ({
    accountToken: makeToken('account-user'),
    activeToken: makeToken('active-user'),
    activeUserId: 'active-user',
    selectedServerByUserId: {},
    deviceKey: null,
    ...overrides,
});

const createPort = (
    overrides: Partial<jest.Mocked<SelectedServerCredentialsPort>> = {}
): jest.Mocked<SelectedServerCredentialsPort> => ({
    getActiveUserId: jest.fn(() => 'active-user'),
    readStoredCredentialsAndClearCorruption: jest.fn(() => ({
        kind: 'available',
        credentials: makeCredentials(),
    })),
    storeCredentials: jest.fn(),
    ...overrides,
});

const createAdapter = (
    port: SelectedServerCredentialsPort | null
): SelectedServerPersistenceAdapter =>
    new SelectedServerPersistenceAdapter({
        getCredentialsPort: () => port,
    });

describe('SelectedServerPersistenceAdapter', () => {
    it('persists selected server for the active Plex user without changing credential schema', async () => {
        const credentials = makeCredentials({
            selectedServerByUserId: {
                'other-user': { serverId: 'server-old', serverUri: 'https://old.example.invalid' },
            },
        });
        const port = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({
                kind: 'available',
                credentials,
            })),
        });
        const adapter = createAdapter(port);

        await expect(adapter.persistSelection('server-1', 'https://server.example.invalid')).resolves.toBe('updated');

        expect(port.storeCredentials).toHaveBeenCalledWith(
            {
                accountToken: credentials.accountToken,
                activeToken: credentials.activeToken,
                activeUserId: 'active-user',
                selectedServerByUserId: {
                    'other-user': { serverId: 'server-old', serverUri: 'https://old.example.invalid' },
                    'active-user': { serverId: 'server-1', serverUri: 'https://server.example.invalid' },
                },
                deviceKey: null,
            },
            { emitAuthChange: false }
        );
    });

    it('uses the current session active user when stored credentials disagree', async () => {
        const credentials = makeCredentials({
            activeUserId: 'stored-user',
            selectedServerByUserId: {
                'stored-user': { serverId: 'server-old', serverUri: 'https://old.example.invalid' },
            },
        });
        const port = createPort({
            getActiveUserId: jest.fn(() => 'session-user'),
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({
                kind: 'available',
                credentials,
            })),
        });
        const adapter = createAdapter(port);

        await expect(adapter.persistSelection('server-1', 'https://server.example.invalid')).resolves.toBe('updated');

        // Current session authority is intentional: port.getActiveUserId() overwrites stored activeUserId.
        expect(port.storeCredentials).toHaveBeenCalledWith(
            expect.objectContaining({
                activeUserId: 'session-user',
                selectedServerByUserId: expect.objectContaining({
                    'session-user': { serverId: 'server-1', serverUri: 'https://server.example.invalid' },
                    'stored-user': { serverId: 'server-old', serverUri: 'https://old.example.invalid' },
                }),
            }),
            { emitAuthChange: false }
        );
    });

    it('preserves missing and corrupted credential semantics when persisting', async () => {
        const missingPort = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({ kind: 'missing' })),
        });
        const corruptedPort = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({
                kind: 'corrupted',
                reason: 'invalid-json',
            })),
        });

        await expect(createAdapter(null).persistSelection('server-1', null)).resolves.toBe('skipped_missing_credentials');
        await expect(createAdapter(missingPort).persistSelection('server-1', null)).resolves.toBe('skipped_missing_credentials');
        await expect(createAdapter(corruptedPort).persistSelection('server-1', null)).resolves.toBe('skipped_corrupted_credentials');

        expect(missingPort.storeCredentials).not.toHaveBeenCalled();
        expect(corruptedPort.storeCredentials).not.toHaveBeenCalled();
    });

    it('captures selected-server snapshots for the active user without persisting', async () => {
        const port = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({
                kind: 'available',
                credentials: makeCredentials({
                    selectedServerByUserId: {
                        'active-user': {
                            serverId: 'server-1',
                            serverUri: 'https://server.example.invalid',
                        },
                    },
                }),
            })),
        });
        const adapter = createAdapter(port);

        await expect(adapter.capturePersistedSelectionSnapshot()).resolves.toEqual({
            kind: 'available',
            selection: {
                serverId: 'server-1',
                serverUri: 'https://server.example.invalid',
            },
        });

        expect(port.storeCredentials).not.toHaveBeenCalled();
    });

    it('restores selected-server snapshots by replacing the active-user selection exactly', async () => {
        const port = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({
                kind: 'available',
                credentials: makeCredentials({
                    selectedServerByUserId: {
                        'active-user': {
                            serverId: 'server-1',
                            serverUri: 'https://server.example.invalid',
                        },
                        'foreign-user': {
                            serverId: 'foreign-server',
                            serverUri: 'https://foreign.example.invalid',
                        },
                    },
                }),
            })),
        });
        const adapter = createAdapter(port);

        await expect(adapter.restorePersistedSelectionSnapshot({
            kind: 'available',
            selection: {
                serverId: 'server-2',
                serverUri: 'https://server-2.example.invalid',
            },
        })).resolves.toBe('updated');

        expect(port.storeCredentials).toHaveBeenCalledTimes(1);
        expect(port.storeCredentials).toHaveBeenCalledWith(
            expect.objectContaining({
                selectedServerByUserId: {
                    'active-user': {
                        serverId: 'server-2',
                        serverUri: 'https://server-2.example.invalid',
                    },
                    'foreign-user': {
                        serverId: 'foreign-server',
                        serverUri: 'https://foreign.example.invalid',
                    },
                },
            }),
            { emitAuthChange: false }
        );
    });
});
