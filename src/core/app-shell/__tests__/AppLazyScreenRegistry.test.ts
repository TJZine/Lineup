/**
 * @jest-environment jsdom
 */

import type { AppOrchestrator } from '../../../Orchestrator';
import { AppLazyScreenRegistry } from '../AppLazyScreenRegistry';

type MockScreen = {
    show: jest.Mock;
    hide: jest.Mock;
    destroy: jest.Mock;
};

const makeScreen = (): MockScreen => ({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn(),
});

const makeOrchestrator = (): AppOrchestrator => ({
    getNavigation: jest.fn().mockReturnValue(null),
    setSubtitleTrack: jest.fn(),
    onGuideSettingChange: jest.fn(),
} as never);

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
};

describe('AppLazyScreenRegistry', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('returns null when required dependencies are missing', async () => {
        const registry = new AppLazyScreenRegistry({
            getOrchestrator: () => null,
            containers: {},
        });

        await expect(registry.ensureAudioSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureChannelSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureSettingsScreen()).resolves.toBeNull();
    });

    it('dedupes concurrent settings loads and caches the instance', async () => {
        const settingsScreen = makeScreen();
        const SettingsScreen = jest.fn().mockImplementation(() => settingsScreen);
        const loadSettingsScreen = jest.fn().mockResolvedValue({
            SettingsScreen,
        });

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            containers: {
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsScreen,
            },
        });

        const [first, second] = await Promise.all([
            registry.ensureSettingsScreen(),
            registry.ensureSettingsScreen(),
        ]);
        const third = await registry.ensureSettingsScreen();

        expect(loadSettingsScreen).toHaveBeenCalledTimes(1);
        expect(SettingsScreen).toHaveBeenCalledTimes(1);
        expect(first).toBe(settingsScreen as never);
        expect(second).toBe(settingsScreen as never);
        expect(third).toBe(settingsScreen as never);
    });

    it('dedupes concurrent channel-setup loads and caches the instance', async () => {
        const channelSetupScreen = makeScreen();
        const ChannelSetupScreen = jest.fn().mockImplementation(() => channelSetupScreen);
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({
            ChannelSetupScreen,
        });

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            containers: {
                channelSetupContainer: document.createElement('div'),
            },
            loaders: {
                loadChannelSetupScreen,
            },
        });

        const [first, second] = await Promise.all([
            registry.ensureChannelSetupScreen(),
            registry.ensureChannelSetupScreen(),
        ]);
        const third = await registry.ensureChannelSetupScreen();

        expect(loadChannelSetupScreen).toHaveBeenCalledTimes(1);
        expect(ChannelSetupScreen).toHaveBeenCalledTimes(1);
        expect(first).toBe(channelSetupScreen as never);
        expect(second).toBe(channelSetupScreen as never);
        expect(third).toBe(channelSetupScreen as never);
    });

    it('wires the audio setup completion callback through the registry-owned constructor path', async () => {
        const audioSetupScreen = makeScreen();
        let capturedOnComplete: (() => void) | null = null;

        const AudioSetupScreen = jest.fn().mockImplementation(
            (_container: HTMLElement, _getNavigation: () => unknown, onComplete: () => void) => {
                capturedOnComplete = onComplete;
                return audioSetupScreen;
            }
        );

        const onAudioSetupComplete = jest.fn();

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            containers: {
                audioSetupContainer: document.createElement('div'),
            },
            onAudioSetupComplete,
            loaders: {
                loadAudioSetupScreen: jest.fn().mockResolvedValue({
                    AudioSetupScreen,
                }),
            },
        });

        const first = await registry.ensureAudioSetupScreen();
        const second = await registry.ensureAudioSetupScreen();

        expect(AudioSetupScreen).toHaveBeenCalledTimes(1);
        expect(first).toBe(audioSetupScreen as never);
        expect(second).toBe(audioSetupScreen as never);

        capturedOnComplete?.();
        expect(onAudioSetupComplete).toHaveBeenCalledTimes(1);
    });

    it('schedules and cancels prefetch timers without duplicates', () => {
        const loadSettingsScreen = jest.fn().mockResolvedValue({ SettingsScreen: jest.fn() });
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({ ChannelSetupScreen: jest.fn() });

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            containers: {
                settingsContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsScreen,
                loadChannelSetupScreen,
            },
        });

        registry.scheduleSettingsPrefetch();
        registry.scheduleSettingsPrefetch();
        registry.scheduleChannelSetupPrefetch();
        registry.scheduleChannelSetupPrefetch();

        expect(jest.getTimerCount()).toBe(2);

        registry.cancelSettingsPrefetch();
        expect(jest.getTimerCount()).toBe(1);

        registry.cancelChannelSetupPrefetch();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('fires prefetch loaders after the existing delays only once', async () => {
        const loadSettingsScreen = jest.fn().mockResolvedValue({ SettingsScreen: jest.fn() });
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({ ChannelSetupScreen: jest.fn() });

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            containers: {
                settingsContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsScreen,
                loadChannelSetupScreen,
            },
        });

        registry.scheduleSettingsPrefetch();
        registry.scheduleChannelSetupPrefetch();

        jest.advanceTimersByTime(500);
        await flushMicrotasks();

        expect(loadChannelSetupScreen).toHaveBeenCalledTimes(1);
        expect(loadSettingsScreen).toHaveBeenCalledTimes(0);

        jest.advanceTimersByTime(700);
        await flushMicrotasks();

        expect(loadSettingsScreen).toHaveBeenCalledTimes(1);
    });

    it('destroy clears timers, destroys cached screens, and blocks future ensures', async () => {
        const audioSetupScreen = makeScreen();
        const channelSetupScreen = makeScreen();
        const settingsScreen = makeScreen();

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            containers: {
                audioSetupContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadAudioSetupScreen: jest.fn().mockResolvedValue({
                    AudioSetupScreen: jest.fn().mockImplementation(() => audioSetupScreen),
                }),
                loadChannelSetupScreen: jest.fn().mockResolvedValue({
                    ChannelSetupScreen: jest.fn().mockImplementation(() => channelSetupScreen),
                }),
                loadSettingsScreen: jest.fn().mockResolvedValue({
                    SettingsScreen: jest.fn().mockImplementation(() => settingsScreen),
                }),
            },
        });

        await registry.ensureAudioSetupScreen();
        await registry.ensureChannelSetupScreen();
        await registry.ensureSettingsScreen();
        registry.scheduleSettingsPrefetch();
        registry.scheduleChannelSetupPrefetch();

        expect(jest.getTimerCount()).toBe(2);

        registry.destroy();

        expect(jest.getTimerCount()).toBe(0);
        expect(audioSetupScreen.destroy).toHaveBeenCalledTimes(1);
        expect(channelSetupScreen.destroy).toHaveBeenCalledTimes(1);
        expect(settingsScreen.destroy).toHaveBeenCalledTimes(1);
        await expect(registry.ensureAudioSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureChannelSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureSettingsScreen()).resolves.toBeNull();
    });
});
