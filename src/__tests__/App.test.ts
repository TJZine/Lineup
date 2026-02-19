/**
 * @jest-environment jsdom
 */

import { App } from '../App';
import { AppOrchestrator, type PlaybackInfoSnapshot } from '../Orchestrator';
import { RETUNE_STORAGE_KEYS } from '../config/storageKeys';
import { ThemeManager } from '../modules/ui/theme';
import { STORAGE_KEYS } from '../types';

import { flushPromises } from './helpers';

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

jest.mock('../modules/ui/auth', () => ({
    AuthScreen: class AuthScreen {
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
}));

jest.mock('../modules/ui/profile-select', () => ({
    ProfileSelectScreen: class ProfileSelectScreen {
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
}));

jest.mock('../modules/ui/server-select', () => ({
    ServerSelectScreen: class ServerSelectScreen {
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
}));

const settingsScreenChunkLoaded = jest.fn();
jest.mock('../modules/ui/settings/SettingsScreen', () => {
    settingsScreenChunkLoaded();
    return {
        SettingsScreen: class SettingsScreen {
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
jest.mock('../modules/ui/channel-setup/ChannelSetupScreen', () => {
    channelSetupScreenChunkLoaded();
    return {
        ChannelSetupScreen: class ChannelSetupScreen {
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
        Object.defineProperty(globalThis, '__RETUNE_DEV_BUILD__', {
            value: true,
            configurable: true,
            writable: true,
        });

        jest.spyOn(ThemeManager, 'getInstance').mockReturnValue({
            getTheme: jest.fn().mockReturnValue('obsidian'),
            applyTheme: jest.fn(),
        } as never);
        initializeSpy = jest.spyOn(AppOrchestrator.prototype, 'initialize').mockResolvedValue(undefined);
        startSpy = jest.spyOn(AppOrchestrator.prototype, 'start').mockResolvedValue(undefined);
        jest.spyOn(AppOrchestrator.prototype, 'shutdown').mockResolvedValue(undefined);
        refreshPlaybackInfoSnapshotSpy = jest
            .spyOn(AppOrchestrator.prototype, 'refreshPlaybackInfoSnapshot')
            .mockResolvedValue({} as never);
        getRecoveryActionsSpy = jest.spyOn(AppOrchestrator.prototype, 'getRecoveryActions').mockReturnValue([]);
        settingsScreenChunkLoaded.mockClear();
        channelSetupScreenChunkLoaded.mockClear();
        appShellErrorHandler = null;
        jest.spyOn(AppOrchestrator.prototype, 'registerErrorHandler').mockImplementation((moduleId, handler) => {
            if (moduleId === 'app-shell') {
                appShellErrorHandler = handler as never;
            }
        });
        nowPlayingHandler = null;
        lifecycleHandlers.clear();
        jest.spyOn(AppOrchestrator.prototype, 'setNowPlayingHandler').mockImplementation((handler) => {
            nowPlayingHandler = handler as never;
        });
        screenChangeHandler = null;
        jest.spyOn(AppOrchestrator.prototype, 'onScreenChange').mockImplementation((handler) => {
            screenChangeHandler = handler as never;
            return { dispose: jest.fn() } as never;
        });
        jest.spyOn(AppOrchestrator.prototype, 'onLifecycleEvent').mockImplementation((event, handler) => {
            lifecycleHandlers.set(String(event), handler as never);
            return { dispose: jest.fn() } as never;
        });
        jest.spyOn(AppOrchestrator.prototype, 'getCurrentScreen').mockReturnValue(null);
        isReadySpy = jest.spyOn(AppOrchestrator.prototype, 'isReady').mockReturnValue(false);
    });

    afterEach(async () => {
        if (app) {
            await app.shutdown();
            app = null;
        }
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('creates root containers and starts orchestrator', async () => {
        app = new App();
        await app.start();

        expect(initializeSpy).toHaveBeenCalledTimes(1);
        expect(startSpy).toHaveBeenCalledTimes(1);
        expect(document.getElementById('video-container')).not.toBeNull();
        expect(document.getElementById('epg-container')).not.toBeNull();
        expect(document.getElementById('now-playing-info-container')).not.toBeNull();
        expect(document.getElementById('channel-transition-container')).not.toBeNull();
        expect(document.getElementById('playback-options-container')).not.toBeNull();
        expect(document.getElementById('splash-container')).not.toBeNull();
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
        refreshPlaybackInfoSnapshotSpy.mockReset();

        const { snapshotWithDecision } = createPlaybackSnapshots();

        refreshPlaybackInfoSnapshotSpy
            .mockResolvedValueOnce(snapshotWithDecision)

        app = new App();
        await app.start();

        const { devMenu, playbackPre } = await openDevMenu();
        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(1);

        expect(devMenu?.style.display).toBe('block');

        expect(playbackPre?.textContent ?? '').toContain('PLAYBACK INFO');
        expect(playbackPre?.textContent ?? '').toContain('DELIVERY (what the TV receives)');
    });

    it('refresh updates the PMS decision area and handles missing decision', async () => {
        refreshPlaybackInfoSnapshotSpy.mockReset();
        const { snapshotWithDecision, snapshotNoDecision } = createPlaybackSnapshots();

        refreshPlaybackInfoSnapshotSpy
            .mockResolvedValueOnce(snapshotWithDecision)
            .mockResolvedValueOnce(snapshotNoDecision);

        app = new App();
        await app.start();

        const { playbackPre, refreshButton } = await openDevMenu();
        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(1);

        refreshButton.click();
        await flushPromises();

        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(2);
        expect(playbackPre?.textContent ?? '').toMatch(/PMS:\s+\(decision not fetched; press Refresh again\)/);
    });

    it('refresh handles missing stream and allows toggling the dev menu', async () => {
        refreshPlaybackInfoSnapshotSpy.mockReset();
        const { snapshotWithDecision, snapshotNoDecision, snapshotNoStream } = createPlaybackSnapshots();

        refreshPlaybackInfoSnapshotSpy
            .mockResolvedValueOnce(snapshotWithDecision)
            .mockResolvedValueOnce(snapshotNoDecision)
            .mockResolvedValueOnce(snapshotNoStream);

        app = new App();
        await app.start();

        const { devMenu, playbackPre, refreshButton } = await openDevMenu();
        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(1);

        refreshButton.click();
        await flushPromises();

        refreshButton.click();
        await flushPromises();

        expect(refreshPlaybackInfoSnapshotSpy).toHaveBeenCalledTimes(3);
        expect(playbackPre?.textContent ?? '').toContain('(no stream decision yet)');

        (window as unknown as { retune?: { toggleDevMenu: () => void } }).retune?.toggleDevMenu();
        expect(devMenu?.style.display).toBe('none');
    });

    it('shows an error overlay with recovery actions and hides on action click', async () => {
        const action = jest.fn();
        getRecoveryActionsSpy.mockReturnValue([
            { label: 'Retry', isPrimary: true, action },
            { label: 'Cancel', isPrimary: false, action: jest.fn() },
        ]);

        app = new App();
        await app.start();

        app.showErrorOverlay({
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
        expect(document.activeElement).toBe(retry);
        retry!.click();
        expect(action).toHaveBeenCalledTimes(1);
        expect(overlay?.classList.contains('hidden')).toBe(true);
    });

    it.each([
        ['CHANNEL_NOT_FOUND', 'That channel is unavailable.'],
        ['SCHEDULER_EMPTY_CHANNEL', 'No scheduled content is available for that channel.'],
        ['CONTENT_UNAVAILABLE', 'That content is unavailable right now.'],
        ['RESOURCE_NOT_FOUND', 'Requested content could not be found.'],
    ])(
        'app-shell error handler suppresses blocking overlay for recoverable code %s',
        async (code, expectedMessage) => {
            app = new App();
            await app.start();

            app.showErrorOverlay({
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
        app = new App();
        await app.start();

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

        app = new App();
        await app.start();

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

    it('copies dev playback info via clipboard and shows toast when blocked/unsupported', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);

        refreshPlaybackInfoSnapshotSpy.mockResolvedValueOnce({
            channel: null,
            program: null,
            stream: null,
        } satisfies PlaybackInfoSnapshot);

        app = new App();
        await app.start();

        (window as unknown as { retune?: { toggleDevMenu: () => void } }).retune?.toggleDevMenu();
        await flushPromises();

        const devMenu = document.getElementById('dev-menu') as HTMLElement | null;
        expect(devMenu).not.toBeNull();
        const pre = devMenu?.querySelector('#dev-playback-info') as HTMLPreElement | null;
        expect(pre).not.toBeNull();
        pre!.dataset.summary = 'SUMMARY';
        pre!.dataset.raw = '{"raw":true}';

        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
            configurable: true,
        });

        jest.setSystemTime(10_000);
        const copySummary = devMenu?.querySelector('#dev-playback-copy-summary') as HTMLButtonElement | null;
        expect(copySummary).not.toBeNull();
        copySummary!.click();
        await flushPromises();
        expect((navigator as unknown as { clipboard: { writeText: jest.Mock } }).clipboard.writeText).toHaveBeenCalledWith(
            'SUMMARY'
        );

        const copyRaw = devMenu?.querySelector('#dev-playback-copy-raw') as HTMLButtonElement | null;
        expect(copyRaw).not.toBeNull();
        (navigator as unknown as { clipboard: { writeText: jest.Mock } }).clipboard.writeText.mockRejectedValueOnce(
            new Error('blocked')
        );
        jest.setSystemTime(12_000);
        copyRaw!.click();
        await flushPromises();
        const toastEl = document.getElementById('app-toast') as HTMLElement | null;
        expect(toastEl?.textContent ?? '').toContain('Copy not supported');

        // Empty text branch.
        jest.setSystemTime(16_000);
        pre!.dataset.summary = '';
        copySummary!.click();
        await flushPromises();
    });

    it('renders a fatal error when startup fails', async () => {
        initializeSpy.mockReset();
        initializeSpy.mockRejectedValueOnce(new Error('init failed'));
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        app = new App();
        await app.start();

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('App startup failed:', expect.any(Error));
        const error = errorSpy.mock.calls[0]?.[1] as Error;
        expect(String(error.message)).toContain('init failed');

        const root = document.getElementById('app') as HTMLElement | null;
        expect(root?.textContent ?? '').toContain('Application Error');
        expect(root?.textContent ?? '').toContain('init failed');
    });

    it('does not expose debug helpers when debug surface is disabled', async () => {
        Object.defineProperty(globalThis, '__RETUNE_DEV_BUILD__', {
            value: false,
            configurable: true,
            writable: true,
        });
        localStorage.removeItem(RETUNE_STORAGE_KEYS.DEBUG_LOGGING);

        app = new App();
        await app.start();

        expect((window as unknown as { retune?: unknown }).retune).toBeUndefined();

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

    it('handles debug key bindings when debug surface is enabled', async () => {
        const toggleServerSelectSpy = jest
            .spyOn(AppOrchestrator.prototype, 'toggleServerSelect')
            .mockImplementation(() => undefined);

        app = new App();
        await app.start();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        expect(toggleServerSelectSpy).toHaveBeenCalledTimes(1);
    });

    it('applies screen visibility and schedules/cancels prefetches', async () => {
        jest.useFakeTimers();

        const getScreenParams = jest
            .fn()
            .mockReturnValueOnce({ allowAutoConnect: true })
            .mockReturnValueOnce({});
        jest.spyOn(AppOrchestrator.prototype, 'getNavigation').mockReturnValue({ getScreenParams } as never);

        app = new App();
        await app.start();

        expect(typeof screenChangeHandler).toBe('function');

        // Exercise server-select show/hide paths and channel-setup prefetch scheduling/cancel.
        screenChangeHandler?.('splash', 'server-select');
        expect(jest.getTimerCount()).toBeGreaterThan(0);
        screenChangeHandler?.('server-select', 'auth');

        // Exercise "ready guard" path which hides setup screens and schedules settings prefetch.
        isReadySpy.mockReturnValue(true);
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
        app = new App();
        await app.start();

        screenChangeHandler?.('auth', 'player');
        jest.advanceTimersByTime(1200);
        await flushPromises();

        expect(settingsScreenChunkLoaded).toHaveBeenCalledTimes(1);
    });

    it('prefetches ChannelSetupScreen after server-select delay', async () => {
        jest.useFakeTimers();
        app = new App();
        await app.start();

        screenChangeHandler?.('splash', 'server-select');
        jest.advanceTimersByTime(500);
        await flushPromises();

        expect(channelSetupScreenChunkLoaded).toHaveBeenCalledTimes(1);
    });

    it('generates and persists a client id when missing/invalid (fallback path)', async () => {
        const originalCrypto = globalThis.crypto;
        try {
            Object.defineProperty(globalThis, 'crypto', {
                value: { randomUUID: (): string => { throw new Error('no uuid'); } },
                configurable: true,
            });

            localStorage.setItem(STORAGE_KEYS.CLIENT_ID, '');

            app = new App();
            await app.start();

            const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID) ?? '';
            expect(clientId).toMatch(/^retune-[a-z0-9]+$/);
        } finally {
            Object.defineProperty(globalThis, 'crypto', {
                value: originalCrypto,
                configurable: true,
            });
        }
    });

    it('uses an existing sane client id without regenerating', async () => {
        localStorage.setItem(STORAGE_KEYS.CLIENT_ID, 'retune-existing_123');

        app = new App();
        await app.start();

        expect(localStorage.getItem(STORAGE_KEYS.CLIENT_ID)).toBe('retune-existing_123');
    });
});
