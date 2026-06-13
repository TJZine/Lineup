import { AppErrorCode } from '../../../types/app-errors';
import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';
import type { IAppLifecycle } from '../../../modules/lifecycle';
import type { INavigationManager } from '../../../modules/navigation';
import type {
    IPlexAuth,
    PlexAuthDataV2,
    PlexAuthConfig,
    PlexAuthToken,
    PlexStoredCredentialsReadResult,
} from '../../../modules/plex/auth';
import { PlexAuth } from '../../../modules/plex/auth/PlexAuth';
import { PLEX_AUTH_CONSTANTS } from '../../../modules/plex/auth/constants';
import {
    applyAuthValidationPolicy,
    applyPostReadyRoutingPolicy,
    applyServerConnectionPolicy,
    type AuthValidationPolicyInputs,
} from '../InitializationStartupPolicy';

type PlexAuthGateMock = Pick<
    IPlexAuth,
    'readStoredCredentialsAndClearCorruption' | 'validateToken' | 'getCurrentUser' | 'storeCredentials' | 'getHomeUsers'
> & {
    readStoredCredentialsAndClearCorruption: jest.MockedFunction<IPlexAuth['readStoredCredentialsAndClearCorruption']>;
    validateToken: jest.MockedFunction<IPlexAuth['validateToken']>;
    getCurrentUser: jest.MockedFunction<IPlexAuth['getCurrentUser']>;
    storeCredentials: jest.MockedFunction<IPlexAuth['storeCredentials']>;
    getHomeUsers: jest.MockedFunction<IPlexAuth['getHomeUsers']>;
};

type NavigationGateMock = Pick<INavigationManager, 'getCurrentScreen' | 'goTo'> & {
    getCurrentScreen: jest.MockedFunction<INavigationManager['getCurrentScreen']>;
    goTo: jest.MockedFunction<INavigationManager['goTo']>;
};

type LifecycleGateMock = Pick<IAppLifecycle, 'setPhase'> & {
    setPhase: jest.MockedFunction<IAppLifecycle['setPhase']>;
};

type AuthValidationPlexAuthOverrides = Partial<PlexAuthGateMock>;

type AuthValidationPolicyTestInputs = AuthValidationPolicyInputs & {
    plexAuth: PlexAuthGateMock;
    navigation: NavigationGateMock;
    lifecycle: LifecycleGateMock;
    updateModuleStatus: jest.Mock;
    configureDiscoveryStorage: jest.Mock;
    handlers: {
        registerAuthResume: jest.Mock;
        registerProfileResume: jest.Mock;
    };
};

const createToken = (
    token: string,
    userId: string,
    username: string,
    email: string
): PlexAuthToken => ({
    token,
    userId,
    username,
    email,
    thumb: '',
    expiresAt: new Date(),
    issuedAt: new Date(),
});

describe('applyPostReadyRoutingPolicy', () => {
    type PostReadyRoutingPolicyTestInputs = Parameters<typeof applyPostReadyRoutingPolicy>[0];

    const createInputs = (
        switchOutcome: ChannelSwitchOutcome = { kind: 'switched' }
    ): PostReadyRoutingPolicyTestInputs => ({
        navigation: {
            replaceScreen: jest.fn(),
        },
        channelManager: {
            getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
            getAllChannels: jest.fn().mockReturnValue([]),
        },
        shouldRunAudioSetup: jest.fn().mockReturnValue(false),
        shouldRunChannelSetup: jest.fn().mockReturnValue(false),
        switchToChannel: jest.fn().mockResolvedValue(switchOutcome),
        openServerSelect: jest.fn(),
    });

    it('routes to player and completes when the startup tune switches', async () => {
        const inputs = createInputs({ kind: 'switched' });

        await expect(applyPostReadyRoutingPolicy(inputs)).resolves.toBeUndefined();

        expect(inputs.navigation.replaceScreen).toHaveBeenCalledWith('player');
        expect(inputs.switchToChannel).toHaveBeenCalledWith('current-channel-id');
        expect(inputs.openServerSelect).not.toHaveBeenCalled();
    });

    it('routes to channel setup when the startup tune cannot find the channel', async () => {
        const inputs = createInputs({ kind: 'failed', reason: 'missing_channel' });

        await expect(applyPostReadyRoutingPolicy(inputs)).resolves.toBeUndefined();

        expect(inputs.navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
        expect(inputs.openServerSelect).not.toHaveBeenCalled();
    });

    it('does not force channel setup when the startup tune fails transiently', async () => {
        const inputs = createInputs({ kind: 'failed', reason: 'content_unavailable' });

        await expect(applyPostReadyRoutingPolicy(inputs)).resolves.toBeUndefined();

        expect(inputs.navigation.replaceScreen).not.toHaveBeenCalled();
        expect(inputs.openServerSelect).not.toHaveBeenCalled();
    });

    it('rejects without opening server select when the startup tune aborts', async () => {
        const inputs = createInputs({ kind: 'aborted' });

        await expect(applyPostReadyRoutingPolicy(inputs)).rejects.toThrow(
            'Initial channel switch aborted for current-channel-id.'
        );

        expect(inputs.navigation.replaceScreen).not.toHaveBeenCalled();
        expect(inputs.openServerSelect).not.toHaveBeenCalled();
    });

    it('opens server select without routing to player when no channels exist', async () => {
        const inputs = createInputs({ kind: 'switched' });
        inputs.channelManager = {
            getCurrentChannel: jest.fn().mockReturnValue(null),
            getAllChannels: jest.fn().mockReturnValue([]),
        };

        await expect(applyPostReadyRoutingPolicy(inputs)).resolves.toBeUndefined();

        expect(inputs.navigation.replaceScreen).not.toHaveBeenCalled();
        expect(inputs.switchToChannel).not.toHaveBeenCalled();
        expect(inputs.openServerSelect).toHaveBeenCalledTimes(1);
    });
});

describe('applyServerConnectionPolicy', () => {
    const createInputs = (
        initializeResult: Awaited<ReturnType<Parameters<typeof applyServerConnectionPolicy>[0]['plexDiscovery']['initialize']>>,
        isConnected = false
    ): Parameters<typeof applyServerConnectionPolicy>[0] => ({
        startTime: Date.now(),
        signal: null,
        plexDiscovery: {
            initialize: jest.fn().mockResolvedValue(initializeResult),
            isConnected: jest.fn().mockReturnValue(isConnected),
        } as unknown as Parameters<typeof applyServerConnectionPolicy>[0]['plexDiscovery'],
        plexLibrary: {} as Parameters<typeof applyServerConnectionPolicy>[0]['plexLibrary'],
        plexStreamResolver: {} as Parameters<typeof applyServerConnectionPolicy>[0]['plexStreamResolver'],
        navigation: {
            goTo: jest.fn(),
        } as unknown as Parameters<typeof applyServerConnectionPolicy>[0]['navigation'],
        updateModuleStatus: jest.fn(),
        handlers: {
            registerServerResume: jest.fn(),
        },
    });

    it.each([
        {
            reason: 'server_not_found' as const,
            expectedCode: AppErrorCode.SERVER_UNREACHABLE,
            expectedMessage: 'Saved Plex server is no longer available.',
        },
        {
            reason: 'unreachable' as const,
            expectedCode: AppErrorCode.SERVER_UNREACHABLE,
            expectedMessage: 'Saved Plex server is unreachable.',
        },
        {
            reason: 'auth_required' as const,
            expectedCode: AppErrorCode.AUTH_REQUIRED,
            expectedMessage: 'Saved Plex server requires authentication.',
        },
        {
            reason: 'access_denied' as const,
            expectedCode: AppErrorCode.ACCESS_DENIED,
            expectedMessage: 'Saved Plex server access was denied.',
        },
    ])(
        'surfaces saved-server $reason as a typed startup blocker while routing to server-select',
        async ({ reason, expectedCode, expectedMessage }) => {
            const inputs = createInputs({
                kind: 'selection_failed',
                serverId: 'saved-srv',
                reason,
            });

            await expect(applyServerConnectionPolicy(inputs)).resolves.toBe(false);

            const expectedError = {
                code: expectedCode,
                message: expectedMessage,
                recoverable: true,
                context: {
                    serverId: 'saved-srv',
                    reason,
                },
            };
            expect(inputs.updateModuleStatus).toHaveBeenCalledWith(
                'plex-server-discovery',
                'pending',
                undefined,
                expect.any(Number)
            );
            expect(inputs.updateModuleStatus).toHaveBeenCalledWith(
                'plex-library',
                'pending',
                expectedError,
                expect.any(Number)
            );
            expect(inputs.updateModuleStatus).toHaveBeenCalledWith(
                'plex-stream-resolver',
                'pending',
                expectedError,
                expect.any(Number)
            );
            expect(inputs.handlers.registerServerResume).toHaveBeenCalledTimes(1);
            expect(inputs.navigation.goTo).toHaveBeenCalledWith('server-select');
        }
    );

    it('marks Plex server modules ready without server-select routing after saved-server restore succeeds', async () => {
        const inputs = createInputs({ kind: 'selected', serverId: 'saved-srv' }, true);

        await expect(applyServerConnectionPolicy(inputs)).resolves.toBe(true);

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith(
            'plex-server-discovery',
            'ready',
            undefined,
            expect.any(Number)
        );
        expect(inputs.updateModuleStatus).toHaveBeenCalledWith(
            'plex-library',
            'ready',
            undefined,
            expect.any(Number)
        );
        expect(inputs.updateModuleStatus).toHaveBeenCalledWith(
            'plex-stream-resolver',
            'ready',
            undefined,
            expect.any(Number)
        );
        expect(inputs.handlers.registerServerResume).not.toHaveBeenCalled();
        expect(inputs.navigation.goTo).not.toHaveBeenCalled();
    });
});

const createStoredCredentials = (): PlexAuthDataV2 => ({
    accountToken: createToken('account-token', 'account-user', 'account', 'account@example.com'),
    activeToken: createToken('active-token', 'active-user', 'active', 'active@example.com'),
    activeUserId: 'active-user',
    selectedServerByUserId: {
        'active-user': { serverId: null, serverUri: null },
    },
    deviceKey: null,
});

const realPlexAuthConfig: PlexAuthConfig = {
    clientIdentifier: 'test-client-id',
    product: 'Lineup',
    version: '1.0.0',
    platform: 'webOS',
    platformVersion: '6.0',
    device: 'LG Smart TV',
    deviceName: 'Living Room TV',
};

const mockLocalStorage = (function (): Storage {
    let store: Record<string, string> = {};
    return {
        get length(): number {
            return Object.keys(store).length;
        },
        key: function (index: number): string | null {
            const keys = Object.keys(store);
            return keys[index] !== undefined ? keys[index] : null;
        },
        getItem: function (key: string): string | null {
            const value = store[key];
            return value !== undefined ? value : null;
        },
        setItem: function (key: string, value: string): void {
            store[key] = value;
        },
        removeItem: function (key: string): void {
            delete store[key];
        },
        clear: function (): void {
            store = {};
        },
    };
})();

Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
});

function createPlexAuthMock(
    storedCredentials: PlexAuthDataV2,
    overrides: AuthValidationPlexAuthOverrides = {}
): PlexAuthGateMock {
    const storedReadResult: PlexStoredCredentialsReadResult = {
        kind: 'available',
        credentials: storedCredentials,
    };
    return {
        validateToken: jest.fn().mockResolvedValue(true),
        getHomeUsers: jest.fn().mockResolvedValue([]),
        readStoredCredentialsAndClearCorruption: jest.fn().mockReturnValue(storedReadResult),
        storeCredentials: jest.fn<void, Parameters<IPlexAuth['storeCredentials']>>(() => undefined),
        getCurrentUser: jest.fn().mockReturnValue(storedCredentials.activeToken),
        ...overrides,
    };
}

function createNavigationMock(): NavigationGateMock {
    return {
        goTo: jest.fn(),
        getCurrentScreen: jest.fn().mockReturnValue('player'),
    };
}

function createLifecycleMock(): LifecycleGateMock {
    return {
        setPhase: jest.fn(),
    };
}

function createInputs(overrides: AuthValidationPlexAuthOverrides = {}): AuthValidationPolicyTestInputs {
    const storedCredentials = createStoredCredentials();
    const plexAuth = createPlexAuthMock(storedCredentials, overrides);
    const navigation = createNavigationMock();
    const lifecycle = createLifecycleMock();

    return {
        startTime: Date.now() - 10,
        plexAuth,
        navigation,
        lifecycle,
        updateModuleStatus: jest.fn(),
        configureDiscoveryStorage: jest.fn(),
        readShowProfilePickerOnStartup: jest.fn(() => false),
        handlers: {
            registerAuthResume: jest.fn(),
            registerProfileResume: jest.fn(),
        },
    };
}

function applyPolicy(inputs: AuthValidationPolicyTestInputs): Promise<boolean> {
    return applyAuthValidationPolicy(inputs);
}

describe('applyAuthValidationPolicy', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('rethrows non-auth failures that happen after token validation succeeds', async () => {
        const error = new Error('storage write failed');
        const inputs = createInputs({
            storeCredentials: jest.fn<void, Parameters<IPlexAuth['storeCredentials']>>(() => {
                throw error;
            }),
        });

        await expect(applyPolicy(inputs)).rejects.toThrow('storage write failed');

        expect(inputs.handlers.registerAuthResume).not.toHaveBeenCalled();
        expect(inputs.navigation.goTo).not.toHaveBeenCalledWith('auth');
    });

    it('stores a PlexAuthDataV2-compatible credential payload after validation succeeds', async () => {
        const inputs = createInputs();

        await expect(applyPolicy(inputs)).resolves.toBe(true);

        expect(inputs.plexAuth.storeCredentials).toHaveBeenCalledWith({
            accountToken: {
                token: 'account-token',
                userId: 'account-user',
                username: 'account',
                email: 'account@example.com',
                thumb: '',
                expiresAt: expect.any(Date),
                issuedAt: expect.any(Date),
            },
            activeToken: {
                token: 'active-token',
                userId: 'active-user',
                username: 'active',
                email: 'active@example.com',
                thumb: '',
                expiresAt: expect.any(Date),
                issuedAt: expect.any(Date),
            },
            activeUserId: 'active-user',
            selectedServerByUserId: {
                'active-user': {
                    serverId: null,
                    serverUri: null,
                },
            },
            deviceKey: null,
        });
    });

    it('passes the startup signal into active token validation', async () => {
        const controller = new AbortController();
        const inputs = createInputs();
        inputs.signal = controller.signal;

        await expect(applyPolicy(inputs)).resolves.toBe(true);

        expect(inputs.plexAuth.validateToken).toHaveBeenCalledWith(
            'active-token',
            { signal: controller.signal }
        );
    });

    it('falls back to auth resume for explicit auth failures', async () => {
        const error = { code: AppErrorCode.AUTH_INVALID };
        const inputs = createInputs({
            validateToken: jest.fn().mockRejectedValue(error),
        });

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending');
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('auth');
    });

    it('falls back to auth resume for expired auth during token validation', async () => {
        const error = { code: AppErrorCode.AUTH_EXPIRED };
        const inputs = createInputs({
            validateToken: jest.fn().mockRejectedValue(error),
        });

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending');
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('auth');
    });

    it('falls back to auth resume for expired auth while checking profile selection', async () => {
        const error = { code: AppErrorCode.AUTH_EXPIRED };
        const inputs = createInputs({
            getHomeUsers: jest.fn().mockRejectedValue(error),
        });
        inputs.readShowProfilePickerOnStartup = jest.fn(() => true);

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending');
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('auth');
    });

    it('rethrows non-auth validation failures instead of forcing auth resume', async () => {
        const error = { code: AppErrorCode.SERVER_UNREACHABLE };
        const inputs = createInputs({
            validateToken: jest.fn().mockRejectedValue(error),
        });

        await expect(applyPolicy(inputs)).rejects.toEqual(error);

        expect(inputs.handlers.registerAuthResume).not.toHaveBeenCalled();
        expect(inputs.navigation.goTo).not.toHaveBeenCalledWith('auth');
    });

    it('routes corrupted stored credentials to auth with STORAGE_CORRUPTED status', async () => {
        const inputs = createInputs({
            readStoredCredentialsAndClearCorruption: jest.fn().mockReturnValue({
                kind: 'corrupted',
                reason: 'invalid-json',
            }),
        });

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending', {
            code: AppErrorCode.STORAGE_CORRUPTED,
            message: 'Stored Plex auth credentials were invalid and were cleared.',
            recoverable: true,
        });
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('auth');
        expect(inputs.plexAuth.validateToken).not.toHaveBeenCalled();
    });

    it('treats missing stored credentials as normal pending-auth startup', async () => {
        const inputs = createInputs({
            readStoredCredentialsAndClearCorruption: jest.fn().mockReturnValue({ kind: 'missing' }),
        });

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending');
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('auth');
    });

    it('preserves pending-auth side-effect order when stored credentials are missing', async () => {
        const inputs = createInputs({
            readStoredCredentialsAndClearCorruption: jest.fn().mockReturnValue({ kind: 'missing' }),
        });

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        const updateOrder = inputs.updateModuleStatus.mock.invocationCallOrder[0] ?? 0;
        const resumeOrder = inputs.handlers.registerAuthResume.mock.invocationCallOrder[0] ?? 0;
        const navigationOrder = inputs.navigation.goTo.mock.invocationCallOrder[0] ?? 0;

        expect(updateOrder).toBeGreaterThan(0);
        expect(updateOrder).toBeLessThan(resumeOrder);
        expect(resumeOrder).toBeLessThan(navigationOrder);
    });

    it('normalizes to the validated account token before routing to profile-select', async () => {
        const controller = new AbortController();
        const inputs = createInputs({
            validateToken: jest.fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true),
            getCurrentUser: jest.fn().mockReturnValue(
                createToken('account-token', 'account-user', 'account', 'account@example.com')
            ),
        });
        inputs.signal = controller.signal;

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        expect(inputs.plexAuth.validateToken).toHaveBeenNthCalledWith(
            1,
            'active-token',
            { signal: controller.signal }
        );
        expect(inputs.plexAuth.validateToken).toHaveBeenNthCalledWith(
            2,
            'account-token',
            { signal: controller.signal }
        );

        expect(inputs.plexAuth.storeCredentials).toHaveBeenCalledWith({
            accountToken: {
                token: 'account-token',
                userId: 'account-user',
                username: 'account',
                email: 'account@example.com',
                thumb: '',
                expiresAt: expect.any(Date),
                issuedAt: expect.any(Date),
            },
            activeToken: {
                token: 'account-token',
                userId: 'account-user',
                username: 'account',
                email: 'account@example.com',
                thumb: '',
                expiresAt: expect.any(Date),
                issuedAt: expect.any(Date),
            },
            activeUserId: 'account-user',
            selectedServerByUserId: {
                'active-user': {
                    serverId: null,
                    serverUri: null,
                },
                'account-user': {
                    serverId: null,
                    serverUri: null,
                },
            },
            deviceKey: null,
        });
        expect(inputs.handlers.registerProfileResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('profile-select');
    });

    it('passes the startup signal into profile selection user lookup', async () => {
        const controller = new AbortController();
        const inputs = createInputs({
            getHomeUsers: jest.fn().mockResolvedValue([
                { id: 'active-user', title: 'Active User', thumb: null, admin: true, protected: false },
                { id: 'other-user', title: 'Other User', thumb: null, admin: false, protected: false },
            ]),
        });
        inputs.signal = controller.signal;
        inputs.navigation.getCurrentScreen.mockReturnValue('auth');

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        expect(inputs.plexAuth.getHomeUsers).toHaveBeenCalledWith({ signal: controller.signal });
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('profile-select');
    });

    it('uses the explicit startup read path to normalize stored credentials through real PlexAuth state', async () => {
        const previousFetch = globalThis.fetch;
        const storedCredentials = createStoredCredentials();
        localStorage.setItem(
            PLEX_AUTH_CONSTANTS.STORAGE_KEY,
            JSON.stringify({
                version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
                data: storedCredentials,
            })
        );

        const plexAuth = new PlexAuth(realPlexAuthConfig);
        const readSpy = jest.spyOn(plexAuth, 'readStoredCredentialsAndClearCorruption');

        expect(plexAuth.getCurrentUser()).toBeNull();
        expect(plexAuth.getActiveUserId()).toBeNull();

        const fetchMock = jest.fn()
            .mockResolvedValueOnce({
                status: 401,
                ok: false,
                json: async () => ({}),
            })
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({
                    id: 'account-user',
                    username: 'validated-account',
                    email: 'validated-account@example.com',
                    thumb: 'https://plex.example/account.png',
                }),
            });
        (globalThis as typeof globalThis & { fetch: typeof fetchMock }).fetch = fetchMock;

        const navigation = createNavigationMock();
        const lifecycle = createLifecycleMock();
        const inputs: AuthValidationPolicyInputs = {
            startTime: Date.now() - 10,
            plexAuth,
            navigation,
            lifecycle,
            updateModuleStatus: jest.fn(),
            configureDiscoveryStorage: jest.fn(),
            readShowProfilePickerOnStartup: jest.fn(() => false),
            handlers: {
                registerAuthResume: jest.fn(),
                registerProfileResume: jest.fn(),
            },
        };

        try {
            await expect(applyAuthValidationPolicy(inputs)).resolves.toBe(false);
        } finally {
            (globalThis as typeof globalThis & { fetch: typeof previousFetch }).fetch = previousFetch;
        }

        expect(readSpy).toHaveBeenCalledTimes(1);
        expect(plexAuth.getCurrentUser()).toMatchObject({
            token: 'account-token',
            userId: 'account-user',
            username: 'validated-account',
            email: 'validated-account@example.com',
            thumb: 'https://plex.example/account.png',
        });
        expect(plexAuth.getActiveUserId()).toBe('account-user');
        expect(plexAuth.readStoredCredentialsAndClearCorruption()).toEqual({
            kind: 'available',
            credentials: expect.objectContaining({
                accountToken: expect.objectContaining({
                    token: 'account-token',
                    userId: 'account-user',
                    username: 'validated-account',
                    email: 'validated-account@example.com',
                }),
                activeToken: expect.objectContaining({
                    token: 'account-token',
                    userId: 'account-user',
                    username: 'validated-account',
                    email: 'validated-account@example.com',
                }),
                activeUserId: 'account-user',
                selectedServerByUserId: {
                    'active-user': {
                        serverId: null,
                        serverUri: null,
                    },
                    'account-user': {
                        serverId: null,
                        serverUri: null,
                    },
                },
            }),
        });
        expect(inputs.handlers.registerProfileResume).toHaveBeenCalledTimes(1);
        expect(navigation.goTo).toHaveBeenCalledWith('profile-select');
    });
});
