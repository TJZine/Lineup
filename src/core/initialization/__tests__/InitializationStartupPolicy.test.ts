import { AppErrorCode } from '../../../types/app-errors';
import type { IAppLifecycle } from '../../../modules/lifecycle';
import type { INavigationManager } from '../../../modules/navigation';
import type {
    IPlexAuth,
    PlexAuthDataV2,
    PlexAuthConfig,
    PlexAuthToken,
    PlexAuthValidationGuard,
    PlexStoredCredentialsValidationResult,
} from '../../../modules/plex/auth';
import { PlexAuth } from '../../../modules/plex/auth/PlexAuth';
import { NavigationManager } from '../../../modules/navigation/manager/NavigationManager';
import { PLEX_AUTH_CONSTANTS } from '../../../modules/plex/auth/constants';
import {
    PlexDiscoverySelectionSupersededError,
    type PlexDiscoverySelectionReceipt,
} from '../../../modules/plex/discovery';
import { PlexDiscoverySelectionContext } from '../../../modules/plex/discovery/PlexDiscoverySelectionContext';
import {
    applyAuthValidationPolicy,
    applyPostReadyRoutingPolicy,
    applyServerConnectionPolicy,
    type AuthValidationPolicyInputs,
} from '../InitializationStartupPolicy';

type PlexAuthGateMock = Pick<
    IPlexAuth,
    'validateStoredCredentials' | 'getHomeUsers'
> & {
    validateStoredCredentials: jest.MockedFunction<IPlexAuth['validateStoredCredentials']>;
    getHomeUsers: jest.MockedFunction<IPlexAuth['getHomeUsers']>;
};

type NavigationGateMock = Pick<INavigationManager, 'getCurrentScreen' | 'goTo' | 'resetToAuth'> & {
    getCurrentScreen: jest.MockedFunction<INavigationManager['getCurrentScreen']>;
    goTo: jest.MockedFunction<INavigationManager['goTo']>;
    resetToAuth: jest.MockedFunction<INavigationManager['resetToAuth']>;
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

    const createInputs = (): PostReadyRoutingPolicyTestInputs => ({
        navigation: {
            replaceScreen: jest.fn(),
        },
        channelManager: {
            getLastLoadOutcome: jest.fn().mockReturnValue({
                kind: 'readable', generation: 1, revision: 1, channelCount: 2,
            }),
        },
        shouldRunAudioSetup: jest.fn().mockReturnValue(false),
        openServerSelect: jest.fn(),
    });

    it('opens untuned Guide for a readable saved lineup', async () => {
        const inputs = createInputs();

        await expect(applyPostReadyRoutingPolicy(inputs)).resolves.toBeUndefined();

        expect(inputs.navigation.replaceScreen).toHaveBeenCalledWith('guide');
        expect(inputs.openServerSelect).not.toHaveBeenCalled();
    });

    it.each(['absent', 'valid-empty'] as const)('routes %s to first-use setup', async (kind) => {
        const inputs = createInputs();
        (inputs.channelManager?.getLastLoadOutcome as jest.Mock).mockReturnValue({
            kind, generation: 1, revision: 1, ...(kind === 'valid-empty' ? { channelCount: 0 } : {}),
        });

        await expect(applyPostReadyRoutingPolicy(inputs)).resolves.toBeUndefined();

        expect(inputs.navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
    });

    it.each(['read-failed', 'unreadable', 'unsupported'] as const)(
        'blocks %s without guessing that the lineup is empty', async (kind) => {
            const inputs = createInputs();
            (inputs.channelManager?.getLastLoadOutcome as jest.Mock).mockReturnValue({
                kind, generation: 1, revision: 1,
                ...(kind === 'read-failed' ? {} : { replacementHandle: 'protected' }),
            });

            await expect(applyPostReadyRoutingPolicy(inputs)).rejects.toMatchObject({
                name: 'StartupRestoreBlockedError', outcome: { kind },
            });
            expect(inputs.navigation.replaceScreen).not.toHaveBeenCalled();
        }
    );

    it('keeps a readable but degraded lineup in Guide', async () => {
        const inputs = createInputs();
        (inputs.channelManager?.getLastLoadOutcome as jest.Mock).mockReturnValue({
            kind: 'readable-degraded', generation: 1, revision: 1, channelCount: 2,
        });
        await applyPostReadyRoutingPolicy(inputs);
        expect(inputs.navigation.replaceScreen).toHaveBeenCalledWith('guide');
    });
});

describe('applyServerConnectionPolicy', () => {
    const createReceipt = (): PlexDiscoverySelectionReceipt => {
        const context = new PlexDiscoverySelectionContext();
        return context.issueReceipt(context.capture(), 'selected');
    };

    const createInputs = (
        initializeResult: Awaited<ReturnType<Parameters<typeof applyServerConnectionPolicy>[0]['plexDiscovery']['initialize']>>,
        isConnected = false
    ): Parameters<typeof applyServerConnectionPolicy>[0] => ({
        startTime: Date.now(),
        signal: null,
        plexDiscovery: {
            initialize: jest.fn().mockResolvedValue(initializeResult),
            isConnected: jest.fn().mockReturnValue(isConnected),
            assertSelectionReceiptCurrent: jest.fn(),
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

            await expect(applyServerConnectionPolicy(inputs)).resolves.toEqual({
                kind: 'stop',
                reason: 'selection_failed',
            });

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
        const receipt = createReceipt();
        const inputs = createInputs({ kind: 'selected', serverId: 'saved-srv', receipt }, true);

        await expect(applyServerConnectionPolicy(inputs)).resolves.toEqual({
            kind: 'continue',
            receipt,
        });

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
        expect(inputs.plexDiscovery.assertSelectionReceiptCurrent).toHaveBeenCalledTimes(5);
    });

    it('rethrows discovery supersession before startup fallback routing', async () => {
        const inputs = createInputs({ kind: 'skipped_no_servers' });
        const superseded = new PlexDiscoverySelectionSupersededError();
        inputs.plexDiscovery.initialize = jest.fn().mockRejectedValue(superseded);

        await expect(applyServerConnectionPolicy(inputs)).rejects.toBe(superseded);
        expect(inputs.updateModuleStatus).toHaveBeenCalledTimes(1);
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

function createGuard(): PlexAuthValidationGuard {
    return { signal: new AbortController().signal, assertCurrent: jest.fn() };
}

function createValidationResult(
    kind: PlexStoredCredentialsValidationResult['kind'],
    guard = createGuard()
): PlexStoredCredentialsValidationResult {
    return kind === 'corrupted'
        ? { kind, reason: 'invalid-json', guard }
        : { kind, guard };
}

function createPlexAuthMock(overrides: AuthValidationPlexAuthOverrides = {}): PlexAuthGateMock {
    return {
        validateStoredCredentials: jest.fn().mockResolvedValue(createValidationResult('active_valid')),
        getHomeUsers: jest.fn().mockResolvedValue([]),
        ...overrides,
    };
}

function createNavigationMock(): NavigationGateMock {
    return {
        goTo: jest.fn(),
        resetToAuth: jest.fn(),
        getCurrentScreen: jest.fn().mockReturnValue('player'),
    };
}

function createLifecycleMock(): LifecycleGateMock {
    return {
        setPhase: jest.fn(),
    };
}

function createInputs(overrides: AuthValidationPlexAuthOverrides = {}): AuthValidationPolicyTestInputs {
    const plexAuth = createPlexAuthMock(overrides);
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

function applyPolicy(
    inputs: AuthValidationPolicyTestInputs
): ReturnType<typeof applyAuthValidationPolicy> {
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

    it('continues after the auth owner has committed active credentials', async () => {
        const inputs = createInputs();
        const result = await applyPolicy(inputs);
        expect(result.kind).toBe('continue');
        expect(inputs.configureDiscoveryStorage).toHaveBeenCalledTimes(1);
    });

    it('passes the startup signal into stored credential validation', async () => {
        const controller = new AbortController();
        const inputs = createInputs();
        inputs.signal = controller.signal;
        await applyPolicy(inputs);
        expect(inputs.plexAuth.validateStoredCredentials).toHaveBeenCalledWith({
            signal: controller.signal,
        });
    });

    it('falls back to auth resume for expired auth while checking profile selection', async () => {
        const error = { code: AppErrorCode.AUTH_EXPIRED };
        const inputs = createInputs({
            getHomeUsers: jest.fn().mockRejectedValue(error),
        });
        inputs.readShowProfilePickerOnStartup = jest.fn(() => true);

        await expect(applyPolicy(inputs)).resolves.toEqual({ kind: 'stop' });

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending');
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.resetToAuth).toHaveBeenCalledTimes(1);
    });

    it('rethrows non-auth validation failures instead of forcing auth resume', async () => {
        const error = { code: AppErrorCode.SERVER_UNREACHABLE };
        const inputs = createInputs({
            validateStoredCredentials: jest.fn().mockRejectedValue(error),
        });

        await expect(applyPolicy(inputs)).rejects.toEqual(error);

        expect(inputs.handlers.registerAuthResume).not.toHaveBeenCalled();
        expect(inputs.navigation.resetToAuth).not.toHaveBeenCalled();
    });

    it('routes corrupted stored credentials to auth with STORAGE_CORRUPTED status', async () => {
        const inputs = createInputs({
            validateStoredCredentials: jest.fn().mockResolvedValue(createValidationResult('corrupted')),
        });
        await expect(applyPolicy(inputs)).resolves.toEqual({ kind: 'stop' });

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending', {
            code: AppErrorCode.STORAGE_CORRUPTED,
            message: 'Stored Plex auth credentials were invalid and were cleared.',
            recoverable: true,
        });
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.resetToAuth).toHaveBeenCalledTimes(1);
    });

    it('treats missing stored credentials as normal pending-auth startup', async () => {
        const inputs = createInputs({
            validateStoredCredentials: jest.fn().mockResolvedValue(createValidationResult('missing')),
        });
        await expect(applyPolicy(inputs)).resolves.toEqual({ kind: 'stop' });

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending');
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.resetToAuth).toHaveBeenCalledTimes(1);
    });

    it('clears protected Settings history when sign-out leaves auth pending', async () => {
        const navigation = new NavigationManager();
        navigation.goTo('guide');
        navigation.goTo('settings');
        const inputs = createInputs({
            validateStoredCredentials: jest.fn().mockResolvedValue(createValidationResult('missing')),
        });

        await expect(applyAuthValidationPolicy({ ...inputs, navigation })).resolves.toEqual({ kind: 'stop' });

        expect(navigation.getCurrentScreen()).toBe('auth');
        expect(navigation.getState().screenStack).toEqual([]);
        expect(navigation.goBack()).toBe(false);
        expect(navigation.getCurrentScreen()).toBe('auth');
        navigation.destroy();
    });

    it('preserves pending-auth side-effect order when stored credentials are missing', async () => {
        const inputs = createInputs({
            validateStoredCredentials: jest.fn().mockResolvedValue(createValidationResult('missing')),
        });
        await expect(applyPolicy(inputs)).resolves.toEqual({ kind: 'stop' });

        const updateOrder = inputs.updateModuleStatus.mock.invocationCallOrder[0] ?? 0;
        const resumeOrder = inputs.handlers.registerAuthResume.mock.invocationCallOrder[0] ?? 0;
        const navigationOrder = inputs.navigation.resetToAuth.mock.invocationCallOrder[0] ?? 0;

        expect(updateOrder).toBeGreaterThan(0);
        expect(updateOrder).toBeLessThan(resumeOrder);
        expect(resumeOrder).toBeLessThan(navigationOrder);
    });

    it('routes an account fallback result to profile-select', async () => {
        const inputs = createInputs({
            validateStoredCredentials: jest.fn().mockResolvedValue(
                createValidationResult('account_fallback_valid')
            ),
        });
        await expect(applyPolicy(inputs)).resolves.toEqual({ kind: 'stop' });
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

        await expect(applyPolicy(inputs)).resolves.toEqual({ kind: 'stop' });

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
        const validationSpy = jest.spyOn(plexAuth, 'validateStoredCredentials');

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
            await expect(applyAuthValidationPolicy(inputs)).resolves.toEqual({ kind: 'stop' });
        } finally {
            (globalThis as typeof globalThis & { fetch: typeof previousFetch }).fetch = previousFetch;
        }

        expect(validationSpy).toHaveBeenCalledTimes(1);
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
