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
        if (module.app?.getOrchestrator()) {
            return;
        }
    }

    throw new Error('bootstrap did not create orchestrator');
};

const waitForUnauthenticatedPhase2 = async (module: BootstrapModule): Promise<void> => {
    for (let i = 0; i < 50; i += 1) {
        await flushPromisesAndMacrotask();
        const orchestrator = module.app?.getOrchestrator() ?? null;
        if (!orchestrator) continue;

        const moduleStatus = orchestrator.getModuleStatus();
        const appLifecycleStatus = moduleStatus.get('app-lifecycle')?.status;
        const navigationStatus = moduleStatus.get('navigation')?.status;
        const plexAuthStatus = moduleStatus.get('plex-auth')?.status;
        const screen = orchestrator.getCurrentScreen();

        if (
            appLifecycleStatus === 'ready'
            && navigationStatus === 'ready'
            && plexAuthStatus === 'pending'
            && screen === 'auth'
        ) {
            return;
        }
    }

    throw new Error('startup did not reach unauthenticated phase-2 state');
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
        await waitForUnauthenticatedPhase2(module);

        expect(module.app).not.toBeNull();

        const orchestrator = module.app?.getOrchestrator() ?? null;
        expect(orchestrator).not.toBeNull();

        const moduleStatus = orchestrator?.getModuleStatus();
        expect(moduleStatus?.get('app-lifecycle')?.status).toBe('ready');
        expect(moduleStatus?.get('navigation')?.status).toBe('ready');
        expect(moduleStatus?.get('plex-auth')?.status).toBe('pending');

        expect(orchestrator?.getCurrentScreen()).toBe('auth');

        const invalidTransitionWarnings = (consoleWarnSpy?.mock.calls ?? []).filter(([message]) =>
            typeof message === 'string' && message.includes('Invalid phase transition')
        );
        expect(invalidTransitionWarnings).toHaveLength(0);

        const debugApi = (window as LineupWindow).__LINEUP__;
        expect(debugApi).toBeDefined();
        expect(debugApi?.orchestratorStatus()).not.toBeNull();

        await module.cleanupAndUninstallLineupBootstrap();

        expect(module.app).toBeNull();
        expect((window as LineupWindow).__LINEUP__).toBeUndefined();
    });
});
