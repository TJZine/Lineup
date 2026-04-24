import { AppErrorCode, type IAppLifecycle } from '../../../modules/lifecycle';
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
import { applyPhase2AuthGatePolicy, type Phase2AuthGateInputs } from '../InitializationStartupPolicy';

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

type Phase2PlexAuthOverrides = Partial<PlexAuthGateMock>;

type Phase2AuthGateTestInputs = Phase2AuthGateInputs & {
    plexAuth: PlexAuthGateMock;
    navigation: NavigationGateMock;
    lifecycle: LifecycleGateMock;
    updateModuleStatus: jest.Mock;
    configureDiscoveryStorage: jest.Mock;
    seedSubtitleLanguageFromPlexUser: jest.Mock;
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
    overrides: Phase2PlexAuthOverrides = {}
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

function createInputs(overrides: Phase2PlexAuthOverrides = {}): Phase2AuthGateTestInputs {
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
        seedSubtitleLanguageFromPlexUser: jest.fn(),
        handlers: {
            registerAuthResume: jest.fn(),
            registerProfileResume: jest.fn(),
        },
    };
}

function applyPolicy(inputs: Phase2AuthGateTestInputs): Promise<boolean> {
    return applyPhase2AuthGatePolicy(inputs);
}

describe('applyPhase2AuthGatePolicy', () => {
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
        const inputs = createInputs({
            validateToken: jest.fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true),
            getCurrentUser: jest.fn().mockReturnValue(
                createToken('account-token', 'account-user', 'account', 'account@example.com')
            ),
        });

        await expect(applyPolicy(inputs)).resolves.toBe(false);

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
        const inputs: Phase2AuthGateInputs = {
            startTime: Date.now() - 10,
            plexAuth,
            navigation,
            lifecycle,
            updateModuleStatus: jest.fn(),
            configureDiscoveryStorage: jest.fn(),
            readShowProfilePickerOnStartup: jest.fn(() => false),
            seedSubtitleLanguageFromPlexUser: jest.fn(),
            handlers: {
                registerAuthResume: jest.fn(),
                registerProfileResume: jest.fn(),
            },
        };

        try {
            await expect(applyPhase2AuthGatePolicy(inputs)).resolves.toBe(false);
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
