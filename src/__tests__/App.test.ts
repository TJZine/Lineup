/**
 * @jest-environment jsdom
 */

import { App } from '../App';
import { LINEUP_STORAGE_KEYS } from '../config/storageKeys';
import { createAppOrchestratorConfig } from '../core/app-shell/AppOrchestratorConfigFactory';
import { CHANNEL_SETUP_PREFETCH_DELAY_MS, SETTINGS_PREFETCH_DELAY_MS } from '../core/app-shell/constants';
import { AppThemeController } from '../core/app-shell/AppThemeController';
import type { ChannelSetupConfig } from '../core/channel-setup/types';
import { AppOrchestrator, type PlaybackInfoSnapshot } from '../core/orchestrator/AppOrchestrator';
import { PLEX_AUTH_CONSTANTS } from '../modules/plex/auth';
import { APP_SHELL_CONTAINER_IDS } from '../modules/ui/common/appShellContainerIds';
import { webosPlatformServices } from '../platform';

import { flushPromises, setDevBuildForTest } from './helpers';
import {
    EXPECTED_APP_ROOT_CHILD_IDS,
    EXPECTED_CONTAINER_IDS,
    EXPECTED_RUNTIME_CHROME_HOST_CHILD_IDS,
} from './fixtures/appShellContainerIds';

jest.mock('../modules/ui/splash', () => ({
    SplashScreen: class SplashScreen {
        updateStatus(): void {
            return;
        }

        show(): void {
            return;
        }

        hide(): void {
            return;
        }
    },
}));

const authScreenChunkLoaded = jest.fn();
const authScreenConstructed = jest.fn();
jest.mock('../modules/ui/auth', () => {
    authScreenChunkLoaded();
    return {
        AuthScreen: class AuthScreen {
            constructor(...args: unknown[]) {
                authScreenConstructed(args);
            }
            show(): void {
                return;
            }
            hide(): void {
                return;
            }
            destroy(): void {
                return;
            }
        },
    };
});

const profileSelectScreenChunkLoaded = jest.fn();
const profileSelectScreenConstructed = jest.fn();
jest.mock('../modules/ui/profile-select', () => {
    profileSelectScreenChunkLoaded();
    return {
        ProfileSelectScreen: class ProfileSelectScreen {
            constructor(...args: unknown[]) {
                profileSelectScreenConstructed(args);
            }
            show(): void {
                return;
            }
            hide(): void {
                return;
            }
            destroy(): void {
                return;
            }
        },
    };
});

const serverSelectShow = jest.fn();
const serverSelectHide = jest.fn();
const serverSelectScreenChunkLoaded = jest.fn();
const serverSelectScreenConstructed = jest.fn();
jest.mock('../modules/ui/server-select', () => {
    serverSelectScreenChunkLoaded();
    return {
        ServerSelectScreen: class ServerSelectScreen {
            constructor(...args: unknown[]) {
                serverSelectScreenConstructed(args);
            }
            show(options?: unknown): void {
                serverSelectShow(options);
            }
            hide(): void {
                serverSelectHide();
            }
            destroy(): void {
                return;
            }
        },
    };
});

const settingsScreenChunkLoaded = jest.fn();
const settingsScreenConstructed = jest.fn();
jest.mock('../modules/ui/settings', () => {
    settingsScreenChunkLoaded();
    return {
        SettingsScreen: class SettingsScreen {
            constructor(...args: unknown[]) {
                settingsScreenConstructed(args);
            }
            show(): void {
                return;
            }
            hide(): void {
                return;
            }
            destroy(): void {
                return;
            }
        },
    };
});

const channelSetupScreenChunkLoaded = jest.fn();
const channelSetupScreenConstructed = jest.fn();
const getPlannerDiagnosticsConfigMock = jest.fn<ChannelSetupConfig | null, []>();
jest.mock('../modules/ui/channel-setup', () => {
    channelSetupScreenChunkLoaded();
    return {
        ChannelSetupScreen: class ChannelSetupScreen {
            constructor(...args: unknown[]) {
                channelSetupScreenConstructed(args);
            }
            show(): void {
                return;
            }
            hide(): void {
                return;
            }
            destroy(): void {
                return;
            }
            getPlannerDiagnosticsConfig(): ChannelSetupConfig | null {
                return getPlannerDiagnosticsConfigMock();
            }
        },
    };
});

const audioSetupScreenChunkLoaded = jest.fn();
const audioSetupScreenConstructed = jest.fn();
let capturedAudioSetupComplete: (() => void) | null = null;
jest.mock('../modules/ui/audio-setup', () => {
    audioSetupScreenChunkLoaded();
    return {
        AudioSetupScreen: class AudioSetupScreen {
            constructor(_container: HTMLElement, _getNavigation: () => unknown, onComplete: () => void) {
                audioSetupScreenConstructed();
                capturedAudioSetupComplete = onComplete;
            }
            show(): void {
                return;
            }
            hide(): void {
                return;
            }
            destroy(): void {
                return;
            }
        },
    };
});

describe('App bootstrap smoke', () => {
    let app: App | null = null;
    let restoreDevBuild: (() => void) | null = null;
    let initializeSpy: jest.SpyInstance;
    let startSpy: jest.SpyInstance;
    let refreshPlaybackInfoSnapshotSpy: jest.SpyInstance;
    let getRecoveryActionsSpy: jest.SpyInstance;
    let isReadySpy: jest.SpyInstance;
    let nowPlayingHandler: ((toast: unknown) => void) | null = null;
    const lifecycleHandlers = new Map<string, (payload: unknown) => void>();
    let screenChangeHandler: ((from: string, to: string) => void) | null = null;
    let appShellErrorHandler: ((error: { code: string; message: string; recoverable: boolean }) => boolean) | null = null;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '<div id="app"></div>';
        restoreDevBuild?.();
        restoreDevBuild = setDevBuildForTest(true);

        authScreenChunkLoaded.mockClear();
        authScreenConstructed.mockClear();
        profileSelectScreenChunkLoaded.mockClear();
        profileSelectScreenConstructed.mockClear();
        serverSelectScreenChunkLoaded.mockClear();
        serverSelectScreenConstructed.mockClear();
        settingsScreenChunkLoaded.mockClear();
        settingsScreenConstructed.mockClear();
        channelSetupScreenChunkLoaded.mockClear();
        channelSetupScreenConstructed.mockClear();
        getPlannerDiagnosticsConfigMock.mockReset();
        getPlannerDiagnosticsConfigMock.mockReturnValue(null);
        audioSetupScreenChunkLoaded.mockClear();
        audioSetupScreenConstructed.mockClear();
        capturedAudioSetupComplete = null;
        serverSelectShow.mockClear();
        serverSelectHide.mockClear();

        appShellErrorHandler = null;
        nowPlayingHandler = null;
        lifecycleHandlers.clear();
        screenChangeHandler = null;

        jest.spyOn(AppOrchestrator.prototype, 'getCurrentScreen').mockReturnValue(null);
        isReadySpy = jest.spyOn(AppOrchestrator.prototype, 'isReady').mockReturnValue(false);
    });

    const installStartupSpies = (): void => {
        initializeSpy = jest.spyOn(AppOrchestrator.prototype, 'initialize').mockResolvedValue(undefined);
        startSpy = jest.spyOn(AppOrchestrator.prototype, 'start').mockResolvedValue(undefined);
        jest.spyOn(AppOrchestrator.prototype, 'shutdown').mockResolvedValue(undefined);
        jest.spyOn(AppThemeController.prototype, 'initialize').mockReturnValue('ember-steel');
    };

    const installPlaybackSnapshotSpy = (): void => {
        // Default stub: callers should `mockReset()` (or re-mock) before using `mockResolvedValueOnce()`
        // when they need a specific snapshot sequence (e.g., before `createPlaybackSnapshots()` + `App.start()`).
        refreshPlaybackInfoSnapshotSpy = jest
            .spyOn(AppOrchestrator.prototype, 'refreshPlaybackInfoSnapshot')
            .mockResolvedValue({} as never);
    };

    const installRecoveryActionSpy = (): void => {
        getRecoveryActionsSpy = jest
            .spyOn(AppOrchestrator.prototype, 'getRecoveryActions')
            .mockReturnValue([]);
    };

    const installLifecycleWiringSpies = (): void => {
        jest.spyOn(AppOrchestrator.prototype, 'registerErrorHandler').mockImplementation((moduleId, handler) => {
            if (moduleId === 'app-shell') {
                appShellErrorHandler = handler as never;
            }
        });
        jest.spyOn(AppOrchestrator.prototype, 'setNowPlayingHandler').mockImplementation((handler) => {
            nowPlayingHandler = handler as never;
        });
        jest.spyOn(AppOrchestrator.prototype, 'onScreenChange').mockImplementation((handler) => {
            screenChangeHandler = handler as never;
            return { dispose: jest.fn() } as never;
        });
        jest.spyOn(AppOrchestrator.prototype, 'onLifecycleEvent').mockImplementation((event, handler) => {
            lifecycleHandlers.set(String(event), handler as never);
            return { dispose: jest.fn() } as never;
        });
    };

    type BootstrapOptions = {
        skipLifecycleWiring?: boolean;
    };

    const bootstrapApp = async (configure?: () => void, options: BootstrapOptions = {}): Promise<App> => {
        installStartupSpies();
        if (!options.skipLifecycleWiring) {
            installLifecycleWiringSpies();
        }
        configure?.();
        app = new App();
        await app.start();
        return app;
    };

    afterEach(async () => {
        if (app) {
            await app.shutdown();
            app = null;
        }
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
        restoreDevBuild?.();
        restoreDevBuild = null;
    });

    it('creates root containers and starts orchestrator', async () => {
        jest.spyOn(webosPlatformServices.identity, 'detectPlatformVersion').mockReturnValue('24.0');

        await bootstrapApp();

        expect(initializeSpy).toHaveBeenCalledTimes(1);
        expect(initializeSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                plexConfig: expect.objectContaining({
                    product: 'Lineup',
                    version: '1.0.0',
                    platform: 'webOS',
                    platformVersion: '24.0',
                    device: 'LG Smart TV',
                    deviceName: 'Living Room TV',
                    clientIdentifier: expect.any(String),
                }),
            })
        );
        const initializePayload = initializeSpy.mock.calls[0]?.[0] as {
            plexConfig: { clientIdentifier: string };
        };
        expect(initializePayload.plexConfig.clientIdentifier.length).toBeGreaterThan(0);
        expect(startSpy).toHaveBeenCalledTimes(1);
        for (const id of EXPECTED_CONTAINER_IDS) {
            expect(document.getElementById(id)).not.toBeNull();
        }
        expect(Array.from((document.getElementById('app') as HTMLElement).children, (child) => (child as HTMLElement).id)).toEqual(
            EXPECTED_APP_ROOT_CHILD_IDS
        );
        expect(
            Array.from(
                (document.getElementById(APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST) as HTMLElement).children,
                (child) => (child as HTMLElement).id
            )
        ).toEqual(EXPECTED_RUNTIME_CHROME_HOST_CHILD_IDS);
    });

    it('defers the first platform version probe until plex auth config consumers read it', () => {
        let bridgeReady = false;
        const detectPlatformVersionSpy = jest
            .spyOn(webosPlatformServices.identity, 'detectPlatformVersion')
            .mockImplementation(() => (bridgeReady ? '24.0' : '6.0'));

        const config = createAppOrchestratorConfig();

        expect(detectPlatformVersionSpy).not.toHaveBeenCalled();

        bridgeReady = true;

        expect(config.plexConfig.platformVersion).toBe('24.0');
        expect(detectPlatformVersionSpy).toHaveBeenCalledTimes(1);
    });

    const createPlaybackSnapshots = (): {
        snapshotWithDecision: PlaybackInfoSnapshot;
        snapshotNoDecision: PlaybackInfoSnapshot;
        snapshotNoStream: PlaybackInfoSnapshot;
    } => ({
        snapshotWithDecision: {
            channel: { id: 'ch12', number: 12, name: 'News' },
            program: {
                itemKey: '/library/metadata/1234',
                title: 'Morning Show',
                fullTitle: 'Morning Show',
                type: 'episode',
                scheduledStartTime: Date.now() - 30_000,
                scheduledEndTime: Date.now() + 90_000,
                elapsedMs: 30_000,
                remainingMs: 90_000,
            },
            stream: {
                protocol: 'hls',
                mimeType: 'application/vnd.apple.mpegurl',
                isDirectPlay: false,
                isTranscoding: true,
                container: 'mpegts',
                videoCodec: 'h264',
                audioCodec: 'aac',
                subtitleDelivery: 'none',
                bitrate: 2500,
                width: 1280,
                height: 720,
                sessionId: 'sess1',
                selectedAudio: { id: 'a1', codec: 'aac', channels: 2, language: 'en' },
                selectedSubtitle: { id: 's1', codec: 'srt', language: 'en' },
                directPlay: { allowed: false, reasons: ['container unsupported'] },
                source: {
                    container: 'mkv',
                    videoCodec: 'hevc',
                    audioCodec: 'eac3',
                    width: 1920,
                    height: 1080,
                    bitrate: 8000,
                },
                audioFallback: { fromCodec: 'eac3', toCodec: 'aac', reason: 'compat' },
                transcodeRequest: { sessionId: 'abc', maxBitrate: 10_000, audioStreamId: 'a1' },
                serverDecision: {
                    fetchedAt: Date.now(),
                    videoDecision: 'transcode',
                    audioDecision: 'copy',
                    subtitleDecision: 'burn',
                    decisionText: 'transcode because codec',
                },
            },
        },
        snapshotNoDecision: {
            channel: null,
            program: null,
            stream: {
                protocol: 'hls',
                mimeType: 'application/vnd.apple.mpegurl',
                isDirectPlay: false,
                isTranscoding: true,
                container: 'mpegts',
                videoCodec: 'h264',
                audioCodec: 'aac',
                subtitleDelivery: 'none',
                bitrate: 2500,
                width: 1280,
                height: 720,
                sessionId: 'sess2',
                selectedAudio: null,
                selectedSubtitle: null,
            },
        },
        snapshotNoStream: {
            channel: null,
            program: null,
            stream: null,
        },
    });

    const openDevMenu = async (): Promise<{
        devMenu: HTMLElement;
        playbackPre: HTMLPreElement;
        refreshButton: HTMLButtonElement;
    }> => {
        document.dispatchEvent(
            new KeyboardEvent('keydown', {
                code: 'KeyD',
                ctrlKey: true,
                shiftKey: true,
            })
        );
        await flushPromises();

        const devMenu = document.getElementById('dev-menu');
        if (!(devMenu instanceof HTMLElement)) {
            throw new Error('Dev menu #dev-menu not found');
        }
        const playbackPre = devMenu.querySelector('#dev-playback-info');
        if (!(playbackPre instanceof HTMLPreElement)) {
            throw new Error('Dev menu playback info #dev-playback-info not found');
        }
        const refreshButton = devMenu.querySelector('#dev-playback-refresh');
        if (!(refreshButton instanceof HTMLButtonElement)) {
            throw new Error('Dev menu refresh button #dev-playback-refresh not found');
        }
        return { devMenu, playbackPre, refreshButton };
    };

    it('renders dev menu and playback info when debug surface is enabled', async () => {
        const { snapshotWithDecision } = createPlaybackSnapshots();

        await bootstrapApp(() => {
            installPlaybackSnapshotSpy();
            refreshPlaybackInfoSnapshotSpy.mockReset();
            refreshPlaybackInfoSnapshotSpy.mockResolvedValueOnce(snapshotWithDecision);
        });

        const { devMenu, playbackPre } = await openDevMenu();
        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(1);

        expect(devMenu?.style.display).toBe('block');

        expect(playbackPre?.textContent ?? '').toContain('PLAYBACK INFO');
        expect(playbackPre?.textContent ?? '').toContain('DELIVERY (what the TV receives)');
    });

    it('refresh updates the PMS decision area and handles missing decision', async () => {
        const { snapshotWithDecision, snapshotNoDecision } = createPlaybackSnapshots();

        await bootstrapApp(() => {
            installPlaybackSnapshotSpy();
            refreshPlaybackInfoSnapshotSpy.mockReset();
            refreshPlaybackInfoSnapshotSpy
                .mockResolvedValueOnce(snapshotWithDecision)
                .mockResolvedValueOnce(snapshotNoDecision);
        });

        const { playbackPre, refreshButton } = await openDevMenu();
        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(1);

        refreshButton.click();
        await flushPromises();

        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(2);
        expect(playbackPre?.textContent ?? '').toMatch(/PMS:\s+\(decision not fetched; press Refresh again\)/);
    });

    it('refresh handles missing stream and allows toggling the dev menu', async () => {
        const { snapshotWithDecision, snapshotNoDecision, snapshotNoStream } = createPlaybackSnapshots();

        await bootstrapApp(() => {
            installPlaybackSnapshotSpy();
            refreshPlaybackInfoSnapshotSpy.mockReset();
            refreshPlaybackInfoSnapshotSpy
                .mockResolvedValueOnce(snapshotWithDecision)
                .mockResolvedValueOnce(snapshotNoDecision)
                .mockResolvedValueOnce(snapshotNoStream);
        });

        const { devMenu, playbackPre, refreshButton } = await openDevMenu();
        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(1);

        refreshButton.click();
        await flushPromises();

        refreshButton.click();
        await flushPromises();

        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(3);
        expect(playbackPre?.textContent ?? '').toContain('(no stream decision yet)');

        (window as unknown as { lineup?: { toggleDevMenu: () => void } }).lineup?.toggleDevMenu();
        expect(devMenu?.style.display).toBe('none');
    });

    it('shows an error overlay with recovery actions and hides on action click', async () => {
        const action = jest.fn();
        const startedApp = await bootstrapApp(() => {
            installRecoveryActionSpy();
            getRecoveryActionsSpy.mockReturnValue([
                { label: 'Retry', isPrimary: true, action },
                { label: 'Cancel', isPrimary: false, action: jest.fn() },
            ]);
        });

        startedApp.showErrorOverlay({
            code: 'TEST_ERROR',
            message: 'Boom',
            userMessage: 'Something failed',
            recoverable: true,
            phase: 'error',
            timestamp: Date.now(),
            actions: [],
        } as never);

        const overlay = document.getElementById('error-overlay') as HTMLElement | null;
        expect(overlay).not.toBeNull();
        expect(overlay?.classList.contains('hidden')).toBe(false);

        const retry = overlay?.querySelector('button.error-button.primary') as HTMLButtonElement | null;
        expect(retry).not.toBeNull();
        if (!retry) {
            throw new Error('Retry button not found');
        }
        expect(document.activeElement).toBe(retry);
        retry.click();
        expect(action).toHaveBeenCalledTimes(1);
        expect(overlay?.classList.contains('hidden')).toBe(true);
    });

    it('falls back to dismiss recovery when an overlay is shown without actions for an unknown error code', async () => {
        const startedApp = await bootstrapApp(() => {
        });

        expect(() => {
            startedApp.showErrorOverlay({
                code: 'TEST_ERROR',
                message: 'Boom',
                userMessage: 'Something failed',
                recoverable: true,
                phase: 'error',
                timestamp: Date.now(),
                actions: [],
            } as never);
        }).not.toThrow();

        const overlay = document.getElementById('error-overlay') as HTMLElement | null;
        const dismiss = overlay?.querySelector('button.error-button.primary') as HTMLButtonElement | null;

        expect(overlay?.classList.contains('hidden')).toBe(false);
        expect(dismiss?.textContent).toBe('Dismiss');
    });

    it('routes blocking overlay presentation through navigation modal APIs', async () => {
        const openModal = jest.fn();
        const closeModal = jest.fn();
        const isModalOpen = jest.fn().mockReturnValue(false);
        const registerFocusable = jest.fn();
        const unregisterFocusable = jest.fn();
        const setFocus = jest.fn();
        const on = jest.fn();
        const off = jest.fn();

        const startedApp = await bootstrapApp(() => {
            installRecoveryActionSpy();
            jest.spyOn(AppOrchestrator.prototype, 'getNavigation').mockReturnValue({
                openModal,
                closeModal,
                isModalOpen,
                registerFocusable,
                unregisterFocusable,
                setFocus,
                on,
                off,
            } as never);
            getRecoveryActionsSpy.mockReturnValue([
                { label: 'Retry', isPrimary: true, action: jest.fn() },
            ]);
        });

        startedApp.showErrorOverlay({
            code: 'TEST_ERROR',
            message: 'Boom',
            userMessage: 'Something failed',
            recoverable: true,
            phase: 'error',
            timestamp: Date.now(),
            actions: [],
        } as never);

        expect(openModal).toHaveBeenCalledWith('modal:error-overlay', ['error-overlay-action-0']);
        expect(registerFocusable).toHaveBeenCalledTimes(1);
        expect(setFocus).toHaveBeenCalledWith('error-overlay-action-0', { persist: false });

        startedApp.hideErrorOverlay();

        expect(closeModal).toHaveBeenCalledWith('modal:error-overlay');
        expect(unregisterFocusable).toHaveBeenCalledWith('error-overlay-action-0');
        expect(off).toHaveBeenCalledWith('modalClose', expect.any(Function));
    });

    it.each([
        ['CHANNEL_NOT_FOUND', 'That channel is unavailable.'],
        ['SCHEDULER_EMPTY_CHANNEL', 'No scheduled content is available for that channel.'],
        ['CONTENT_UNAVAILABLE', 'That content is unavailable right now.'],
        ['RESOURCE_NOT_FOUND', 'Requested content could not be found.'],
    ])(
        'app-shell error handler suppresses blocking overlay for recoverable code %s',
        async (code, expectedMessage) => {
            const startedApp = await bootstrapApp(() => {
            });

            startedApp.showErrorOverlay({
                code: 'TEST_ERROR',
                message: 'Boom',
                userMessage: 'Something failed',
                recoverable: true,
                phase: 'error',
                timestamp: Date.now(),
                actions: [],
            } as never);

            const overlay = document.getElementById('error-overlay') as HTMLElement | null;
            expect(overlay?.classList.contains('hidden')).toBe(false);

            expect(appShellErrorHandler).not.toBeNull();
            const handled = appShellErrorHandler?.({
                code,
                message: 'x',
                recoverable: true,
            });

            expect(handled).toBe(true);
            expect(overlay?.classList.contains('hidden')).toBe(true);

            const toast = document.getElementById('app-toast') as HTMLElement | null;
            expect(toast?.textContent ?? '').toContain(expectedMessage);
        }
    );

    it('app-shell error handler still shows overlay for auth-required blocking errors', async () => {
        await bootstrapApp(() => {
        });

        expect(appShellErrorHandler).not.toBeNull();
        const handled = appShellErrorHandler?.({
            code: 'AUTH_REQUIRED',
            message: 'x',
            recoverable: true,
        });

        expect(handled).toBe(false);
        const overlay = document.getElementById('error-overlay') as HTMLElement | null;
        expect(overlay?.classList.contains('hidden')).toBe(false);
    });

    it('shows, throttles, and hides toasts via orchestrator hooks', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        await bootstrapApp(() => {
        });

        expect(typeof nowPlayingHandler).toBe('function');
        const toastEl = document.getElementById('app-toast') as HTMLElement | null;
        expect(toastEl).not.toBeNull();

        jest.setSystemTime(10_000);
        nowPlayingHandler?.({ message: 'Hello', type: 'info' });
        expect(toastEl?.style.display).toBe('block');
        expect(toastEl?.style.opacity).toBe('1');
        expect(toastEl?.textContent ?? '').toContain('Hello');

        // Within throttle window: should be suppressed.
        jest.setSystemTime(10_500);
        nowPlayingHandler?.({ message: 'Suppressed', type: 'success' });
        expect(toastEl?.textContent ?? '').not.toContain('Suppressed');

        // Later timestamp: should replace the toast and clear the previous hide timer.
        jest.setSystemTime(12_000);
        nowPlayingHandler?.({ message: 'Replaced', type: 'success' });
        expect(toastEl?.textContent ?? '').toContain('Replaced');

        jest.advanceTimersByTime(5000);
        expect(toastEl?.style.opacity).toBe('0');
        jest.advanceTimersByTime(200);
        expect(toastEl?.style.display).toBe('none');

        const persistenceWarning = lifecycleHandlers.get('persistenceWarning');
        jest.setSystemTime(14_000);
        persistenceWarning?.({});
        expect(toastEl?.textContent ?? '').toContain('Some settings could not be saved.');
    });

    it('clears delegated toast timers during shutdown', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        const startedApp = await bootstrapApp(() => {
        });

        jest.setSystemTime(10_000);
        nowPlayingHandler?.({ message: 'Hello', type: 'info' });
        expect(jest.getTimerCount()).toBeGreaterThan(0);

        await startedApp.shutdown();
        app = null;

        expect(jest.getTimerCount()).toBe(0);
    });

    it('copies dev playback info via clipboard and shows toast when blocked/unsupported', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        await bootstrapApp(() => {
            installPlaybackSnapshotSpy();
            refreshPlaybackInfoSnapshotSpy.mockResolvedValueOnce({
                channel: null,
                program: null,
                stream: null,
            } satisfies PlaybackInfoSnapshot);
        });

        (window as unknown as { lineup?: { toggleDevMenu: () => void } }).lineup?.toggleDevMenu();
        await flushPromises();

        const devMenu = document.getElementById('dev-menu') as HTMLElement | null;
        expect(devMenu).not.toBeNull();
        const pre = devMenu?.querySelector('#dev-playback-info') as HTMLPreElement | null;
        expect(pre).not.toBeNull();
        if (!pre) {
            throw new Error('Playback info pre not found');
        }
        pre.dataset.summary = 'SUMMARY';
        pre.dataset.raw = '{"raw":true}';

        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
            configurable: true,
        });

        jest.setSystemTime(10_000);
        const copySummary = devMenu?.querySelector('#dev-playback-copy-summary') as HTMLButtonElement | null;
        expect(copySummary).not.toBeNull();
        if (!copySummary) {
            throw new Error('Copy summary button not found');
        }
        copySummary.click();
        await flushPromises();
        expect((navigator as unknown as { clipboard: { writeText: jest.Mock } }).clipboard.writeText).toHaveBeenCalledWith(
            'SUMMARY'
        );

        const copyRaw = devMenu?.querySelector('#dev-playback-copy-raw') as HTMLButtonElement | null;
        expect(copyRaw).not.toBeNull();
        if (!copyRaw) {
            throw new Error('Copy raw button not found');
        }
        (navigator as unknown as { clipboard: { writeText: jest.Mock } }).clipboard.writeText.mockRejectedValueOnce(
            new Error('blocked')
        );
        jest.setSystemTime(12_000);
        copyRaw.click();
        await flushPromises();
        const toastEl = document.getElementById('app-toast') as HTMLElement | null;
        expect(toastEl?.textContent ?? '').toContain('Copy not supported');

        // Empty text branch.
        jest.setSystemTime(16_000);
        pre.dataset.summary = '';
        copySummary.click();
        await flushPromises();
    });

    it('rethrows startup failures after best-effort shutdown', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const shutdownSpy = jest.spyOn(AppOrchestrator.prototype, 'shutdown').mockResolvedValue(undefined);

        await expect(bootstrapApp(() => {
            initializeSpy.mockReset();
            initializeSpy.mockRejectedValueOnce(new Error('init failed'));
        })).rejects.toThrow('init failed');

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            'App startup failed:',
            expect.objectContaining({
                name: 'Error',
                message: expect.stringContaining('init failed'),
            })
        );
        expect(shutdownSpy).toHaveBeenCalledTimes(1);
    });

    it('does not expose debug helpers when debug surface is disabled', async () => {
        restoreDevBuild?.();
        restoreDevBuild = setDevBuildForTest(false);
        localStorage.removeItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);
        await bootstrapApp();

        expect((window as unknown as { lineup?: unknown }).lineup).toBeUndefined();

        document.dispatchEvent(
            new KeyboardEvent('keydown', {
                code: 'KeyD',
                ctrlKey: true,
                shiftKey: true,
            })
        );
        await flushPromises();

        const devMenu = document.getElementById('dev-menu') as HTMLElement | null;
        expect(devMenu?.style.display).toBe('none');
        expect(devMenu?.innerHTML ?? '').toBe('');
    });

    it('defers auth/profile/server startup screen construction until those routes are shown', async () => {
        let current = 'player';
        (AppOrchestrator.prototype.getCurrentScreen as unknown as jest.Mock).mockImplementation(() => current);
        await bootstrapApp(() => {
        });

        expect(authScreenConstructed).toHaveBeenCalledTimes(0);
        expect(profileSelectScreenConstructed).toHaveBeenCalledTimes(0);
        expect(serverSelectScreenConstructed).toHaveBeenCalledTimes(0);

        current = 'auth';
        screenChangeHandler?.('player', 'auth');
        await flushPromises();
        expect(authScreenConstructed).toHaveBeenCalledTimes(1);

        current = 'profile-select';
        screenChangeHandler?.('auth', 'profile-select');
        await flushPromises();
        expect(profileSelectScreenConstructed).toHaveBeenCalledTimes(1);

        current = 'server-select';
        screenChangeHandler?.('profile-select', 'server-select');
        await flushPromises();
        expect(serverSelectScreenConstructed).toHaveBeenCalledTimes(1);
    });

    it('applies screen visibility and schedules/cancels prefetches', async () => {
        jest.useFakeTimers();
        let currentScreen: string | null = 'splash';
        (AppOrchestrator.prototype.getCurrentScreen as unknown as jest.Mock).mockImplementation(() => currentScreen);

        const getServerSelectParams = jest
            .fn()
            .mockReturnValueOnce({ allowAutoConnect: true })
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(null);
        jest.spyOn(AppOrchestrator.prototype, 'getNavigation').mockReturnValue({
            getServerSelectParams,
            openModal: jest.fn(),
            closeModal: jest.fn(),
            isModalOpen: jest.fn().mockReturnValue(false),
            registerFocusable: jest.fn(),
            unregisterFocusable: jest.fn(),
            setFocus: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        } as never);
        await bootstrapApp(() => {
        });

        expect(typeof screenChangeHandler).toBe('function');

        // Exercise server-select show/hide paths and channel-setup prefetch scheduling/cancel.
        currentScreen = 'server-select';
        screenChangeHandler?.('splash', 'server-select');
        await flushPromises(6);
        expect(serverSelectShow).toHaveBeenCalledWith({ allowAutoConnect: true });
        currentScreen = 'auth';
        screenChangeHandler?.('server-select', 'auth');
        await flushPromises(6);
        expect(serverSelectHide).toHaveBeenCalled();

        // Validate missing server-select params pass undefined options through App flow.
        currentScreen = 'server-select';
        screenChangeHandler?.('auth', 'server-select');
        await flushPromises(6);
        expect(serverSelectShow).toHaveBeenLastCalledWith(undefined);
        currentScreen = 'auth';
        screenChangeHandler?.('server-select', 'auth');
        await flushPromises(6);
        currentScreen = 'server-select';
        screenChangeHandler?.('auth', 'server-select');
        await flushPromises(6);
        expect(serverSelectShow).toHaveBeenLastCalledWith(undefined);

        // Exercise "ready guard" path which hides setup screens and schedules settings prefetch.
        isReadySpy.mockReturnValue(true);
        currentScreen = 'player';
        screenChangeHandler?.('auth', 'player');
        screenChangeHandler?.('player', 'player');

        // Exercise phaseChange path.
        (AppOrchestrator.prototype.getCurrentScreen as unknown as jest.Mock).mockReturnValue('auth');
        lifecycleHandlers.get('phaseChange')?.({ to: 'ready' });

        expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('prefetches SettingsScreen after player entry delay', async () => {
        jest.useFakeTimers();
        isReadySpy.mockReturnValue(true);
        await bootstrapApp(() => {
        });

        screenChangeHandler?.('auth', 'player');
        jest.advanceTimersByTime(SETTINGS_PREFETCH_DELAY_MS);
        await flushPromises();

        expect(settingsScreenChunkLoaded).toHaveBeenCalledTimes(1);
    });

    it('prefetches ChannelSetupScreen after server-select delay', async () => {
        jest.useFakeTimers();
        let currentScreen: string | null = 'splash';
        (AppOrchestrator.prototype.getCurrentScreen as unknown as jest.Mock).mockImplementation(() => currentScreen);
        await bootstrapApp(() => {
        });

        currentScreen = 'server-select';
        screenChangeHandler?.('splash', 'server-select');
        await flushPromises();
        currentScreen = 'auth';
        screenChangeHandler?.('server-select', 'auth');
        await flushPromises();
        currentScreen = 'server-select';
        screenChangeHandler?.('auth', 'server-select');
        await flushPromises();
        jest.advanceTimersByTime(CHANNEL_SETUP_PREFETCH_DELAY_MS);
        await flushPromises();

        expect(channelSetupScreenChunkLoaded).toHaveBeenCalledTimes(1);
    });

    it('reuses lazy-loaded settings and channel-setup screens across repeated visibility changes', async () => {
        let currentScreen: string | null = null;
        (AppOrchestrator.prototype.getCurrentScreen as unknown as jest.Mock).mockImplementation(() => currentScreen);
        await bootstrapApp(() => {
        });

        currentScreen = 'settings';
        screenChangeHandler?.('player', 'settings');
        await flushPromises();
        screenChangeHandler?.('settings', 'settings');
        await flushPromises();
        expect(settingsScreenConstructed).toHaveBeenCalledTimes(1);

        currentScreen = 'channel-setup';
        screenChangeHandler?.('auth', 'channel-setup');
        await flushPromises();
        screenChangeHandler?.('channel-setup', 'channel-setup');
        await flushPromises();
        expect(channelSetupScreenConstructed).toHaveBeenCalledTimes(1);
    });

    it('routes audio setup completion to channel-setup through the lazy-screen callback', async () => {
        const replaceScreen = jest.fn();
        jest.spyOn(AppOrchestrator.prototype, 'getNavigation').mockReturnValue({
            replaceScreen,
            getServerSelectParams: jest.fn().mockReturnValue(null),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            isModalOpen: jest.fn().mockReturnValue(false),
            registerFocusable: jest.fn(),
            unregisterFocusable: jest.fn(),
            setFocus: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        } as never);

        let currentScreen: string | null = null;
        (AppOrchestrator.prototype.getCurrentScreen as unknown as jest.Mock).mockImplementation(() => currentScreen);
        await bootstrapApp(() => {
        });

        currentScreen = 'audio-setup';
        screenChangeHandler?.('auth', 'audio-setup');
        await flushPromises();

        expect(audioSetupScreenChunkLoaded).toHaveBeenCalledTimes(1);
        expect(audioSetupScreenConstructed).toHaveBeenCalledTimes(1);
        expect(capturedAudioSetupComplete).not.toBeNull();

        capturedAudioSetupComplete?.();

        expect(replaceScreen).toHaveBeenCalledWith('channel-setup');
    });

    it('clears delegated lazy-screen prefetch timers during shutdown', async () => {
        jest.useFakeTimers();
        isReadySpy.mockReturnValue(true);
        const startedApp = await bootstrapApp(() => {
        });

        screenChangeHandler?.('splash', 'server-select');
        screenChangeHandler?.('auth', 'player');

        expect(jest.getTimerCount()).toBe(1);

        await startedApp.shutdown();
        app = null;

        expect(jest.getTimerCount()).toBe(0);
    });

    it('generates and persists a client id when missing/invalid (fallback path)', async () => {
        const originalCrypto = globalThis.crypto;
        try {
            Object.defineProperty(globalThis, 'crypto', {
                value: { randomUUID: (): string => { throw new Error('no uuid'); } },
                configurable: true,
            });

            localStorage.setItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY, '');
            await bootstrapApp();

            const clientId = localStorage.getItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY) ?? '';
            expect(clientId).toMatch(/^lineup-[A-Za-z0-9._-]+$/);
        } finally {
            Object.defineProperty(globalThis, 'crypto', {
                value: originalCrypto,
                configurable: true,
            });
        }
    });

    it('uses an existing sane client id without regenerating', async () => {
        localStorage.setItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY, 'lineup-existing_123');
        await bootstrapApp();

        expect(localStorage.getItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY)).toBe('lineup-existing_123');
    });
});
