/**
 * @fileoverview Unit tests for AppOrchestrator.
 * @module __tests__/Orchestrator.test
 * @version 1.0.0
 * @remarks Legacy umbrella suite; focused suites live under `src/__tests__/orchestrator/`.
 */


import { AppOrchestrator } from '../Orchestrator';
import { AppErrorCode } from '../modules/lifecycle';
import type { OrchestratorConfig } from '../core/orchestrator/OrchestratorTypes';
import {
    NowPlayingInfoCoordinator,
} from '../modules/ui/now-playing-info';
import { EPGCoordinator } from '../modules/ui/epg';
import type { INavigationManager } from '../modules/navigation';
import type { PlexAuthDataV2, PlexStoredCredentialsReadResult } from '../modules/plex/auth';
import type { IPlexLibrary } from '../modules/plex/library';
import type { ScheduledProgram } from '../modules/scheduler/scheduler';
import type { INowPlayingInfoOverlay, NowPlayingInfoConfig } from '../modules/ui/now-playing-info';
import { CHANNEL_BADGE_CONTAINER_ID } from '../modules/ui/channel-badge';
import { LINEUP_STORAGE_KEYS } from '../config/storageKeys';
import { InitializationCoordinator, STARTUP_PHASE } from '../core/initialization/InitializationCoordinator';
import { ChannelTuningCoordinator } from '../core/channel-tuning';
import type { PlatformServices } from '../platform';
import type { StreamDecision } from '../modules/plex/stream';
import { AudioSettingsStore } from '../modules/settings/AudioSettingsStore';
import { APP_SHELL_CONTAINER_IDS } from '../modules/ui/common/appShellContainerIds';
import { PlaybackRecoveryManager } from '../modules/player/PlaybackRecoveryManager';
import { EXIT_CONFIRM_MODAL_ID } from '../modules/ui/exit-confirm';
import * as orchestratorCoordinatorAssembly from '../core/orchestrator/OrchestratorCoordinatorAssembly';
import { OverlayRuntimePolicyController } from '../core/orchestrator/OverlayRuntimePolicyController';
import * as recoverableRuntimeReporterModule from '../core/orchestrator/OrchestratorRecoverableRuntimeReporter';
import { expectConsoleWarn } from './helpers';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from './mocks/localStorage';

installMockLocalStorage();


// ============================================
// Test Configuration
// ============================================

const mockPlexConfig = {
    clientIdentifier: 'test-client',
    product: 'Lineup',
    version: '1.0.0',
    platform: 'webOS',
    platformVersion: '6.0',
    device: 'LG Smart TV',
    deviceName: 'Test TV',
};

const mockNavConfig = {
    enablePointerMode: false,
    keyRepeatDelayMs: 500,
    keyRepeatIntervalMs: 100,
    focusMemoryEnabled: true,
    debugMode: false,
};

const mockPlayerConfig = {
    containerId: APP_SHELL_CONTAINER_IDS.VIDEO,
    defaultVolume: 1.0,
    bufferAheadMs: 30000,
    seekIncrementSec: 10,
    hideControlsAfterMs: 3000,
    retryAttempts: 3,
    retryDelayMs: 1000,
};

const mockEpgConfig = {
    containerId: 'epg-container',
    visibleChannels: 5,
    timeSlotMinutes: 30,
    visibleHours: 3,
    totalHours: 24,
    pixelsPerMinute: 4,
    rowHeight: 80,
    showCurrentTimeIndicator: true,
    autoScrollToNow: true,
};

const mockNowPlayingInfoConfig = {
    containerId: 'now-playing-info-container',
    autoHideMs: 0,
    posterWidth: 111,
    posterHeight: 222,
};

const mockPlaybackOptionsConfig = {
    containerId: 'playback-options-container',
};

const mockPlayerOsdConfig = {
    containerId: 'player-osd-container',
};

const mockChannelNumberOverlay = {
    initialize: jest.fn(),
    showDigits: jest.fn(),
    showError: jest.fn(),
    scheduleHide: jest.fn(),
    hide: jest.fn(),
    isVisible: jest.fn(() => false),
    destroy: jest.fn(),
};

const mockChannelBadgeOverlay = {
    initialize: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    isVisible: jest.fn(() => false),
    destroy: jest.fn(),
};

const mockChannelNumberOverlayConfig = {
    containerId: 'channel-number-overlay-container',
};

const mockChannelBadgeConfig = {
    containerId: CHANNEL_BADGE_CONTAINER_ID,
};

const mockMiniGuideConfig = {
    containerId: 'mini-guide-container',
};

const mockChannelTransitionConfig = {
    containerId: 'channel-transition-container',
};

const mockConfig: OrchestratorConfig = {
    plexConfig: mockPlexConfig,
    navConfig: mockNavConfig,
    playerConfig: mockPlayerConfig,
    epgConfig: mockEpgConfig,
    nowPlayingInfoConfig: mockNowPlayingInfoConfig,
    playerOsdConfig: mockPlayerOsdConfig,
    channelNumberOverlayConfig: mockChannelNumberOverlayConfig,
    channelBadgeConfig: mockChannelBadgeConfig,
    miniGuideConfig: mockMiniGuideConfig,
    channelTransitionConfig: mockChannelTransitionConfig,
    playbackOptionsConfig: mockPlaybackOptionsConfig,
};

// ============================================
// Mock Modules
// ============================================

// Mock EventEmitter
jest.mock('../utils', () => ({
    EventEmitter: jest.fn().mockImplementation(() => ({
        on: jest.fn(() => ({ dispose: jest.fn() })),
        off: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn(),
    })),
}));

// Mock AppLifecycle
const mockLifecycle = {
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    setPhase: jest.fn(),
    getPhase: jest.fn().mockReturnValue('ready'),
    getErrorUserMessage: jest.fn().mockReturnValue('Test message'),
    restoreState: jest.fn().mockResolvedValue(null),
    saveState: jest.fn().mockResolvedValue(undefined),
    reportError: jest.fn(),
    onPause: jest.fn(() => ({ dispose: jest.fn() })),
    onResume: jest.fn(() => ({ dispose: jest.fn() })),
    onTerminate: jest.fn(() => ({ dispose: jest.fn() })),
    on: jest.fn(() => ({ dispose: jest.fn() })),
};

jest.mock('../modules/lifecycle', () => {
    const actual = jest.requireActual('../modules/lifecycle');
    return {
        ...actual,
        AppLifecycle: jest.fn(() => mockLifecycle),
    };
});

// Mock NavigationManager
const mockNavigation = {
    initialize: jest.fn().mockResolvedValue(undefined),
    goTo: jest.fn(),
    replaceScreen: jest.fn(),
    getCurrentScreen: jest.fn().mockReturnValue('player'),
    isModalOpen: jest.fn().mockReturnValue(false),
    isInputBlocked: jest.fn().mockReturnValue(false),
    openModal: jest.fn(),
    closeModal: jest.fn(),
    on: jest.fn(() => ({ dispose: jest.fn() })),
    off: jest.fn(),
    handleLongPress: jest.fn(),
    destroy: jest.fn(),
};

jest.mock('../modules/navigation', () => ({
    NavigationManager: jest.fn(() => mockNavigation),
}));

jest.mock('../modules/ui/now-playing-info', () => {
    const actual = jest.requireActual('../modules/ui/now-playing-info');
    return {
        ...actual,
        NowPlayingInfoOverlay: jest.fn(() => ({
            initialize: jest.fn(),
            show: jest.fn(),
            update: jest.fn(),
            hide: jest.fn(),
            isVisible: jest.fn(() => false),
            destroy: jest.fn(),
            setAutoHideMs: jest.fn(),
            resetAutoHideTimer: jest.fn(),
            setOnAutoHide: jest.fn(),
        })),
    };
});

jest.mock('../modules/ui/player-osd', () => {
    const actual = jest.requireActual('../modules/ui/player-osd');
    return {
        ...actual,
        PlayerOsdOverlay: jest.fn(() => ({
            initialize: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            isVisible: jest.fn(() => false),
            destroy: jest.fn(),
            setViewModel: jest.fn(),
        })),
    };
});

jest.mock('../modules/ui/channel-number-overlay', () => ({
    ChannelNumberOverlay: jest.fn(() => mockChannelNumberOverlay),
}));

jest.mock('../modules/ui/channel-badge', () => ({
    ChannelBadgeOverlay: jest.fn(() => mockChannelBadgeOverlay),
    CHANNEL_BADGE_CONTAINER_ID: 'channel-badge-overlay-container',
}));

jest.mock('../modules/ui/mini-guide', () => {
    const actual = jest.requireActual('../modules/ui/mini-guide');
    return {
        ...actual,
        MiniGuideOverlay: jest.fn(() => ({
            initialize: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            isVisible: jest.fn(() => false),
            destroy: jest.fn(),
            setViewModel: jest.fn(),
            setFocusedIndex: jest.fn(),
        })),
    };
});

jest.mock('../modules/ui/channel-transition', () => {
    const actual = jest.requireActual('../modules/ui/channel-transition');
    return {
        ...actual,
        ChannelTransitionOverlay: jest.fn(() => ({
            initialize: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            isVisible: jest.fn(() => false),
            destroy: jest.fn(),
            setViewModel: jest.fn(),
        })),
    };
});

// Mock PlexAuth
const mockPlexAuth = {
    validateToken: jest.fn().mockResolvedValue(true),
    storeCredentials: jest.fn(() => undefined),
    readStoredCredentialsAndClearCorruption: jest.fn().mockReturnValue({ kind: 'missing' }),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getAuthHeaders: jest.fn().mockReturnValue({}),
    getCurrentUser: jest.fn().mockReturnValue(null),
    getHomeUsers: jest.fn().mockResolvedValue([]),
    switchHomeUser: jest.fn().mockResolvedValue(undefined),
    getActiveUserId: jest.fn().mockReturnValue('user-1'),
    getAccountUserId: jest.fn().mockReturnValue('user-1'),
    logoutActiveUser: jest.fn().mockResolvedValue(undefined),
    clearCredentials: jest.fn(() => undefined),
    on: jest.fn(() => ({ dispose: jest.fn() })),
};

const createStoredCredentials = (
    token: string,
    userId: string = 'user-1'
): PlexStoredCredentialsReadResult => ({
    kind: 'available',
    credentials: {
        accountToken: {
            token,
            userId,
            username: 'testuser',
            email: 'test@example.com',
            thumb: '',
            expiresAt: null,
            issuedAt: new Date(),
        },
        activeToken: {
            token,
            userId,
            username: 'testuser',
            email: 'test@example.com',
            thumb: '',
            expiresAt: null,
            issuedAt: new Date(),
        },
        activeUserId: userId,
        selectedServerByUserId: {
            [userId]: { serverId: null, serverUri: null },
        },
    } satisfies PlexAuthDataV2,
});

const makeDecision = (overrides: Partial<StreamDecision> = {}): StreamDecision => ({
    playbackUrl: 'http://test/stream.mp4',
    protocol: 'http',
    isDirectPlay: true,
    isTranscoding: false,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    subtitleDelivery: 'none',
    sessionId: 'sess-1',
    mediaIndex: 0,
    partIndex: 0,
    partKey: '/library/parts/1',
    selectedAudioStream: null,
    selectedSubtitleStream: null,
    width: 1920,
    height: 1080,
    bitrate: 1000,
    ...overrides,
});

jest.mock('../modules/plex/auth', () => ({
    PlexAuth: jest.fn(() => mockPlexAuth),
}));

// Mock PlexServerDiscovery
const mockPlexDiscovery = {
    initialize: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    getSelectedServer: jest.fn().mockReturnValue(null),
    getServerUri: jest.fn().mockReturnValue('http://localhost:32400'),
    captureSelectedServerSnapshot: jest.fn().mockReturnValue({
        server: null,
        connection: null,
        storedServerId: null,
    }),
    restoreSelectedServerSnapshot: jest.fn(),
    selectServer: jest.fn().mockResolvedValue({ kind: 'selected' }),
    clearSelection: jest.fn(),
    setStorageKeys: jest.fn(),
    on: jest.fn(() => ({ dispose: jest.fn() })),
};

jest.mock('../modules/plex/discovery', () => ({
    PlexServerDiscovery: jest.fn(() => mockPlexDiscovery),
}));

// Mock PlexLibrary
const mockPlexLibrary = {
    getLibraries: jest.fn().mockResolvedValue([]),
    getImageUrl: jest.fn().mockReturnValue('http://test/resized.jpg'),
    getItem: jest.fn().mockResolvedValue(null),
    on: jest.fn(() => ({ dispose: jest.fn() })),
    off: jest.fn(),
};

jest.mock('../modules/plex/library', () => ({
    PlexLibrary: jest.fn(() => mockPlexLibrary),
}));

// Mock PlexStreamResolver
const mockPlexStreamResolver = {
    resolveStream: jest.fn().mockResolvedValue({
        playbackUrl: 'http://test/stream.mp4',
        protocol: 'direct',
        mimeType: 'video/mp4',
    }),
    stopTranscodeSession: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(() => ({ dispose: jest.fn() })),
    off: jest.fn(),
};

jest.mock('../modules/plex/stream', () => ({
    PlexStreamResolver: jest.fn(() => mockPlexStreamResolver),
}));

// Mock ChannelManager
const mockChannel = {
    id: 'ch1',
    name: 'Test Channel',
    number: 1,
    contentSource: { type: 'manual', items: [] as unknown[] },
    startTimeAnchor: 0,
    playbackMode: 'sequential' as const,
    shuffleSeed: 12345,
    phaseSeed: 4242,
    skipIntros: false,
    skipCredits: false,
    createdAt: 0,
    updatedAt: 0,
    lastContentRefresh: 0,
    itemCount: 0,
    totalDurationMs: 0,
};

const mockChannelManager = {
    loadChannels: jest.fn().mockResolvedValue(undefined),
    setStorageKeys: jest.fn(),
    flushSaves: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    replaceAllChannels: jest.fn().mockResolvedValue(undefined),
    getAllChannels: jest.fn().mockReturnValue([mockChannel]),
    getCurrentChannel: jest.fn().mockReturnValue(mockChannel),
    getChannel: jest.fn().mockReturnValue(mockChannel),
    getChannelByNumber: jest.fn().mockReturnValue(mockChannel),
    getNextChannel: jest.fn().mockReturnValue(mockChannel),
    getPreviousChannel: jest.fn().mockReturnValue(mockChannel),
    setCurrentChannel: jest.fn(),
    deleteChannel: jest.fn().mockResolvedValue(undefined),
    resolveChannelContent: jest.fn().mockResolvedValue({
        channelId: 'ch1',
        items: [],
        orderedItems: [],
        totalDurationMs: 0,
        resolvedAt: Date.now(),
    }),
    on: jest.fn(() => ({ dispose: jest.fn() })),
};

jest.mock('../modules/scheduler/channel-manager', () => ({
    ChannelManager: jest.fn(() => mockChannelManager),
}));

// Mock ChannelScheduler
const mockScheduler = {
    loadChannel: jest.fn(),
    unloadChannel: jest.fn(),
    syncToCurrentTime: jest.fn(),
    getCurrentProgram: jest.fn().mockReturnValue(null),
    getState: jest.fn().mockReturnValue({ isActive: false, channelId: null }),
    getScheduleWindow: jest.fn().mockReturnValue({ startTime: 0, endTime: 0, programs: [] }),
    skipToNext: jest.fn(),
    skipToPrevious: jest.fn(),
    pauseSyncTimer: jest.fn(),
    resumeSyncTimer: jest.fn(),
    on: jest.fn(() => jest.fn()),
    off: jest.fn(),
};

jest.mock('../modules/scheduler/scheduler', () => {
    class MockShuffleGenerator { }
    return {
        ChannelScheduler: jest.fn(() => mockScheduler),
        ShuffleGenerator: MockShuffleGenerator,
        buildScheduleIndex: jest.fn(() => ({})),
        generateScheduleWindow: jest.fn(() => []),
    };
});

// Mock VideoPlayer
const mockVideoPlayer = {
    initialize: jest.fn().mockResolvedValue(undefined),
    loadStream: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    stop: jest.fn(),
    setSubtitleTrack: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
    requestMediaSession: jest.fn(),
    releaseMediaSession: jest.fn(),
    getCurrentTimeMs: jest.fn().mockReturnValue(5000),
    getState: jest.fn().mockReturnValue({ activeAudioId: null }),
    getAvailableAudio: jest.fn().mockReturnValue([]),
    getAvailableSubtitles: jest.fn().mockReturnValue([]),
    isPlaying: jest.fn().mockReturnValue(false),
    on: jest.fn(() => ({ dispose: jest.fn() })),
    off: jest.fn(),
};

jest.mock('../modules/player', () => ({
    VideoPlayer: jest.fn(() => mockVideoPlayer),
}));

// Mock EPGComponent
const mockEpg = {
    initialize: jest.fn(),
    ensureReady: jest.fn().mockResolvedValue(undefined),
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn(),
    isVisible: jest.fn().mockReturnValue(false),
    handleNavigation: jest.fn().mockReturnValue(false),
    handleSelect: jest.fn().mockReturnValue(false),
    handleBack: jest.fn().mockReturnValue(true),
    loadChannels: jest.fn(),
    setCategoryColorsEnabled: jest.fn(),
    setLayoutMode: jest.fn(),
    setVisibleHours: jest.fn(),
    setNowWatchingBannerEnabled: jest.fn(),
    setLibraryTabs: jest.fn(),
    setGridAnchorTime: jest.fn(),
    loadScheduleForChannel: jest.fn(),
    clearSchedules: jest.fn(),
    getState: jest.fn().mockReturnValue({
        isVisible: false,
        focusedCell: null,
        scrollPosition: { channelOffset: 0, timeOffset: 0 },
        viewWindow: {
            startTime: 0,
            endTime: 0,
            startChannelIndex: 0,
            endChannelIndex: 0,
        },
        currentTime: 0,
    }),
    getFocusedProgram: jest.fn().mockReturnValue(null),
    focusChannel: jest.fn(),
    focusNow: jest.fn(),
    scrollToChannel: jest.fn(),
    on: jest.fn(() => ({ dispose: jest.fn() })),
    off: jest.fn(),
};

const createMockEpgDebugRuntime = (): {
    isEnabled: jest.Mock<boolean, []>;
    append: jest.Mock<void, [string, unknown?]>;
    destroy: jest.Mock<void, []>;
} => ({
    isEnabled: jest.fn().mockReturnValue(false),
    append: jest.fn(),
    destroy: jest.fn(),
});

jest.mock('../modules/ui/epg', () => {
    const actual = jest.requireActual('../modules/ui/epg');
    return {
        ...actual,
        DeferredEPGComponent: jest.fn(() => mockEpg),
        EPGDebugRuntime: jest.fn(() => createMockEpgDebugRuntime()),
    };
});

// ============================================
// Tests
// ============================================

describe('AppOrchestrator', () => {
    let orchestrator: AppOrchestrator;
    const ownedOrchestrators = new Set<AppOrchestrator>();
    let schedulerHandlers: {
        programStart?: (program: unknown) => void;
        scheduleSync?: () => void;
    };
    let playerHandlers: {
        ended?: () => void;
        error?: (error: unknown) => void;
        trackChange?: (event: { type: 'audio' | 'subtitle'; trackId: string | null }) => void;
    };
    let navHandlers: {
        keyPress?: (payload: unknown) => void;
        modalOpen?: (payload: unknown) => void;
        modalClose?: (payload: unknown) => void;
    };
    let channelManagerHandlers: {
        persistenceWarning?: (payload: {
            message: string;
            code: AppErrorCode;
            isQuotaError: boolean;
            timestamp: number;
        }) => void;
    };
    let pauseHandler: (() => void | Promise<void>) | null;
    let resumeHandler: (() => void | Promise<void>) | null;
const createOrchestrator = (platformServices?: PlatformServices): AppOrchestrator => {
        const instance = new AppOrchestrator(platformServices);
        ownedOrchestrators.add(instance);
        return instance;
    };

    const resetMockPlexDiscoveryOn = (): void => {
        mockPlexDiscovery.on.mockReset();
        mockPlexDiscovery.on.mockReturnValue({ dispose: jest.fn() });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        resetMockLocalStorage();

        mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReset();
        mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({ kind: 'missing' });
        mockPlexAuth.storeCredentials.mockReset();
        mockPlexAuth.storeCredentials.mockImplementation(() => undefined);

        mockPlexAuth.validateToken.mockReset();
        mockPlexAuth.validateToken.mockResolvedValue(true);

        mockLocalStorage.getItem.mockReset();
        mockLocalStorage.getItem.mockReturnValue(null);

        mockNavigation.isModalOpen.mockReset();
        mockNavigation.isModalOpen.mockReturnValue(false);

        mockEpg.isVisible.mockReset();
        mockEpg.isVisible.mockReturnValue(false);

        mockPlexDiscovery.getSelectedServer.mockReset();
        mockPlexDiscovery.getSelectedServer.mockReturnValue(null);
        mockPlexDiscovery.getServerUri.mockReset();
        mockPlexDiscovery.getServerUri.mockReturnValue(null);
        mockPlexDiscovery.captureSelectedServerSnapshot.mockReset();
        mockPlexDiscovery.captureSelectedServerSnapshot.mockReturnValue({
            server: null,
            connection: null,
            storedServerId: null,
        });
        mockPlexDiscovery.restoreSelectedServerSnapshot.mockReset();
        resetMockPlexDiscoveryOn();

        mockChannelManager.getAllChannels.mockReset();
        mockChannelManager.getAllChannels.mockReturnValue([mockChannel]);

        mockLifecycle.onPause.mockReset();
        mockLifecycle.onResume.mockReset();
        mockScheduler.on.mockReset();
        mockScheduler.off.mockReset();
        mockVideoPlayer.on.mockReset();
        mockVideoPlayer.off.mockReset();
        mockNavigation.on.mockReset();
        mockChannelManager.on.mockReset();

        schedulerHandlers = {};
        playerHandlers = {};
        navHandlers = {};
        channelManagerHandlers = {};
        pauseHandler = null;
        resumeHandler = null;

        (mockScheduler.on as jest.Mock).mockImplementation(
            (event: string, handler: (payload: unknown) => void) => {
                if (event === 'programStart') {
                    schedulerHandlers.programStart = handler;
                }
                if (event === 'scheduleSync') {
                    schedulerHandlers.scheduleSync = handler as () => void;
                }
                return {
                    dispose: jest.fn(() => {
                        mockScheduler.off(event, handler);
                    }),
                };
            });
        (mockScheduler.off as jest.Mock).mockImplementation(
            (event: string, handler: (payload: unknown) => void) => {
                if (event === 'programStart' && schedulerHandlers.programStart === handler) {
                    delete schedulerHandlers.programStart;
                }
                if (event === 'scheduleSync' && schedulerHandlers.scheduleSync === handler) {
                    delete schedulerHandlers.scheduleSync;
                }
            });

        (mockVideoPlayer.on as jest.Mock).mockImplementation(
            (event: string, handler: (payload: unknown) => void) => {
                if (event === 'ended') {
                    playerHandlers.ended = handler as () => void;
                }
                if (event === 'error') {
                    playerHandlers.error = handler;
                }
                if (event === 'trackChange') {
                    playerHandlers.trackChange = handler as (
                        event: { type: 'audio' | 'subtitle'; trackId: string | null }
                    ) => void;
                }
                return {
                    dispose: jest.fn(() => {
                        mockVideoPlayer.off(event, handler);
                    }),
                };
            });
        (mockVideoPlayer.off as jest.Mock).mockImplementation(
            (event: string, handler: (payload: unknown) => void) => {
                if (event === 'ended' && playerHandlers.ended === handler) {
                    delete playerHandlers.ended;
                }
                if (event === 'error' && playerHandlers.error === handler) {
                    delete playerHandlers.error;
                }
                if (event === 'trackChange' && playerHandlers.trackChange === handler) {
                    delete playerHandlers.trackChange;
                }
            });

        (mockNavigation.on as jest.Mock).mockImplementation(
            (event: string, handler: (payload: unknown) => void) => {
                if (event === 'keyPress') {
                    navHandlers.keyPress = handler;
                }
                if (event === 'modalOpen') {
                    navHandlers.modalOpen = handler;
                }
                if (event === 'modalClose') {
                    navHandlers.modalClose = handler;
                }
                return {
                    dispose: jest.fn(() => {
                        if (event === 'keyPress' && navHandlers.keyPress === handler) {
                            delete navHandlers.keyPress;
                        }
                        if (event === 'modalOpen' && navHandlers.modalOpen === handler) {
                            delete navHandlers.modalOpen;
                        }
                        if (event === 'modalClose' && navHandlers.modalClose === handler) {
                            delete navHandlers.modalClose;
                        }
                    }),
                };
            });
        (mockChannelManager.on as jest.Mock).mockImplementation(
            (event: string, handler: (payload: unknown) => void) => {
                if (event === 'persistenceWarning') {
                    channelManagerHandlers.persistenceWarning = handler as (payload: {
                        message: string;
                        code: AppErrorCode;
                        isQuotaError: boolean;
                        timestamp: number;
                    }) => void;
                }
                return { dispose: jest.fn() };
            });
        (mockLifecycle.onPause as jest.Mock).mockImplementation(
            (handler: () => void | Promise<void>) => {
                pauseHandler = handler;
                return { dispose: jest.fn() };
            });
        (mockLifecycle.onResume as jest.Mock).mockImplementation(
            (handler: () => void | Promise<void>) => {
                resumeHandler = handler;
                return { dispose: jest.fn() };
            });
        orchestrator = createOrchestrator();
    });

    afterEach(async () => {
        jest.useRealTimers();

        for (const orchestratorInstance of ownedOrchestrators) {
            try {
                await orchestratorInstance.shutdown();
            } catch {
                // Cleanup failures are asserted in explicit shutdown tests.
            }
        }

        ownedOrchestrators.clear();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    describe('initialize', () => {
        it('should create all module instances', async () => {
            await orchestrator.initialize(mockConfig);

            // Verify modules were created (by checking the mocks were called)
            expect(require('../modules/lifecycle').AppLifecycle).toHaveBeenCalled();
            expect(require('../modules/navigation').NavigationManager).toHaveBeenCalled();
            expect(require('../modules/plex/auth').PlexAuth).toHaveBeenCalled();
            expect(require('../modules/plex/discovery').PlexServerDiscovery).toHaveBeenCalled();
            expect(require('../modules/plex/library').PlexLibrary).toHaveBeenCalled();
            expect(require('../modules/plex/stream').PlexStreamResolver).toHaveBeenCalled();
            expect(require('../modules/scheduler/channel-manager').ChannelManager).toHaveBeenCalled();
            expect(require('../modules/scheduler/scheduler').ChannelScheduler).toHaveBeenCalled();
            expect(require('../modules/player').VideoPlayer).toHaveBeenCalled();
            expect(require('../modules/ui/epg').DeferredEPGComponent).toHaveBeenCalled();
        });

        it('wires injected platform services into lifecycle/navigation/stream/player seams', async () => {
            const platformServices: PlatformServices = {
                identity: {
                    isWebOs: jest.fn(() => true),
                    detectPlatformVersion: jest.fn(() => '24.0'),
                    getDefaultPlexIdentity: jest.fn((clientIdentifier: string) => ({
                        'X-Plex-Client-Identifier': clientIdentifier,
                        'X-Plex-Platform': 'webOS',
                        'X-Plex-Product': 'Lineup',
                        'X-Plex-Version': '1.0.0',
                        'X-Plex-Device': 'LG Smart TV',
                        'X-Plex-Device-Name': 'Lineup',
                        'X-Plex-Platform-Version': '24.0',
                        'X-Plex-Model': 'LGTV',
                    })),
                },
                input: {
                    getKeyMap: jest.fn(() => new Map([[13, 'ok']])),
                },
                lifecycle: {
                    bindRelaunch: jest.fn(() => jest.fn()),
                },
                playback: {
                    applyStreamSource: jest.fn(),
                },
                subtitle: {
                    deriveLanHttpSubtitleUrl: jest.fn(() => null),
                },
            };
            const orchestratorWithPlatform = createOrchestrator(platformServices);

            await orchestratorWithPlatform.initialize(mockConfig);

            expect(require('../modules/lifecycle').AppLifecycle).toHaveBeenCalledWith(
                undefined,
                undefined,
                platformServices.lifecycle
            );
            expect(require('../modules/navigation').NavigationManager).toHaveBeenCalledWith(
                platformServices.input,
                expect.objectContaining({
                    readDebugLoggingEnabled: expect.any(Function),
                })
            );
            const streamResolverConfig =
                (require('../modules/plex/stream').PlexStreamResolver as jest.Mock).mock.calls[0]?.[0];
            expect(streamResolverConfig?.identityService).toBe(platformServices.identity);
            expect(require('../modules/player').VideoPlayer).toHaveBeenCalledWith({
                playbackService: platformServices.playback,
                subtitleService: platformServices.subtitle,
            });
        });

        it('wires default webos platform services into lifecycle/navigation/stream/player seams', async () => {
            await orchestrator.initialize(mockConfig);

            expect(require('../modules/lifecycle').AppLifecycle).toHaveBeenCalledWith(
                undefined,
                undefined,
                expect.objectContaining({
                    bindRelaunch: expect.any(Function),
                })
            );
            expect(require('../modules/navigation').NavigationManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    getKeyMap: expect.any(Function),
                }),
                expect.objectContaining({
                    readDebugLoggingEnabled: expect.any(Function),
                })
            );
            const streamResolverConfig =
                (require('../modules/plex/stream').PlexStreamResolver as jest.Mock).mock.calls[0]?.[0];
            expect(streamResolverConfig?.identityService).toEqual(
                expect.objectContaining({
                    detectPlatformVersion: expect.any(Function),
                    getDefaultPlexIdentity: expect.any(Function),
                    isWebOs: expect.any(Function),
                })
            );
            expect(require('../modules/player').VideoPlayer).toHaveBeenCalledWith({
                playbackService: expect.objectContaining({
                    applyStreamSource: expect.any(Function),
                }),
                subtitleService: expect.objectContaining({
                    deriveLanHttpSubtitleUrl: expect.any(Function),
                }),
            });
        });

        it('wraps nowPlayingInfoConfig.onAutoHide without mutating caller config', async () => {
            const previousOnAutoHide = jest.fn();
            const configWithHandler: OrchestratorConfig = {
                ...mockConfig,
                nowPlayingInfoConfig: {
                    ...mockConfig.nowPlayingInfoConfig,
                    onAutoHide: previousOnAutoHide,
                },
            };
            const originalNowPlayingInfoConfig = configWithHandler.nowPlayingInfoConfig;
            const originalOnAutoHide = configWithHandler.nowPlayingInfoConfig.onAutoHide;

            mockNavigation.isModalOpen.mockReturnValue(true);

            await orchestrator.initialize(configWithHandler);

            expect(configWithHandler.nowPlayingInfoConfig).toBe(originalNowPlayingInfoConfig);
            expect(configWithHandler.nowPlayingInfoConfig.onAutoHide).toBe(originalOnAutoHide);

            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);

            await orchestrator.start();

            const nowPlayingModule = require('../modules/ui/now-playing-info');
            const instance = (nowPlayingModule.NowPlayingInfoOverlay as jest.Mock).mock.results[0]?.value;
            const initializedConfig = (instance.initialize as jest.Mock).mock.calls[0]?.[0] as NowPlayingInfoConfig;

            expect(initializedConfig).not.toBe(configWithHandler.nowPlayingInfoConfig);
            expect(initializedConfig.onAutoHide).not.toBe(originalOnAutoHide);

            initializedConfig.onAutoHide?.();

            expect(previousOnAutoHide).toHaveBeenCalledTimes(1);
            expect(mockNavigation.closeModal).toHaveBeenCalledWith('now-playing-info');
        });

        it('should use configured nowPlayingInfo poster sizes when resizing', async () => {
            const configWithPosterSizes: OrchestratorConfig = {
                ...mockConfig,
                nowPlayingInfoConfig: {
                    ...mockConfig.nowPlayingInfoConfig,
                    posterWidth: 111,
                    posterHeight: 222,
                },
            };

            await orchestrator.initialize(configWithPosterSizes);

            const program = {
                elapsedMs: 1234,
                item: {
                    ratingKey: 'rk1',
                    type: 'movie',
                    title: 'Test Movie',
                    fullTitle: null,
                    year: 2024,
                    contentRating: 'PG',
                    durationMs: 60_000,
                    thumb: '/thumb',
                },
            };
            const coordinator = new NowPlayingInfoCoordinator({
                nowPlayingModalId: 'now-playing-info',
                getNavigation: (): INavigationManager =>
                    ({
                        isModalOpen: (): boolean => true,
                    }) as INavigationManager,
                getScheduler: (): null => null,
                getPlexLibrary: (): IPlexLibrary => mockPlexLibrary as unknown as IPlexLibrary,
                getNowPlayingInfo: (): INowPlayingInfoOverlay =>
                    ({
                        setAutoHideMs: jest.fn(),
                        update: jest.fn(),
                        isVisible: (): boolean => false,
                    }) as unknown as INowPlayingInfoOverlay,
                getNowPlayingInfoConfig: (): NowPlayingInfoConfig | null => configWithPosterSizes.nowPlayingInfoConfig,
                buildPlexResourceUrl: (): null => null,
                buildDebugText: (): string | null => null,
                maybeFetchStreamDecisionForDebugHud: (): Promise<void> => Promise.resolve(),
                getAutoHideMs: (): number => 0,
                getCurrentProgramForPlayback: (): null => null,
                getPlaybackInfoSnapshot: (): { stream: null } => ({ stream: null }),
                refreshPlaybackInfoSnapshot: (): Promise<{ stream: null }> =>
                    Promise.resolve({ stream: null }),
            });
            coordinator.onProgramStart(program as unknown as ScheduledProgram);

            expect(mockPlexLibrary.getImageUrl).toHaveBeenCalledWith('/thumb', 111, 222);
        });
    });

    describe('nowPlayingInfo autoHideMs wiring', () => {
        const baseProgram = {
            item: {
                ratingKey: 'rk1',
                title: 'Test Movie',
                durationMs: 120_000,
                type: 'movie',
                fullTitle: null,
                year: 2024,
                contentRating: 'PG',
                thumb: '/thumb',
            },
            scheduledStartTime: Date.now(),
            scheduledEndTime: Date.now() + 120_000,
            elapsedMs: 0,
            remainingMs: 120_000,
            scheduleIndex: 0,
            loopNumber: 0,
            streamDescriptor: null,
            isCurrent: true,
        };

        it('applies stored autoHideMs when opening now playing modal', async () => {
            const configWithAutoHide: OrchestratorConfig = {
                ...mockConfig,
                nowPlayingInfoConfig: {
                    ...mockConfig.nowPlayingInfoConfig,
                    autoHideMs: 15_000,
                },
            };

            mockLocalStorage.getItem.mockImplementation((key: string) =>
                key === LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS ? '0' : null
            );
            await orchestrator.initialize(configWithAutoHide);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            await orchestrator.start();

            mockScheduler.getCurrentProgram.mockReturnValue(baseProgram);
            mockNavigation.isModalOpen.mockImplementation((modalId?: string) => modalId === 'now-playing-info');

            const modalOpen = navHandlers.modalOpen as (payload: unknown) => void;
            modalOpen({ modalId: 'now-playing-info' });

            const nowPlayingModule = require('../modules/ui/now-playing-info');
            const instance = (nowPlayingModule.NowPlayingInfoOverlay as jest.Mock).mock.results[0]?.value;
            expect(instance.setAutoHideMs).toHaveBeenCalledWith(0);

            const modalClose = navHandlers.modalClose as (payload: unknown) => void;
            modalClose({ modalId: 'now-playing-info' });
        });

        it('falls back to config autoHideMs when stored value is invalid', async () => {
            const configWithAutoHide: OrchestratorConfig = {
                ...mockConfig,
                nowPlayingInfoConfig: {
                    ...mockConfig.nowPlayingInfoConfig,
                    autoHideMs: 15_000,
                },
            };

            mockLocalStorage.getItem.mockImplementation((key: string) =>
                key === LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS ? '0x0' : null
            );
            await orchestrator.initialize(configWithAutoHide);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            await orchestrator.start();

            mockScheduler.getCurrentProgram.mockReturnValue(baseProgram);
            mockNavigation.isModalOpen.mockImplementation((modalId?: string) => modalId === 'now-playing-info');

            const modalOpen = navHandlers.modalOpen as (payload: unknown) => void;
            modalOpen({ modalId: 'now-playing-info' });

            const nowPlayingModule = require('../modules/ui/now-playing-info');
            const instance = (nowPlayingModule.NowPlayingInfoOverlay as jest.Mock).mock.results[0]?.value;
            expect(instance.setAutoHideMs).toHaveBeenCalledWith(15_000);

            const modalClose = navHandlers.modalClose as (payload: unknown) => void;
            modalClose({ modalId: 'now-playing-info' });
        });
    });

    describe('selectServer', () => {
        it('clears EPG schedules and refreshes after selecting a new server', async () => {
            await orchestrator.initialize(mockConfig);

            const clearSpy = jest.spyOn(EPGCoordinator.prototype, 'clearScheduleCaches');
            const primeSpy = jest.spyOn(EPGCoordinator.prototype, 'primeEpgChannels');
            const refreshSpy = jest
                .spyOn(EPGCoordinator.prototype, 'refreshEpgSchedules')
                .mockResolvedValue(undefined);
            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockResolvedValue(undefined);

            try {
                mockPlexDiscovery.selectServer.mockResolvedValue({ kind: 'selected' });
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));

                await expect(orchestrator.selectServer('server-1')).resolves.toEqual({
                    kind: 'selected',
                    readiness: 'startup_pending',
                    persistedSelection: 'updated',
                    startupResume: {
                        startup: 'completed',
                        epgRefresh: { kind: 'succeeded' },
                    },
                });

                expect(mockPlexDiscovery.selectServer).toHaveBeenCalledWith('server-1');
                expect(runStartupSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
                expect(clearSpy).toHaveBeenCalled();
                expect(mockEpg.clearSchedules).toHaveBeenCalled();
                expect(primeSpy).toHaveBeenCalled();
                expect(refreshSpy).toHaveBeenCalledWith({ reason: 'server-swap' });
            } finally {
                clearSpy.mockRestore();
                primeSpy.mockRestore();
                refreshSpy.mockRestore();
                runStartupSpy.mockRestore();
            }
        });

        it('logs post-selection EPG refresh failures without failing server selection', async () => {
            await orchestrator.initialize(mockConfig);

            const refreshError = new Error('refresh failed');
            expectConsoleWarn([
                'Post-selection EPG refresh failed',
                expect.objectContaining({
                    step: 'refreshEpgSchedules',
                    safeError: expect.objectContaining({
                        message: 'refresh failed',
                    }),
                }),
            ]);
            const refreshSpy = jest
                .spyOn(EPGCoordinator.prototype, 'refreshEpgSchedules')
                .mockRejectedValue(refreshError);
            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockResolvedValue(undefined);

            try {
                mockPlexDiscovery.selectServer.mockResolvedValue({ kind: 'selected' });
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));

                await expect(orchestrator.selectServer('server-1')).resolves.toEqual({
                    kind: 'selected',
                    readiness: 'startup_pending',
                    persistedSelection: 'updated',
                    startupResume: {
                        startup: 'completed',
                        epgRefresh: { kind: 'failed', error: refreshError },
                    },
                });

                expect(runStartupSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
                expect(refreshSpy).toHaveBeenCalledWith({ reason: 'server-swap' });
            } finally {
                refreshSpy.mockRestore();
                runStartupSpy.mockRestore();
            }
        });

        it('returns selection_failed when discovery reports server_not_found', async () => {
            await orchestrator.initialize(mockConfig);

            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockResolvedValue(undefined);
            mockPlexDiscovery.selectServer.mockResolvedValue({ kind: 'server_not_found' });

            try {
                await expect(orchestrator.selectServer('missing-server')).resolves.toEqual({
                    kind: 'selection_failed',
                    reason: 'server_not_found',
                });
                expect(mockPlexAuth.readStoredCredentialsAndClearCorruption).not.toHaveBeenCalled();
                expect(mockPlexAuth.storeCredentials).not.toHaveBeenCalled();
                expect(runStartupSpy).not.toHaveBeenCalled();
            } finally {
                mockPlexDiscovery.getSelectedServer.mockReturnValue(null);
                mockPlexDiscovery.getServerUri.mockReturnValue('http://localhost:32400');
                runStartupSpy.mockRestore();
            }
        });

        it('returns selection_failed when discovery reports connection_unavailable', async () => {
            await orchestrator.initialize(mockConfig);

            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockResolvedValue(undefined);
            mockPlexDiscovery.selectServer.mockResolvedValue({
                kind: 'connection_unavailable',
                reason: 'auth_required',
            });

            try {
                await expect(orchestrator.selectServer('server-1')).resolves.toEqual({
                    kind: 'selection_failed',
                    reason: 'auth_required',
                });
                expect(mockPlexAuth.readStoredCredentialsAndClearCorruption).not.toHaveBeenCalled();
                expect(mockPlexAuth.storeCredentials).not.toHaveBeenCalled();
                expect(runStartupSpy).not.toHaveBeenCalled();
            } finally {
                runStartupSpy.mockRestore();
            }
        });

        it('reports skipped_missing_credentials when selected-server persistence has no stored auth', async () => {
            await orchestrator.initialize(mockConfig);

            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockResolvedValue(undefined);
            mockPlexDiscovery.selectServer.mockResolvedValue({ kind: 'selected' });
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({ kind: 'missing' });

            try {
                await expect(orchestrator.selectServer('server-1')).resolves.toEqual({
                    kind: 'selected',
                    readiness: 'startup_pending',
                    persistedSelection: 'skipped_missing_credentials',
                    startupResume: {
                        startup: 'completed',
                        epgRefresh: { kind: 'succeeded' },
                    },
                });
                expect(mockPlexAuth.storeCredentials).not.toHaveBeenCalled();
                expect(runStartupSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
            } finally {
                runStartupSpy.mockRestore();
            }
        });

        it('does not rewrite persisted selected-server state when stored auth is corrupted', async () => {
            await orchestrator.initialize(mockConfig);

            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockResolvedValue(undefined);
            mockPlexDiscovery.selectServer.mockResolvedValue({ kind: 'selected' });
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({
                kind: 'corrupted',
                reason: 'invalid-json',
            });

            try {
                await expect(orchestrator.selectServer('server-1')).resolves.toEqual({
                    kind: 'selected',
                    readiness: 'startup_pending',
                    persistedSelection: 'skipped_corrupted_credentials',
                    startupResume: {
                        startup: 'completed',
                        epgRefresh: { kind: 'succeeded' },
                    },
                });
                expect(mockPlexAuth.storeCredentials).not.toHaveBeenCalled();
                expect(runStartupSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
            } finally {
                runStartupSpy.mockRestore();
            }
        });

        it('restores the discovery snapshot when selected-server persistence rejects', async () => {
            await orchestrator.initialize(mockConfig);

            const persistedSelectionError = new Error('selected-server persistence failed');
            const discoverySnapshot = {
                server: { id: 'server-prev' },
                connection: { uri: 'http://previous.example' },
                storedServerId: 'server-prev',
            };
            const storedCredentials = createStoredCredentials('valid-token');
            if (storedCredentials.kind !== 'available') {
                throw new Error('Expected available stored credentials in test setup');
            }
            storedCredentials.credentials.selectedServerByUserId['user-1'] = {
                serverId: 'server-prev',
                serverUri: 'http://previous.example',
            };

            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockResolvedValue(undefined);
            mockPlexDiscovery.captureSelectedServerSnapshot.mockReturnValue(discoverySnapshot);
            mockPlexDiscovery.selectServer.mockResolvedValue({ kind: 'selected' });
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(storedCredentials);
            mockPlexAuth.storeCredentials.mockImplementation(() => { throw persistedSelectionError; });

            try {
                await expect(orchestrator.selectServer('server-1')).rejects.toBe(persistedSelectionError);

                expect(mockPlexDiscovery.restoreSelectedServerSnapshot).toHaveBeenCalledWith(discoverySnapshot);
                expect(mockPlexAuth.storeCredentials).toHaveBeenCalledTimes(1);
                expect(runStartupSpy).not.toHaveBeenCalled();
            } finally {
                runStartupSpy.mockRestore();
            }
        });

        it('restores discovery and active-user persisted selection when startup resume fails after persistence', async () => {
            await orchestrator.initialize(mockConfig);

            const resumeError = new Error('startup resume failed');
            expectConsoleWarn([
                'Post-selection runtime swap failed',
                expect.objectContaining({
                    step: 'runStartup',
                    safeError: expect.objectContaining({
                        message: 'startup resume failed',
                    }),
                }),
            ]);
            const discoverySnapshot = {
                server: { id: 'server-prev' },
                connection: { uri: 'http://previous.example' },
                storedServerId: 'server-prev',
            };
            const storedCredentials = createStoredCredentials('valid-token');
            if (storedCredentials.kind !== 'available') {
                throw new Error('Expected available stored credentials in test setup');
            }
            storedCredentials.credentials.selectedServerByUserId['user-1'] = {
                serverId: 'server-prev',
                serverUri: 'http://previous.example',
            };

            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockRejectedValue(resumeError);
            mockPlexDiscovery.captureSelectedServerSnapshot.mockReturnValue(discoverySnapshot);
            mockPlexDiscovery.selectServer.mockResolvedValue({ kind: 'selected' });
            mockPlexDiscovery.getServerUri.mockReturnValue('http://next.example');
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(storedCredentials);

            try {
                await expect(orchestrator.selectServer('server-1')).rejects.toBe(resumeError);

                expect(mockPlexDiscovery.restoreSelectedServerSnapshot).toHaveBeenCalledWith(discoverySnapshot);
                expect(mockPlexAuth.storeCredentials).toHaveBeenNthCalledWith(
                    1,
                    expect.objectContaining({
                        selectedServerByUserId: expect.objectContaining({
                            'user-1': { serverId: 'server-1', serverUri: 'http://next.example' },
                        }),
                    })
                );
                expect(mockPlexAuth.storeCredentials).toHaveBeenNthCalledWith(
                    2,
                    expect.objectContaining({
                        selectedServerByUserId: expect.objectContaining({
                            'user-1': { serverId: 'server-prev', serverUri: 'http://previous.example' },
                        }),
                    })
                );
            } finally {
                runStartupSpy.mockRestore();
            }
        });

        it('does not synthesize persisted selection from discovery when rolling back a missing-credentials snapshot', async () => {
            await orchestrator.initialize(mockConfig);

            const resumeError = new Error('startup resume failed');
            expectConsoleWarn([
                'Post-selection runtime swap failed',
                expect.objectContaining({
                    step: 'runStartup',
                    safeError: expect.objectContaining({
                        message: 'startup resume failed',
                    }),
                }),
            ]);
            const discoverySnapshot = {
                server: { id: 'server-prev' },
                connection: { uri: 'http://previous.example' },
                storedServerId: 'server-prev',
            };
            const nextCredentials = createStoredCredentials('valid-token');
            mockPlexDiscovery.captureSelectedServerSnapshot.mockReturnValue(discoverySnapshot);
            mockPlexDiscovery.selectServer.mockResolvedValue({ kind: 'selected' });
            mockPlexDiscovery.getServerUri.mockReturnValue('http://next.example');
            mockPlexAuth.readStoredCredentialsAndClearCorruption
                .mockReturnValueOnce({ kind: 'missing' })
                .mockReturnValueOnce(nextCredentials);
            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockRejectedValue(resumeError);

            try {
                await expect(orchestrator.selectServer('server-1')).rejects.toBe(resumeError);

                expect(mockPlexDiscovery.restoreSelectedServerSnapshot).toHaveBeenCalledWith(discoverySnapshot);
                expect(mockPlexAuth.storeCredentials).toHaveBeenCalledTimes(1);
                expect(mockPlexAuth.storeCredentials).toHaveBeenCalledWith(
                    expect.objectContaining({
                        selectedServerByUserId: expect.objectContaining({
                            'user-1': { serverId: 'server-1', serverUri: 'http://next.example' },
                        }),
                    })
                );
                expect(mockPlexAuth.readStoredCredentialsAndClearCorruption).toHaveBeenCalledTimes(2);
            } finally {
                mockPlexDiscovery.getSelectedServer.mockReturnValue(null);
                mockPlexDiscovery.getServerUri.mockReturnValue('http://localhost:32400');
                runStartupSpy.mockRestore();
            }
        });

        it('clears discovery selection and persisted selected-server state', async () => {
            await orchestrator.initialize(mockConfig);
            const storedCredentials = createStoredCredentials('valid-token');
            if (storedCredentials.kind !== 'available') {
                throw new Error('Expected available stored credentials in test setup');
            }
            storedCredentials.credentials.selectedServerByUserId['user-1'] = {
                serverId: 'server-123',
                serverUri: 'http://example',
            };
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(storedCredentials);

            await orchestrator.clearSelectedServer();

            expect(mockPlexDiscovery.clearSelection).toHaveBeenCalledTimes(1);
            expect(mockPlexAuth.storeCredentials).toHaveBeenCalledWith(expect.objectContaining({
                activeUserId: 'user-1',
                selectedServerByUserId: expect.objectContaining({
                    'user-1': { serverId: null, serverUri: null },
                }),
            }));
        });

        it('propagates selected-server clear persistence failures without clearing discovery selection', async () => {
            const persistenceError = new Error('store failed');
            await orchestrator.initialize(mockConfig);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.storeCredentials.mockImplementationOnce(() => { throw persistenceError; });

            await expect(orchestrator.clearSelectedServer()).rejects.toBe(persistenceError);

            expect(mockPlexAuth.storeCredentials).toHaveBeenCalledTimes(1);
            expect(mockPlexDiscovery.clearSelection).not.toHaveBeenCalled();
        });
    });

    describe('schedule day rollover', () => {
        it('clears the selected-channel snapshot and rebuilds the active schedule before refreshing EPG schedules on day rollover', async () => {
            await orchestrator.initialize(mockConfig);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            await orchestrator.start();

            const epgRefreshSequence: string[] = [];
            const originalClearSelectedSnapshot = EPGCoordinator.prototype.clearSelectedChannelScheduleSnapshot;
            const clearSelectedSnapshotSpy = jest
                .spyOn(EPGCoordinator.prototype, 'clearSelectedChannelScheduleSnapshot')
                .mockImplementation(function (this: EPGCoordinator) {
                    epgRefreshSequence.push('clearSelectedChannelScheduleSnapshot');
                    return originalClearSelectedSnapshot.call(this);
                });
            const refreshSpy = jest
                .spyOn(EPGCoordinator.prototype, 'refreshEpgSchedules')
                .mockImplementation(async () => {
                    epgRefreshSequence.push('refreshEpgSchedules');
                });
            const nowSpy = jest.spyOn(Date, 'now');
            try {
                nowSpy.mockReturnValue(new Date('2026-03-18T12:00:00.000Z').getTime());
                mockScheduler.getCurrentProgram.mockReturnValue(null);
                mockChannelManager.getCurrentChannel.mockReturnValue(mockChannel);
                mockChannelManager.resolveChannelContent.mockResolvedValue({
                    channelId: mockChannel.id,
                    items: [],
                    orderedItems: [],
                    totalDurationMs: 0,
                    resolvedAt: Date.now(),
                });

                await orchestrator.switchToChannel(mockChannel.id);
                nowSpy.mockReturnValue(new Date('2026-03-19T12:00:00.000Z').getTime());
                schedulerHandlers.scheduleSync?.();
                await Promise.resolve();
                await Promise.resolve();

                expect(mockChannelManager.resolveChannelContent).toHaveBeenCalledWith(mockChannel.id);
                expect(mockScheduler.loadChannel).toHaveBeenCalled();
                expect(refreshSpy).toHaveBeenCalledTimes(1);
                expect(epgRefreshSequence).toEqual([
                    'clearSelectedChannelScheduleSnapshot',
                    'refreshEpgSchedules',
                ]);
            } finally {
                nowSpy.mockRestore();
                clearSelectedSnapshotSpy.mockRestore();
                refreshSpy.mockRestore();
            }
        });
    });

    describe('profile switching', () => {
        beforeEach(() => {
            mockVideoPlayer.stop.mockClear();
            mockScheduler.unloadChannel.mockClear();
            mockPlexStreamResolver.stopTranscodeSession.mockClear();
        });

        it('prepares the coordinator for switchHomeUser before the auth mutation and resumes startup afterward', async () => {
            await orchestrator.initialize(mockConfig);

            const profileSwitchSequence: string[] = [];
            const originalPrepareForProfileSwitchAttempt = InitializationCoordinator.prototype.prepareForProfileSwitchAttempt;
            const prepareForProfileSwitchAttemptSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'prepareForProfileSwitchAttempt')
                .mockImplementation(function (this: InitializationCoordinator) {
                    profileSwitchSequence.push('prepareForProfileSwitchAttempt');
                    return originalPrepareForProfileSwitchAttempt.call(this);
                });
            const resumeStartupAfterProfileSwitchSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'resumeStartupAfterProfileSwitch')
                .mockImplementation(async () => {
                    profileSwitchSequence.push('resumeStartupAfterProfileSwitch');
                });

            try {
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
                mockPlexAuth.validateToken.mockResolvedValue(true);
                mockPlexDiscovery.isConnected.mockReturnValue(true);

                await orchestrator.start();

                expect(schedulerHandlers.programStart).toBeDefined();
                prepareForProfileSwitchAttemptSpy.mockClear();
                resumeStartupAfterProfileSwitchSpy.mockClear();
                profileSwitchSequence.length = 0;
                mockPlexAuth.switchHomeUser.mockClear();
                mockVideoPlayer.stop.mockClear();
                mockScheduler.unloadChannel.mockClear();
                mockPlexStreamResolver.stopTranscodeSession.mockClear();
                mockPlexAuth.switchHomeUser.mockImplementationOnce(async () => {
                    profileSwitchSequence.push('switchHomeUser');
                });

                mockPlexStreamResolver.resolveStream.mockResolvedValueOnce(
                    makeDecision({ isTranscoding: true, sessionId: 'profile-switch-session' })
                );
                const nowPlayingProgram = {
                    item: {
                        ratingKey: 'item-1',
                        title: 'Test Item',
                        durationMs: 60_000,
                        type: 'movie',
                        fullTitle: null,
                        year: 2024,
                        contentRating: 'PG',
                        thumb: '/thumb',
                    },
                    elapsedMs: 5_000,
                    scheduledStartTime: Date.now(),
                    scheduledEndTime: Date.now() + 60_000,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: true,
                };
                schedulerHandlers.programStart?.(nowPlayingProgram as unknown as ScheduledProgram);
                await new Promise((resolve) => setImmediate(resolve));

                await orchestrator.switchHomeUser('user-2', '1234');

                expect(prepareForProfileSwitchAttemptSpy).toHaveBeenCalledTimes(1);
                expect(mockPlexAuth.switchHomeUser).toHaveBeenCalledWith('user-2', { pin: '1234' });
                expect(mockNavigation.goTo).toHaveBeenCalledWith('splash');
                expect(resumeStartupAfterProfileSwitchSpy).toHaveBeenCalledTimes(1);
                expect(mockVideoPlayer.stop).toHaveBeenCalled();
                expect(mockScheduler.unloadChannel).toHaveBeenCalledTimes(1);
                expect(mockPlexStreamResolver.stopTranscodeSession).toHaveBeenCalledWith('profile-switch-session');
                expect(profileSwitchSequence).toEqual([
                    'prepareForProfileSwitchAttempt',
                    'switchHomeUser',
                    'resumeStartupAfterProfileSwitch',
                ]);
            } finally {
                prepareForProfileSwitchAttemptSpy.mockRestore();
                resumeStartupAfterProfileSwitchSpy.mockRestore();
            }
        });

        it('reports PlexServerDiscovery as the missing dependency when profile switching runs without discovery', async () => {
            await orchestrator.initialize(mockConfig);

            Reflect.set(orchestrator as object, '_plexDiscovery', null);

            await expect(orchestrator.switchHomeUser('user-2')).rejects.toMatchObject({
                code: AppErrorCode.MODULE_INIT_FAILED,
                recoverable: true,
                message: expect.stringContaining('PlexServerDiscovery not initialized'),
                context: expect.objectContaining({
                    method: 'switchHomeUser',
                    dependency: 'PlexServerDiscovery',
                }),
            });

            await expect(orchestrator.useMainAccountProfile()).rejects.toMatchObject({
                code: AppErrorCode.MODULE_INIT_FAILED,
                recoverable: true,
                message: expect.stringContaining('PlexServerDiscovery not initialized'),
                context: expect.objectContaining({
                    method: 'useMainAccountProfile',
                    dependency: 'PlexServerDiscovery',
                }),
            });
        });

        it('prepares the coordinator for useMainAccountProfile before logout and resumes startup afterward', async () => {
            await orchestrator.initialize(mockConfig);

            const profileSwitchSequence: string[] = [];
            const originalPrepareForProfileSwitchAttempt = InitializationCoordinator.prototype.prepareForProfileSwitchAttempt;
            const prepareForProfileSwitchAttemptSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'prepareForProfileSwitchAttempt')
                .mockImplementation(function (this: InitializationCoordinator) {
                    profileSwitchSequence.push('prepareForProfileSwitchAttempt');
                    return originalPrepareForProfileSwitchAttempt.call(this);
                });
            const resumeStartupAfterProfileSwitchSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'resumeStartupAfterProfileSwitch')
                .mockImplementation(async () => {
                    profileSwitchSequence.push('resumeStartupAfterProfileSwitch');
                });

            try {
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
                mockPlexAuth.validateToken.mockResolvedValue(true);
                mockPlexDiscovery.isConnected.mockReturnValue(true);

                await orchestrator.start();

                expect(schedulerHandlers.programStart).toBeDefined();
                prepareForProfileSwitchAttemptSpy.mockClear();
                resumeStartupAfterProfileSwitchSpy.mockClear();
                profileSwitchSequence.length = 0;
                mockPlexAuth.logoutActiveUser.mockClear();
                mockVideoPlayer.stop.mockClear();
                mockScheduler.unloadChannel.mockClear();
                mockPlexStreamResolver.stopTranscodeSession.mockClear();
                mockPlexAuth.logoutActiveUser.mockImplementationOnce(async () => {
                    profileSwitchSequence.push('logoutActiveUser');
                });

                mockPlexStreamResolver.resolveStream.mockResolvedValueOnce(
                    makeDecision({ isTranscoding: true, sessionId: 'main-profile-session' })
                );
                const nowPlayingProgram = {
                    item: {
                        ratingKey: 'item-2',
                        title: 'Another Item',
                        durationMs: 60_000,
                        type: 'movie',
                        fullTitle: null,
                        year: 2024,
                        contentRating: 'PG',
                        thumb: '/thumb',
                    },
                    elapsedMs: 5_000,
                    scheduledStartTime: Date.now(),
                    scheduledEndTime: Date.now() + 60_000,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: true,
                };
                schedulerHandlers.programStart?.(nowPlayingProgram as unknown as ScheduledProgram);
                await new Promise((resolve) => setImmediate(resolve));

                await orchestrator.useMainAccountProfile();

                expect(prepareForProfileSwitchAttemptSpy).toHaveBeenCalledTimes(1);
                expect(mockPlexAuth.logoutActiveUser).toHaveBeenCalledTimes(1);
                expect(mockNavigation.goTo).toHaveBeenCalledWith('splash');
                expect(resumeStartupAfterProfileSwitchSpy).toHaveBeenCalledTimes(1);
                expect(mockVideoPlayer.stop).toHaveBeenCalled();
                expect(mockScheduler.unloadChannel).toHaveBeenCalledTimes(1);
                expect(mockPlexStreamResolver.stopTranscodeSession).toHaveBeenCalledWith('main-profile-session');
                expect(profileSwitchSequence).toEqual([
                    'prepareForProfileSwitchAttempt',
                    'logoutActiveUser',
                    'resumeStartupAfterProfileSwitch',
                ]);
            } finally {
                prepareForProfileSwitchAttemptSpy.mockRestore();
                resumeStartupAfterProfileSwitchSpy.mockRestore();
            }
        });

        it('does not reset channel state when switchHomeUser fails', async () => {
            await orchestrator.initialize(mockConfig);

            mockPlexAuth.switchHomeUser.mockRejectedValueOnce(new Error('switch failed'));
            const prepareForProfileSwitchAttemptSpy = jest.spyOn(
                InitializationCoordinator.prototype,
                'prepareForProfileSwitchAttempt'
            );
            const resumeStartupAfterProfileSwitchSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'resumeStartupAfterProfileSwitch')
                .mockResolvedValue(undefined);

            try {
                await expect(orchestrator.switchHomeUser('user-2')).rejects.toThrow('switch failed');

                expect(prepareForProfileSwitchAttemptSpy).toHaveBeenCalledTimes(1);
                expect(mockNavigation.goTo).not.toHaveBeenCalledWith('splash');
                expect(resumeStartupAfterProfileSwitchSpy).not.toHaveBeenCalled();
                expect(mockVideoPlayer.stop).toHaveBeenCalledTimes(1);
                expect(mockScheduler.unloadChannel).not.toHaveBeenCalled();
            } finally {
                prepareForProfileSwitchAttemptSpy.mockRestore();
                resumeStartupAfterProfileSwitchSpy.mockRestore();
            }
        });

        it('restores pending server resume after a failed profile switch from server-select', async () => {
            const connectionChangeListeners = new Set<(uri: string | null) => void>();
            (mockPlexDiscovery.on as jest.Mock).mockImplementation(
                (event: string, handler: (uri: string | null) => void) => {
                    if (event !== 'connectionChange') {
                        return { dispose: jest.fn() };
                    }

                    connectionChangeListeners.add(handler);
                    return {
                        dispose: jest.fn(() => {
                            connectionChangeListeners.delete(handler);
                        }),
                    };
                }
            );

            await orchestrator.initialize(mockConfig);

            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(false);

            await orchestrator.start();
            expect(connectionChangeListeners.size).toBe(1);

            mockPlexAuth.switchHomeUser.mockRejectedValueOnce(new Error('switch failed'));
            const runStartupSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'runStartup')
                .mockResolvedValue(undefined);

            try {
                await expect(orchestrator.switchHomeUser('user-2')).rejects.toThrow('switch failed');

                expect(connectionChangeListeners.size).toBe(1);

                const [listener] = [...connectionChangeListeners];
                listener?.('http://server.example');
                await Promise.resolve();

                expect(runStartupSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
            } finally {
                runStartupSpy.mockRestore();
            }
        });

        it('does not reset channel state when useMainAccountProfile fails', async () => {
            await orchestrator.initialize(mockConfig);

            mockPlexAuth.logoutActiveUser.mockRejectedValueOnce(new Error('logout failed'));
            const prepareForProfileSwitchAttemptSpy = jest.spyOn(
                InitializationCoordinator.prototype,
                'prepareForProfileSwitchAttempt'
            );
            const resumeStartupAfterProfileSwitchSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'resumeStartupAfterProfileSwitch')
                .mockResolvedValue(undefined);

            try {
                await expect(orchestrator.useMainAccountProfile()).rejects.toThrow('logout failed');

                expect(prepareForProfileSwitchAttemptSpy).toHaveBeenCalledTimes(1);
                expect(mockNavigation.goTo).not.toHaveBeenCalledWith('splash');
                expect(resumeStartupAfterProfileSwitchSpy).not.toHaveBeenCalled();
                expect(mockScheduler.unloadChannel).not.toHaveBeenCalled();
            } finally {
                prepareForProfileSwitchAttemptSpy.mockRestore();
                resumeStartupAfterProfileSwitchSpy.mockRestore();
            }
        });

        it('fails before mutating auth state when switchHomeUser is called without an initialization coordinator', async () => {
            await orchestrator.initialize(mockConfig);

            Reflect.set(orchestrator as object, '_initCoordinator', null);

            await expect(orchestrator.switchHomeUser('user-2')).rejects.toThrow(
                'InitializationCoordinator not initialized'
            );
            expect(mockPlexAuth.switchHomeUser).not.toHaveBeenCalled();
        });

        it('fails before logging out when useMainAccountProfile is called without an initialization coordinator', async () => {
            await orchestrator.initialize(mockConfig);

            Reflect.set(orchestrator as object, '_initCoordinator', null);

            await expect(orchestrator.useMainAccountProfile()).rejects.toThrow(
                'InitializationCoordinator not initialized'
            );
            expect(mockPlexAuth.logoutActiveUser).not.toHaveBeenCalled();
        });
    });

    describe('start', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({ kind: 'missing' });
        });

        it('should initialize modules in correct phase order', async () => {
            const initOrder: string[] = [];

            mockLifecycle.initialize.mockImplementation(async () => {
                initOrder.push('lifecycle');
            });
            mockNavigation.initialize.mockImplementation(async () => {
                initOrder.push('navigation');
            });
            mockPlexAuth.validateToken.mockImplementation(async () => {
                initOrder.push('plex-auth');
                return true;
            });
            mockPlexDiscovery.initialize.mockImplementation(async () => {
                initOrder.push('plex-discovery');
            });

            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('test-token'));

            await orchestrator.start();

            // Core infrastructure (lifecycle, navigation) should be before auth validation
            const lifecycleIdx = initOrder.indexOf('lifecycle');
            const navIdx = initOrder.indexOf('navigation');
            const authIdx = initOrder.indexOf('plex-auth');
            const discoveryIdx = initOrder.indexOf('plex-discovery');

            // Lifecycle and navigation initialize together before auth
            expect(lifecycleIdx).toBeLessThan(authIdx);
            expect(navIdx).toBeLessThan(authIdx);
            // Auth validation runs before server discovery
            expect(authIdx).toBeLessThan(discoveryIdx);
        });

        it('should navigate to auth if no saved credentials', async () => {
            mockLifecycle.restoreState.mockResolvedValue(null);

            await orchestrator.start();

            expect(mockNavigation.goTo).toHaveBeenCalledWith('auth');
        });

        it('routes corrupted stored credentials to auth without token validation', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({
                kind: 'corrupted',
                reason: 'invalid-json',
            });

            await orchestrator.start();

            expect(mockNavigation.goTo).toHaveBeenCalledWith('auth');
            expect(mockPlexAuth.validateToken).not.toHaveBeenCalled();
        });

        it('should validate token and proceed if valid', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);

            await orchestrator.start();

            expect(mockPlexAuth.validateToken).toHaveBeenCalledWith('valid-token');
            expect(mockNavigation.replaceScreen).toHaveBeenCalledWith('player');
        });

        it('routes to audio-setup before channel-setup when audio setup is incomplete', async () => {
            const readSpy = jest
                .spyOn(AudioSettingsStore.prototype, 'readAudioSetupCompleteAndClean')
                .mockReturnValue(false);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });
            mockChannelManager.getAllChannels.mockReturnValue([]);
            mockLocalStorage.getItem.mockImplementation((key: string) => {
                if (key === 'lineup_channel_setup_v2:server-1') return null;
                if (key === 'lineup_channels_server_v1:server-1:user-1') return null;
                return null;
            });

            try {
                await orchestrator.start();

                expect(mockNavigation.replaceScreen).toHaveBeenCalledWith('audio-setup');
                expect(mockNavigation.replaceScreen).not.toHaveBeenCalledWith('channel-setup');
                expect(mockNavigation.replaceScreen).not.toHaveBeenCalledWith('player');
            } finally {
                readSpy.mockRestore();
            }
        });

        it('should navigate to auth if token invalid', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('invalid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(false);

            await orchestrator.start();

            expect(mockNavigation.goTo).toHaveBeenCalledWith('auth');
        });

        it('should navigate to server-select if server connection fails', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(false);

            await orchestrator.start();

            expect(mockNavigation.goTo).toHaveBeenCalledWith('server-select');
        });

        it('should be ready after successful start', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);

            await orchestrator.start();

            expect(orchestrator.isReady()).toBe(true);
        });

        it('should defer EPG initialization until the warmup timer fires', async () => {
            jest.useFakeTimers();
            const ensureEpgInitializedSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'ensureEPGInitialized')
                .mockResolvedValue(undefined);

            try {
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
                mockPlexAuth.validateToken.mockResolvedValue(true);
                mockPlexDiscovery.isConnected.mockReturnValue(true);

                await orchestrator.start();

                expect(ensureEpgInitializedSpy).not.toHaveBeenCalled();

                await jest.advanceTimersByTimeAsync(1500);

                expect(ensureEpgInitializedSpy).toHaveBeenCalledTimes(1);
            } finally {
                ensureEpgInitializedSpy.mockRestore();
                jest.useRealTimers();
            }
        });

        it('should call requestMediaSession once after player initialization', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);

            let releasePlayerInitialization = (): void => undefined;
            mockVideoPlayer.initialize.mockImplementationOnce(
                async () =>
                    new Promise<void>((resolve) => {
                        releasePlayerInitialization = resolve;
                    })
            );

            const startPromise = orchestrator.start();
            await new Promise((resolve) => setImmediate(resolve));

            expect(mockVideoPlayer.initialize).toHaveBeenCalledTimes(1);
            expect(mockVideoPlayer.requestMediaSession).not.toHaveBeenCalled();

            releasePlayerInitialization();
            await startPromise;

            expect(mockVideoPlayer.requestMediaSession).toHaveBeenCalledTimes(1);
        });

        it('should proceed without auth UI when stored credentials exist', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);

            await orchestrator.start();

            expect(mockPlexAuth.validateToken).toHaveBeenCalledWith('valid-token');
            expect(mockNavigation.replaceScreen).toHaveBeenCalledWith('player');
            expect(mockNavigation.replaceScreen).not.toHaveBeenCalledWith('auth');
        });

        it('should navigate to channel-setup when channels are empty and setup is missing', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });
            mockChannelManager.getAllChannels.mockReturnValue([]);
            mockLocalStorage.getItem.mockImplementation((key: string) => {
                if (key === 'lineup_audio_setup_complete') return '1';
                if (key === 'lineup_channel_setup_v2:server-1') return null;
                if (key === 'lineup_channels_server_v1:server-1:user-1') return null;
                return null;
            });

            await orchestrator.start();

            expect(mockNavigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
            expect(mockNavigation.replaceScreen).not.toHaveBeenCalledWith('player');
        });

        it('should rerun setup when switching to a new server without setup record', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-2' });
            mockChannelManager.getAllChannels.mockReturnValue([mockChannel]);
            mockLocalStorage.getItem.mockImplementation((key: string) => {
                if (key === 'lineup_audio_setup_complete') return '1';
                if (key === 'lineup_channels_server_v1:server-1:user-1') return 'server-1';
                return null;
            });

            await orchestrator.start();

            expect(mockNavigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
            expect(mockChannelManager.setStorageKeys).toHaveBeenCalledWith(
                'lineup_channels_server_v1:server-2:user-1',
                'lineup_current_channel_v4:server-2:user-1'
            );
        });

        it('should navigate to server-select when auth is valid but no selection restored', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(false);

            await orchestrator.start();

            expect(mockNavigation.goTo).toHaveBeenCalledWith('server-select');
            expect(mockNavigation.goTo).not.toHaveBeenCalledWith('auth');
        });

        it('should wire scheduler, player, and lifecycle events after start', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);

            await orchestrator.start();

            expect(schedulerHandlers.programStart).toBeDefined();
            expect(playerHandlers.ended).toBeDefined();
            expect(playerHandlers.error).toBeDefined();
            expect(pauseHandler).toBeDefined();
            expect(resumeHandler).toBeDefined();

            const program = {
                item: {
                    ratingKey: 'item-1',
                    title: 'Test Item',
                    durationMs: 60000,
                    type: 'movie',
                },
                elapsedMs: 5000,
            };

            schedulerHandlers.programStart?.(program);
            await new Promise((resolve) => setImmediate(resolve));

            expect(mockPlexStreamResolver.resolveStream).toHaveBeenCalledWith(
                expect.objectContaining({
                    itemKey: 'item-1',
                    startOffsetMs: 5000,
                    directPlay: true,
                })
            );
            expect(mockVideoPlayer.loadStream).toHaveBeenCalled();
            expect(mockVideoPlayer.play).toHaveBeenCalled();

            playerHandlers.ended?.();
            expect(mockScheduler.skipToNext).toHaveBeenCalledTimes(1);

            playerHandlers.error?.({
                recoverable: false,
                code: 'PLAYBACK_FAILED',
                message: 'boom',
            });
            expect(mockScheduler.skipToNext).toHaveBeenCalledTimes(2);

            await pauseHandler?.();
            expect(mockVideoPlayer.pause).toHaveBeenCalled();
            expect(mockScheduler.pauseSyncTimer).toHaveBeenCalled();
            expect(mockLifecycle.saveState).toHaveBeenCalled();

            await resumeHandler?.();
            expect(mockScheduler.resumeSyncTimer).toHaveBeenCalled();
            expect(mockScheduler.syncToCurrentTime).toHaveBeenCalled();
            expect(mockVideoPlayer.play).toHaveBeenCalled();
        });

        it('shows a warning toast when setSubtitleTrack fails', async () => {
            expectConsoleWarn([
                'setSubtitleTrack failed',
                expect.objectContaining({
                    trackId: null,
                    safeError: expect.objectContaining({
                        name: 'Error',
                        message: 'boom',
                    }),
                }),
            ]);
            const toastSpy = jest.fn();

            mockVideoPlayer.setSubtitleTrack.mockRejectedValueOnce(new Error('boom'));
            orchestrator.setNowPlayingHandler(toastSpy);

            await orchestrator.setSubtitleTrack(null);

            expect(toastSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'warning', message: expect.any(String) })
            );
        });

        it('uses subtitle mode policy to block burn-in subtitle tracks when mode disallows burn-in', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });
            mockLocalStorage.getItem.mockImplementation((key: string) => {
                if (key === LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE) return '1';
                if (key === LINEUP_STORAGE_KEYS.SUBTITLE_MODE) return 'off';
                return null;
            });

            await orchestrator.start();

            const setSubtitleTrackSpy = jest.spyOn(orchestrator, 'setSubtitleTrack').mockResolvedValue(undefined);
            const burnInSpy = jest
                .spyOn(PlaybackRecoveryManager.prototype, 'attemptBurnInSubtitleForCurrentProgram')
                .mockResolvedValue({ outcome: 'burned_in' });
            try {
                mockVideoPlayer.getAvailableSubtitles.mockReturnValue([{ id: 'sub-1', format: 'ass' }]);

                playerHandlers.trackChange?.({ type: 'subtitle', trackId: 'sub-1' });

                expect(setSubtitleTrackSpy).toHaveBeenCalledWith(null);
                expect(burnInSpy).not.toHaveBeenCalled();
            } finally {
                setSubtitleTrackSpy.mockRestore();
                burnInSpy.mockRestore();
            }
        });

        it('uses subtitle mode policy to allow burn-in subtitle tracks when mode permits burn-in', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });
            mockLocalStorage.getItem.mockImplementation((key: string) => {
                if (key === LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE) return '1';
                if (key === LINEUP_STORAGE_KEYS.SUBTITLE_MODE) return 'full';
                return null;
            });

            await orchestrator.start();

            const setSubtitleTrackSpy = jest.spyOn(orchestrator, 'setSubtitleTrack').mockResolvedValue(undefined);
            const burnInSpy = jest
                .spyOn(PlaybackRecoveryManager.prototype, 'attemptBurnInSubtitleForCurrentProgram')
                .mockResolvedValue({ outcome: 'burned_in' });
            try {
                mockVideoPlayer.getAvailableSubtitles.mockReturnValue([{ id: 'sub-1', format: 'ass' }]);

                playerHandlers.trackChange?.({ type: 'subtitle', trackId: 'sub-1' });

                expect(burnInSpy).toHaveBeenCalledWith('sub-1', 'subtitle_track_change');
                expect(setSubtitleTrackSpy).not.toHaveBeenCalled();
            } finally {
                setSubtitleTrackSpy.mockRestore();
                burnInSpy.mockRestore();
            }
        });

        it('reloads stream when audio track changes during direct play', async () => {
            expectConsoleWarn([
                'playback_recovery',
                expect.objectContaining({
                    event: 'audioReload.start',
                    reason: 'audio_track_change',
                    trackId: 'audio-2',
                    itemKey: 'item-1',
                    preserveDirectPlayPreference: true,
                }),
            ]);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            const program = {
                item: {
                    ratingKey: 'item-1',
                    title: 'Test Item',
                    durationMs: 60_000,
                    type: 'movie',
                },
                elapsedMs: 5_000,
            } as unknown as ScheduledProgram;

            mockPlexStreamResolver.resolveStream
                .mockResolvedValueOnce(makeDecision({ isDirectPlay: true, protocol: 'http' }))
                .mockResolvedValueOnce(
                    makeDecision({
                        isDirectPlay: true,
                        protocol: 'http',
                        playbackUrl: 'http://test/reloaded.m3u8',
                    })
                );

            await orchestrator.start();

            schedulerHandlers.programStart?.(program);
            await new Promise((resolve) => setImmediate(resolve));

            mockPlexStreamResolver.resolveStream.mockClear();
            const loadCallsBefore = mockVideoPlayer.loadStream.mock.calls.length;
            const playCallsBefore = mockVideoPlayer.play.mock.calls.length;

            mockVideoPlayer.getState.mockReturnValueOnce({
                status: 'playing',
                activeAudioId: null,
                activeSubtitleId: null,
            });
            playerHandlers.trackChange?.({ type: 'audio', trackId: 'audio-2' });
            await new Promise((resolve) => setImmediate(resolve));

            expect(mockPlexStreamResolver.resolveStream).toHaveBeenCalledWith(
                expect.objectContaining({
                    audioStreamId: 'audio-2',
                    directPlay: true,
                })
            );
            expect(mockPlexStreamResolver.resolveStream).toHaveBeenCalledTimes(1);
            expect(mockVideoPlayer.loadStream).toHaveBeenCalledTimes(loadCallsBefore + 1);
            expect(mockVideoPlayer.play).toHaveBeenCalledTimes(playCallsBefore + 1);
            const lastLoad = mockVideoPlayer.loadStream.mock.calls.at(-1)?.[0];
            expect(lastLoad?.url).toBe('http://test/reloaded.m3u8');
        });

        it('does not force direct-stream fallback when format is unsupported pre-MVP', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);

            mockPlexStreamResolver.resolveStream.mockResolvedValueOnce({
                playbackUrl: 'http://test/stream.mkv',
                protocol: 'direct',
                container: 'mkv',
            });

            await orchestrator.start();

            const program = {
                item: {
                    ratingKey: 'item-1',
                    title: 'Test Item',
                    durationMs: 60000,
                    type: 'movie',
                },
                elapsedMs: 5000,
            };

            schedulerHandlers.programStart?.(program);
            await new Promise((resolve) => setImmediate(resolve));

            expect(mockPlexStreamResolver.resolveStream).toHaveBeenCalledWith(
                expect.objectContaining({
                    itemKey: 'item-1',
                    startOffsetMs: 5000,
                    directPlay: true,
                })
            );

            playerHandlers.error?.({
                recoverable: false,
                code: 'PLAYBACK_FORMAT_UNSUPPORTED',
                message: 'Media format not supported',
            });

            await new Promise((resolve) => setImmediate(resolve));

            expect(mockPlexStreamResolver.resolveStream).toHaveBeenCalledTimes(1);
            expect(mockPlexStreamResolver.resolveStream).not.toHaveBeenCalledWith(
                expect.objectContaining({ directPlay: false })
            );
            expect(mockVideoPlayer.loadStream).toHaveBeenCalledTimes(1);
            expect(mockVideoPlayer.play).toHaveBeenCalledTimes(1);
        });

    });

    describe('switchToChannel', () => {
        beforeEach(async () => {
            // Reset mocks that may have been modified by previous tests
            mockChannelManager.getChannel.mockReturnValue(mockChannel);
            await orchestrator.initialize(mockConfig);
        });

        it('logs the specific missing modules when channel tuning is unavailable', async () => {
            const warning = expectConsoleWarn([
                'switchToChannel: channel tuning unavailable',
                expect.objectContaining({
                    missingModules: expect.arrayContaining([
                        '_channelTuning',
                        '_channelManager',
                        '_scheduler',
                    ]),
                }),
            ]);

            Reflect.set(orchestrator as object, '_channelTuning', null);
            Reflect.set(orchestrator as object, '_channelManager', null);
            Reflect.set(orchestrator as object, '_scheduler', null);

            await expect(orchestrator.switchToChannel('ch1')).resolves.toBeUndefined();

            const switchPayload = warning.getLastCall()?.[1] as {
                missingModules: string[];
            };
            expect(switchPayload.missingModules).toHaveLength(3);
            expect(mockVideoPlayer.stop).not.toHaveBeenCalled();
        });

        it('should stop current playback', async () => {
            await orchestrator.switchToChannel('ch1');

            expect(mockVideoPlayer.stop).toHaveBeenCalled();
        });

        it('should load scheduler with channel content', async () => {
            await orchestrator.switchToChannel('ch1');

            expect(mockScheduler.loadChannel).toHaveBeenCalled();
        });

        it('should sync to current time', async () => {
            await orchestrator.switchToChannel('ch1');

            expect(mockScheduler.syncToCurrentTime).toHaveBeenCalled();
        });

        it('forwards guide selection snapshots through switchToChannel without transforming them', async () => {
            const switchSpy = jest.spyOn(ChannelTuningCoordinator.prototype, 'switchToChannel');
            const guideSelectionSnapshot = {
                channelId: 'ch1',
                ratingKey: 'rk-1',
                scheduledStartTime: 1_000,
                scheduledEndTime: 61_000,
                source: 'resolved-immediate' as const,
                referenceTimeMs: 10_000,
                dayKey: 123,
                orderedItems: [],
            };
            try {
                await orchestrator.switchToChannel('ch1', { guideSelectionSnapshot });

                expect(switchSpy).toHaveBeenCalledWith('ch1', {
                    guideSelectionSnapshot,
                });
            } finally {
                switchSpy.mockRestore();
            }
        });

        it('carries ID-based switch outcomes through the public startup contract', async () => {
            const cases: Array<{
                outcome: 'failed' | 'aborted' | 'switched';
                expectedError: RegExp | null;
            }> = [
                { outcome: 'failed', expectedError: /Initial channel switch failed for ch1/ },
                { outcome: 'aborted', expectedError: /Initial channel switch aborted for ch1/ },
                { outcome: 'switched', expectedError: null },
            ];

            for (const { outcome, expectedError } of cases) {
                const localOrchestrator = createOrchestrator();
                await localOrchestrator.initialize(mockConfig);
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
                    createStoredCredentials('valid-token')
                );
                mockPlexAuth.validateToken.mockResolvedValue(true);
                mockPlexDiscovery.isConnected.mockReturnValue(true);
                mockPlexDiscovery.getSelectedServer.mockReturnValue(null);
                mockLocalStorage.getItem.mockImplementation((key: string) => {
                    if (key === 'lineup_audio_setup_complete') return '1';
                    return null;
                });

                const switchSpy = jest
                    .spyOn(ChannelTuningCoordinator.prototype, 'switchToChannel')
                    .mockResolvedValueOnce(outcome);

                try {
                    if (expectedError) {
                        expectConsoleWarn([
                            'Global error in start',
                            expect.objectContaining({
                                safeError: expect.objectContaining({
                                    message: expect.stringMatching(expectedError),
                                }),
                            }),
                        ]);
                        await expect(localOrchestrator.start()).rejects.toThrow(expectedError);
                    } else {
                        await expect(localOrchestrator.start()).resolves.toBeUndefined();
                    }
                } finally {
                    switchSpy.mockRestore();
                }
            }
        });

        it('should handle non-existent channel gracefully', async () => {
            expectConsoleWarn([
                'Global error in switchToChannel',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.CHANNEL_NOT_FOUND,
                        message: 'Channel invalid not found',
                    }),
                }),
            ]);
            mockChannelManager.getChannel.mockReturnValue(null);

            await expect(orchestrator.switchToChannel('invalid')).resolves.not.toThrow();
            expect(mockLifecycle.reportError).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.CHANNEL_NOT_FOUND,
                    message: 'Channel invalid not found',
                    recoverable: true,
                })
            );

            // Verify early return - stop should not be called for invalid channel
            expect(mockVideoPlayer.stop).not.toHaveBeenCalled();
        });

        it('should resolve channel content before loading scheduler', async () => {
            const resolveOrder: string[] = [];

            mockChannelManager.resolveChannelContent.mockImplementation(async () => {
                resolveOrder.push('resolve');
                return { channelId: 'ch1', items: [], orderedItems: [], totalDurationMs: 0, resolvedAt: Date.now() };
            });
            mockScheduler.loadChannel.mockImplementation(() => {
                resolveOrder.push('load');
            });

            await orchestrator.switchToChannel('ch1');

            expect(resolveOrder).toEqual(['resolve', 'load']);
        });

        // ========================================
        // ORCH-002: Concurrent Channel Switch Guard
        // ========================================

        it('should queue latest concurrent channel switch attempts and resolve each request when applied', async () => {
            // Make first resolveChannelContent call take some time.
            let resolveFirst: () => void = (): void => { };
            mockChannelManager.resolveChannelContent.mockImplementation(
                (channelId: string): Promise<{ channelId: string; items: never[]; orderedItems: never[]; totalDurationMs: number; resolvedAt: number }> =>
                    new Promise<{ channelId: string; items: never[]; orderedItems: never[]; totalDurationMs: number; resolvedAt: number }>((resolve) => {
                        if (mockChannelManager.resolveChannelContent.mock.calls.length === 1) {
                            resolveFirst = (): void => resolve({ channelId, items: [], orderedItems: [], totalDurationMs: 0, resolvedAt: Date.now() });
                            return;
                        }
                        resolve({ channelId, items: [], orderedItems: [], totalDurationMs: 0, resolvedAt: Date.now() });
                    })
            );

            // Start first switch (will be pending)
            const switch1 = orchestrator.switchToChannel('ch1');

            // Attempt second switch while first is in progress
            expectConsoleWarn(/already in progress/);
            const switch2 = orchestrator.switchToChannel('ch2');

            // Second switch should remain pending while first is still in-flight.
            await Promise.resolve();
            expect(mockChannelManager.resolveChannelContent).toHaveBeenCalledTimes(1);
            expect(mockScheduler.loadChannel).not.toHaveBeenCalled();

            // Complete first and then queued second switch.
            resolveFirst();
            await switch2;
            await switch1;
            expect(mockChannelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
            expect(mockScheduler.loadChannel).toHaveBeenCalledTimes(2);
            expect(mockChannelManager.setCurrentChannel).toHaveBeenNthCalledWith(1, 'ch1');
            expect(mockChannelManager.setCurrentChannel).toHaveBeenNthCalledWith(2, 'ch2');
        });

        it('propagates abort rejections for public channel switches superseded while queued', async () => {
            let resolveFirst: () => void = (): void => { };
            mockChannelManager.resolveChannelContent.mockImplementation(
                (channelId: string): Promise<{ channelId: string; items: never[]; orderedItems: never[]; totalDurationMs: number; resolvedAt: number }> =>
                    new Promise<{ channelId: string; items: never[]; orderedItems: never[]; totalDurationMs: number; resolvedAt: number }>((resolve) => {
                        if (mockChannelManager.resolveChannelContent.mock.calls.length === 1) {
                            resolveFirst = (): void => resolve({ channelId, items: [], orderedItems: [], totalDurationMs: 0, resolvedAt: Date.now() });
                            return;
                        }
                        resolve({ channelId, items: [], orderedItems: [], totalDurationMs: 0, resolvedAt: Date.now() });
                    })
            );

            const switch1 = orchestrator.switchToChannel('ch1');

            expectConsoleWarn(/already in progress/, { times: 2 });
            const switch2 = orchestrator.switchToChannel('ch2');
            const switch2Result = switch2.then(
                () => 'resolved',
                (error: unknown) => error
            );

            const switch3 = orchestrator.switchToChannel('ch3');

            await expect(switch2Result).resolves.toMatchObject({ name: 'AbortError' });

            resolveFirst();
            await switch1;
            await switch3;

            expect(mockChannelManager.setCurrentChannel).toHaveBeenNthCalledWith(1, 'ch1');
            expect(mockChannelManager.setCurrentChannel).toHaveBeenNthCalledWith(2, 'ch3');
        });

        it('should allow sequential channel switches', async () => {
            mockChannelManager.resolveChannelContent.mockResolvedValue({
                channelId: 'ch1',
                items: [],
                orderedItems: [],
                totalDurationMs: 0,
                resolvedAt: Date.now(),
            });

            // First switch
            await orchestrator.switchToChannel('ch1');
            expect(mockScheduler.loadChannel).toHaveBeenCalledTimes(1);

            // Second switch (should work since first is complete)
            await orchestrator.switchToChannel('ch2');
            expect(mockScheduler.loadChannel).toHaveBeenCalledTimes(2);
        });
    });

    describe('switchToChannelByNumber', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('logs the specific missing modules when numeric channel tuning is unavailable', async () => {
            const warning = expectConsoleWarn([
                'switchToChannelByNumber: channel tuning unavailable',
                expect.objectContaining({
                    missingModules: expect.arrayContaining([
                        '_channelTuning',
                        '_videoPlayer',
                    ]),
                }),
            ]);

            Reflect.set(orchestrator as object, '_channelTuning', null);
            Reflect.set(orchestrator as object, '_videoPlayer', null);

            await expect(orchestrator.switchToChannelByNumber(5)).resolves.toBeUndefined();

            const switchByNumberPayload = warning.getLastCall()?.[1] as {
                missingModules: string[];
            };
            expect(switchByNumberPayload.missingModules).toHaveLength(2);
        });

        it('should find channel by number and switch', async () => {
            mockChannelManager.getChannelByNumber.mockReturnValue(mockChannel);

            await orchestrator.switchToChannelByNumber(5);

            expect(mockChannelManager.getChannelByNumber).toHaveBeenCalledWith(5);
            expect(mockChannelManager.resolveChannelContent).toHaveBeenCalledWith(mockChannel.id, {
                signal: null,
            });
            expect(mockVideoPlayer.stop).toHaveBeenCalled();
        });

        it('should handle invalid channel number', async () => {
            expectConsoleWarn([
                'Global error in switchToChannelByNumber',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.CHANNEL_NOT_FOUND,
                        message: 'Channel 999 not found',
                    }),
                }),
            ]);
            mockChannelManager.getChannelByNumber.mockReturnValue(null);

            await orchestrator.switchToChannelByNumber(999);

            expect(mockLifecycle.reportError).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'CHANNEL_NOT_FOUND' })
            );
        });
    });

    describe('channel setup rerun', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('should clear setup record and navigate to channel-setup', () => {
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-3' });
            orchestrator.requestChannelSetupRerun();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'lineup_channel_setup_v2:server-3'
            );
            expect(mockNavigation.goTo).toHaveBeenCalledWith('channel-setup');
        });
    });

    describe('channel setup context', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('returns first-time when selected server has no channels', () => {
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-4' });
            mockChannelManager.getAllChannels.mockReturnValue([]);
            const workflowPort = orchestrator.getChannelSetupWorkflowPort();

            expect(workflowPort.getSetupContextForSelectedServer()).toBe('first-time');
        });

        it('returns existing when selected server has channels', () => {
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-4' });
            mockChannelManager.getAllChannels.mockReturnValue([{ ...mockChannel, id: 'channel-1' }]);
            const workflowPort = orchestrator.getChannelSetupWorkflowPort();

            expect(workflowPort.getSetupContextForSelectedServer()).toBe('existing');
        });

        it('returns unknown when selected server is unavailable', () => {
            mockPlexDiscovery.getSelectedServer.mockReturnValue(null);
            const workflowPort = orchestrator.getChannelSetupWorkflowPort();

            expect(workflowPort.getSetupContextForSelectedServer()).toBe('unknown');
        });
    });

    describe('EPG management', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('should open EPG and focus now', () => {
            orchestrator.openEPG();

            expect(mockEpg.show).toHaveBeenCalled();
            expect(mockEpg.focusNow).toHaveBeenCalled();
        });

        it('should close EPG', () => {
            orchestrator.closeEPG();

            expect(mockEpg.hide).toHaveBeenCalled();
        });

        it('should toggle EPG from closed to open', () => {
            mockEpg.isVisible.mockReturnValue(false);

            orchestrator.toggleEPG();

            expect(mockEpg.show).toHaveBeenCalled();
        });

        it('should toggle EPG from open to closed', () => {
            mockEpg.isVisible.mockReturnValue(true);

            orchestrator.toggleEPG();

            expect(mockEpg.hide).toHaveBeenCalled();
        });

        it('should allow EPG while Now Playing modal is open and back should not close EPG', async () => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            mockNavigation.isModalOpen.mockReturnValue(true);
            mockEpg.isVisible.mockReturnValue(true);

            await orchestrator.start();

            orchestrator.openEPG();
            expect(mockNavigation.closeModal).not.toHaveBeenCalled();

            const keyPress = navHandlers.keyPress;
            expect(keyPress).toBeDefined();
            keyPress?.({
                button: 'back',
                isRepeat: false,
                isLongPress: false,
                timestamp: Date.now(),
                originalEvent: { preventDefault: jest.fn() },
            });
            expect(mockEpg.handleBack).not.toHaveBeenCalled();
        });

        it('shows warning toast instead of reporting global fatal error when deferred EPG init fails', async () => {
            const toastHandler = jest.fn();
            orchestrator.setNowPlayingHandler(toastHandler);
            const initError = new Error('epg init failed');
            const initSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'ensureEPGInitialized')
                .mockRejectedValue(initError);

            try {
                orchestrator.openEPG();
                await new Promise(process.nextTick);

                expect(toastHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: expect.stringContaining('Guide unavailable'),
                        type: 'warning',
                    })
                );
                expect(mockLifecycle.reportError).not.toHaveBeenCalled();
            } finally {
                initSpy.mockRestore();
            }
        });

        it('wires ensureEpgInitialized through the real InitializationCoordinator before coordinator assembly', async () => {
            const originalAssembly = orchestratorCoordinatorAssembly.createOrchestratorCoordinators;
            const earlyEnsureCalls: Array<Promise<void>> = [];
            const ensureEpgInitializedSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'ensureEPGInitialized')
                .mockResolvedValue(undefined);
            const assemblySpy = jest
                .spyOn(orchestratorCoordinatorAssembly, 'createOrchestratorCoordinators')
                .mockImplementation((deps) => {
                    earlyEnsureCalls.push(deps.init.ensureEpgInitialized());
                    return originalAssembly(deps);
                });

            try {
                await orchestrator.initialize(mockConfig);
                expect(earlyEnsureCalls.length).toBeGreaterThan(0);
                await expect(Promise.all(earlyEnsureCalls)).resolves.toEqual(
                    expect.arrayContaining([undefined])
                );
                expect(ensureEpgInitializedSpy).toHaveBeenCalled();
                expect(mockLifecycle.reportError).not.toHaveBeenCalled();
            } finally {
                assemblySpy.mockRestore();
                ensureEpgInitializedSpy.mockRestore();
            }
        });

        it('routes channel transition activity callbacks through overlay badge recompute wiring', async () => {
            const originalAssembly = orchestratorCoordinatorAssembly.createOrchestratorCoordinators;
            let capturedAssemblyInput: unknown = null;
            const assemblySpy = jest
                .spyOn(orchestratorCoordinatorAssembly, 'createOrchestratorCoordinators')
                .mockImplementation((deps) => {
                    capturedAssemblyInput = deps;
                    return originalAssembly(deps);
                });
            const syncSpy = jest.spyOn(
                OverlayRuntimePolicyController.prototype,
                'syncChannelBadgeOverlay'
            );

            try {
                await orchestrator.initialize(mockConfig);
                syncSpy.mockClear();

                const actions = (
                    capturedAssemblyInput as
                        | { actions?: { onChannelTransitionActivityChange?: (active: boolean) => void } }
                        | null
                )?.actions;
                actions?.onChannelTransitionActivityChange?.(true);

                expect(syncSpy).toHaveBeenCalledTimes(1);
            } finally {
                syncSpy.mockRestore();
                assemblySpy.mockRestore();
            }
        });

        it('should forward layout mode changes when EPG is visible', () => {
            mockEpg.isVisible.mockReturnValue(true);

            orchestrator.onGuideSettingChange({ key: 'layoutMode', mode: 'classic' });

            expect(mockEpg.setLayoutMode).toHaveBeenCalledWith('classic');
        });

        it('should forward now watching banner changes when EPG is visible', () => {
            mockEpg.isVisible.mockReturnValue(true);

            orchestrator.onGuideSettingChange({ key: 'nowWatchingBanner', enabled: false });

            expect(mockEpg.setNowWatchingBannerEnabled).toHaveBeenCalledWith(false);
        });

        it('delegates guide-setting policy entrypoints to EPGCoordinator', () => {
            const delegateSpy = jest.spyOn(EPGCoordinator.prototype, 'handleGuideSettingChange');
            const change = { key: 'guideDensity', density: 'wide' } as const;

            try {
                orchestrator.onGuideSettingChange(change);
                expect(delegateSpy).toHaveBeenCalledWith(change);
            } finally {
                delegateSpy.mockRestore();
            }
        });

        it('ignores info background mode changes while EPG is visible', () => {
            mockEpg.isVisible.mockReturnValue(true);
            const clearSpy = jest.spyOn(EPGCoordinator.prototype, 'clearScheduleCaches');
            const primeSpy = jest.spyOn(EPGCoordinator.prototype, 'primeEpgChannels');
            const refreshSpy = jest.spyOn(EPGCoordinator.prototype, 'refreshEpgSchedules');

            try {
                orchestrator.onGuideSettingChange({ key: 'infoBackgroundMode', mode: 1 });

                expect(clearSpy).not.toHaveBeenCalled();
                expect(primeSpy).not.toHaveBeenCalled();
                expect(refreshSpy).not.toHaveBeenCalled();
                expect(mockEpg.clearSchedules).not.toHaveBeenCalled();
                expect(mockEpg.setLayoutMode).not.toHaveBeenCalled();
                expect(mockEpg.setNowWatchingBannerEnabled).not.toHaveBeenCalled();
            } finally {
                clearSpy.mockRestore();
                primeSpy.mockRestore();
                refreshSpy.mockRestore();
            }
        });

        it('refreshes schedules when guide density changes while EPG is visible', async () => {
            jest.useFakeTimers();
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            mockLocalStorage.getItem.mockImplementation((key: string) =>
                key === 'lineup_epg_guide_density' ? 'wide' : null
            );
            mockEpg.isVisible.mockReturnValue(true);
            const primeSpy = jest.spyOn(EPGCoordinator.prototype, 'primeEpgChannels');

            try {
                await orchestrator.start();
                await jest.advanceTimersByTimeAsync(1500);
                orchestrator.onGuideSettingChange({ key: 'guideDensity', density: 'wide' });

                expect(mockEpg.setVisibleHours).toHaveBeenCalledWith(3);
                expect(mockEpg.clearSchedules).toHaveBeenCalled();
                expect(primeSpy).toHaveBeenCalled();
            } finally {
                primeSpy.mockRestore();
                jest.useRealTimers();
            }
        });

        it('clears and refreshes schedules when aggressive preload changes while EPG visible', () => {
            mockEpg.isVisible.mockReturnValue(true);
            const primeSpy = jest.spyOn(EPGCoordinator.prototype, 'primeEpgChannels');

            try {
                orchestrator.onGuideSettingChange({ key: 'aggressivePreload', enabled: true });

                expect(mockEpg.clearSchedules).toHaveBeenCalled();
                expect(primeSpy).toHaveBeenCalled();
            } finally {
                primeSpy.mockRestore();
            }
        });

        it('clears and refreshes schedules when past-items window changes while EPG visible', () => {
            mockEpg.isVisible.mockReturnValue(true);
            const primeSpy = jest.spyOn(EPGCoordinator.prototype, 'primeEpgChannels');

            try {
                orchestrator.onGuideSettingChange({ key: 'pastItemsWindow', value: '15' });

                expect(mockEpg.clearSchedules).toHaveBeenCalled();
                expect(primeSpy).toHaveBeenCalled();
            } finally {
                primeSpy.mockRestore();
            }
        });

        it('invalidates cached schedules but skips refresh when aggressive preload changes while EPG is hidden', () => {
            mockEpg.isVisible.mockReturnValue(false);
            const primeSpy = jest.spyOn(EPGCoordinator.prototype, 'primeEpgChannels');

            try {
                orchestrator.onGuideSettingChange({ key: 'aggressivePreload', enabled: true });

                expect(primeSpy).not.toHaveBeenCalled();
                expect(mockEpg.clearSchedules).toHaveBeenCalled();
            } finally {
                primeSpy.mockRestore();
            }
        });
    });

    describe('Now Playing Info overlay', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            await orchestrator.start();
        });

        it('should live-update progress while open', async () => {
            jest.useFakeTimers();

            const baseProgram = {
                item: {
                    ratingKey: 'rk1',
                    title: 'Test Movie',
                    durationMs: 120_000,
                    type: 'movie',
                },
                scheduledStartTime: Date.now(),
                scheduledEndTime: Date.now() + 120_000,
                elapsedMs: 0,
                remainingMs: 120_000,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: true,
            };

            // Program start sets _currentProgramForPlayback so the modal can render.
            await (schedulerHandlers.programStart as (p: unknown) => Promise<void>)(baseProgram);

            // While open, orchestrator should pull fresh elapsed values from scheduler.getCurrentProgram().
            // Use a monotonic mock since other orchestrator flows may also query getCurrentProgram().
            let elapsedMs = 0;
            mockScheduler.getCurrentProgram.mockImplementation(() => {
                elapsedMs += 1000;
                return { ...baseProgram, elapsedMs, remainingMs: Math.max(0, 120_000 - elapsedMs) };
            });

            mockNavigation.isModalOpen.mockImplementation((modalId?: string) => modalId === 'now-playing-info');

            const modalOpen = navHandlers.modalOpen as (payload: unknown) => void;
            expect(modalOpen).toBeDefined();
            modalOpen({ modalId: 'now-playing-info' });

            jest.advanceTimersByTime(1100);
            jest.advanceTimersByTime(1100);

            const nowPlayingModule = require('../modules/ui/now-playing-info');
            const instance = (nowPlayingModule.NowPlayingInfoOverlay as jest.Mock).mock.results[0]?.value;
            expect((instance.update as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);

            const elapsedValues = (instance.update as jest.Mock).mock.calls
                .map((call: [{ elapsedMs?: number }]) => call[0]?.elapsedMs)
                .filter((value: number | undefined): value is number => typeof value === 'number');
            expect(elapsedValues.length).toBeGreaterThanOrEqual(2);
            const firstElapsed = elapsedValues[0] ?? 0;
            const lastElapsed = elapsedValues[elapsedValues.length - 1] ?? 0;
            expect(lastElapsed).toBeGreaterThan(firstElapsed);

            // Closing should stop the timer (no further updates).
            const callCount = (instance.update as jest.Mock).mock.calls.length;
            const modalClose = navHandlers.modalClose as (payload: unknown) => void;
            modalClose({ modalId: 'now-playing-info' });
            jest.advanceTimersByTime(3000);
            expect((instance.update as jest.Mock).mock.calls.length).toBe(callCount);

            jest.useRealTimers();
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('should call module-specific handler first', () => {
            expectConsoleWarn([
                'Global error in test-context',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.NETWORK_TIMEOUT,
                        message: 'test',
                    }),
                }),
            ]);
            expectConsoleWarn([
                'Global error handled by module',
                expect.objectContaining({ moduleId: 'test-module' }),
            ]);
            const moduleHandler = jest.fn().mockReturnValue(true);
            orchestrator.registerErrorHandler('test-module', moduleHandler);

            const error = { code: AppErrorCode.NETWORK_TIMEOUT, message: 'test', recoverable: true };
            orchestrator.handleGlobalError(error, 'test-context');

            expect(moduleHandler).toHaveBeenCalledWith(error);
            expect(mockLifecycle.reportError).not.toHaveBeenCalled();
        });

        it('should report to lifecycle if handler returns false', () => {
            expectConsoleWarn([
                'Global error in test-context',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.NETWORK_TIMEOUT,
                        message: 'test',
                    }),
                }),
            ]);
            const moduleHandler = jest.fn().mockReturnValue(false);
            orchestrator.registerErrorHandler('test-module', moduleHandler);

            const error = { code: AppErrorCode.NETWORK_TIMEOUT, message: 'test', recoverable: true };
            orchestrator.handleGlobalError(error, 'test-context');

            expect(moduleHandler).toHaveBeenCalledWith(error);
            expect(mockLifecycle.reportError).toHaveBeenCalledWith(error);
        });

        it('redacts tokenized message values in global error logs', () => {
            const warning = expectConsoleWarn([
                expect.stringContaining('Global error in test-context'),
                expect.any(Object),
            ]);
            const secret = 'secret-token';
            const error = {
                code: AppErrorCode.NETWORK_TIMEOUT,
                message: `http://x?X-Plex-Token=${secret}`,
                recoverable: true,
            };

            orchestrator.handleGlobalError(error, 'test-context');

            const globalErrorCall = warning.getLastCall();
            expect(globalErrorCall).toBeDefined();
            const logged = JSON.stringify(globalErrorCall);
            expect(logged).toContain('REDACTED');
            expect(logged).not.toContain(secret);
        });

        it('keeps recoverable reporter failures inside the reporter collaborator during global error handling', () => {
            const warn = jest.fn();
            const isolatedOrchestrator = new AppOrchestrator();
            Reflect.set(
                isolatedOrchestrator as object,
                '_recoverableRuntimeReporter',
                recoverableRuntimeReporterModule.createRecoverableRuntimeIssueReporter({
                    issueId: 'qa-1',
                    appendIssueDiagnostic: () => {
                        throw new Error('append failed');
                    },
                    warn,
                })
            );

            expect(() => {
                isolatedOrchestrator.handleGlobalError(
                    {
                        code: AppErrorCode.NETWORK_TIMEOUT,
                        message: 'test',
                        recoverable: true,
                    },
                    'test-context'
                );
            }).not.toThrow();

            expect(warn).toHaveBeenCalledWith(
                '[RecoverableRuntimeReporter] reportError failed:',
                expect.objectContaining({
                    message: 'append failed',
                })
            );
        });

        it('defers reentrant global errors until the active handling pass completes', () => {
            expectConsoleWarn([
                'Global error in outer-context',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.NETWORK_TIMEOUT,
                        message: 'first error',
                    }),
                }),
            ]);
            expectConsoleWarn([
                'Global error in nested-context',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.UNKNOWN,
                        message: 'nested error',
                    }),
                }),
            ]);
            const firstError = {
                code: AppErrorCode.NETWORK_TIMEOUT,
                message: 'first error',
                recoverable: true,
            };
            const nestedError = {
                code: AppErrorCode.UNKNOWN,
                message: 'nested error',
                recoverable: true,
            };
            const handledOrder: string[] = [];

            const moduleHandler = jest.fn((error) => {
                handledOrder.push(error.message);

                if (error === firstError) {
                    orchestrator.handleGlobalError(nestedError, 'nested-context');
                }

                return false;
            });

            orchestrator.registerErrorHandler('recursive-module', moduleHandler);

            orchestrator.handleGlobalError(firstError, 'outer-context');

            expect(handledOrder).toEqual(['first error', 'nested error']);
            expect(moduleHandler).toHaveBeenCalledTimes(2);
            expect(moduleHandler).toHaveBeenNthCalledWith(1, firstError);
            expect(moduleHandler).toHaveBeenNthCalledWith(2, nestedError);
            expect(mockLifecycle.reportError).toHaveBeenNthCalledWith(1, firstError);
            expect(mockLifecycle.reportError).toHaveBeenNthCalledWith(2, nestedError);
        });

        it('clears the global error reentrancy guard after a handling pass', () => {
            expectConsoleWarn([
                'Global error in first-context',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.NETWORK_TIMEOUT,
                        message: 'first error',
                    }),
                }),
            ]);
            expectConsoleWarn([
                'Global error in second-context',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.UNKNOWN,
                        message: 'second error',
                    }),
                }),
            ]);
            const firstError = {
                code: AppErrorCode.NETWORK_TIMEOUT,
                message: 'first error',
                recoverable: true,
            };
            const secondError = {
                code: AppErrorCode.UNKNOWN,
                message: 'second error',
                recoverable: true,
            };

            orchestrator.handleGlobalError(firstError, 'first-context');
            orchestrator.handleGlobalError(secondError, 'second-context');

            expect(mockLifecycle.reportError).toHaveBeenNthCalledWith(1, firstError);
            expect(mockLifecycle.reportError).toHaveBeenNthCalledWith(2, secondError);
        });
    });

    describe('getRecoveryActions', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('should return Sign In action for AUTH_REQUIRED', () => {
            const actions = orchestrator.getRecoveryActions(AppErrorCode.AUTH_REQUIRED);

            expect(actions).toContainEqual(
                expect.objectContaining({ label: 'Sign In', isPrimary: true })
            );
        });

        it('should return Retry and Exit for INITIALIZATION_FAILED', () => {
            const actions = orchestrator.getRecoveryActions(AppErrorCode.INITIALIZATION_FAILED);

            const labels = actions.map((a) => a.label);
            expect(labels).toContain('Retry');
            expect(labels).toContain('Exit');
        });

        it('should return Skip action for PLAYBACK_DECODE_ERROR', () => {
            const actions = orchestrator.getRecoveryActions(AppErrorCode.PLAYBACK_DECODE_ERROR);

            expect(actions).toContainEqual(
                expect.objectContaining({ label: 'Skip', isPrimary: true })
            );
        });
    });

    describe('shutdown', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('shows warning toast when channel manager emits persistenceWarning', async () => {
            const toastHandler = jest.fn();
            orchestrator.setNowPlayingHandler(toastHandler);
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });
            await orchestrator.start();

            channelManagerHandlers.persistenceWarning?.({
                message: 'Storage full - some settings may not be saved',
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                isQuotaError: true,
                timestamp: Date.now(),
            });

            expect(toastHandler).toHaveBeenCalledWith({
                message: 'Storage full - some settings may not be saved',
                type: 'warning',
            });
        });

        it('should save state before shutdown', async () => {
            await orchestrator.shutdown();

            expect(mockLifecycle.shutdown).toHaveBeenCalled();
        });

        it('should stop video player on shutdown', async () => {
            await orchestrator.shutdown();

            expect(mockVideoPlayer.stop).toHaveBeenCalled();
        });

        it('flushes pending channel saves before module teardown', async () => {
            await orchestrator.shutdown();

            expect(mockChannelManager.flushSaves).toHaveBeenCalledTimes(1);
        });

        it('disposes channel manager on shutdown', async () => {
            await orchestrator.shutdown();

            expect(mockChannelManager.dispose).toHaveBeenCalledTimes(1);
        });

        it('makes concurrent shutdown callers wait for the active teardown', async () => {
            let resolveFlush!: () => void;
            const flushRelease = new Promise<void>((resolve) => {
                resolveFlush = resolve;
            });
            const flushStarted = new Promise<void>((resolve) => {
                (mockChannelManager.flushSaves as jest.Mock).mockImplementationOnce(async () => {
                    resolve();
                    await flushRelease;
                });
            });

            const firstShutdown = orchestrator.shutdown();
            await flushStarted;

            let secondShutdownResolved = false;
            const secondShutdown = orchestrator.shutdown().then(() => {
                secondShutdownResolved = true;
            });

            await Promise.resolve();

            expect(secondShutdownResolved).toBe(false);
            expect(mockChannelManager.flushSaves).toHaveBeenCalledTimes(1);

            resolveFlush();

            await expect(Promise.all([firstShutdown, secondShutdown])).resolves.toEqual([undefined, undefined]);
            expect(secondShutdownResolved).toBe(true);
            expect(mockLifecycle.shutdown).toHaveBeenCalledTimes(1);
            expect(mockNavigation.destroy).toHaveBeenCalledTimes(1);
        });

        it('should destroy modules on shutdown', async () => {
            await orchestrator.shutdown();

            expect(mockEpg.destroy).toHaveBeenCalledTimes(1);
            expect(mockChannelNumberOverlay.destroy).toHaveBeenCalledTimes(1);
            expect(mockChannelBadgeOverlay.destroy).toHaveBeenCalledTimes(1);
            expect(mockVideoPlayer.destroy).toHaveBeenCalledTimes(1);
            expect(mockNavigation.destroy).toHaveBeenCalledTimes(1);
        });

        it('clears owned runtime collaborator references after shutdown and remains non-reusable', async () => {
            await orchestrator.shutdown();

            const clearedFields = [
                '_lifecycle',
                '_videoPlayer',
                '_scheduler',
            ] as const;

            for (const field of clearedFields) {
                expect(Reflect.get(orchestrator as object, field)).toBeNull();
            }

            expect(Reflect.get(orchestrator as object, '_config')).not.toBeNull();
            expect(Reflect.get(orchestrator as object, '_moduleStatus')).toBeInstanceOf(Map);
            expect(Reflect.get(orchestrator as object, '_errorHandlers')).toBeInstanceOf(Map);

            mockEpg.show.mockClear();
            mockEpg.hide.mockClear();
            mockEpg.setLayoutMode.mockClear();
            mockEpg.setNowWatchingBannerEnabled.mockClear();

            expect(() => orchestrator.openEPG()).toThrow(
                'AppOrchestrator cannot be used after shutdown; create a new instance.'
            );
            expect(() => orchestrator.closeEPG()).toThrow(
                'AppOrchestrator cannot be used after shutdown; create a new instance.'
            );
            expect(() => orchestrator.toggleEPG()).toThrow(
                'AppOrchestrator cannot be used after shutdown; create a new instance.'
            );
            expect(() => orchestrator.onGuideSettingChange({ key: 'layoutMode', mode: 'classic' })).toThrow(
                'AppOrchestrator cannot be used after shutdown; create a new instance.'
            );
            expect(() => orchestrator.onGuideSettingChange({ key: 'nowWatchingBanner', enabled: false })).toThrow(
                'AppOrchestrator cannot be used after shutdown; create a new instance.'
            );

            expect(mockEpg.show).not.toHaveBeenCalled();
            expect(mockEpg.hide).not.toHaveBeenCalled();
            expect(mockEpg.setLayoutMode).not.toHaveBeenCalled();
            expect(mockEpg.setNowWatchingBannerEnabled).not.toHaveBeenCalled();

            await expect(orchestrator.start()).rejects.toMatchObject({
                code: AppErrorCode.MODULE_INIT_FAILED,
                recoverable: false,
                message: expect.stringContaining('AppOrchestrator cannot be used after shutdown'),
                context: expect.objectContaining({
                    method: 'start',
                    lifecycle: 'shutdown',
                }),
            });
            await expect(orchestrator.initialize(mockConfig)).rejects.toMatchObject({
                code: AppErrorCode.MODULE_INIT_FAILED,
                recoverable: false,
                message: expect.stringContaining('AppOrchestrator cannot be used after shutdown'),
                context: expect.objectContaining({
                    method: 'initialize',
                    lifecycle: 'shutdown',
                }),
            });
        });

        it('clears playback snapshot state on shutdown', async () => {
            Reflect.set(orchestrator as object, '_currentProgramForPlayback', {
                item: {
                    ratingKey: 'rk1',
                    title: 'Test Movie',
                    fullTitle: 'Test Movie',
                    type: 'movie',
                },
                scheduledStartTime: 1,
                scheduledEndTime: 2,
                elapsedMs: 0,
                remainingMs: 120_000,
            } as never);

            Reflect.set(orchestrator as object, '_currentStreamDecision', {
                isDirectPlay: true,
                isTranscoding: false,
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                subtitleDelivery: 'none',
                bitrate: 1000,
                width: 1920,
                height: 1080,
                sessionId: 'session-1',
                selectedAudioStream: null,
                selectedSubtitleStream: null,
                directPlay: true,
                audioFallback: false,
                source: 'test',
                transcodeRequest: null,
                serverDecision: null,
            } as never);

            Reflect.set(orchestrator as object, '_currentStreamDescriptor', {
                protocol: 'hls',
                mimeType: 'application/x-mpegURL',
            } as never);

            expect(orchestrator.getPlaybackInfoSnapshot().program).not.toBeNull();

            await orchestrator.shutdown();

            expect(orchestrator.getPlaybackInfoSnapshot()).toEqual({
                channel: null,
                program: null,
                stream: null,
            });
        });

        it('clears the exit-confirm coordinator even when the modal reference is already gone', async () => {
            const handleModalClose = jest.fn();
            Reflect.set(orchestrator as object, '_exitConfirmModal', null);
            Reflect.set(orchestrator as object, '_exitConfirmCoordinator', { handleModalClose });

            await orchestrator.shutdown();

            expect(handleModalClose).toHaveBeenCalledWith(EXIT_CONFIRM_MODAL_ID);
            expect(Reflect.get(orchestrator as object, '_exitConfirmCoordinator')).toBeNull();
        });

        it('continues teardown and logs aggregated warnings when shutdown steps fail', async () => {
            expectConsoleWarn([
                'Shutdown teardown failures',
                expect.objectContaining({
                    teardownFailures: expect.arrayContaining([
                        expect.objectContaining({ step: 'lifecycle.shutdown' }),
                        expect.objectContaining({ step: 'videoPlayer.stop' }),
                        expect.objectContaining({ step: 'scheduler.pauseSyncTimer' }),
                        expect.objectContaining({ step: 'epg.destroy' }),
                    ]),
                }),
            ]);
            try {
                (mockLifecycle.shutdown as jest.Mock).mockRejectedValueOnce(new Error('lifecycle failed'));
                (mockVideoPlayer.stop as jest.Mock).mockImplementationOnce(() => {
                    throw new Error('stop failed');
                });
                (mockScheduler.pauseSyncTimer as jest.Mock).mockImplementationOnce(() => {
                    throw new Error('pause failed');
                });
                (mockEpg.destroy as jest.Mock).mockImplementationOnce(() => {
                    throw new Error('epg destroy failed');
                });

                await expect(orchestrator.shutdown()).resolves.toBeUndefined();

                expect(mockNavigation.destroy).toHaveBeenCalled();
            } finally {
                (mockLifecycle.shutdown as jest.Mock).mockResolvedValue(undefined);
                (mockVideoPlayer.stop as jest.Mock).mockImplementation(() => undefined);
                (mockScheduler.pauseSyncTimer as jest.Mock).mockImplementation(() => undefined);
                (mockEpg.destroy as jest.Mock).mockImplementation(() => undefined);
            }
        });

        it('preserves teardown order and reports aggregate failures after teardown attempts complete', async () => {
            const order: string[] = [];
            let reportRecorded = false;

            expectConsoleWarn((args) => {
                const [message, data] = args;
                if (message !== 'Shutdown teardown failures') {
                    return false;
                }
                if (!reportRecorded) {
                    reportRecorded = true;
                    order.push('aggregate-report');
                }

                return (
                    typeof data === 'object' &&
                    data !== null &&
                    Array.isArray((data as { teardownFailures?: unknown }).teardownFailures)
                );
            });

            (mockChannelManager.flushSaves as jest.Mock).mockImplementationOnce(async () => {
                order.push('channelManager.flushSaves');
            });
            (mockChannelManager.dispose as jest.Mock).mockImplementationOnce(() => {
                order.push('channelManager.dispose');
            });
            (mockLifecycle.shutdown as jest.Mock).mockImplementationOnce(async () => {
                order.push('lifecycle.shutdown');
                throw new Error('lifecycle failed');
            });
            (mockVideoPlayer.stop as jest.Mock).mockImplementationOnce(() => {
                order.push('videoPlayer.stop');
                throw new Error('stop failed');
            });
            (mockScheduler.pauseSyncTimer as jest.Mock).mockImplementationOnce(() => {
                order.push('scheduler.pauseSyncTimer');
                throw new Error('pause failed');
            });
            (mockScheduler.unloadChannel as jest.Mock).mockImplementationOnce(() => {
                order.push('scheduler.unloadChannel');
            });
            (mockEpg.destroy as jest.Mock).mockImplementationOnce(() => {
                order.push('epg.destroy');
                throw new Error('epg destroy failed');
            });
            (mockVideoPlayer.destroy as jest.Mock).mockImplementationOnce(() => {
                order.push('videoPlayer.destroy');
            });
            (mockNavigation.destroy as jest.Mock).mockImplementationOnce(() => {
                order.push('navigation.destroy');
            });

            try {
                await expect(orchestrator.shutdown()).resolves.toBeUndefined();

                expect(order).toEqual(expect.arrayContaining([
                    'channelManager.flushSaves',
                    'channelManager.dispose',
                    'lifecycle.shutdown',
                    'videoPlayer.stop',
                    'scheduler.pauseSyncTimer',
                    'scheduler.unloadChannel',
                    'epg.destroy',
                    'videoPlayer.destroy',
                    'navigation.destroy',
                    'aggregate-report',
                ]));
                expect(order.indexOf('channelManager.flushSaves')).toBeLessThan(
                    order.indexOf('channelManager.dispose')
                );
                expect(order.indexOf('channelManager.dispose')).toBeLessThan(order.indexOf('lifecycle.shutdown'));
                expect(order.indexOf('lifecycle.shutdown')).toBeLessThan(order.indexOf('videoPlayer.stop'));
                expect(order.indexOf('scheduler.pauseSyncTimer')).toBeLessThan(
                    order.indexOf('scheduler.unloadChannel')
                );
                expect(order.indexOf('navigation.destroy')).toBeLessThan(order.indexOf('aggregate-report'));
            } finally {
                (mockLifecycle.shutdown as jest.Mock).mockResolvedValue(undefined);
                (mockVideoPlayer.stop as jest.Mock).mockImplementation(() => undefined);
                (mockScheduler.pauseSyncTimer as jest.Mock).mockImplementation(() => undefined);
                (mockScheduler.unloadChannel as jest.Mock).mockImplementation(() => undefined);
                (mockEpg.destroy as jest.Mock).mockImplementation(() => undefined);
                (mockVideoPlayer.destroy as jest.Mock).mockImplementation(() => undefined);
                (mockNavigation.destroy as jest.Mock).mockImplementation(() => undefined);
            }
        });

        it('collects initialization resume clear failures and continues later teardown', async () => {
            const clearAuthResumeSpy = jest.spyOn(InitializationCoordinator.prototype, 'clearAuthResume');
            clearAuthResumeSpy.mockImplementationOnce(() => {
                throw new Error('auth resume clear failed');
            });
            const clearServerResumeSpy = jest.spyOn(InitializationCoordinator.prototype, 'clearServerResume');
            clearServerResumeSpy.mockImplementationOnce(() => {
                throw new Error('server resume clear failed');
            });
            const clearProfileResumeSpy = jest.spyOn(InitializationCoordinator.prototype, 'clearProfileResume');
            clearProfileResumeSpy.mockImplementationOnce(() => {
                throw new Error('profile resume clear failed');
            });
            expectConsoleWarn([
                'Shutdown teardown failures',
                expect.objectContaining({
                    teardownFailures: expect.arrayContaining([
                        expect.objectContaining({ step: 'initCoordinator.clearAuthResume' }),
                        expect.objectContaining({ step: 'initCoordinator.clearServerResume' }),
                        expect.objectContaining({ step: 'initCoordinator.clearProfileResume' }),
                    ]),
                }),
            ]);

            try {
                await expect(orchestrator.shutdown()).resolves.toBeUndefined();
            } finally {
                clearAuthResumeSpy.mockRestore();
                clearServerResumeSpy.mockRestore();
                clearProfileResumeSpy.mockRestore();
            }

            expect(mockChannelManager.flushSaves).toHaveBeenCalled();
            expect(mockLifecycle.shutdown).toHaveBeenCalled();
            expect(mockNavigation.destroy).toHaveBeenCalled();
        });

        it('stops the video player during shutdown when active transcode cleanup fails', async () => {
            expectConsoleWarn([
                'stopActiveTranscodeSession failed during playback stop',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        name: 'Error',
                        message: 'transcode cleanup failed',
                    }),
                }),
            ]);
            const stopActiveTranscodeSession = jest.fn(() => {
                throw new Error('transcode cleanup failed');
            });

            Reflect.set(orchestrator as object, '_playbackRuntimeController', {
                stopActiveTranscodeSession,
            });

            await expect(orchestrator.shutdown()).resolves.toBeUndefined();

            expect(stopActiveTranscodeSession).toHaveBeenCalledTimes(1);
            expect(mockVideoPlayer.stop).toHaveBeenCalledTimes(1);
        });

        it('records channel overlay teardown failures and continues shutdown', async () => {
            expectConsoleWarn([
                'Shutdown teardown failures',
                expect.objectContaining({
                    teardownFailures: expect.arrayContaining([
                        expect.objectContaining({ step: 'channelNumberOverlay.destroy' }),
                        expect.objectContaining({ step: 'channelBadgeOverlay.destroy' }),
                    ]),
                }),
            ]);

            (mockChannelNumberOverlay.destroy as jest.Mock).mockImplementationOnce(() => {
                throw new Error('channel number destroy failed');
            });
            (mockChannelBadgeOverlay.destroy as jest.Mock).mockImplementationOnce(() => {
                throw new Error('channel badge destroy failed');
            });

            try {
                await expect(orchestrator.shutdown()).resolves.toBeUndefined();

                expect(mockNavigation.destroy).toHaveBeenCalled();
            } finally {
                (mockChannelNumberOverlay.destroy as jest.Mock).mockImplementation(() => undefined);
                (mockChannelBadgeOverlay.destroy as jest.Mock).mockImplementation(() => undefined);
            }
        });

        it('records event cleanup failures under events.unsubscribe and continues shutdown', async () => {
            expectConsoleWarn([
                'Shutdown teardown failures',
                expect.objectContaining({
                    teardownFailures: expect.arrayContaining([
                        expect.objectContaining({ step: 'events.unsubscribe' }),
                    ]),
                }),
            ]);
            const pauseDispose = jest.fn(() => {
                throw new Error('pause cleanup failed');
            });

            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });

            (mockLifecycle.onPause as jest.Mock).mockImplementationOnce(
                (handler: () => void | Promise<void>) => {
                    pauseHandler = handler;
                    return { dispose: pauseDispose };
                }
            );

            await orchestrator.start();
            await expect(orchestrator.shutdown()).resolves.toBeUndefined();

            expect(pauseDispose).toHaveBeenCalledTimes(1);
            expect(mockNavigation.destroy).toHaveBeenCalled();
        });

        it('records event binder dispose failures and continues shutdown', async () => {
            expectConsoleWarn([
                'Shutdown teardown failures',
                expect.objectContaining({
                    teardownFailures: expect.arrayContaining([
                        expect.objectContaining({ step: 'events.unsubscribe' }),
                    ]),
                }),
            ]);
            const dispose = jest.fn(() => {
                throw new Error('event binder dispose failed');
            });

            Reflect.set(orchestrator as object, '_eventBinder', { dispose });

            await expect(orchestrator.shutdown()).resolves.toBeUndefined();

            expect(dispose).toHaveBeenCalledTimes(1);
            expect(mockNavigation.destroy).toHaveBeenCalled();
        });

        it('records schedule day rollover disposal failures and continues shutdown', async () => {
            expectConsoleWarn([
                'Shutdown teardown failures',
                expect.objectContaining({
                    teardownFailures: expect.arrayContaining([
                        expect.objectContaining({ step: 'scheduleDayRolloverController.dispose' }),
                    ]),
                }),
            ]);

            Reflect.set(orchestrator as object, '_scheduleDayRolloverController', {
                dispose: jest.fn(() => {
                    throw new Error('rollover dispose failed');
                }),
            });

            await expect(orchestrator.shutdown()).resolves.toBeUndefined();

            expect(mockNavigation.destroy).toHaveBeenCalled();
        });

        it('should set ready to false after shutdown', async () => {
            // First start to set ready
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('t'));
            mockPlexAuth.validateToken.mockResolvedValue(true);
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            await orchestrator.start();
            expect(orchestrator.isReady()).toBe(true);

            // Then shutdown
            await orchestrator.shutdown();
            expect(orchestrator.isReady()).toBe(false);
        });

        it('fails fast when start is called after shutdown without resetting playback recovery', async () => {
            const resetSpy = jest.spyOn(PlaybackRecoveryManager.prototype, 'resetPlaybackFailureGuard');

            try {
                await orchestrator.shutdown();

                await expect(orchestrator.start()).rejects.toMatchObject({
                    code: AppErrorCode.MODULE_INIT_FAILED,
                    recoverable: false,
                    message: expect.stringContaining('AppOrchestrator cannot be used after shutdown'),
                    context: expect.objectContaining({
                        method: 'start',
                        lifecycle: 'shutdown',
                    }),
                });

                expect(resetSpy).not.toHaveBeenCalled();
            } finally {
                resetSpy.mockRestore();
            }
        });
    });

    describe('getModuleStatus', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('should return status of all modules', () => {
            const status = orchestrator.getModuleStatus();

            expect(status.has('plex-auth')).toBe(true);
            expect(status.has('channel-scheduler')).toBe(true);
            expect(status.has('video-player')).toBe(true);
            expect(status.has('epg-ui')).toBe(true);
        });

        it('should report event-emitter as ready after initialize', () => {
            const status = orchestrator.getModuleStatus();
            const emitterStatus = status.get('event-emitter');

            expect(emitterStatus).toBeDefined();
            expect(emitterStatus && emitterStatus.status).toBe('ready');
        });

        it('returns defensive copies of module status values', () => {
            const status = orchestrator.getModuleStatus();
            const authStatus = status.get('plex-auth');

            expect(authStatus).toBeDefined();
            if (!authStatus) return;

            authStatus.status = 'error';

            expect(orchestrator.getModuleStatus().get('plex-auth')?.status).not.toBe('error');
        });

        it('returns defensive copies of module status error context', () => {
            Reflect.set(orchestrator as object, '_moduleStatus', new Map([
                [
                    'plex-auth',
                    {
                        id: 'plex-auth',
                        name: 'plex-auth',
                        status: 'error',
                        error: {
                            code: AppErrorCode.AUTH_INVALID,
                            message: 'bad auth',
                            recoverable: true,
                            context: {
                                source: 'test',
                                nested: {
                                    value: 'original',
                                },
                            },
                        },
                    },
                ],
            ]));

            const returned = orchestrator.getModuleStatus().get('plex-auth');

            expect(returned?.error).toEqual({
                code: AppErrorCode.AUTH_INVALID,
                message: 'bad auth',
                recoverable: true,
                context: {
                    source: 'test',
                    nested: {
                        value: 'original',
                    },
                },
            });
            expect(returned?.error).not.toBe(
                Reflect.get(orchestrator as object, '_moduleStatus').get('plex-auth').error
            );
            expect(returned?.error?.context).not.toBe(
                Reflect.get(orchestrator as object, '_moduleStatus').get('plex-auth').error.context
            );

            if (returned?.error?.context) {
                returned.error.context.source = 'mutated';
                (returned.error.context.nested as { value: string }).value = 'mutated';
            }

            expect(orchestrator.getModuleStatus().get('plex-auth')?.error?.context?.source).toBe('test');
            const nestedContext = orchestrator.getModuleStatus().get('plex-auth')?.error?.context?.nested as
                | { value: string }
                | undefined;
            expect(nestedContext?.value).toBe('original');
        });

        it('reports structuredClone fallback once per failing context identity', () => {
            const originalStructuredClone = globalThis.structuredClone;
            const reportError = jest.fn();
            const context = {
                source: 'test',
                nested: {
                    value: 'original',
                },
            };

            Object.defineProperty(globalThis, 'structuredClone', {
                configurable: true,
                value: jest.fn(() => {
                    throw new Error('clone failed');
                }),
            });

            Reflect.set(orchestrator as object, '_recoverableRuntimeReporter', {
                reportIssue: jest.fn(),
                reportError,
            });
            Reflect.set(orchestrator as object, '_moduleStatus', new Map([
                [
                    'plex-auth',
                    {
                        id: 'plex-auth',
                        name: 'plex-auth',
                        status: 'error',
                        error: {
                            code: AppErrorCode.AUTH_INVALID,
                            message: 'bad auth',
                            recoverable: true,
                            context,
                        },
                    },
                ],
            ]));

            try {
                const firstReturned = orchestrator.getModuleStatus().get('plex-auth');
                const secondReturned = orchestrator.getModuleStatus().get('plex-auth');

                expect(firstReturned?.error?.context).toEqual({
                    source: 'test',
                    nested: {
                        value: 'original',
                    },
                });
                expect(secondReturned?.error?.context).toEqual(firstReturned?.error?.context);
                expect(reportError).toHaveBeenCalledTimes(1);
                expect(reportError).toHaveBeenNthCalledWith(
                    1,
                    'orchestrator.moduleStatus.cloneContext',
                    'Falling back to diagnostic-value clone for module status error context',
                    expect.objectContaining({
                        message: 'clone failed',
                    }),
                    {}
                );

                Reflect.set(orchestrator as object, '_moduleStatus', new Map([
                    [
                        'plex-auth',
                        {
                            id: 'plex-auth',
                            name: 'plex-auth',
                            status: 'error',
                            error: {
                                code: AppErrorCode.AUTH_INVALID,
                                message: 'bad auth',
                                recoverable: true,
                                context: {
                                    source: 'test-2',
                                },
                            },
                        },
                    ],
                ]));

                orchestrator.getModuleStatus();

                expect(reportError).toHaveBeenCalledTimes(2);
            } finally {
                Object.defineProperty(globalThis, 'structuredClone', {
                    configurable: true,
                    value: originalStructuredClone,
                });
            }
        });

        it('returns null and reports when Plex resource URL accessor dependencies throw', () => {
            const reportError = jest.fn();

            mockPlexDiscovery.getServerUri.mockImplementation(() => {
                throw new Error('server uri failed');
            });
            Reflect.set(orchestrator as object, '_recoverableRuntimeReporter', {
                reportIssue: jest.fn(),
                reportError,
            });

            try {
                expect(
                    Reflect.get(
                        orchestrator as object,
                        '_buildPlexResourceUrl'
                    ).call(orchestrator, '/library/metadata/1/thumb')
                ).toBeNull();
                expect(reportError).toHaveBeenCalledWith(
                    'orchestrator.plexResourceUrl.build',
                    'buildPlexResourceUrlWithAuth failed',
                    expect.objectContaining({
                        message: 'server uri failed',
                    }),
                    expect.objectContaining({
                        pathOrUrl: '/library/metadata/1/thumb',
                    })
                );
            } finally {
                mockPlexDiscovery.getServerUri.mockReset();
                mockPlexDiscovery.getServerUri.mockReturnValue('http://localhost:32400');
            }
        });
    });

});
