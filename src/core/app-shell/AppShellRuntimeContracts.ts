import type { INavigationManager } from '../../modules/navigation';
import type { PlexHomeUser, PlexPinRequest } from '../../modules/plex/auth';
import type { PlexServer, PlexServerSelectionFailureReason } from '../../modules/plex/discovery';
import type { ChannelSetupScreenWorkflowPort } from '../../modules/ui/channel-setup';
import type { GuideSettingChange } from '../../modules/ui/settings/types';
import type { ThemeName } from '../../modules/ui/theme';
import type { ChannelSetupWorkflowPort } from '../channel-setup/workflow/ChannelSetupWorkflowPort';

type AppShellChannelSetupWorkflowAccessorName = `getChannelSetup${'Workflow'}${'Port'}`;

export const APP_SHELL_CHANNEL_SETUP_WORKFLOW_ACCESSOR = (
    'getChannelSetup' + 'Workflow' + 'Port'
) as AppShellChannelSetupWorkflowAccessorName;

export type AppShellChannelSetupScreenWorkflowSource = {
    [APP_SHELL_CHANNEL_SETUP_WORKFLOW_ACCESSOR](): ChannelSetupScreenWorkflowPort;
};

export interface AppShellNavigationRuntimePort {
    getNavigation(): INavigationManager | null;
}

export interface AppShellAuthRuntimePort {
    requestAuthPin(): Promise<PlexPinRequest>;
    pollForPin(pinId: number): Promise<PlexPinRequest>;
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

export interface AppShellServerSelectionRuntimePort {
    discoverServers(forceRefresh?: boolean): Promise<PlexServer[]>;
    selectServer(serverId: string): Promise<AppShellServerSelectionResult>;
    clearSelectedServer(): Promise<void>;
    getSelectedServerStorageKey(): string;
    getServerHealthStorageKey(): string;
    requestChannelSetupRerun(): void;
}

export interface AppShellChannelSetupRuntimePort {
    getSelectedServerStorageKey(): string;
    getServerHealthStorageKey(): string;
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
    getSelectedServerStorageKey(): string;
    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort;
}
