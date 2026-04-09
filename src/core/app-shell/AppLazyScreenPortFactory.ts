import type { AppOrchestrator } from '../../Orchestrator';
import type { ChannelSetupWorkflowPort } from '../channel-setup/ChannelSetupWorkflowPort';
import type { ChannelSetupScreenPorts } from '../../modules/ui/channel-setup/ChannelSetupScreenPorts';
import type { AuthScreenPorts } from '../../modules/ui/auth/AuthScreen';
import type { ProfileSelectScreenPorts } from '../../modules/ui/profile-select/ProfileSelectScreen';
import type { ServerSelectScreenPorts } from '../../modules/ui/server-select/ServerSelectScreen';
import type { INavigationManager } from '../../modules/navigation';
import type { GuideSettingChange } from '../../modules/ui/settings/types';

type AppLazyScreenRuntimeOrchestrator = Pick<
    AppOrchestrator,
    | 'requestAuthPin'
    | 'pollForPin'
    | 'cancelPin'
    | 'getHomeUsers'
    | 'switchHomeUser'
    | 'useMainAccountProfile'
    | 'signOutPlex'
    | 'discoverServers'
    | 'selectServer'
    | 'clearSelectedServer'
    | 'getSelectedServerStorageKey'
    | 'getServerHealthStorageKey'
    | 'getChannelSetupWorkflowPort'
    | 'getSelectedServerId'
    | 'openServerSelect'
    | 'switchToChannelByNumber'
    | 'openEPG'
    | 'requestChannelSetupRerun'
    | 'setSubtitleTrack'
    | 'onGuideSettingChange'
    | 'getActiveUsername'
    | 'getNavigation'
>;

export interface AppLazyScreenPortFactoryOptions {
    getOrchestrator: () => AppLazyScreenRuntimeOrchestrator | null;
}

export interface AppLazyChannelSetupScreenInput {
    workflowPort: ChannelSetupWorkflowPort;
    screenPorts: ChannelSetupScreenPorts;
}

export interface AppLazySettingsRuntimePorts {
    getNavigation: () => INavigationManager | null;
    clearSubtitleTrack: () => Promise<void>;
    onGuideSettingChange: (change: GuideSettingChange) => void;
    getActiveUsername: () => string | null;
}

export class AppLazyScreenPortFactory {
    private readonly _getOrchestrator: () => AppLazyScreenRuntimeOrchestrator | null;

    constructor(options: AppLazyScreenPortFactoryOptions) {
        this._getOrchestrator = options.getOrchestrator;
    }

    getNavigation(): INavigationManager | null {
        return this._getOrchestrator()?.getNavigation() ?? null;
    }

    createAuthScreenPorts(): AuthScreenPorts | null {
        const orchestrator = this._getOrchestrator();
        if (!orchestrator) {
            return null;
        }

        return {
            requestAuthPin: () => orchestrator.requestAuthPin(),
            pollForPin: (pinId: number) => orchestrator.pollForPin(pinId),
            cancelPin: (pinId: number) => orchestrator.cancelPin(pinId),
            getNavigation: () => this.getNavigation(),
        };
    }

    createProfileSelectScreenPorts(): ProfileSelectScreenPorts | null {
        const orchestrator = this._getOrchestrator();
        if (!orchestrator) {
            return null;
        }

        return {
            getHomeUsers: () => orchestrator.getHomeUsers(),
            switchHomeUser: (userId: string, pin?: string) => orchestrator.switchHomeUser(userId, pin),
            useMainAccountProfile: () => orchestrator.useMainAccountProfile(),
            signOutPlex: () => orchestrator.signOutPlex(),
            getNavigation: () => this.getNavigation(),
        };
    }

    createServerSelectScreenPorts(): ServerSelectScreenPorts | null {
        const orchestrator = this._getOrchestrator();
        if (!orchestrator) {
            return null;
        }

        return {
            discoverServers: (forceRefresh?: boolean) => orchestrator.discoverServers(forceRefresh),
            selectServer: (serverId: string) => orchestrator.selectServer(serverId),
            clearSelectedServer: () => orchestrator.clearSelectedServer(),
            getSelectedServerStorageKey: () => orchestrator.getSelectedServerStorageKey(),
            getServerHealthStorageKey: () => orchestrator.getServerHealthStorageKey(),
            requestChannelSetupRerun: () => orchestrator.requestChannelSetupRerun(),
            getNavigation: () => this.getNavigation(),
        };
    }

    createChannelSetupScreenInput(): AppLazyChannelSetupScreenInput | null {
        const orchestrator = this._getOrchestrator();
        if (!orchestrator) {
            return null;
        }

        return {
            workflowPort: orchestrator.getChannelSetupWorkflowPort(),
            screenPorts: {
                getNavigation: () => this.getNavigation(),
                getSelectedServerStorageKey: () => orchestrator.getSelectedServerStorageKey(),
                getServerHealthStorageKey: () => orchestrator.getServerHealthStorageKey(),
                getSelectedServerId: () => orchestrator.getSelectedServerId(),
                openServerSelect: () => orchestrator.openServerSelect(),
                switchToChannelByNumber: (number, options) => orchestrator.switchToChannelByNumber(number, options),
                openEPG: () => orchestrator.openEPG(),
            },
        };
    }

    createSettingsRuntimePorts(): AppLazySettingsRuntimePorts | null {
        const orchestrator = this._getOrchestrator();
        if (!orchestrator) {
            return null;
        }

        return {
            getNavigation: () => this.getNavigation(),
            clearSubtitleTrack: () => orchestrator.setSubtitleTrack(null),
            onGuideSettingChange: (change: GuideSettingChange) => orchestrator.onGuideSettingChange(change),
            getActiveUsername: () => orchestrator.getActiveUsername(),
        };
    }
}
