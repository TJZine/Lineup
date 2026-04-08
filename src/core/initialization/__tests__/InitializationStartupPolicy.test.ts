import { AppErrorCode, type IAppLifecycle } from '../../../modules/lifecycle';
import type { INavigationManager } from '../../../modules/navigation';
import type {
    IPlexAuth,
    PlexAuthDataV2,
    PlexAuthToken,
    PlexStoredCredentialsReadResult,
} from '../../../modules/plex/auth';
import { applyPhase2AuthGatePolicy, type Phase2AuthGateInputs } from '../InitializationStartupPolicy';

type PlexAuthGateMock = Pick<
    IPlexAuth,
    'getStoredCredentials' | 'validateToken' | 'getCurrentUser' | 'storeCredentials' | 'getHomeUsers'
> & {
    getStoredCredentials: jest.MockedFunction<IPlexAuth['getStoredCredentials']>;
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
        getStoredCredentials: jest.fn().mockResolvedValue(storedReadResult),
        storeCredentials: jest.fn().mockResolvedValue(undefined),
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
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('rethrows non-auth failures that happen after token validation succeeds', async () => {
        const error = new Error('storage write failed');
        const inputs = createInputs({
            storeCredentials: jest.fn().mockRejectedValue(error),
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

    it('routes corrupted stored credentials to auth with STORAGE_CORRUPTED status', async () => {
        const inputs = createInputs({
            getStoredCredentials: jest.fn().mockResolvedValue({
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
            getStoredCredentials: jest.fn().mockResolvedValue({ kind: 'missing' }),
        });

        await expect(applyPolicy(inputs)).resolves.toBe(false);

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending');
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('auth');
    });
});
