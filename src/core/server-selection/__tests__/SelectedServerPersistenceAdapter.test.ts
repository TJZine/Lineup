import {
    PlexAuth,
    type PlexAuthConfig,
    type PlexAuthData,
    type PlexAuthToken,
    type PlexDeviceKey,
} from '../../../modules/plex/auth';
import {
    installMockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../__tests__/mocks/localStorage';
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

const makeDeviceKey = (): PlexDeviceKey => ({
    kid: 'unexpected-device-key',
    publicJwk: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: 'unexpected-public-key',
        alg: 'EdDSA',
    },
    privateKey: 'unexpected-private-key',
    createdAt: new Date(0),
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

const createStatefulPort = (
    initial: PlexAuthData
): jest.Mocked<SelectedServerCredentialsPort> => {
    let credentials = initial;
    const port = createPort({
        readStoredCredentialsAndClearCorruption: jest.fn(() => ({
            kind: 'available',
            credentials,
        })),
        storeCredentials: jest.fn((next) => {
            credentials = next;
        }),
    });
    return port;
};

installMockLocalStorage();

describe('SelectedServerPersistenceAdapter', () => {
    beforeEach(() => {
        resetMockLocalStorage();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    it('uses opaque evidence to persist and strictly restore the active-user selection', () => {
        const port = createStatefulPort(makeCredentials({
            selectedServerByUserId: {
                'active-user': {
                    serverId: 'server-old',
                    serverUri: 'https://old.example.invalid',
                },
                'foreign-user': {
                    serverId: 'foreign-server',
                    serverUri: 'https://foreign.example.invalid',
                },
            },
        }));
        const adapter = createAdapter(port);
        const evidence = adapter.capturePersistenceEvidence();

        expect(Object.isFrozen(evidence)).toBe(true);

        expect(adapter.persistCandidateSelection(
            evidence,
            'server-new',
            'https://new.example.invalid'
        )).toEqual({ phase: 'candidate', state: 'updated', publicResult: 'updated' });
        expect(adapter.restorePersistenceEvidence(evidence)).toEqual({
            phase: 'rollback',
            state: 'restored_available_selected',
            selection: { serverId: 'server-old', serverUri: 'https://old.example.invalid' },
        });

        const lastWrite = port.storeCredentials.mock.calls.at(-1)?.[0];
        expect(lastWrite?.selectedServerByUserId).toEqual({
            'active-user': {
                serverId: 'server-old',
                serverUri: 'https://old.example.invalid',
            },
            'foreign-user': {
                serverId: 'foreign-server',
                serverUri: 'https://foreign.example.invalid',
            },
        });
    });

    it('preserves the original corrupted result after capture cleaned storage to missing', () => {
        const reads = [
            { kind: 'corrupted' as const, reason: 'invalid-json' as const },
            { kind: 'missing' as const },
            { kind: 'missing' as const },
        ];
        const port = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => {
                const next = reads.shift();
                if (!next) throw new Error('Unexpected credentials read.');
                return next;
            }),
        });
        const adapter = createAdapter(port);
        const evidence = adapter.capturePersistenceEvidence();

        expect(adapter.persistCandidateSelection(
            evidence,
            'server-new',
            'https://new.example.invalid'
        )).toEqual({
            phase: 'candidate',
            state: 'corruption_cleaned_to_missing',
            publicResult: 'skipped_corrupted_credentials',
        });
        expect(adapter.restorePersistenceEvidence(evidence)).toEqual({
            phase: 'rollback',
            state: 'corruption_cleaned_to_missing',
        });
        expect(port.storeCredentials).not.toHaveBeenCalled();
    });

    it('proves stable missing evidence without writing credentials', () => {
        const port = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({ kind: 'missing' })),
        });
        const adapter = createAdapter(port);
        const evidence = adapter.capturePersistenceEvidence();

        expect(adapter.persistCandidateSelection(
            evidence,
            'server-new',
            'https://new.example.invalid'
        )).toEqual({
            phase: 'candidate',
            state: 'stable_missing',
            publicResult: 'skipped_missing_credentials',
        });
        expect(adapter.restorePersistenceEvidence(evidence)).toEqual({
            phase: 'rollback',
            state: 'stable_missing',
        });
        expect(port.storeCredentials).not.toHaveBeenCalled();
    });

    it('restores an explicit available null selection as an unselected proof', () => {
        const port = createStatefulPort(makeCredentials({
            selectedServerByUserId: {
                'active-user': { serverId: null, serverUri: null },
            },
        }));
        const adapter = createAdapter(port);
        const evidence = adapter.capturePersistenceEvidence();

        expect(adapter.persistCandidateSelection(
            evidence,
            'server-new',
            'https://new.example.invalid'
        )).toEqual({ phase: 'candidate', state: 'updated', publicResult: 'updated' });
        expect(adapter.restorePersistenceEvidence(evidence)).toEqual({
            phase: 'rollback',
            state: 'restored_available_unselected',
            selection: { serverId: null, serverUri: null },
        });
        expect(port.storeCredentials.mock.calls.at(-1)?.[0].selectedServerByUserId['active-user'])
            .toEqual({ serverId: null, serverUri: null });
    });

    it('restores selection after real credential validation refreshes token metadata', async () => {
        const config: PlexAuthConfig = {
            clientIdentifier: 'test-client',
            product: 'Lineup',
            version: '1.0.0',
            platform: 'webOS',
            platformVersion: '6.0',
            device: 'LG TV',
            deviceName: 'Test TV',
        };
        const auth = new PlexAuth(config);
        auth.storeCredentials(makeCredentials({
            selectedServerByUserId: {
                'active-user': { serverId: null, serverUri: null },
            },
        }), { emitAuthChange: false });
        const adapter = createAdapter(auth);
        const evidence = adapter.capturePersistenceEvidence();
        adapter.persistCandidateSelection(
            evidence,
            'server-new',
            'https://new.example.invalid'
        );
        const credentialsBeforeValidation = auth.readStoredCredentialsAndClearCorruption();
        if (credentialsBeforeValidation.kind !== 'available') {
            throw new Error('Expected available credentials before validation.');
        }
        const fetchBeforeTest = globalThis.fetch;
        const refreshedUser = {
            id: 'active-user',
            username: 'active-user-refreshed',
            email: 'active-user-refreshed@example.invalid',
            thumb: '',
        };
        globalThis.fetch = jest.fn().mockResolvedValue({
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => refreshedUser,
            text: async () => JSON.stringify(refreshedUser),
        }) as typeof fetch;

        try {
            await expect(auth.validateStoredCredentials()).resolves.toMatchObject({
                kind: 'active_valid',
            });
            const credentialsAfterValidation = auth.readStoredCredentialsAndClearCorruption();
            if (credentialsAfterValidation.kind !== 'available') {
                throw new Error('Expected available credentials after validation.');
            }
            expect(credentialsAfterValidation.credentials.activeToken).toMatchObject({
                token: credentialsBeforeValidation.credentials.activeToken.token,
                userId: credentialsBeforeValidation.credentials.activeToken.userId,
                username: refreshedUser.username,
                email: refreshedUser.email,
            });
            expect(credentialsAfterValidation.credentials.activeToken.username)
                .not.toBe(credentialsBeforeValidation.credentials.activeToken.username);
            expect(adapter.restorePersistenceEvidence(evidence)).toEqual({
                phase: 'rollback',
                state: 'restored_available_unselected',
                selection: { serverId: null, serverUri: null },
            });
        } finally {
            globalThis.fetch = fetchBeforeTest;
        }
    });

    it('rejects candidate persistence when the credentials port does not store the exact pair', () => {
        const port = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({
                kind: 'available',
                credentials: makeCredentials({
                    selectedServerByUserId: {
                        'active-user': { serverId: null, serverUri: null },
                    },
                }),
            })),
        });
        const adapter = createAdapter(port);
        const evidence = adapter.capturePersistenceEvidence();

        expect(() => adapter.persistCandidateSelection(
            evidence,
            'server-new',
            'https://new.example.invalid'
        )).toThrow('Selected-server persistence evidence is no longer current.');
    });

    it('rejects partial available evidence and active-user drift without writing', () => {
        const partialPort = createPort({
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({
                kind: 'available',
                credentials: makeCredentials({
                    selectedServerByUserId: {
                        'active-user': { serverId: 'partial', serverUri: null },
                    },
                }),
            })),
        });
        expect(() => createAdapter(partialPort).capturePersistenceEvidence()).toThrow(
            'Selected-server persistence evidence is no longer current.'
        );

        const port = createStatefulPort(makeCredentials({
            selectedServerByUserId: {
                'active-user': { serverId: null, serverUri: null },
            },
        }));
        const adapter = createAdapter(port);
        const evidence = adapter.capturePersistenceEvidence();
        port.getActiveUserId.mockReturnValue('new-user');

        expect(() => adapter.persistCandidateSelection(evidence, 'server-new', null)).toThrow(
            'Selected-server persistence evidence is no longer current.'
        );
        expect(port.storeCredentials).not.toHaveBeenCalled();
    });

    it('rejects a stored active-user envelope that disagrees with the session owner', () => {
        const port = createPort({
            getActiveUserId: jest.fn(() => 'session-user'),
            readStoredCredentialsAndClearCorruption: jest.fn(() => ({
                kind: 'available',
                credentials: makeCredentials({
                    activeUserId: 'stored-user',
                    selectedServerByUserId: {
                        'session-user': { serverId: null, serverUri: null },
                    },
                }),
            })),
        });

        expect(() => createAdapter(port).capturePersistenceEvidence()).toThrow(
            'Selected-server persistence evidence is no longer current.'
        );
        expect(port.storeCredentials).not.toHaveBeenCalled();
    });

    it.each([
        ['account token identity', (credentials: PlexAuthData): PlexAuthData => ({
            ...credentials,
            accountToken: {
                ...credentials.accountToken,
                token: 'unexpected-account-token',
            },
        })],
        ['account token user', (credentials: PlexAuthData): PlexAuthData => ({
            ...credentials,
            accountToken: {
                ...credentials.accountToken,
                userId: 'unexpected-account-user',
            },
        })],
        ['active token identity', (credentials: PlexAuthData): PlexAuthData => ({
            ...credentials,
            activeToken: {
                ...credentials.activeToken,
                token: 'unexpected-active-token',
            },
        })],
        ['active token user', (credentials: PlexAuthData): PlexAuthData => ({
            ...credentials,
            activeToken: {
                ...credentials.activeToken,
                userId: 'unexpected-active-user',
            },
        })],
        ['stored active profile', (credentials: PlexAuthData): PlexAuthData => ({
            ...credentials,
            activeUserId: 'unexpected-active-user',
        })],
        ['device key', (credentials: PlexAuthData): PlexAuthData => ({
            ...credentials,
            deviceKey: makeDeviceKey(),
        })],
        ['active-user selection pair', (credentials: PlexAuthData): PlexAuthData => ({
            ...credentials,
            selectedServerByUserId: {
                ...credentials.selectedServerByUserId,
                'active-user': {
                    serverId: 'unexpected-server',
                    serverUri: 'https://unexpected.example.invalid',
                },
            },
        })],
        ['foreign-user selection', (credentials: PlexAuthData): PlexAuthData => ({
            ...credentials,
            selectedServerByUserId: {
                ...credentials.selectedServerByUserId,
                'foreign-user': {
                    serverId: 'unexpected-server',
                    serverUri: 'https://unexpected.example.invalid',
                },
            },
        })],
    ] as const)('rejects %s drift while evidence is retained', (_label, mutate) => {
        const port = createStatefulPort(makeCredentials({
            selectedServerByUserId: {
                'active-user': { serverId: null, serverUri: null },
                'foreign-user': {
                    serverId: 'foreign-server',
                    serverUri: 'https://foreign.example.invalid',
                },
            },
        }));
        const adapter = createAdapter(port);
        const evidence = adapter.capturePersistenceEvidence();
        const current = port.readStoredCredentialsAndClearCorruption();
        if (current.kind !== 'available') {
            throw new Error('Expected available credentials.');
        }
        port.storeCredentials(mutate(current.credentials), { emitAuthChange: false });

        expect(() => adapter.assertPersistenceEvidenceCurrent(evidence)).toThrow(
            'Selected-server persistence evidence is no longer current.'
        );
    });
});
