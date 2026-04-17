import type { INavigationManager } from '../../modules/navigation';
import type { PlexHomeUser, PlexPinRequest } from '../../modules/plex/auth';
import type { PlexServer } from '../../modules/plex/discovery';
import type { GuideSettingChange } from '../../modules/ui/settings/types';
import type { ThemeName } from '../../modules/ui/theme';
import type { PlaybackInfoSnapshot } from '../orchestrator/AppOrchestrator';
import type { ChannelSetupWorkflowPort } from '../channel-setup/ChannelSetupWorkflowPort';
import type { OrchestratorServerSelectionResult } from '../server-selection/ServerSelectionTypes';

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

export interface AppShellServerSelectionRuntimePort {
    discoverServers(forceRefresh?: boolean): Promise<PlexServer[]>;
    selectServer(serverId: string): Promise<OrchestratorServerSelectionResult>;
    clearSelectedServer(): Promise<void>;
    getSelectedServerStorageKey(): string;
    getServerHealthStorageKey(): string;
    requestChannelSetupRerun(): void;
}

export interface AppShellChannelSetupRuntimePort {
    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort;
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

export interface AppShellDiagnosticsRuntimePort {
    toggleServerSelect(): void;
    refreshPlaybackInfoSnapshot(): Promise<PlaybackInfoSnapshot>;
    getSelectedServerId(): string | null;
    getSelectedServerStorageKey(): string;
    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort;
}
