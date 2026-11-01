import type { INavigationManager, Screen } from '../../../modules/navigation';
import type { AppError, LifecycleAppError, LifecycleEventMap } from '../../../modules/lifecycle/types';
import type { PlexHomeUser, PlexPinCancellationResult, PlexPinRequest } from '../../../modules/plex/auth';
import type {
    PlexServer,
    PlexServerSelectionFailureReason,
    ServerHealthRecord,
    ServerHealthStatus,
    ServerHealthType,
} from '../../../modules/plex/discovery';
import type { GuideSettingChange, SettingsPersistenceResult } from '../../../modules/ui/settings/types';
import type { ThemeName } from '../../../modules/ui/theme';
import type { OverlayTransparency } from '../../../modules/settings/NowPlayingDisplayStore';
import type { ChannelSetupScreenWorkflowPort } from '../../channel-setup/workflow/ChannelSetupScreenWorkflowPort';
import type { ChannelSetupWorkflowPort } from '../../channel-setup/workflow/ChannelSetupWorkflowPort';
import type { ModuleStatus, OrchestratorConfig } from '../../orchestrator/contracts/OrchestratorTypes';
import type { InitializationRestoreProjection } from '../../initialization/InitializationRestoreProjection';
import type { PlaybackInfoSnapshot } from '../../orchestrator/runtime/OrchestratorPlaybackInfoSnapshot';
import type { BlockingErrorOverlayAction } from '../chrome/AppBlockingErrorOverlayPresenter';
import type { ToastInput } from '../../../shared/toast';
import type { IDisposable } from '../../../utils/interfaces';
import type { AppErrorCode } from '../../../types/app-errors';
import type { EpgScheduleRefreshOutcome } from '../../../shared/epgRefresh';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { IPlexLibrary } from '../../../modules/plex/library/interfaces';
import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';
import type {
    SelectedServerQuarantineCommandState,
    SelectedServerQuarantineRecoveryPresentation,
} from '../../server-selection/SelectedServerQuarantineRecoveryState';

export interface AppShellNavigationRuntimePort {
    getNavigation(): INavigationManager | null;
}

export interface AppShellAuthRuntimePort {
    requestAuthPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
    pollForPin(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
    cancelPin(pinId: number): Promise<PlexPinCancellationResult>;
}

export interface AppShellProfileRuntimePort {
    getHomeUsers(options?: { signal?: AbortSignal | null }): Promise<PlexHomeUser[]>;
    switchHomeUser(userId: string, options?: { pin?: string | null; signal?: AbortSignal | null }): Promise<void>;
    useMainAccountProfile(): Promise<void>;
    signOutPlex(): Promise<void>;
}

export type AppShellServerSelectionResult =
    | {
        kind: 'selection_failed';
        reason: 'server_not_found' | PlexServerSelectionFailureReason;
    }
    | {
        kind: 'selected';
        persistedSelection:
            | 'updated'
            | 'skipped_missing_credentials'
            | 'skipped_corrupted_credentials';
        epgRefresh: EpgScheduleRefreshOutcome;
    };

export type AppShellChannelSetupRerunRequestResult =
    | { ok: true; serverId: string }
    | { ok: false; reason: 'missing-selected-server' };

export type AppShellServerHealthStatus = ServerHealthStatus;

export type AppShellServerHealthType = ServerHealthType;

export type AppShellServerHealthRecord = ServerHealthRecord;

export type AppShellServerSelectState = {
    selectedServerId: string | null;
    serverHealth: Record<string, AppShellServerHealthRecord>;
};

export interface AppShellServerSelectionRuntimePort {
    discoverServers(options?: { forceRefresh?: boolean; signal?: AbortSignal | null }): Promise<PlexServer[]>;
    selectServer(
        serverId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<AppShellServerSelectionResult>;
    clearSelectedServer(): Promise<void>;
    getSelectedServerScreenState(): AppShellServerSelectState;
    requestChannelSetupRerun(): AppShellChannelSetupRerunRequestResult;
}

export interface AppShellChannelSetupRuntimePort {
    getChannelSetupScreenWorkflowPort(): ChannelSetupScreenWorkflowPort;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
}

export interface AppShellSettingsRuntimePort {
    setSubtitleTrack(trackId: string | null): Promise<void>;
    onGuideSettingChange(change: GuideSettingChange): void;
    getActiveUsername(): string | null;
    getTheme(): ThemeName;
    setTheme(theme: ThemeName): SettingsPersistenceResult;
    getThemePersistenceResult(): SettingsPersistenceResult;
    retryThemePersistence(): SettingsPersistenceResult;
    updateSettingsPlaybackPolicy(keepRunning: boolean): void;
    setOverlayTransparency(value: OverlayTransparency): void;
    setAccessibilityPreference(name: 'reduceMotion' | 'largeFocus', enabled: boolean): void;
    switchProfileFromSettings(): void;
    switchServerFromSettings(): void;
    signOutFromSettings(): Promise<void>;
}

export type AppShellPlaybackInfoSnapshot = PlaybackInfoSnapshot;

export interface AppShellDiagnosticsRuntimePort {
    toggleServerSelect(): void;
    refreshPlaybackInfoSnapshot(): Promise<AppShellPlaybackInfoSnapshot>;
    getSelectedServerId(): string | null;
    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort;
}

export type AppRuntimeLifecycleEvents = Pick<
    LifecycleEventMap,
    'networkWarning' | 'persistenceWarning' | 'phaseChange'
>;

export type AppShellChannelSetupOrchestratorRuntime = Omit<
    AppShellChannelSetupRuntimePort,
    'getChannelSetupScreenWorkflowPort'
>;

export type AppShellAuthoringManager = Pick<IChannelManager,
    'getLastLoadOutcome' | 'getStructuralBase' | 'getAllChannels' | 'getChannel'
    | 'tryReplaceAllChannels' | 'resolveChannelContent' | 'tryCreateChannel' | 'tryUpdateChannel'>;

export type AppShellAuthoringLibrary = Pick<IPlexLibrary,
    'getLibraries' | 'getShows' | 'getShowEpisodes' | 'getShowSeasons' | 'getCollections'
    | 'getPlaylists' | 'search' | 'getLibraryItems' | 'getCollectionItems'
    | 'getPlaylistItems' | 'getItem'>;

export interface AppShellOrchestratorRuntime
    extends AppShellAuthRuntimePort,
    AppShellChannelSetupOrchestratorRuntime,
    AppShellDiagnosticsRuntimePort,
    AppShellNavigationRuntimePort,
    AppShellProfileRuntimePort,
    AppShellServerSelectionRuntimePort,
    Pick<AppShellSettingsRuntimePort, 'getActiveUsername' | 'onGuideSettingChange' | 'setSubtitleTrack'> {
    getActiveMediaIdentity(): import('../../channel-authoring-runtime/ChannelAuthoringRuntimeContracts').ActiveMediaIdentity | null;
    getDirectoryScopeKey(): string;
    stopDeletedMediaIfCurrent(identity: import('../../channel-authoring-runtime/ChannelAuthoringRuntimeContracts').ActiveMediaIdentity): Promise<'stopped' | 'superseded'>;
    refreshAfterSave(effect: import('../../channel-authoring-runtime/ChannelAuthoringRuntimeContracts').SavedChannelEffect): Promise<void>;
    getChannelAuthoringManager(): AppShellAuthoringManager | null;
    getChannelAuthoringLibrary(): AppShellAuthoringLibrary | null;
    getChannelAuthoringImageUrl(path: string, width: number, height: number): string | null;
    refreshChannelDirectoryAfterCommit(): Promise<void>;
    switchToChannelWithOutcome(channelId: string): Promise<ChannelSwitchOutcome>;
    updateSettingsPlaybackPolicy(keepRunning: boolean): void;
    initialize(config: OrchestratorConfig): Promise<void>;
    start(options?: { signal?: AbortSignal }): Promise<void>;
    shutdown(): Promise<void>;
    getModuleStatus(): Map<string, ModuleStatus>;
    isReady(): boolean;
    getStartupRestoreProjection(): InitializationRestoreProjection | null;
    subscribeToStartupRestoreProjection(listener: (projection: InitializationRestoreProjection) => void): IDisposable;
    getCurrentScreen(): Screen | null;
    openEPG(): void;
    closeEPG(): void;
    toggleEPG(): void;
    registerErrorHandler(moduleId: string, handler: (error: AppError) => boolean): void;
    toLifecycleAppError(error: AppError): LifecycleAppError;
    onScreenChange(handler: (from: string, to: string) => void): IDisposable;
    onLifecycleEvent<K extends keyof AppRuntimeLifecycleEvents>(
        event: K,
        handler: (payload: AppRuntimeLifecycleEvents[K]) => void
    ): IDisposable;
    getRecoveryActions(errorCode: AppErrorCode): BlockingErrorOverlayAction[];
    setNowPlayingHandler(handler: ((toast: ToastInput) => void) | null): void;
    getQuarantineState(): SelectedServerQuarantineCommandState;
    retryQuarantineRecovery(): Promise<SelectedServerQuarantineRecoveryPresentation>;
    exitQuarantine(): Promise<void>;
}
