/**
 * @fileoverview Unit tests for AppOrchestrator.
 * @module __tests__/Orchestrator.test
 * @version 1.0.0
 * @remarks Legacy umbrella suite; focused suites live under `src/__tests__/orchestrator/`.
 */


import { AppOrchestrator } from '../Orchestrator';
import { PlaybackRuntimeController } from '../core/orchestrator/priority-one/PlaybackRuntimeController';
import { AppErrorCode } from '../types/app-errors';
import type { OrchestratorConfig } from '../core/orchestrator/contracts/OrchestratorTypes';
import { EPGCoordinator } from '../modules/ui/epg';
import type { EPGEventMap } from '../modules/ui/epg/types';
import type { EpgScheduleRefreshResult } from '../modules/ui/epg/coordinator/EPGCoordinatorContracts';
import type { ChannelSwitchOutcome } from '../types/channelSwitch';
import type {
    PlexAuthDataV2,
    PlexStoredCredentialsReadResult,
    PlexStoredCredentialsValidationResult,
} from '../modules/plex/auth';
import { PlexDiscoverySelectionContext } from '../modules/plex/discovery/PlexDiscoverySelectionContext';
import type { ScheduledProgram } from '../modules/scheduler/scheduler';
import type { NowPlayingInfoConfig } from '../modules/ui/now-playing-info';
import { CHANNEL_BADGE_CONTAINER_ID } from '../modules/ui/channel-badge';
import { LINEUP_STORAGE_KEYS } from '../config/storageKeys';
import { InitializationCoordinator, STARTUP_PHASE } from '../core/initialization/InitializationCoordinator';
import { ChannelTuningCoordinator } from '../core/channel-tuning';
import type { PlatformServices } from '../platform';
import type { StreamDecision } from '../modules/plex/stream';
import { APP_SHELL_CONTAINER_IDS } from '../modules/ui/common/appShellContainerIds';
import { EpgPreferencesStore } from '../modules/settings/EpgPreferencesStore';
import { PlexDiscoverySelectionSupersededError } from '../modules/plex/discovery';
import * as orchestratorCoordinatorAssembly from '../core/orchestrator/assembly/OrchestratorCoordinatorAssembly';
import type { OrchestratorCoordinatorAssemblyInput } from '../core/orchestrator/assembly/OrchestratorCoordinatorAssembly';
import { ScheduleDayRolloverController } from '../core/orchestrator/controllers/ScheduleDayRolloverController';
import { OverlayRuntimePolicyController } from '../core/orchestrator/controllers/OverlayRuntimePolicyController';
import { OrchestratorServerSelectionRuntimeProjection } from '../core/orchestrator/runtime/OrchestratorServerSelectionRuntimeProjection';
import { NowPlayingDebugManager } from '../modules/debug/NowPlayingDebugManager';
import { expectConsoleWarn } from './helpers';
import { EventEmitter } from '../utils/EventEmitter';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from './mocks/localStorage';

const READY_EPG_REFRESH_RESULT = {
    readiness: 'ready',
    attemptedChannelCount: 1,
    immediateReadyChannelCount: 1,
    backgroundQueuedChannelCount: 0,
    failedChannelCount: 0,
    staleCacheChannelCount: 0,
    firstVisibleScheduleReady: true,
} satisfies EpgScheduleRefreshResult;

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

// Mock AppLifecycle
const mockLifecycle = {
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    setPhase: jest.fn(),
    setPhaseAndWait: jest.fn().mockResolvedValue(true),
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
    activateRuntimeCommandGate: jest.fn(),
    deactivateRuntimeCommandGate: jest.fn(),
    isRuntimeCommandGated: jest.fn().mockReturnValue(false),
    cancelPendingChannelInput: jest.fn(),
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
    storeCredentials: jest.fn((_credentials?: PlexAuthDataV2) => undefined),
    readStoredCredentialsAndClearCorruption: jest.fn().mockReturnValue({ kind: 'missing' }),
    validateStoredCredentials: jest.fn(),
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

const createOpaqueAuthGuard = (): { signal: AbortSignal; assertCurrent: jest.Mock } => ({
    signal: new AbortController().signal,
    assertCurrent: jest.fn(),
});

const createStoredValidationResult = (
    kind: 'missing' | 'corrupted' | 'invalid' | 'active_valid' | 'account_fallback_valid'
): PlexStoredCredentialsValidationResult => kind === 'corrupted'
    ? { kind, reason: 'invalid-json' as const, guard: createOpaqueAuthGuard() }
    : { kind, guard: createOpaqueAuthGuard() };

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

jest.mock('../modules/plex/auth', () => {
    const actual = jest.requireActual('../modules/plex/auth');
    return {
        ...actual,
        PlexAuth: jest.fn(() => mockPlexAuth),
        isPlexAuthRecoverable: jest.fn(() => false),
    };
});

// Mock PlexServerDiscovery
let mockDiscoverySelectionContext = new PlexDiscoverySelectionContext();
const createSelectedDiscoveryResult = (): { kind: 'selected'; receipt: object } => {
    const capture = mockDiscoverySelectionContext.advance();
    return {
        kind: 'selected',
        receipt: mockDiscoverySelectionContext.issueReceipt(capture, 'selected'),
    };
};
const restoreDiscoverySnapshot = (): object => {
    const capture = mockDiscoverySelectionContext.advance();
    return mockDiscoverySelectionContext.issueReceipt(capture, 'unselected');
};

const createSavedServerRestoreResult = (): object => {
    if (!mockPlexDiscovery.isConnected()) {
        return { kind: 'skipped_no_saved_server' };
    }
    const capture = mockDiscoverySelectionContext.capture();
    return {
        kind: 'already_selected',
        serverId: mockPlexDiscovery.getSelectedServer()?.id ?? 'server-1',
        receipt: mockDiscoverySelectionContext.issueReceipt(capture, 'selected'),
    };
};

const mockPlexDiscovery = {
    initialize: jest.fn().mockResolvedValue({ kind: 'skipped_no_saved_server' }),
    isConnected: jest.fn().mockReturnValue(true),
    getSelectedServer: jest.fn().mockReturnValue(null),
    getSelectedConnection: jest.fn().mockReturnValue({ uri: 'http://localhost:32400' }),
    getServerUri: jest.fn().mockReturnValue('http://localhost:32400'),
    getSelectedServerAuthHeaders: jest.fn().mockReturnValue({}),
    captureSelectedServerSnapshot: jest.fn().mockReturnValue({
        server: null,
        connection: null,
        storedServerId: null,
    }),
    restoreSelectedServerSnapshot: jest.fn(restoreDiscoverySnapshot),
    selectServer: jest.fn().mockImplementation(async () => createSelectedDiscoveryResult()),
    getSelectionReceiptSignal: jest.fn((receipt) => mockDiscoverySelectionContext.getReceiptSignal(receipt)),
    assertSelectionReceiptCurrent: jest.fn((receipt) => mockDiscoverySelectionContext.assertReceiptCurrent(receipt)),
    captureCurrentSelectionReceipt: jest.fn(),
    clearSelection: jest.fn(() => { mockDiscoverySelectionContext.advance(); }),
    setStorageKeys: jest.fn(),
    on: jest.fn(() => ({ dispose: jest.fn() })),
};

jest.mock('../modules/plex/discovery', () => {
    const actual = jest.requireActual('../modules/plex/discovery');
    return {
        ...actual,
        PlexServerDiscovery: jest.fn(() => mockPlexDiscovery),
    };
});

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
    contentSource: { type: 'manual', items: [] },
    startTimeAnchor: 0,
    playbackMode: 'sequential',
    shuffleSeed: 12345,
    phaseSeed: 4242,
    skipIntros: false,
    skipCredits: false,
    createdAt: 0,
    updatedAt: 0,
    lastContentRefresh: 0,
    itemCount: 0,
    totalDurationMs: 0,
} satisfies EPGEventMap['channelSelected']['channel'];

const mockChannelManager = {
    loadChannels: jest.fn().mockResolvedValue(undefined),
    setStorageKeys: jest.fn(),
    flushSaves: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    replaceAllChannels: jest.fn().mockResolvedValue(undefined),
    getAllChannels: jest.fn().mockReturnValue([mockChannel]),
    clearRuntimeState: jest.fn(),
    supersedeActiveResolutions: jest.fn().mockResolvedValue(undefined),
    resumeActiveResolutions: jest.fn(),
    clearRuntimeStateForScopeTransition: jest.fn().mockResolvedValue(undefined),
    createInitialTuneResolutionAuthorization: jest.fn().mockReturnValue({}),
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
    resolveChannelContentForInitialTune: jest.fn().mockResolvedValue({
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
    jumpToProgram: jest.fn(),
    skipToNext: jest.fn(),
    skipToPrevious: jest.fn(),
    pauseSyncTimer: jest.fn(),
    resumeSyncTimer: jest.fn(),
    on: jest.fn(() => jest.fn()),
    off: jest.fn(),
};

jest.mock('../modules/scheduler/scheduler', () => {
    const actual = jest.requireActual('../modules/scheduler/scheduler');
    class MockShuffleGenerator { }
    return {
        ...actual,
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

jest.mock('../modules/player', () => {
    const actual = jest.requireActual('../modules/player');
    return {
        ...actual,
        VideoPlayer: jest.fn(() => mockVideoPlayer),
    };
});

// Mock EPGComponent
const mockEpgEvents = new EventEmitter<EPGEventMap>();
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
            endChannelIndexExclusive: 1,
        },
        currentTime: 0,
    }),
    getFocusedProgram: jest.fn().mockReturnValue(null),
    focusChannel: jest.fn(),
    focusNow: jest.fn(),
    scrollToChannel: jest.fn(),
    on: jest.fn(mockEpgEvents.on.bind(mockEpgEvents)),
    off: jest.fn(mockEpgEvents.off.bind(mockEpgEvents)),
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

jest.mock('../modules/ui/epg/component/DeferredEPGComponent', () => ({
    DeferredEPGComponent: jest.fn(() => mockEpg),
}));

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

    const captureCoordinatorAssembly = async (): Promise<{
        orchestrator: AppOrchestrator;
        input: OrchestratorCoordinatorAssemblyInput;
    }> => {
        const instance = createOrchestrator();
        const originalAssembly = orchestratorCoordinatorAssembly.createOrchestratorCoordinators;
        let capturedInput: OrchestratorCoordinatorAssemblyInput | null = null;
        const assemblySpy = jest
            .spyOn(orchestratorCoordinatorAssembly, 'createOrchestratorCoordinators')
            .mockImplementation((input) => {
                capturedInput = input;
                return originalAssembly(input);
            });

        try {
            await instance.initialize(mockConfig);
        } finally {
            assemblySpy.mockRestore();
        }

        if (!capturedInput) throw new Error('Coordinator assembly input was not captured');
        return { orchestrator: instance, input: capturedInput };
    };

    const resetMockPlexDiscoveryOn = (): void => {
        mockPlexDiscovery.on.mockReset();
        mockPlexDiscovery.on.mockReturnValue({ dispose: jest.fn() });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockEpgEvents.removeAllListeners();
        resetMockLocalStorage();

        mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReset();
        mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({ kind: 'missing' });
        mockPlexAuth.storeCredentials.mockReset();
        mockPlexAuth.storeCredentials.mockImplementation((credentials) => {
            mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({
                kind: 'available',
                credentials,
            });
        });

        mockPlexAuth.validateToken.mockReset();
        mockPlexAuth.validateToken.mockResolvedValue(true);
        mockPlexAuth.validateStoredCredentials.mockReset();
        mockPlexAuth.validateStoredCredentials.mockResolvedValue(
            createStoredValidationResult('active_valid')
        );

        mockLocalStorage.getItem.mockReset();
        mockLocalStorage.getItem.mockReturnValue(null);

        mockNavigation.isModalOpen.mockReset();
        mockNavigation.isModalOpen.mockReturnValue(false);
        mockNavigation.goTo.mockReset();

        mockEpg.isVisible.mockReset();
        mockEpg.isVisible.mockReturnValue(false);

        mockPlexDiscovery.getSelectedServer.mockReset();
        mockPlexDiscovery.getSelectedServer.mockReturnValue(null);
        mockPlexDiscovery.getSelectedConnection.mockReset();
        mockPlexDiscovery.getSelectedConnection.mockReturnValue({ uri: 'http://localhost:32400' });
        mockPlexDiscovery.getServerUri.mockReset();
        mockPlexDiscovery.getServerUri.mockReturnValue(null);
        mockPlexDiscovery.initialize.mockReset();
        mockPlexDiscovery.initialize.mockImplementation(async () => createSavedServerRestoreResult());
        mockPlexDiscovery.captureSelectedServerSnapshot.mockReset();
        mockPlexDiscovery.captureSelectedServerSnapshot.mockReturnValue({
            server: null,
            connection: null,
            storedServerId: null,
        });
        mockDiscoverySelectionContext = new PlexDiscoverySelectionContext();
        mockPlexDiscovery.restoreSelectedServerSnapshot.mockReset();
        mockPlexDiscovery.restoreSelectedServerSnapshot.mockImplementation(restoreDiscoverySnapshot);
        mockPlexDiscovery.selectServer.mockReset();
        mockPlexDiscovery.selectServer.mockImplementation(async () => createSelectedDiscoveryResult());
        mockPlexDiscovery.getSelectionReceiptSignal.mockClear();
        mockPlexDiscovery.assertSelectionReceiptCurrent.mockClear();
        mockPlexDiscovery.captureCurrentSelectionReceipt.mockClear();
        mockPlexDiscovery.captureCurrentSelectionReceipt.mockImplementation(() => {
            const capture = mockDiscoverySelectionContext.capture();
            return mockDiscoverySelectionContext.issueReceipt(
                capture,
                mockPlexDiscovery.isConnected() ? 'selected' : 'unselected'
            );
        });
        mockPlexDiscovery.clearSelection.mockReset();
        mockPlexDiscovery.clearSelection.mockImplementation(() => { mockDiscoverySelectionContext.advance(); });
        resetMockPlexDiscoveryOn();

        mockChannelManager.getAllChannels.mockReset();
        mockChannelManager.getAllChannels.mockReturnValue([mockChannel]);
        mockChannelManager.resolveChannelContent.mockReset();
        mockChannelManager.resolveChannelContent.mockResolvedValue({
            channelId: 'ch1',
            items: [],
            orderedItems: [],
            totalDurationMs: 0,
            resolvedAt: Date.now(),
        });
        mockChannelManager.clearRuntimeState.mockReset();

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
            expect(require('../modules/ui/epg/component/DeferredEPGComponent').DeferredEPGComponent).toHaveBeenCalled();
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

                mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                    createStoredValidationResult('active_valid')
                );
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
    });

    describe('selectServer', () => {
        beforeEach(() => {
            mockPlexDiscovery.getServerUri.mockReturnValue('http://localhost:32400');
        });
        it('clears EPG schedules and refreshes after selecting a new server', async () => {
            await orchestrator.initialize(mockConfig);

            const clearSpy = jest.spyOn(EPGCoordinator.prototype, 'clearScheduleCaches');
            const primeSpy = jest.spyOn(EPGCoordinator.prototype, 'primeEpgChannels');
            const refreshSpy = jest
                .spyOn(EPGCoordinator.prototype, 'refreshEpgSchedules')
                .mockResolvedValue(READY_EPG_REFRESH_RESULT);
            try {
                mockPlexDiscovery.selectServer.mockImplementation(async () => createSelectedDiscoveryResult());
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));

                await expect(orchestrator.selectServer('server-1')).resolves.toEqual({
                    kind: 'selected',
                    persistedSelection: 'updated',
                    epgRefresh: { kind: 'succeeded', result: READY_EPG_REFRESH_RESULT },
                });

                expect(mockPlexDiscovery.selectServer.mock.calls[0]?.[0]).toBe('server-1');
                expect(clearSpy).toHaveBeenCalled();
                expect(mockEpg.clearSchedules).toHaveBeenCalled();
                expect(primeSpy).toHaveBeenCalled();
                expect(refreshSpy).toHaveBeenCalledWith(expect.objectContaining({ reason: 'server-swap' }));
            } finally {
                clearSpy.mockRestore();
                primeSpy.mockRestore();
                refreshSpy.mockRestore();
            }
        });

        it('returns the transaction-owned EPG failure without losing the selected result', async () => {
            await orchestrator.initialize(mockConfig);

            const refreshError = new Error('refresh failed');
            const refreshSpy = jest
                .spyOn(EPGCoordinator.prototype, 'refreshEpgSchedules')
                .mockRejectedValue(refreshError);

            try {
                mockPlexDiscovery.selectServer.mockImplementation(async () => createSelectedDiscoveryResult());
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('valid-token'));

                await expect(orchestrator.selectServer('server-1')).resolves.toEqual({
                    kind: 'selected',
                    persistedSelection: 'updated',
                    epgRefresh: { kind: 'failed', error: refreshError },
                });
                expect(mockPlexDiscovery.restoreSelectedServerSnapshot).not.toHaveBeenCalled();
                expect(refreshSpy).toHaveBeenCalledWith(expect.objectContaining({ reason: 'server-swap' }));
            } finally {
                refreshSpy.mockRestore();
            }
        });




            it('clears discovery selection and persisted selected-server state', async () => {
                await orchestrator.initialize(mockConfig);
                const cancelRolloverSpy = jest.spyOn(
                    ScheduleDayRolloverController.prototype,
                    'cancelPendingDayRollover'
                );
                const clearSelectedSnapshotSpy = jest.spyOn(EPGCoordinator.prototype, 'clearSelectedChannelScheduleSnapshot');
                const clearScheduleCachesSpy = jest.spyOn(EPGCoordinator.prototype, 'clearScheduleCaches');
                const storedCredentials = createStoredCredentials('valid-token');
                if (storedCredentials.kind !== 'available') {
                    throw new Error('Expected available stored credentials in test setup');
                }
                storedCredentials.credentials.selectedServerByUserId['user-1'] = {
                    serverId: 'server-123',
                    serverUri: 'http://example',
                };
                mockPlexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(storedCredentials);
                try {
                    await orchestrator.clearSelectedServer();

                    expect(mockPlexDiscovery.clearSelection).toHaveBeenCalledTimes(1);
                    expect(mockPlexAuth.storeCredentials).toHaveBeenCalledWith(
                        expect.objectContaining({
                            activeUserId: 'user-1',
                            selectedServerByUserId: expect.objectContaining({
                                'user-1': { serverId: null, serverUri: null },
                            }),
                        }),
                        { emitAuthChange: false }
                    );
                    expect(mockChannelManager.clearRuntimeState).toHaveBeenCalledTimes(1);
                    expect(clearSelectedSnapshotSpy).toHaveBeenCalledTimes(1);
                    expect(clearScheduleCachesSpy).toHaveBeenCalledTimes(1);
                    expect(mockEpg.clearSchedules).toHaveBeenCalledTimes(1);
                    expect(mockScheduler.unloadChannel).toHaveBeenCalledTimes(1);
                    expect(cancelRolloverSpy).toHaveBeenCalledTimes(1);
                    const cancelCallOrder = cancelRolloverSpy.mock.invocationCallOrder[0];
                    const epgClearCallOrder = clearSelectedSnapshotSpy.mock.invocationCallOrder[0];
                    if (cancelCallOrder === undefined || epgClearCallOrder === undefined) {
                        throw new Error('Expected rollover cancellation and EPG clearing to run');
                    }
                    expect(cancelCallOrder).toBeLessThan(epgClearCallOrder);
                } finally {
                    cancelRolloverSpy.mockRestore();
                    clearSelectedSnapshotSpy.mockRestore();
                    clearScheduleCachesSpy.mockRestore();
                }
            });



            it('allows quarantine retry through the selected-server recovery gate', async () => {
                await orchestrator.initialize(mockConfig);
                mockNavigation.isRuntimeCommandGated.mockReturnValue(true);
                const retry = jest.spyOn(
                    OrchestratorServerSelectionRuntimeProjection.prototype,
                    'retryQuarantineRecovery'
                ).mockResolvedValue('none');

                try {
                    await expect(orchestrator.retryQuarantineRecovery()).resolves.toBe('none');
                    expect(retry).toHaveBeenCalledTimes(1);
                } finally {
                    retry.mockRestore();
                    mockNavigation.isRuntimeCommandGated.mockReturnValue(false);
                }
            });

        it('rejects selected-server clear while recovery commands are gated', async () => {
            await orchestrator.initialize(mockConfig);
            mockNavigation.isRuntimeCommandGated.mockReturnValueOnce(true);

            await expect(orchestrator.clearSelectedServer()).rejects.toMatchObject({
                code: AppErrorCode.INITIALIZATION_FAILED,
                recoverable: true,
                message: 'Runtime command clearSelectedServer is unavailable during selected-server recovery.',
                context: { recoveryMode: 'selected-server-quarantine' },
            });

            expect(mockPlexAuth.storeCredentials).not.toHaveBeenCalled();
            expect(mockPlexDiscovery.clearSelection).not.toHaveBeenCalled();
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
            const clearSelectedSnapshotSpy = jest.spyOn(EPGCoordinator.prototype, 'clearSelectedChannelScheduleSnapshot');
            const clearScheduleCachesSpy = jest.spyOn(EPGCoordinator.prototype, 'clearScheduleCaches');

            try {
                mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                    createStoredValidationResult('active_valid')
                );
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
                mockChannelManager.clearRuntimeState.mockClear();
                mockEpg.clearSchedules.mockClear();
                clearSelectedSnapshotSpy.mockClear();
                clearScheduleCachesSpy.mockClear();
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
                    isCurrent: true,
                };
                schedulerHandlers.programStart?.(nowPlayingProgram as unknown as ScheduledProgram);
                await new Promise((resolve) => setImmediate(resolve));

                await orchestrator.switchHomeUser('user-2', { pin: '1234' });

                expect(prepareForProfileSwitchAttemptSpy).toHaveBeenCalledTimes(1);
                expect(mockPlexAuth.switchHomeUser).toHaveBeenCalledWith('user-2', {
                    pin: '1234',
                    signal: null,
                });
                expect(mockNavigation.goTo).toHaveBeenCalledWith('splash');
                expect(resumeStartupAfterProfileSwitchSpy).toHaveBeenCalledTimes(1);
                expect(mockVideoPlayer.stop).toHaveBeenCalled();
                expect(mockScheduler.unloadChannel).toHaveBeenCalledTimes(1);
                expect(mockPlexStreamResolver.stopTranscodeSession).toHaveBeenCalledWith('profile-switch-session');
                expect(mockChannelManager.clearRuntimeState).toHaveBeenCalledTimes(1);
                expect(clearSelectedSnapshotSpy).toHaveBeenCalledTimes(1);
                expect(clearScheduleCachesSpy).toHaveBeenCalledTimes(1);
                expect(mockEpg.clearSchedules).toHaveBeenCalledTimes(1);
                expect(profileSwitchSequence).toEqual([
                    'prepareForProfileSwitchAttempt',
                    'switchHomeUser',
                    'resumeStartupAfterProfileSwitch',
                ]);
            } finally {
                prepareForProfileSwitchAttemptSpy.mockRestore();
                resumeStartupAfterProfileSwitchSpy.mockRestore();
                clearSelectedSnapshotSpy.mockRestore();
                clearScheduleCachesSpy.mockRestore();
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
                    mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                        createStoredValidationResult('active_valid')
                    );
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



            it('continues useMainAccountProfile cleanup and startup when channel runtime clear throws', async () => {
                expectConsoleWarn([
                    'Identity-scoped runtime cleanup step failed: clearChannelManagerRuntimeState',
                    expect.objectContaining({
                        step: 'clearChannelManagerRuntimeState',
                        safeError: expect.objectContaining({ message: 'channel cleanup failed' }),
                    }),
                ]);
                await orchestrator.initialize(mockConfig);
                const resumeStartupAfterProfileSwitchSpy = jest
                    .spyOn(InitializationCoordinator.prototype, 'resumeStartupAfterProfileSwitch')
                    .mockResolvedValue(undefined);
                mockChannelManager.clearRuntimeState.mockImplementationOnce(() => {
                    throw new Error('channel cleanup failed');
                });

                try {
                    await expect(orchestrator.useMainAccountProfile()).resolves.toBeUndefined();

                    expect(mockScheduler.unloadChannel).toHaveBeenCalledTimes(1);
                    expect(mockEpg.clearSchedules).toHaveBeenCalledTimes(1);
                    expect(mockNavigation.goTo).toHaveBeenCalledWith('splash');
                    expect(resumeStartupAfterProfileSwitchSpy).toHaveBeenCalledTimes(1);
                } finally {
                    resumeStartupAfterProfileSwitchSpy.mockRestore();
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

    });

    describe('start', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('missing')
            );
        });

        it('should initialize modules in correct phase order', async () => {
            const initOrder: string[] = [];

            mockLifecycle.initialize.mockImplementation(async () => {
                initOrder.push('lifecycle');
            });
            mockNavigation.initialize.mockImplementation(async () => {
                initOrder.push('navigation');
            });
            mockPlexAuth.validateStoredCredentials.mockImplementation(async () => {
                initOrder.push('plex-auth');
                return createStoredValidationResult('active_valid');
            });
            mockPlexDiscovery.initialize.mockImplementation(async () => {
                initOrder.push('plex-discovery');
                return { kind: 'skipped_no_saved_server' };
            });

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

        it('should be ready after successful start', async () => {
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('active_valid')
            );
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
                mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                    createStoredValidationResult('active_valid')
                );
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

        it('forwards startup warmup options to the assembled current EPG coordinator', async () => {
            jest.useFakeTimers();
            const warmupSpy = jest
                .spyOn(EPGCoordinator.prototype, 'warmCurrentViewportForStartup')
                .mockResolvedValue(undefined);
            try {
                mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                    createStoredValidationResult('active_valid')
                );
                mockPlexDiscovery.isConnected.mockReturnValue(true);
                mockVideoPlayer.isPlaying.mockReturnValue(true);

                await orchestrator.start();
                await jest.advanceTimersByTimeAsync(1500);

                expect(warmupSpy).toHaveBeenCalledTimes(1);
                expect(warmupSpy.mock.instances[0]).toBe(
                    Reflect.get(orchestrator as object, '_epgCoordinator')
                );
                const options = warmupSpy.mock.calls[0]?.[0] as {
                    signal?: AbortSignal | null;
                    shouldContinue?: () => boolean;
                } | undefined;
                expect(options?.signal).toBeInstanceOf(AbortSignal);
                expect(options?.shouldContinue?.()).toBe(true);
            } finally {
                warmupSpy.mockRestore();
                mockVideoPlayer.isPlaying.mockReturnValue(false);
                jest.useRealTimers();
            }
        });

        it('should rerun setup when switching to a new server without setup record', async () => {
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('active_valid')
            );
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

        it('should wire scheduler, player, and lifecycle events after start', async () => {
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('active_valid')
            );
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
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('active_valid')
            );
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });
            mockLocalStorage.getItem.mockImplementation((key: string) => {
                if (key === LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE) return '1';
                if (key === LINEUP_STORAGE_KEYS.SUBTITLE_MODE) return 'off';
                return null;
            });

            await orchestrator.start();

            const setSubtitleTrackSpy = jest
                .spyOn(orchestrator, 'setSubtitleTrack')
                .mockResolvedValue(undefined);
            try {
                mockVideoPlayer.getAvailableSubtitles.mockReturnValue([
                    { id: 'sub-1', format: 'ass' },
                ]);

                playerHandlers.trackChange?.({ type: 'subtitle', trackId: 'sub-1' });

                expect(setSubtitleTrackSpy).toHaveBeenCalledWith(null);
            } finally {
                setSubtitleTrackSpy.mockRestore();
            }
        });
    });

    describe('switchToChannel', () => {
        beforeEach(async () => {
            // Reset mocks that may have been modified by previous tests
            mockChannelManager.getChannel.mockReturnValue(mockChannel);
            await orchestrator.initialize(mockConfig);
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
                outcome: ChannelSwitchOutcome;
                expectedError: RegExp | null;
                expectedScreen: 'channel-setup' | 'player' | null;
            }> = [
                {
                    outcome: { kind: 'failed', reason: 'missing_channel' },
                    expectedError: null,
                    expectedScreen: 'channel-setup',
                },
                {
                    outcome: { kind: 'failed', reason: 'content_unavailable' },
                    expectedError: /Initial channel switch failed for ch1: content_unavailable/,
                    expectedScreen: null,
                },
                {
                    outcome: { kind: 'aborted' },
                    expectedError: /Initial channel switch aborted for ch1/,
                    expectedScreen: null,
                },
                { outcome: { kind: 'switched' }, expectedError: null, expectedScreen: 'player' },
            ];

            for (const { outcome, expectedError, expectedScreen } of cases) {
                const localOrchestrator = createOrchestrator();
                await localOrchestrator.initialize(mockConfig);
                mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                    createStoredValidationResult('active_valid')
                );
                mockPlexDiscovery.isConnected.mockReturnValue(true);
                mockPlexDiscovery.getSelectedServer.mockReturnValue(null);
                mockLocalStorage.getItem.mockImplementation((key: string) => {
                    if (key === 'lineup_audio_setup_complete') return '1';
                    return null;
                });

                const switchSpy = jest
                    .spyOn(ChannelTuningCoordinator.prototype, 'switchToChannel')
                    .mockResolvedValueOnce(outcome);
                mockNavigation.replaceScreen.mockClear();

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
                        if (expectedScreen) {
                            expect(mockNavigation.replaceScreen).toHaveBeenCalledWith(expectedScreen);
                        } else {
                            expect(mockNavigation.replaceScreen).not.toHaveBeenCalled();
                        }
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
    });

    describe('switchToChannelByNumber', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
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
                'lineup_channel_setup_v3:server-3:user-1'
            );
            expect(mockNavigation.goTo).toHaveBeenCalledWith('channel-setup');
        });
    });

    describe('channel setup context', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it.each([
            { server: { id: 'server-4' }, channels: [], expected: 'first-time' },
            {
                server: { id: 'server-4' },
                channels: [{ ...mockChannel, id: 'channel-1' }],
                expected: 'existing',
            },
            { server: null, channels: [], expected: 'unknown' },
        ] as const)(
            'returns $expected for the selected server state',
            ({ server, channels, expected }) => {
                mockPlexDiscovery.getSelectedServer.mockReturnValue(server);
                mockChannelManager.getAllChannels.mockReturnValue(channels);

                expect(
                    orchestrator.getChannelSetupWorkflowPort().getSetupContextForSelectedServer()
                ).toBe(expected);
            }
        );
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




            it('routes channel transition activity through overlay badge recompute wiring', async () => {
                const syncSpy = jest.spyOn(
                    OverlayRuntimePolicyController.prototype,
                    'syncChannelBadgeOverlay'
                );

                try {
                    const { input: assemblyInput } = await captureCoordinatorAssembly();
                    syncSpy.mockClear();

                    assemblyInput.actions.onChannelTransitionActivityChange(true);

                    expect(syncSpy).toHaveBeenCalledTimes(1);
                } finally {
                    syncSpy.mockRestore();
                }
            });

            it('wires schedule state and selected-server accessors into coordinator assembly', async () => {
                const { input: assemblyInput } = await captureCoordinatorAssembly();

                expect(assemblyInput.schedule.lastChannelChangeSource()).toBeNull();
                assemblyInput.schedule.setLastChannelChangeSource('guide');
                expect(assemblyInput.schedule.lastChannelChangeSource()).toBe('guide');

                mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });
                expect(assemblyInput.schedule.getSelectedServerId()).toBe('server-1');
                expect(assemblyInput.schedule.getLocalMidnightMs(Date.now())).toEqual(
                    expect.any(Number)
                );
            });

            it('wires void and outcome channel-switch actions into coordinator assembly', async () => {
                const { orchestrator: assemblyOrchestrator, input: assemblyInput } =
                    await captureCoordinatorAssembly();
                const switchSpy = jest
                    .spyOn(assemblyOrchestrator, 'switchToChannel')
                    .mockResolvedValue(undefined);

                try {
                    await assemblyInput.actions.switchToChannel('channel-1');
                    expect(switchSpy).toHaveBeenCalledWith('channel-1', undefined);

                    await expect(
                        assemblyInput.actions.switchToChannelWithOutcome(mockChannel.id)
                    ).resolves.toEqual(expect.objectContaining({ kind: expect.any(String) }));
                } finally {
                    switchSpy.mockRestore();
                }
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

        it('opens server selection with the requested auto-connect policy', () => {
            orchestrator.openServerSelect({ allowAutoConnect: true });
            orchestrator.openServerSelect();
            orchestrator.closeEPG();
            orchestrator.toggleEPG();

            expect(mockNavigation.goTo).toHaveBeenCalledWith('server-select', {
                allowAutoConnect: true,
            });
            expect(mockNavigation.goTo).toHaveBeenCalledWith('server-select', {
                allowAutoConnect: false,
            });
            expect(mockEpg.hide).toHaveBeenCalled();
        });
    });

    describe('Now Playing Info overlay', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('active_valid')
            );
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

        it('should surface playback failure again when Retry cannot start playback', () => {
            mockScheduler.getState.mockReturnValue({
                isActive: false,
                channelId: 'ch1',
                currentProgram: null,
            });
            const actions = orchestrator.getRecoveryActions(AppErrorCode.PLAYBACK_DECODE_ERROR);

            actions[0]?.action();

            expect(mockScheduler.jumpToProgram).not.toHaveBeenCalled();
            expect(mockLifecycle.reportError).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.PLAYBACK_FAILED,
                    message: 'Playback retry failed',
                    recoverable: true,
                })
            );
            expectConsoleWarn([
                'Retry playback failed',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        message: 'Cannot retry playback without an active program',
                    }),
                }),
            ]);
            expectConsoleWarn([
                'Global error in playback',
                expect.objectContaining({
                    safeError: expect.objectContaining({
                        code: AppErrorCode.PLAYBACK_FAILED,
                    }),
                }),
            ]);
        });




            it('prepares one-shot startup resume before routing runtime AUTH_EXPIRED recovery to Auth', async () => {
                const authChangeSubscription: {
                    current: ((isAuthenticated: boolean) => void) | null;
                } = { current: null };
                mockPlexAuth.on.mockImplementation(((event: string, handler: (value: boolean) => void) => {
                    if (event !== 'authChange') {
                        return { dispose: jest.fn() };
                    }
                    authChangeSubscription.current = handler;
                    return {
                        dispose: jest.fn(() => {
                            authChangeSubscription.current = null;
                        }),
                    };
                }) as never);
                const prepareSpy = jest.spyOn(
                    InitializationCoordinator.prototype,
                    'prepareForRuntimeAuthRecovery'
                );
                const runStartupSpy = jest
                    .spyOn(InitializationCoordinator.prototype, 'runStartup')
                    .mockResolvedValue(undefined);

                try {
                    const signIn = orchestrator
                        .getRecoveryActions(AppErrorCode.AUTH_EXPIRED)
                        .find((action) => action.label === 'Sign In');
                    if (!signIn) {
                        throw new Error('Expected AUTH_EXPIRED recovery to expose Sign In');
                    }

                    signIn.action();

                    expect(prepareSpy).toHaveBeenCalledTimes(1);
                    expect(mockNavigation.goTo).toHaveBeenCalledWith('auth');
                    const prepareOrder = prepareSpy.mock.invocationCallOrder[0];
                    const routeOrder = mockNavigation.goTo.mock.invocationCallOrder.at(-1);
                    if (prepareOrder === undefined || routeOrder === undefined) {
                        throw new Error('Expected auth resume preparation and Auth routing');
                    }
                    expect(prepareOrder).toBeLessThan(routeOrder);

                    authChangeSubscription.current?.(true);
                    await Promise.resolve();

                    expect(runStartupSpy).toHaveBeenCalledTimes(1);
                    expect(runStartupSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
                    expect(authChangeSubscription.current).toBeNull();
                } finally {
                    prepareSpy.mockRestore();
                    runStartupSpy.mockRestore();
                }
            });



            it('prefers the scheduler current program when retrying playback', async () => {
                const { orchestrator: assemblyOrchestrator, input } =
                    await captureCoordinatorAssembly();
                input.playback.state.setCurrentProgramForPlayback({
                    item: {
                        ratingKey: 'stale-item',
                        title: 'Stale Item',
                        durationMs: 30000,
                        type: 'movie',
                    },
                    elapsedMs: 2000,
                    scheduledStartTime: 10,
                    scheduledEndTime: 30010,
                    remainingMs: 28000,
                    scheduleIndex: 9,
                } as never);
                const currentProgram = {
                    item: {
                        ratingKey: 'item-1',
                        title: 'Test Item',
                        durationMs: 60000,
                        type: 'movie',
                    },
                    elapsedMs: 5000,
                    scheduledStartTime: 0,
                    scheduledEndTime: 60000,
                    remainingMs: 55000,
                    scheduleIndex: 0,
                };
                mockScheduler.getState.mockReturnValue({
                    isActive: true,
                    channelId: 'ch1',
                    currentProgram,
                });
                const actions = assemblyOrchestrator.getRecoveryActions(AppErrorCode.PLAYBACK_DECODE_ERROR);

                expect(actions[0]).toEqual(expect.objectContaining({ label: 'Retry', isPrimary: true }));
                expect(actions[1]).toEqual(expect.objectContaining({ label: 'Skip', isPrimary: false }));

                actions[0]?.action();
                expect(mockScheduler.jumpToProgram).toHaveBeenCalledWith(currentProgram);
            });



            it('does not fall back to stale playback state when the active scheduler has no current program', async () => {
                const { orchestrator: assemblyOrchestrator, input } =
                    await captureCoordinatorAssembly();
                input.playback.state.setCurrentProgramForPlayback({
                    item: {
                        ratingKey: 'stale-item',
                        title: 'Stale Item',
                        durationMs: 30000,
                        type: 'movie',
                    },
                    elapsedMs: 2000,
                    scheduledStartTime: 10,
                    scheduledEndTime: 30010,
                    remainingMs: 28000,
                    scheduleIndex: 9,
                } as never);
                mockScheduler.getState.mockReturnValue({
                    isActive: true,
                    channelId: 'ch1',
                    currentProgram: null,
                });

                const actions = assemblyOrchestrator.getRecoveryActions(AppErrorCode.PLAYBACK_DECODE_ERROR);
                actions[0]?.action();

                expect(mockScheduler.jumpToProgram).not.toHaveBeenCalled();
                expect(mockLifecycle.reportError).toHaveBeenCalledWith(
                    expect.objectContaining({
                        code: AppErrorCode.PLAYBACK_FAILED,
                        message: 'Playback retry failed',
                        recoverable: true,
                    })
                );
                expectConsoleWarn([
                    'Retry playback failed',
                    expect.objectContaining({
                        safeError: expect.objectContaining({
                            message: 'Cannot retry playback without an active program',
                        }),
                    }),
                ]);
                expectConsoleWarn([
                    'Global error in playback',
                    expect.objectContaining({
                        safeError: expect.objectContaining({
                            code: AppErrorCode.PLAYBACK_FAILED,
                            message: 'Playback retry failed',
                        }),
                    }),
                ]);
            });
    });

    describe('shutdown', () => {
        beforeEach(async () => {
            await orchestrator.initialize(mockConfig);
        });

        it('shows warning toast when channel manager emits persistenceWarning', async () => {
            const toastHandler = jest.fn();
            orchestrator.setNowPlayingHandler(toastHandler);
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('active_valid')
            );
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

        it('clears the public playback snapshot on shutdown', async () => {
            const program = {
                item: {
                    ratingKey: 'snapshot-item',
                    title: 'Snapshot Movie',
                    fullTitle: 'Snapshot Movie',
                    durationMs: 60_000,
                    type: 'movie',
                    thumb: null,
                    year: 2024,
                    scheduledIndex: 0,
                },
                scheduledStartTime: 1_000,
                scheduledEndTime: 61_000,
                elapsedMs: 5_000,
                remainingMs: 55_000,
                scheduleIndex: 0,
                loopNumber: 0,
                isCurrent: true,
            } satisfies ScheduledProgram;
            let resolvePlaybackStarted!: () => void;
            const playbackStarted = new Promise<void>((resolve) => {
                resolvePlaybackStarted = resolve;
            });
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('active_valid')
            );
            mockPlexDiscovery.getSelectedServer.mockReturnValue({ id: 'server-1' });
            await orchestrator.start();
            mockChannelManager.getCurrentChannel.mockReturnValue(mockChannel);
            mockScheduler.getState.mockReturnValue({ isActive: false, channelId: null });
            mockPlexStreamResolver.resolveStream.mockResolvedValueOnce(makeDecision());
            mockVideoPlayer.play.mockImplementationOnce(async () => {
                resolvePlaybackStarted();
            });

            expect(schedulerHandlers.programStart).toBeDefined();
            schedulerHandlers.programStart?.(program);
            await playbackStarted;
            await Promise.resolve();

            expect(orchestrator.getPlaybackInfoSnapshot()).toEqual({
                channel: {
                    id: mockChannel.id,
                    number: mockChannel.number,
                    name: mockChannel.name,
                },
                program: {
                    itemKey: 'snapshot-item',
                    title: 'Snapshot Movie',
                    fullTitle: 'Snapshot Movie',
                    type: 'movie',
                    scheduledStartTime: 1_000,
                    scheduledEndTime: 61_000,
                    elapsedMs: 5_000,
                    remainingMs: 55_000,
                },
                stream: expect.objectContaining({
                    protocol: 'direct',
                    isDirectPlay: true,
                    isTranscoding: false,
                    sessionId: 'sess-1',
                }),
            });

            await orchestrator.shutdown();

            expect(orchestrator.getPlaybackInfoSnapshot()).toEqual({
                channel: null,
                program: null,
                stream: null,
            });
        });

        it('flushes pending channel saves before module teardown', async () => {
            await orchestrator.shutdown();

            expect(mockChannelManager.flushSaves).toHaveBeenCalledTimes(1);
        });

        it('drains shared source producers before flushing saves and disposing dependencies', async () => {
            let releaseDrain!: () => void;
            const drain = new Promise<void>((resolve) => { releaseDrain = resolve; });
            let markStarted!: () => void;
            const started = new Promise<void>((resolve) => { markStarted = resolve; });
            mockChannelManager.supersedeActiveResolutions.mockImplementationOnce(() => {
                markStarted();
                return drain;
            });
            const shutdown = orchestrator.shutdown();
            try {
                await started;
                expect(mockChannelManager.supersedeActiveResolutions).toHaveBeenCalledTimes(1);
                expect(mockChannelManager.flushSaves).not.toHaveBeenCalled();
                expect(mockChannelManager.dispose).not.toHaveBeenCalled();
                expect(mockVideoPlayer.destroy).not.toHaveBeenCalled();
            } finally {
                releaseDrain();
                await shutdown;
            }
            expect(mockChannelManager.flushSaves).toHaveBeenCalledTimes(1);
            expect(mockChannelManager.dispose).toHaveBeenCalledTimes(1);
        });

        it('disposes channel manager on shutdown', async () => {
            await orchestrator.shutdown();

            expect(mockChannelManager.dispose).toHaveBeenCalledTimes(1);
        });

        it('disposes the playback runtime controller on shutdown', async () => {
            const disposeSpy = jest.spyOn(PlaybackRuntimeController.prototype, 'dispose');
            try {
                await orchestrator.shutdown();

                expect(disposeSpy).toHaveBeenCalledTimes(1);
            } finally {
                disposeSpy.mockRestore();
            }
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

        it('drains assembled EPG warmup before channel and player teardown', async () => {
            jest.useFakeTimers();
            const order: string[] = [];
            let resolveWarmup: (() => void) | null = null;
            const releaseWarmupIfStarted = (): void => {
                const release = resolveWarmup as (() => void) | null;
                if (release) release();
            };
            const warmupStarted = new Promise<void>((resolve) => {
                jest.spyOn(EPGCoordinator.prototype, 'warmCurrentViewportForStartup')
                    .mockImplementation(() => new Promise<void>((release) => {
                        order.push('epgWarmup.start');
                        resolveWarmup = release;
                        resolve();
                    }));
            });
            const originalDrain = InitializationCoordinator.prototype.drainEpgWarmupForShutdown;
            const drainSpy = jest
                .spyOn(InitializationCoordinator.prototype, 'drainEpgWarmupForShutdown')
                .mockImplementation(async function (this: InitializationCoordinator): Promise<void> {
                    order.push('epgWarmup.drain.start');
                    await originalDrain.call(this);
                    order.push('epgWarmup.drain.end');
                });

            try {
                mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                    createStoredValidationResult('active_valid')
                );
                mockPlexDiscovery.isConnected.mockReturnValue(true);
                mockVideoPlayer.isPlaying.mockReturnValue(true);
                (mockChannelManager.flushSaves as jest.Mock).mockImplementationOnce(async () => {
                    order.push('channelManager.flushSaves');
                });
                (mockChannelManager.dispose as jest.Mock).mockImplementationOnce(() => {
                    order.push('channelManager.dispose');
                });
                (mockVideoPlayer.destroy as jest.Mock).mockImplementationOnce(() => {
                    order.push('videoPlayer.destroy');
                });

                await orchestrator.start();
                await jest.advanceTimersByTimeAsync(1500);
                await warmupStarted;

                const shutdown = orchestrator.shutdown();
                await Promise.resolve();

                expect(drainSpy).toHaveBeenCalledTimes(1);
                expect(mockChannelManager.flushSaves).not.toHaveBeenCalled();
                expect(mockChannelManager.dispose).not.toHaveBeenCalled();
                expect(mockVideoPlayer.destroy).not.toHaveBeenCalled();

                releaseWarmupIfStarted();
                await shutdown;

                expect(order.indexOf('epgWarmup.drain.start')).toBeGreaterThanOrEqual(0);
                expect(order.indexOf('epgWarmup.drain.end')).toBeLessThan(
                    order.indexOf('channelManager.flushSaves')
                );
                expect(order.indexOf('channelManager.flushSaves')).toBeLessThan(
                    order.indexOf('channelManager.dispose')
                );
                expect(order.indexOf('channelManager.dispose')).toBeLessThan(
                    order.indexOf('videoPlayer.destroy')
                );
            } finally {
                releaseWarmupIfStarted();
                drainSpy.mockRestore();
                jest.restoreAllMocks();
                mockVideoPlayer.isPlaying.mockReturnValue(false);
                jest.useRealTimers();
            }
        });

        it('should destroy modules on shutdown', async () => {
            await orchestrator.shutdown();

            expect(mockEpg.destroy).toHaveBeenCalledTimes(1);
            expect(mockChannelNumberOverlay.destroy).toHaveBeenCalledTimes(1);
            expect(mockChannelBadgeOverlay.destroy).toHaveBeenCalledTimes(1);
            expect(mockVideoPlayer.destroy).toHaveBeenCalledTimes(1);
            expect(mockNavigation.destroy).toHaveBeenCalledTimes(1);
        });

        it('rejects public facade use after shutdown', async () => {
            await orchestrator.shutdown();

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
            await expect(orchestrator.retryQuarantineRecovery()).rejects.toMatchObject({
                code: AppErrorCode.MODULE_INIT_FAILED,
                recoverable: false,
                context: {
                    method: 'retryQuarantineRecovery',
                    lifecycle: 'shutdown',
                },
            });
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

        it('should set ready to false after shutdown', async () => {
            // First start to set ready
            mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                createStoredValidationResult('active_valid')
            );
            mockPlexDiscovery.isConnected.mockReturnValue(true);
            await orchestrator.start();
            expect(orchestrator.isReady()).toBe(true);

            // Then shutdown
            await orchestrator.shutdown();
            expect(orchestrator.isReady()).toBe(false);
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
                const { orchestrator: assemblyOrchestrator, input } =
                    await captureCoordinatorAssembly();
                input.playback.state.setCurrentStreamDecision(
                    makeDecision({ isTranscoding: true, sessionId: 'transcode-session' })
                );
                mockPlexStreamResolver.stopTranscodeSession.mockImplementationOnce(() => {
                    throw new Error('transcode cleanup failed');
                });

                await expect(assemblyOrchestrator.shutdown()).resolves.toBeUndefined();

                expect(mockPlexStreamResolver.stopTranscodeSession)
                    .toHaveBeenCalledWith('transcode-session');
                expect(mockVideoPlayer.stop).toHaveBeenCalledTimes(1);
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

                mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                    createStoredValidationResult('active_valid')
                );
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



            it('records schedule day rollover disposal failures and continues shutdown', async () => {
                expectConsoleWarn([
                    'Shutdown teardown failures',
                    expect.objectContaining({
                        teardownFailures: expect.arrayContaining([
                            expect.objectContaining({ step: 'scheduleDayRolloverController.dispose' }),
                        ]),
                    }),
                ]);

                const disposeSpy = jest
                    .spyOn(ScheduleDayRolloverController.prototype, 'dispose')
                    .mockImplementationOnce(() => {
                        throw new Error('rollover dispose failed');
                    });

                try {
                    await expect(orchestrator.shutdown()).resolves.toBeUndefined();

                    expect(disposeSpy).toHaveBeenCalledTimes(1);
                    expect(mockNavigation.destroy).toHaveBeenCalled();
                } finally {
                    disposeSpy.mockRestore();
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

            it('wires selected PMS credentials into playback resource URLs', async () => {
                mockPlexDiscovery.getServerUri.mockReturnValue('https://selected.example:32400');
                mockPlexDiscovery.getSelectedServerAuthHeaders.mockReturnValue({
                    'X-Plex-Token': 'selected-pms-token',
                });
                mockPlexAuth.getAuthHeaders.mockReturnValue({
                    'X-Plex-Token': 'cloud-home-token',
                });

                const { input } = await captureCoordinatorAssembly();
                const result = input.playback.buildPlexResourceUrl('/library/metadata/1/thumb');

                expect(result).not.toBeNull();
                expect(result).toContain('X-Plex-Token=selected-pms-token');
                expect(result).not.toContain('cloud-home-token');
                expect(mockPlexAuth.getAuthHeaders).not.toHaveBeenCalled();
            });

            it('refreshes server decision data only when playback state can support it', async () => {
                const ensureServerDecisionSpy = jest
                    .spyOn(NowPlayingDebugManager.prototype, 'ensureServerDecisionForPlaybackInfoSnapshot')
                    .mockResolvedValue(undefined);

                try {
                    const { orchestrator: assemblyOrchestrator, input } =
                        await captureCoordinatorAssembly();
                    input.playback.state.setCurrentProgramForPlayback({
                        item: {
                            ratingKey: 'item-1',
                            title: 'Episode',
                            fullTitle: 'Show - Episode',
                            type: 'episode',
                        },
                        scheduledStartTime: 100,
                        scheduledEndTime: 200,
                        elapsedMs: 25,
                        remainingMs: 75,
                    } as ScheduledProgram);
                    input.playback.state.setCurrentStreamDecision(makeDecision());
                    input.playback.state.setCurrentStreamDescriptor({
                        protocol: 'hls',
                        mimeType: 'application/vnd.apple.mpegurl',
                    } as never);

                    await expect(assemblyOrchestrator.refreshPlaybackInfoSnapshot()).resolves.toMatchObject({
                        stream: expect.objectContaining({ sessionId: expect.any(String) }),
                    });
                    expect(ensureServerDecisionSpy).toHaveBeenCalledTimes(1);

                    input.playback.state.setCurrentStreamDecision(null);
                    await expect(assemblyOrchestrator.refreshPlaybackInfoSnapshot()).resolves.toMatchObject({
                        stream: null,
                    });
                    expect(ensureServerDecisionSpy).toHaveBeenCalledTimes(1);
                } finally {
                    ensureServerDecisionSpy.mockRestore();
                }
            });



    });



    describe("Plex sign-out storage scope", () => {

                it('clears selected-library filter scope after sign-out clears identity', async () => {
                    await orchestrator.initialize(mockConfig);
                    const scopeSpy = jest.spyOn(EpgPreferencesStore.prototype, 'setLibraryFilterScope');
                    const cancelRolloverSpy = jest.spyOn(
                        ScheduleDayRolloverController.prototype,
                        'cancelPendingDayRollover'
                    );
                    const clearSelectedSnapshotSpy = jest.spyOn(
                        EPGCoordinator.prototype,
                        'clearSelectedChannelScheduleSnapshot'
                    );
                    scopeSpy.mockClear();

                    try {
                        await orchestrator.signOutPlex();

                        expect(scopeSpy).toHaveBeenLastCalledWith(null);
                        expect(cancelRolloverSpy).toHaveBeenCalledTimes(1);
                        const cancelCallOrder = cancelRolloverSpy.mock.invocationCallOrder[0];
                        const epgClearCallOrder = clearSelectedSnapshotSpy.mock.invocationCallOrder[0];
                        if (cancelCallOrder === undefined || epgClearCallOrder === undefined) {
                            throw new Error('Expected rollover cancellation and EPG clearing to run');
                        }
                        expect(cancelCallOrder).toBeLessThan(epgClearCallOrder);
                    } finally {
                        scopeSpy.mockRestore();
                        cancelRolloverSpy.mockRestore();
                        clearSelectedSnapshotSpy.mockRestore();
                    }
                });



                it('continues sign-out when discovery cleanup is synchronously superseded', async () => {
                    await orchestrator.initialize(mockConfig);
                    mockPlexDiscovery.clearSelection.mockImplementationOnce(() => {
                        throw new PlexDiscoverySelectionSupersededError();
                    });

                    await expect(orchestrator.signOutPlex()).resolves.toBeUndefined();

                    expect(mockPlexAuth.clearCredentials).toHaveBeenCalledTimes(1);
                    expect(mockChannelManager.clearRuntimeState).toHaveBeenCalledTimes(1);
                });



                it('continues to propagate unrelated sign-out discovery cleanup failures', async () => {
                    await orchestrator.initialize(mockConfig);
                    const cleanupError = new Error('discovery cleanup failed');
                    mockPlexDiscovery.clearSelection.mockImplementationOnce(() => {
                        throw cleanupError;
                    });

                    await expect(orchestrator.signOutPlex()).rejects.toBe(cleanupError);
                });
    });

    describe("schedule day rollover", () => {

                it('clears the selected-channel snapshot and rebuilds the active schedule before refreshing EPG schedules on day rollover', async () => {
                    await orchestrator.initialize(mockConfig);
                    mockPlexAuth.validateStoredCredentials.mockResolvedValue(
                        createStoredValidationResult('active_valid')
                    );
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
                            return READY_EPG_REFRESH_RESULT;
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

                        expect(mockChannelManager.resolveChannelContent).toHaveBeenCalledWith(mockChannel.id, {
                            signal: null,
                        });
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
});
