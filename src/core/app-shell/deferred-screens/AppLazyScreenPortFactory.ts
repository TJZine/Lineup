import type { AuthScreenPorts } from '../../../modules/ui/auth';
import type { ChannelSetupScreenPorts } from '../../../modules/ui/channel-setup';
import type { INavigationManager } from '../../../modules/navigation';
import type { ProfileSelectScreenPorts } from '../../../modules/ui/profile-select';
import type {
    ServerSelectScreenPorts,
    ServerSelectSelectionResult,
} from '../../../modules/ui/server-select';
import type { GuideSettingChange, SettingsPersistenceResult } from '../../../modules/ui/settings/types';
import type { ThemeName } from '../../../modules/ui/theme';
import type { OverlayTransparency } from '../../../modules/settings/NowPlayingDisplayStore';
import type { ChannelSetupScreenWorkflowPort } from '../../channel-setup/workflow/ChannelSetupScreenWorkflowPort';
import type { ChannelSetupWorkflowPort } from '../../channel-setup/workflow/ChannelSetupWorkflowPort';
import type {
    AppShellAuthRuntimePort,
    AppShellChannelSetupRuntimePort,
    AppShellNavigationRuntimePort,
    AppShellProfileRuntimePort,
    AppShellServerSelectionRuntimePort,
    AppShellSettingsRuntimePort,
} from '../runtime/AppShellRuntimeContracts';

function assertUnhandledServerSelectionResult(result: never): never {
    const resultKind = (result as { kind?: unknown }).kind;
    throw new Error(`Unhandled server selection result kind: ${String(resultKind)}`);
}

export const createChannelSetupScreenWorkflowPort = (
    workflowPort: ChannelSetupWorkflowPort
): ChannelSetupScreenWorkflowPort => ({
    invalidateFacetSnapshot: () => workflowPort.invalidateFacetSnapshot(),
    invalidateSessionData: () => workflowPort.invalidateSessionData(),
    getLibrariesForSetup: (signal) => workflowPort.getLibrariesForSetup(signal),
    scanSetupInventory: (config, options) => workflowPort.scanSetupInventory(config, options),
    retrySetupInventory: (libraryId) => workflowPort.retrySetupInventory(libraryId),
    getChannelSetupRecord: (serverId) => workflowPort.getChannelSetupRecord(serverId),
    getSetupContextForSelectedServer: () => workflowPort.getSetupContextForSelectedServer(),
    getSetupPreview: (config, options) => workflowPort.getSetupPreview(config, options),
    getSetupReview: (config, options) => workflowPort.getSetupReview(config, options),
    applySetupReview: (reviewId, config, consent, options) =>
        workflowPort.applySetupReview(reviewId, config, consent, options),
    cancelPreparedReview: () => workflowPort.cancelPreparedReview(),
    markSetupComplete: (serverId, setupConfig, expectedScopeKey) =>
        workflowPort.markSetupComplete(serverId, setupConfig, expectedScopeKey),
});

interface AppShellChannelSetupRuntimeSource {
    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
}

export const createChannelSetupRuntimePort = (
    runtime: AppShellChannelSetupRuntimeSource | null
): AppShellChannelSetupRuntimePort | null => {
    if (!runtime) {
        return null;
    }

    return {
        getChannelSetupScreenWorkflowPort: () =>
            createChannelSetupScreenWorkflowPort(runtime.getChannelSetupWorkflowPort()),
        getSelectedServerId: () => runtime.getSelectedServerId(),
        openServerSelect: () => runtime.openServerSelect(),
    };
};

export interface AppLazyScreenPortFactoryOptions {
    openCustomChannelStudio: () => void;
    openChannelsFromSettings: () => void;
    goBackFromChannelSetupLibraries: () => void;
    getNavigationRuntime: () => AppShellNavigationRuntimePort | null;
    getAuthRuntime: () => AppShellAuthRuntimePort | null;
    getProfileRuntime: () => AppShellProfileRuntimePort | null;
    getServerSelectionRuntime: () => AppShellServerSelectionRuntimePort | null;
    getChannelSetupRuntime: () => AppShellChannelSetupRuntimePort | null;
    getSettingsRuntime: () => AppShellSettingsRuntimePort | null;
}

export interface AppLazyChannelSetupScreenInput {
    workflowPort: ChannelSetupScreenWorkflowPort;
    screenPorts: ChannelSetupScreenPorts;
}

export interface AppLazySettingsRuntimePorts {
    getNavigation: () => INavigationManager | null;
    clearSubtitleTrack: () => Promise<void>;
    onGuideSettingChange: (change: GuideSettingChange) => void;
    getActiveUsername: () => string | null;
    getTheme: () => ThemeName;
    setTheme: (theme: ThemeName) => SettingsPersistenceResult;
    getThemePersistenceResult: () => SettingsPersistenceResult;
    retryThemePersistence: () => SettingsPersistenceResult;
    updateSettingsPlaybackPolicy: (keepRunning: boolean) => void;
    setOverlayTransparency: (value: OverlayTransparency) => void;
    setAccessibilityPreference: (name: 'reduceMotion' | 'largeFocus', enabled: boolean) => void;
    switchProfileFromSettings: () => void;
    switchServerFromSettings: () => void;
    manageChannelsFromSettings: () => void;
    signOutFromSettings: () => Promise<void>;
}

export class AppLazyScreenPortFactory {
    private readonly _openCustomChannelStudio: () => void;
    private readonly _openChannelsFromSettings: () => void;
    private readonly _goBackFromChannelSetupLibraries: () => void;
    private readonly _getNavigationRuntime: () => AppShellNavigationRuntimePort | null;
    private readonly _getAuthRuntime: () => AppShellAuthRuntimePort | null;
    private readonly _getProfileRuntime: () => AppShellProfileRuntimePort | null;
    private readonly _getServerSelectionRuntime: () => AppShellServerSelectionRuntimePort | null;
    private readonly _getChannelSetupRuntime: () => AppShellChannelSetupRuntimePort | null;
    private readonly _getSettingsRuntime: () => AppShellSettingsRuntimePort | null;

    constructor(options: AppLazyScreenPortFactoryOptions) {
        this._openCustomChannelStudio = options.openCustomChannelStudio;
        this._openChannelsFromSettings = options.openChannelsFromSettings;
        this._goBackFromChannelSetupLibraries = options.goBackFromChannelSetupLibraries;
        this._getNavigationRuntime = options.getNavigationRuntime;
        this._getAuthRuntime = options.getAuthRuntime;
        this._getProfileRuntime = options.getProfileRuntime;
        this._getServerSelectionRuntime = options.getServerSelectionRuntime;
        this._getChannelSetupRuntime = options.getChannelSetupRuntime;
        this._getSettingsRuntime = options.getSettingsRuntime;
    }

    getNavigation(): INavigationManager | null {
        return this._getNavigationRuntime()?.getNavigation() ?? null;
    }

    createAuthScreenPorts(): AuthScreenPorts | null {
        const runtime = this._getAuthRuntime();
        if (!runtime) {
            return null;
        }

        return {
            requestAuthPin: (options?: { signal?: AbortSignal | null }) => runtime.requestAuthPin(options),
            pollForPin: (pinId: number, options) => runtime.pollForPin(pinId, options),
            cancelPin: (pinId: number) => runtime.cancelPin(pinId),
            getNavigation: () => this.getNavigation(),
        };
    }

    createProfileSelectScreenPorts(): ProfileSelectScreenPorts | null {
        const runtime = this._getProfileRuntime();
        if (!runtime) {
            return null;
        }

        return {
            getHomeUsers: (options?: { signal?: AbortSignal | null }) => runtime.getHomeUsers(options),
            switchHomeUser: (
                userId: string,
                options?: { pin?: string | null; signal?: AbortSignal | null }
            ) => runtime.switchHomeUser(userId, options),
            useMainAccountProfile: () => runtime.useMainAccountProfile(),
            signOutPlex: () => runtime.signOutPlex(),
            getNavigation: () => this.getNavigation(),
        };
    }

    createServerSelectScreenPorts(): ServerSelectScreenPorts | null {
        const runtime = this._getServerSelectionRuntime();
        if (!runtime) {
            return null;
        }

        return {
            discoverServers: (options?: { forceRefresh?: boolean; signal?: AbortSignal | null }) =>
                runtime.discoverServers(options),
            selectServer: async (
                serverId: string,
                options?: { signal?: AbortSignal | null }
            ): Promise<ServerSelectSelectionResult> => {
                const result = await runtime.selectServer(serverId, options);
                switch (result.kind) {
                    case 'selection_failed':
                        return { kind: 'selection_failed', reason: result.reason };
                    case 'selected':
                        return {
                            kind: 'selected',
                            persistedSelection: result.persistedSelection,
                            epgRefresh: result.epgRefresh,
                        };
                    default:
                        return assertUnhandledServerSelectionResult(result);
                }
            },
            clearSelectedServer: () => runtime.clearSelectedServer(),
            getSelectedServerScreenState: () => runtime.getSelectedServerScreenState(),
            requestChannelSetupRerun: () => runtime.requestChannelSetupRerun(),
            getNavigation: () => this.getNavigation(),
        };
    }

    createChannelSetupScreenInput(): AppLazyChannelSetupScreenInput | null {
        const runtime = this._getChannelSetupRuntime();
        if (!runtime) {
            return null;
        }

        return {
            workflowPort: runtime.getChannelSetupScreenWorkflowPort(),
            screenPorts: {
                getNavigation: () => this.getNavigation(),
                getSelectedServerId: () => runtime.getSelectedServerId(),
                openServerSelect: () => runtime.openServerSelect(),
                goBackFromLibraries: () => this._goBackFromChannelSetupLibraries(),
                openCustomChannelStudio: () => this._openCustomChannelStudio(),
            },
        };
    }

    createSettingsRuntimePorts(): AppLazySettingsRuntimePorts | null {
        const runtime = this._getSettingsRuntime();
        if (!runtime) {
            return null;
        }

        return {
            getNavigation: () => this.getNavigation(),
            clearSubtitleTrack: () => runtime.setSubtitleTrack(null),
            onGuideSettingChange: (change: GuideSettingChange) => runtime.onGuideSettingChange(change),
            getActiveUsername: () => runtime.getActiveUsername(),
            getTheme: () => runtime.getTheme(),
            setTheme: (theme: ThemeName) => runtime.setTheme(theme),
            getThemePersistenceResult: () => runtime.getThemePersistenceResult(),
            retryThemePersistence: () => runtime.retryThemePersistence(),
            updateSettingsPlaybackPolicy: (keepRunning) => runtime.updateSettingsPlaybackPolicy(keepRunning),
            setOverlayTransparency: (value) => runtime.setOverlayTransparency(value),
            setAccessibilityPreference: (name, enabled) => runtime.setAccessibilityPreference(name, enabled),
            switchProfileFromSettings: () => runtime.switchProfileFromSettings(),
            switchServerFromSettings: () => runtime.switchServerFromSettings(),
            manageChannelsFromSettings: () => this._openChannelsFromSettings(),
            signOutFromSettings: () => runtime.signOutFromSettings(),
        };
    }
}
