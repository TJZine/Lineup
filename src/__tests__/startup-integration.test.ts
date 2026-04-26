/**
 * @jest-environment jsdom
 */

import {
    flushPromisesAndMacrotask,
    setDevBuildForTest,
    setDocumentReadyStateForTest,
} from './helpers';

jest.mock('../modules/ui/splash', () => ({
    SplashScreen: class SplashScreen {
        show(): void {
            return;
        }
        hide(): void {
            return;
        }
    },
}));

type BootstrapModule = typeof import('../bootstrap');

type DebugApi = {
    orchestratorStatus: () => unknown;
};

type LineupWindow = Window & { __LINEUP__?: DebugApi };

jest.setTimeout(15000);

let restoreDevBuild: (() => void) | null = null;
let restoreDocumentReadyState: (() => void) | null = null;

const setDevBuild = (value: boolean): void => {
    restoreDevBuild?.();
    restoreDevBuild = setDevBuildForTest(value);
};

const setDocumentReadyState = (value: DocumentReadyState): void => {
    restoreDocumentReadyState?.();
    restoreDocumentReadyState = setDocumentReadyStateForTest(value);
};

const waitForBoot = async (module: BootstrapModule): Promise<void> => {
    for (let i = 0; i < 50; i += 1) {
        await flushPromisesAndMacrotask();
        if (module.getLineupBootstrapStatus().hasOrchestrator) {
            return;
        }
    }

    throw new Error('bootstrap did not create orchestrator');
};

const waitForUnauthenticatedAuthGate = async (module: BootstrapModule): Promise<void> => {
    for (let i = 0; i < 50; i += 1) {
        await flushPromisesAndMacrotask();
        const orchestrator = module.getLineupBootstrapStatus().orchestrator;
        if (!orchestrator) continue;

        const moduleStatus = new Map(orchestrator.status.map((status) => [status.id, status.status]));
        const appLifecycleStatus = moduleStatus.get('app-lifecycle');
        const navigationStatus = moduleStatus.get('navigation');
        const plexAuthStatus = moduleStatus.get('plex-auth');
        const screen = orchestrator.currentScreen;

        if (
            appLifecycleStatus === 'ready'
            && navigationStatus === 'ready'
            && plexAuthStatus === 'pending'
            && screen === 'auth'
        ) {
            return;
        }
    }

    throw new Error('startup did not reach unauthenticated auth gate state');
};

describe('startup integration', () => {
    let bootstrapModule: BootstrapModule | null = null;
    let consoleWarnSpy: jest.SpyInstance | null = null;

    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        document.body.innerHTML = '<div id="app"></div>';
        setDevBuild(true);
        delete (window as LineupWindow).__LINEUP__;
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(async () => {
        try {
            if (bootstrapModule) {
                await bootstrapModule.cleanupAndUninstallLineupBootstrap();
            }
        } finally {
            bootstrapModule = null;
            delete (window as LineupWindow).__LINEUP__;
            localStorage.clear();
            document.body.innerHTML = '';
            restoreDocumentReadyState?.();
            restoreDocumentReadyState = null;
            restoreDevBuild?.();
            restoreDevBuild = null;
            consoleWarnSpy?.mockRestore();
            consoleWarnSpy = null;
        }
    });

    it('boots through installLineupBootstrap and routes unauthenticated startup to auth without invalid lifecycle transitions', async () =>
    {
        setDocumentReadyState('loading');

        const module = await import('../bootstrap');
        bootstrapModule = module;

        module.installLineupBootstrap();
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await waitForBoot(module);
        await waitForUnauthenticatedAuthGate(module);

        const bootstrapStatus = module.getLineupBootstrapStatus();
        expect(bootstrapStatus.hasApp).toBe(true);
        expect(bootstrapStatus.hasOrchestrator).toBe(true);

        const orchestrator = bootstrapStatus.orchestrator;
        expect(orchestrator).not.toBeNull();

        const actualOrchestrator = orchestrator as NonNullable<typeof orchestrator>;
        const moduleStatus = new Map(actualOrchestrator.status.map((status) => [status.id, status.status]));
        expect(moduleStatus.get('app-lifecycle')).toBe('ready');
        expect(moduleStatus.get('navigation')).toBe('ready');
        expect(moduleStatus.get('plex-auth')).toBe('pending');

        expect(actualOrchestrator.currentScreen).toBe('auth');

        const invalidTransitionWarnings = (consoleWarnSpy?.mock.calls ?? []).filter(([message]) =>
            typeof message === 'string' && message.includes('Invalid phase transition')
        );
        expect(invalidTransitionWarnings).toHaveLength(0);

        const debugApi = (window as LineupWindow).__LINEUP__;
        expect(debugApi).toBeDefined();
        expect(debugApi?.orchestratorStatus()).not.toBeNull();

        await module.cleanupAndUninstallLineupBootstrap();

        expect(module.getLineupBootstrapStatus()).toEqual({
            hasApp: false,
            hasOrchestrator: false,
            orchestrator: null,
        });
        expect((window as LineupWindow).__LINEUP__).toBeUndefined();
    });
});
