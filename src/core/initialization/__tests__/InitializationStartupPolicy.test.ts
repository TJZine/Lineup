import { AppErrorCode } from '../../../modules/lifecycle';
import { applyPhase2AuthGatePolicy, type Phase2AuthGateInputs } from '../InitializationStartupPolicy';

const createStoredCredentials = (): {
    accountToken: {
        token: string;
        userId: string;
        username: string;
        email: string;
        thumb: null;
        authToken: string;
        expiresAt: Date;
        issuedAt: Date;
    };
    activeToken: {
        token: string;
        userId: string;
        username: string;
        email: string;
        thumb: null;
        authToken: string;
        expiresAt: Date;
        issuedAt: Date;
    };
    activeUserId: string;
    selectedServerByUserId: Record<string, never>;
    deviceKey: null;
} => ({
    accountToken: {
        token: 'account-token',
        userId: 'account-user',
        username: 'account',
        email: 'account@example.com',
        thumb: null,
        authToken: 'account-token',
        expiresAt: new Date(),
        issuedAt: new Date(),
    },
    activeToken: {
        token: 'active-token',
        userId: 'active-user',
        username: 'active',
        email: 'active@example.com',
        thumb: null,
        authToken: 'active-token',
        expiresAt: new Date(),
        issuedAt: new Date(),
    },
    activeUserId: 'active-user',
    selectedServerByUserId: {},
    deviceKey: null,
});

function createInputs(overrides: Partial<Phase2AuthGateInputs['plexAuth']> = {}): Phase2AuthGateInputs {
    const storedCredentials = createStoredCredentials();
    const plexAuth = {
        getStoredCredentials: jest.fn().mockResolvedValue(storedCredentials),
        validateToken: jest.fn().mockResolvedValue(true),
        getCurrentUser: jest.fn().mockReturnValue(storedCredentials.activeToken),
        storeCredentials: jest.fn().mockResolvedValue(undefined),
        getHomeUsers: jest.fn().mockResolvedValue([]),
        ...overrides,
    };

    return {
        startTime: Date.now() - 10,
        plexAuth: plexAuth as never,
        navigation: {
            getCurrentScreen: jest.fn().mockReturnValue('player'),
            goTo: jest.fn(),
        } as never,
        lifecycle: {
            setPhase: jest.fn(),
        } as never,
        updateModuleStatus: jest.fn(),
        configureDiscoveryStorage: jest.fn(),
        seedSubtitleLanguageFromPlexUser: jest.fn(),
        handlers: {
            registerAuthResume: jest.fn(),
            registerProfileResume: jest.fn(),
        },
    };
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

        await expect(applyPhase2AuthGatePolicy(inputs)).rejects.toThrow('storage write failed');

        expect(inputs.handlers.registerAuthResume).not.toHaveBeenCalled();
        expect(inputs.navigation.goTo).not.toHaveBeenCalledWith('auth');
    });

    it('falls back to auth resume for explicit auth failures', async () => {
        const error = { code: AppErrorCode.AUTH_INVALID };
        const inputs = createInputs({
            validateToken: jest.fn().mockRejectedValue(error),
        });

        await expect(applyPhase2AuthGatePolicy(inputs)).resolves.toBe(false);

        expect(inputs.updateModuleStatus).toHaveBeenCalledWith('plex-auth', 'pending');
        expect(inputs.handlers.registerAuthResume).toHaveBeenCalledTimes(1);
        expect(inputs.navigation.goTo).toHaveBeenCalledWith('auth');
    });
});
