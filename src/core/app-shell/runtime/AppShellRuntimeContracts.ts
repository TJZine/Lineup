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
import type { BlockingErrorOverlayAction } from '../chrome/AppBlockingErrorOverlayPresenter';
import type { ToastInput } from '../../../shared/toast';
import type { IDisposable } from '../../../utils/interfaces';
import type { AppErrorCode } from '../../../types/app-errors';

export interface AppShellNavigationRuntimePort {
    getNavigation(): INavigationManager | null;
}

export interface AppShellAuthRuntimePort {
    requestAuthPin(): Promise<PlexPinRequest>;
    pollForPin(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
    cancelPin(pinId: number): Promise<void>;
}

export interface AppShellProfileRuntimePort {
    getHomeUsers(): Promise<PlexHomeUser[]>;
    switchHomeUser(userId: string, pin?: string): Promise<void>;
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
    };

export type AppShellServerHealthStatus = ServerHealthStatus;

export type AppShellServerHealthType = ServerHealthType;

export type AppShellServerHealthRecord = ServerHealthRecord;

export type AppShellServerSelectState = {
    selectedServerId: string | null;
    serverHealth: Record<string, AppShellServerHealthRecord>;
};

export interface AppShellServerSelectionRuntimePort {
    discoverServers(forceRefresh?: boolean): Promise<PlexServer[]>;
    selectServer(serverId: string): Promise<AppShellServerSelectionResult>;
    clearSelectedServer(): Promise<void>;
    getSelectedServerScreenState(): AppShellServerSelectState;
    requestChannelSetupRerun(): void;
}

export interface AppShellChannelSetupRuntimePort {
    getChannelSetupScreenWorkflowPort(): ChannelSetupScreenWorkflowPort;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
    switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void>;
    openEPG(): void;
}

export interface AppShellSettingsRuntimePort {
    setSubtitleTrack(trackId: string | null): Promise<void>;
    onGuideSettingChange(change: GuideSettingChange): void;
    getActiveUsername(): string | null;
    getTheme(): ThemeName;
    setTheme(theme: ThemeName): void;
}

export interface AppShellPlaybackInfoSnapshot {
    channel: { id: string; number: number; name: string } | null;
    program: {
        itemKey: string;
        title: string;
        fullTitle: string;
        type: string;
        scheduledStartTime: number;
        scheduledEndTime: number;
        elapsedMs: number;
        remainingMs: number;
    } | null;
    stream: {
        protocol: string;
        mimeType: string;
        isDirectPlay: boolean;
        isTranscoding: boolean;
        container: string;
        videoCodec: string;
        audioCodec: string;
        subtitleDelivery: string;
        bitrate: number;
        width: number;
        height: number;
        sessionId: string;
        selectedAudio: {
            id: string;
            codec: string | null | undefined;
            channels?: number;
            language?: string;
            title?: string;
            default?: boolean;
        } | null;
        selectedSubtitle: {
            id: string;
            codec: string | null | undefined;
            language?: string;
            title?: string;
            format?: string;
            default?: boolean;
        } | null;
        directPlay?: {
            allowed: boolean;
            reasons: string[];
        } | undefined;
        audioFallback?: {
            fromCodec: string;
            toCodec: string;
            reason: string;
        } | undefined;
        source?: {
            container: string;
            videoCodec: string;
            audioCodec: string;
            width: number;
            height: number;
            bitrate: number;
        } | undefined;
        transcodeRequest?: {
            sessionId: string;
            maxBitrate: number;
            audioStreamId?: string;
        } | undefined;
        serverDecision?: {
            videoDecision?: string;
            audioDecision?: string;
            subtitleDecision?: string;
            decisionText?: string;
        } | undefined;
    } | null;
}

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
}
