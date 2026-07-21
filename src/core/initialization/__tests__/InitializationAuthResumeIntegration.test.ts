/** @jest-environment jsdom */

import { PlexAuth, type PlexAuthConfig, type PlexPinRequest } from '../../../modules/plex/auth';
import { AuthScreen } from '../../../modules/ui/auth/AuthScreen';
import { EpgPreferencesStore } from '../../../modules/settings/EpgPreferencesStore';
import { ProfileSessionStore } from '../../../modules/settings/ProfileSessionStore';
import { PlexDiscoverySelectionContext } from '../../../modules/plex/discovery/PlexDiscoverySelectionContext';
import { AppErrorCode } from '../../../types/app-errors';
import { getRecoveryActions } from '../../error-recovery/RecoveryActions';
import {
    InitializationCoordinator,
    STARTUP_PHASE,
    type InitializationCallbacks,
    type InitializationDependencies,
} from '../InitializationCoordinator';

const config: PlexAuthConfig = {
    clientIdentifier: 'integration-client',
    product: 'Lineup',
    version: '1',
    platform: 'webOS',
    platformVersion: '6',
    device: 'TV',
    deviceName: 'TV',
};

function createCoordinator(auth: PlexAuth, setReady: jest.Mock): InitializationCoordinator {
    const selectionContext = new PlexDiscoverySelectionContext();
    const receipt = selectionContext.issueReceipt(selectionContext.capture(), 'selected');
    const navigation = {
        initialize: jest.fn(),
        getCurrentScreen: jest.fn().mockReturnValue('player'),
        goTo: jest.fn(),
        replaceScreen: jest.fn(),
    };
    const dependencies = {
        modules: {
            lifecycle: null,
            navigation,
            plexAuth: auth,
            plexDiscovery: {
                initialize: jest.fn().mockResolvedValue({
                    kind: 'already_selected',
                    serverId: 'server-1',
                    receipt,
                }),
                isConnected: jest.fn().mockReturnValue(true),
                getSelectionReceiptSignal: jest.fn(() => selectionContext.getReceiptSignal(receipt)),
                assertSelectionReceiptCurrent: jest.fn(() => selectionContext.assertReceiptCurrent(receipt)),
                on: jest.fn(() => ({ dispose: jest.fn() })),
            },
            plexLibrary: {},
            plexStreamResolver: {},
            channelManager: null,
            scheduler: null,
            videoPlayer: null,
            epg: null,
        },
        readiness: { epg: null },
        overlays: {
            playerOsd: null,
            channelNumberOverlay: null,
            channelBadgeOverlay: null,
            miniGuide: null,
            channelTransition: null,
        },
        startupUiInitializer: { ensureCorePlayerUiInitialized: jest.fn().mockResolvedValue(undefined) },
        epgDebugRuntime: null,
        stores: {
            epgPreferencesStore: new EpgPreferencesStore(),
            profileSessionStore: new ProfileSessionStore(),
        },
    } as unknown as InitializationDependencies;
    const callbacks = {
        status: { updateModuleStatus: jest.fn(), getModuleStatus: jest.fn() },
        errors: { handleGlobalError: jest.fn() },
        diagnostics: { reportRecoverableAsyncFailure: jest.fn() },
        state: { setReady, setupEventWiring: jest.fn(() => true) },
        serverStorage: {
            configureDiscoveryStorage: jest.fn(),
            configureChannelManagerStorage: jest.fn().mockResolvedValue(undefined),
            getSelectedServerId: jest.fn().mockReturnValue(null),
        },
        routing: {
            shouldRunAudioSetup: jest.fn().mockReturnValue(false),
            shouldRunChannelSetup: jest.fn().mockReturnValue(false),
            switchToChannel: jest.fn().mockResolvedValue({ kind: 'switched' }),
            openServerSelect: jest.fn(),
        },
        resources: { buildPlexResourceUrl: jest.fn().mockReturnValue(null) },
    } as unknown as InitializationCallbacks;
    return new InitializationCoordinator({
        plexConfig: {} as never,
        navConfig: {} as never,
        playerConfig: {} as never,
        epgConfig: {} as never,
        nowPlayingInfoConfig: {} as never,
        playerOsdConfig: {} as never,
        channelNumberOverlayConfig: {} as never,
        channelBadgeConfig: {} as never,
        miniGuideConfig: {} as never,
        channelTransitionConfig: {} as never,
        playbackOptionsConfig: {} as never,
    }, dependencies, callbacks);
}

describe('PIN auth resume integration', () => {
    it('keeps committed PIN success while synchronous auth resume takes newer authority', async () => {
        localStorage.clear();
        const auth = new PlexAuth(config);
        const setReady = jest.fn();
        const coordinator = createCoordinator(auth, setReady);
        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        const events: string[] = [];
        (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn()
            .mockImplementationOnce(async () => {
                events.push('pin-claimed');
                return {
                    ok: true,
                    status: 200,
                    json: async (): Promise<unknown> => ({
                        id: 7,
                        code: 'ABCD',
                        expiresAt: '2026-12-31T00:00:00Z',
                        authToken: 'claimed-token',
                        clientIdentifier: config.clientIdentifier,
                    }),
                };
            })
            .mockImplementationOnce(async () => {
                events.push('claimed-user-loaded');
                return {
                    ok: true,
                    status: 200,
                    json: async (): Promise<unknown> => ({
                        id: 'user-1', username: 'user', email: 'user@example.com', thumb: '',
                    }),
                };
            })
            .mockImplementationOnce(async () => {
                events.push('resume-validation-started');
                return {
                    ok: true,
                    status: 200,
                    json: async (): Promise<unknown> => ({
                        id: 'user-1', username: 'user', email: 'user@example.com', thumb: '',
                    }),
                };
            });
        auth.on('authChange', () => events.push('auth-change-emitted'));
        const container = document.createElement('div');
        document.body.appendChild(container);
        const screen = new AuthScreen(container, {
            requestAuthPin: async (): Promise<PlexPinRequest> => ({
                id: 7,
                code: 'ABCD',
                expiresAt: new Date('2026-12-31T00:00:00Z'),
                authToken: null,
                clientIdentifier: config.clientIdentifier,
            }),
            pollForPin: async (pinId, options): ReturnType<PlexAuth['pollForPin']> => {
                const result = await auth.pollForPin(pinId, options);
                events.push('poll-resolved');
                return result;
            },
            cancelPin: async (): Promise<void> => undefined,
            getNavigation: (): null => null,
        });

        screen.show();
        (container.querySelector('#btn-auth-request') as HTMLButtonElement).click();
        for (
            let attempt = 0;
            attempt < 30 && (!container.textContent?.includes('Signed in.') || !setReady.mock.calls.some(([ready]) => ready));
            attempt += 1
        ) {
            await Promise.resolve();
        }

        expect(container.textContent).toContain('Signed in.');
        expect(container.textContent).toContain('Continuing startup…');
        expect(container.textContent).not.toContain('PIN polling failed.');
        expect(events).toEqual([
            'pin-claimed',
            'claimed-user-loaded',
            'resume-validation-started',
            'auth-change-emitted',
            'poll-resolved',
            'auth-change-emitted',
        ]);
        expect(setReady).toHaveBeenCalledWith(true);
        screen.destroy();
    });

    it('resumes startup exactly once after runtime AUTH_EXPIRED Sign In and successful PIN linking', async () => {
        localStorage.clear();
        const auth = new PlexAuth(config);
        const setReady = jest.fn();
        const coordinator = createCoordinator(auth, setReady);
        const runStartupSpy = jest.spyOn(coordinator, 'runStartup');
        const events: string[] = [];
        (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn()
            .mockImplementationOnce(async () => {
                events.push('pin-claimed');
                return {
                    ok: true,
                    status: 200,
                    json: async (): Promise<unknown> => ({
                        id: 8,
                        code: 'EFGH',
                        expiresAt: '2026-12-31T00:00:00Z',
                        authToken: 'runtime-claimed-token',
                        clientIdentifier: config.clientIdentifier,
                    }),
                };
            })
            .mockImplementationOnce(async () => {
                events.push('claimed-user-loaded');
                return {
                    ok: true,
                    status: 200,
                    json: async (): Promise<unknown> => ({
                        id: 'runtime-user', username: 'runtime-user', email: 'runtime@example.com', thumb: '',
                    }),
                };
            })
            .mockImplementationOnce(async () => {
                events.push('resume-validation-started');
                return {
                    ok: true,
                    status: 200,
                    json: async (): Promise<unknown> => ({
                        id: 'runtime-user', username: 'runtime-user', email: 'runtime@example.com', thumb: '',
                    }),
                };
            });
        auth.on('authChange', () => events.push('auth-change-emitted'));
        const container = document.createElement('div');
        document.body.appendChild(container);
        const screen = new AuthScreen(container, {
            requestAuthPin: async (): Promise<PlexPinRequest> => ({
                id: 8,
                code: 'EFGH',
                expiresAt: new Date('2026-12-31T00:00:00Z'),
                authToken: null,
                clientIdentifier: config.clientIdentifier,
            }),
            pollForPin: async (pinId, options): ReturnType<PlexAuth['pollForPin']> => {
                const result = await auth.pollForPin(pinId, options);
                events.push('poll-resolved');
                return result;
            },
            cancelPin: async (): Promise<void> => undefined,
            getNavigation: (): null => null,
        });
        const signIn = getRecoveryActions(AppErrorCode.AUTH_EXPIRED, {
            goToAuth: (): void => {
                coordinator.prepareForRuntimeAuthRecovery();
                events.push('auth-routed');
                screen.show();
            },
            goToProfileSelect: jest.fn(),
            goToServerSelect: jest.fn(),
            goToChannelEdit: jest.fn(),
            goToSettings: jest.fn(),
            retryStart: jest.fn().mockResolvedValue(undefined),
            retryPlayback: jest.fn(),
            exitApp: jest.fn().mockResolvedValue(undefined),
            skipToNext: jest.fn(),
        })[0];
        if (!signIn) {
            throw new Error('Expected AUTH_EXPIRED recovery to expose Sign In');
        }

        signIn.action();
        (container.querySelector('#btn-auth-request') as HTMLButtonElement).click();
        for (
            let attempt = 0;
            attempt < 30 && (!container.textContent?.includes('Signed in.') || !setReady.mock.calls.some(([ready]) => ready));
            attempt += 1
        ) {
            await Promise.resolve();
        }

        expect(container.textContent).toContain('Signed in.');
        expect(container.textContent).toContain('Continuing startup…');
        expect(events[0]).toBe('auth-routed');
        expect(events).toEqual([
            'auth-routed',
            'pin-claimed',
            'claimed-user-loaded',
            'auth-change-emitted',
            'resume-validation-started',
            'poll-resolved',
            'auth-change-emitted',
        ]);
        expect(runStartupSpy).toHaveBeenCalledTimes(1);
        expect(runStartupSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        expect(setReady).toHaveBeenCalledWith(true);
        screen.destroy();
    });
});
