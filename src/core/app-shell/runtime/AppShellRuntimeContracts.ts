import type { INavigationManager, Screen } from '../../../modules/navigation';
import type { AppError, LifecycleAppError, LifecycleEventMap } from '../../../modules/lifecycle/types';
import type { PlexHomeUser, PlexPinRequest } from '../../../modules/plex/auth';
import type {
    PlexServer,
    PlexServerSelectionFailureReason,
    ServerHealthRecord,
    ServerHealthStatus,
    ServerHealthType,
} from '../../../modules/plex/discovery';
import type { GuideSettingChange } from '../../../modules/ui/settings/types';
import type { ThemeName } from '../../../modules/ui/theme';
import type { ChannelSetupScreenWorkflowPort } from '../../channel-setup/workflow/ChannelSetupScreenWorkflowPort';
import type { ChannelSetupWorkflowPort } from '../../channel-setup/workflow/ChannelSetupWorkflowPort';
import type { ModuleStatus, OrchestratorConfig } from '../../orchestrator/contracts/OrchestratorTypes';
import type { PlaybackInfoSnapshot } from '../../orchestrator/runtime/OrchestratorPlaybackInfoSnapshot';
import type { BlockingErrorOverlayAction } from '../chrome/AppBlockingErrorOverlayPresenter';
import type { ToastInput } from '../../../shared/toast';
import type { IDisposable } from '../../../utils/interfaces';
import type { AppErrorCode } from '../../../types/app-errors';
import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';
import type { EpgScheduleRefreshOutcome } from '../../../shared/epgRefresh';
import type { SelectedServerQuarantineCommandState } from '../../server-selection/SelectedServerQuarantineRecoveryState';

export interface AppShellNavigationRuntimePort {
    getNavigation(): INavigationManager | null;
}

export interface AppShellAuthRuntimePort {
    requestAuthPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
    pollForPin(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
    cancelPin(pinId: number): Promise<void>;
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
    switchToChannelByNumberWithOutcome(number: number, options?: { signal?: AbortSignal }): Promise<ChannelSwitchOutcome>;
    openEPG(): void;
}

export interface AppShellSettingsRuntimePort {
    setSubtitleTrack(trackId: string | null): Promise<void>;
    onGuideSettingChange(change: GuideSettingChange): void;
    getActiveUsername(): string | null;
    getTheme(): ThemeName;
    setTheme(theme: ThemeName): void;
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

export interface AppShellOrchestratorRuntime
    extends AppShellAuthRuntimePort,
    AppShellChannelSetupOrchestratorRuntime,
    AppShellDiagnosticsRuntimePort,
    AppShellNavigationRuntimePort,
    AppShellProfileRuntimePort,
    AppShellServerSelectionRuntimePort,
    Pick<AppShellSettingsRuntimePort, 'getActiveUsername' | 'onGuideSettingChange' | 'setSubtitleTrack'> {
    initialize(config: OrchestratorConfig): Promise<void>;
    start(): Promise<void>;
    shutdown(): Promise<void>;
    getModuleStatus(): Map<string, ModuleStatus>;
    isReady(): boolean;
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
    retryQuarantineRecovery(): Promise<void>;
    exitQuarantine(): Promise<void>;
}
