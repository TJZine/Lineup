import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { DebugOverridesStore } from '../../../modules/debug/DebugOverridesStore';
import { EpgPreferencesStore } from '../../../modules/settings/EpgPreferencesStore';
import { NowPlayingDisplayStore } from '../../../modules/settings/NowPlayingDisplayStore';
import { ProfileSessionStore } from '../../../modules/settings/ProfileSessionStore';
import { SubtitlePreferencesStore } from '../../../modules/settings/SubtitlePreferencesStore';
import { DeveloperSettingsStore } from '../../../modules/settings/DeveloperSettingsStore';
import type { EPGConfig } from '../../../modules/ui/epg';
import { EPGCoordinator } from '../../../modules/ui/epg';
import type { StreamDecision } from '../../../modules/plex/stream';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import {
    createOrchestratorCoordinators,
    type OrchestratorCoordinatorAssemblyInput,
} from '../assembly/OrchestratorCoordinatorAssembly';
import type { OrchestratorPlaybackStateAccessors } from '../runtime/OrchestratorPlaybackStateAccessors';

const makeProgram = (): ScheduledProgram =>
    ({
        item: {
            ratingKey: 'item-1',
            title: 'Program',
            durationMs: 60_000,
            type: 'movie',
        },
        elapsedMs: 0,
        scheduledStartTime: 0,
        scheduledEndTime: 60_000,
        remainingMs: 60_000,
        scheduleIndex: 0,
        loopNumber: 0,
        isCurrent: true,
    } as unknown as ScheduledProgram);

const makeDecision = (): StreamDecision =>
    ({
        isTranscoding: false,
        isDirectPlay: true,
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        bitrate: 8_000,
        width: 1920,
        height: 1080,
        protocol: 'http',
        playbackUrl: 'https://example.invalid/stream.mp4',
        subtitleDelivery: 'embed',
        sessionId: 'sess-1',
        mediaIndex: 0,
        partIndex: 0,
        partKey: '/library/parts/1/1/file.mp4',
        selectedAudioStream: null,
        selectedSubtitleStream: null,
        directPlay: { reasons: [] },
    } as unknown as StreamDecision);

const setupStorage = (): void => {
    const globalAny = globalThis as unknown as { localStorage?: Storage };
    if (typeof globalAny.localStorage !== 'undefined') {
        return;
    }

    const storage: Record<string, string> = {};
    globalAny.localStorage = {
        getItem: (key: string) => (key in storage ? storage[key] ?? null : null),
        setItem: (key: string, value: string) => {
            storage[key] = value;
        },
        removeItem: (key: string) => {
            delete storage[key];
        },
        clear: () => {
            Object.keys(storage).forEach((key) => {
                delete storage[key];
            });
        },
        key: (index: number) => Object.keys(storage)[index] ?? null,
        get length() {
            return Object.keys(storage).length;
        },
    } as Storage;
};

const makeDeps = (
    playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors>
): OrchestratorCoordinatorAssemblyInput => {
    const debugOverridesStore = new DebugOverridesStore();
    const developerSettingsStore = new DeveloperSettingsStore();
    const subtitlePreferencesStore = new SubtitlePreferencesStore();
    const epgPreferencesStore = new EpgPreferencesStore();
    const nowPlayingDisplayStore = new NowPlayingDisplayStore();
    const profileSessionStore = new ProfileSessionStore();
    debugOverridesStore.writeNowPlayingStreamDebugEnabled(true);
    const moduleStatus = new Map<string, { status: 'ready' | 'pending' | 'error' }>();
    moduleStatus.set('epg-ui', { status: 'ready' });

    return {
        epgDebugRuntime: null,
        config: null,
        moduleStatus: moduleStatus as OrchestratorCoordinatorAssemblyInput['moduleStatus'],
        init: {
            ensureEpgInitialized: (): Promise<void> => Promise.resolve(),
        },
        modules: {
            navigation: {
                isModalOpen: jest.fn().mockReturnValue(false),
                getCurrentScreen: jest.fn().mockReturnValue('player'),
            } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['navigation'],
            plexAuth: {
                getAuthHeaders: jest.fn().mockReturnValue({}),
                getCurrentUser: jest.fn().mockReturnValue(null),
            } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['plexAuth'],
            plexDiscovery: {
                getServerUri: jest.fn().mockReturnValue('https://example.invalid'),
            } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['plexDiscovery'],
            plexLibrary: {} as OrchestratorCoordinatorAssemblyInput['modules']['plexLibrary'],
            plexStreamResolver: {} as OrchestratorCoordinatorAssemblyInput['modules']['plexStreamResolver'],
            channelManager: {
                getCurrentChannel: jest.fn().mockReturnValue(null),
            } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['channelManager'],
            scheduler: {
                getCurrentProgram: jest.fn().mockReturnValue(null),
                getNextProgram: jest.fn().mockReturnValue(null),
            } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['scheduler'],
            videoPlayer: {} as OrchestratorCoordinatorAssemblyInput['modules']['videoPlayer'],
            lifecycle: {
                saveState: jest.fn().mockResolvedValue(undefined),
            } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['lifecycle'],
            epg: {} as OrchestratorCoordinatorAssemblyInput['modules']['epg'],
        },
        overlays: {
            nowPlayingInfo: {
                resetAutoHideTimer: jest.fn(),
            } as unknown as OrchestratorCoordinatorAssemblyInput['overlays']['nowPlayingInfo'],
            playerOsd: {
                isVisible: jest.fn().mockReturnValue(false),
            } as unknown as OrchestratorCoordinatorAssemblyInput['overlays']['playerOsd'],
            channelNumberOverlay: {} as OrchestratorCoordinatorAssemblyInput['overlays']['channelNumberOverlay'],
            miniGuide: {
                isVisible: jest.fn().mockReturnValue(false),
            } as unknown as OrchestratorCoordinatorAssemblyInput['overlays']['miniGuide'],
            channelTransitionOverlay: {} as OrchestratorCoordinatorAssemblyInput['overlays']['channelTransitionOverlay'],
            playbackOptionsModal: {} as OrchestratorCoordinatorAssemblyInput['overlays']['playbackOptionsModal'],
            exitConfirmModal: {} as OrchestratorCoordinatorAssemblyInput['overlays']['exitConfirmModal'],
            sleepTimer: {
                cyclePreset: jest.fn().mockReturnValue(15),
                getRemainingMs: jest.fn().mockReturnValue(0),
            } as unknown as OrchestratorCoordinatorAssemblyInput['overlays']['sleepTimer'],
        },
        stores: {
            developerSettingsStore,
            debugOverridesStore,
            subtitlePreferencesStore,
            epgPreferencesStore,
            nowPlayingDisplayStore,
            profileSessionStore,
        },
        diagnostics: {
            appendIssueDiagnostic: jest.fn(),
            reportRecoverableAsyncFailure: jest.fn(),
        },
        playback: {
            state: playbackState,
            getPlaybackInfoSnapshot: jest.fn().mockReturnValue(null),
            refreshPlaybackInfoSnapshot: jest.fn().mockResolvedValue(null),
            stopPlayback: jest.fn(),
            stopActiveTranscodeSession: jest.fn(),
            getMimeType: jest.fn().mockReturnValue('video/mp4'),
            buildPlexResourceUrl: jest.fn().mockReturnValue('https://example.invalid/resource'),
        },
        schedule: {
            lastChannelChangeSource: jest.fn().mockReturnValue(null),
            setLastChannelChangeSource: jest.fn(),
            setActiveScheduleDayKey: jest.fn(),
            getActiveUserId: jest.fn().mockReturnValue('user-1'),
            getSelectedServerId: jest.fn().mockReturnValue('server-1'),
            getLocalMidnightMs: jest.fn().mockReturnValue(0),
            getLocalDayKey: jest.fn().mockReturnValue(0),
            buildDailyScheduleConfig: jest.fn().mockReturnValue({} as never),
        },
        actions: {
            switchToChannel: jest.fn().mockResolvedValue(undefined),
            switchToChannelWithOutcome: jest.fn().mockResolvedValue('switched'),
            switchToNextChannel: jest.fn(),
            switchToPreviousChannel: jest.fn(),
            switchToChannelByNumberWithOutcome: jest.fn().mockResolvedValue('failed'),
            toggleEPG: jest.fn(),
            onOverlayVisibilityChange: jest.fn(),
            onChannelTransitionActivityChange: jest.fn(),
            toggleNowPlayingInfoOverlay: jest.fn(),
        },
        errors: {
            handleGlobalError: jest.fn(),
        },
        nowPlaying: {
            handler: jest.fn().mockReturnValue(null),
        },
    };
};

describe('createOrchestratorCoordinators playbackState wiring', () => {
    beforeAll(() => {
        setupStorage();
    });

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('routes now-playing debug stream text through playbackState accessors', () => {
        const decision = makeDecision();
        const program = makeProgram();
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(decision),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };

        localStorage.setItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG, '1');
        const coordinators = createOrchestratorCoordinators(makeDeps(playbackState));

        const debugText = coordinators.nowPlayingDebugManager.buildNowPlayingStreamDebugText();

        expect(debugText).toContain('DIRECT PLAY');
        expect(playbackState.getCurrentProgramForPlayback).toHaveBeenCalled();
        expect(playbackState.getCurrentStreamDecision).toHaveBeenCalled();
    });

    it('replaces config.epgConfig with a wrapped visible-range handler instead of mutating the original object', () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(null),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const previousOnVisibleRangeChange = jest.fn();
        const originalEpgConfig: EPGConfig = {
            containerId: 'epg',
            visibleChannels: 5,
            timeSlotMinutes: 30,
            visibleHours: 3,
            totalHours: 24,
            pixelsPerMinute: 4,
            rowHeight: 80,
            showCurrentTimeIndicator: true,
            autoScrollToNow: false,
            onVisibleRangeChange: previousOnVisibleRangeChange,
        };
        const deps = makeDeps(playbackState);
        deps.config = {
            epgConfig: originalEpgConfig,
        } as OrchestratorCoordinatorAssemblyInput['config'];
        const visibleRange = {
            channelStart: 0,
            channelEnd: 2,
            timeStartMs: 0,
            timeEndMs: 60_000,
        };
        const handleVisibleRangeChangeSpy = jest
            .spyOn(EPGCoordinator.prototype, 'handleVisibleRangeChange')
            .mockImplementation(() => undefined);

        createOrchestratorCoordinators(deps);

        expect(deps.config?.epgConfig).not.toBe(originalEpgConfig);
        expect(originalEpgConfig.onVisibleRangeChange).toBe(previousOnVisibleRangeChange);
        expect(deps.config?.epgConfig.onVisibleRangeChange).not.toBe(previousOnVisibleRangeChange);
        deps.config?.epgConfig.onVisibleRangeChange?.(visibleRange);
        expect(previousOnVisibleRangeChange).toHaveBeenCalledWith(visibleRange);
        expect(handleVisibleRangeChangeSpy).toHaveBeenCalledWith(visibleRange);
    });

    it('calls ensureEpgInitialized when openEPG runs before epg-ui status is ready', async () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(null),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const ensureEpgInitialized = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
        const show = jest.fn();
        const focusNow = jest.fn();
        const deps = makeDeps(playbackState);
        deps.moduleStatus.set('epg-ui', { status: 'initializing' } as never);
        deps.init.ensureEpgInitialized = ensureEpgInitialized;
        deps.modules.epg = {
            show,
            focusNow,
            isVisible: jest.fn().mockReturnValue(false),
            getState: jest.fn().mockReturnValue({
                viewWindow: {
                    startChannelIndex: 0,
                    endChannelIndex: 0,
                    startTime: 0,
                    endTime: 60_000,
                },
            }),
            loadChannels: jest.fn(),
            loadPrograms: jest.fn(),
            clearProgramsForChannel: jest.fn(),
            setLibraryTabs: jest.fn(),
            setLayoutMode: jest.fn(),
            setNowWatchingBannerEnabled: jest.fn(),
            setVisibleHours: jest.fn(),
        } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['epg'];

        const coordinators = createOrchestratorCoordinators(deps);
        coordinators.epgCoordinator.openEPG();
        await Promise.resolve();

        expect(ensureEpgInitialized).toHaveBeenCalledTimes(1);
        expect(show).toHaveBeenCalled();
        expect(focusNow).toHaveBeenCalled();
    });
});
