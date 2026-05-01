import type { AuthScreenPorts } from '../../modules/ui/auth';
import type { ChannelSetupScreenPorts } from '../../modules/ui/channel-setup';
import type { INavigationManager } from '../../modules/navigation';
import type { ProfileSelectScreenPorts } from '../../modules/ui/profile-select';
import type {
    ServerSelectScreenPorts,
    ServerSelectSelectionResult,
} from '../../modules/ui/server-select';
import type { GuideSettingChange } from '../../modules/ui/settings/types';
import type { ThemeName } from '../../modules/ui/theme';
import type { ChannelSetupScreenWorkflowPort } from '../channel-setup/workflow/ChannelSetupScreenWorkflowPort';
import type { ChannelSetupWorkflowPort } from '../channel-setup/workflow/ChannelSetupWorkflowPort';
import type {
    AppShellAuthRuntimePort,
    AppShellChannelSetupRuntimePort,
    AppShellNavigationRuntimePort,
    AppShellProfileRuntimePort,
    AppShellServerSelectionRuntimePort,
    AppShellSettingsRuntimePort,
} from './AppShellRuntimeContracts';

function assertUnhandledServerSelectionResult(result: never): never {
    const resultKind = (result as { kind?: unknown }).kind;
    throw new Error(`Unhandled server selection result kind: ${String(resultKind)}`);
}

export const createChannelSetupScreenWorkflowPort = (
    workflowPort: ChannelSetupWorkflowPort
): ChannelSetupScreenWorkflowPort => ({
    invalidateFacetSnapshot: () => workflowPort.invalidateFacetSnapshot(),
    getLibrariesForSetup: (signal) => workflowPort.getLibrariesForSetup(signal),
    getChannelSetupRecord: (serverId) => workflowPort.getChannelSetupRecord(serverId),
    getSetupContextForSelectedServer: () => workflowPort.getSetupContextForSelectedServer(),
    getSetupPreview: (config, options) => workflowPort.getSetupPreview(config, options),
    getSetupReview: (config, options) => workflowPort.getSetupReview(config, options),
    createChannelsFromSetup: (config, options) => workflowPort.createChannelsFromSetup(config, options),
    markSetupComplete: (serverId, setupConfig) => workflowPort.markSetupComplete(serverId, setupConfig),
});

interface AppShellChannelSetupRuntimeSource {
    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
    switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void>;
    openEPG(): void;
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
        switchToChannelByNumber: (number, options) => runtime.switchToChannelByNumber(number, options),
        openEPG: () => runtime.openEPG(),
    };
};

export interface AppLazyScreenPortFactoryOptions {
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
    setTheme: (theme: ThemeName) => void;
}

export class AppLazyScreenPortFactory {
    private readonly _getNavigationRuntime: () => AppShellNavigationRuntimePort | null;
    private readonly _getAuthRuntime: () => AppShellAuthRuntimePort | null;
    private readonly _getProfileRuntime: () => AppShellProfileRuntimePort | null;
    private readonly _getServerSelectionRuntime: () => AppShellServerSelectionRuntimePort | null;
    private readonly _getChannelSetupRuntime: () => AppShellChannelSetupRuntimePort | null;
    private readonly _getSettingsRuntime: () => AppShellSettingsRuntimePort | null;

    constructor(options: AppLazyScreenPortFactoryOptions) {
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
            requestAuthPin: () => runtime.requestAuthPin(),
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
            getHomeUsers: () => runtime.getHomeUsers(),
            switchHomeUser: (userId: string, pin?: string) => runtime.switchHomeUser(userId, pin),
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
            discoverServers: (forceRefresh?: boolean) => runtime.discoverServers(forceRefresh),
            selectServer: async (serverId: string): Promise<ServerSelectSelectionResult> => {
                const result = await runtime.selectServer(serverId);
                switch (result.kind) {
                    case 'selection_failed':
                        return { kind: 'selection_failed', reason: result.reason };
                    case 'selected':
                        return { kind: 'selected' };
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
                switchToChannelByNumber: (number, options) => runtime.switchToChannelByNumber(number, options),
                openEPG: () => runtime.openEPG(),
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
        };
    }
}
