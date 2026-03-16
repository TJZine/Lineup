import type { INavigationManager } from '../../modules/navigation';

export interface ChannelSetupRerunControllerDeps {
    navigation: INavigationManager;
    getSelectedServerId: () => string | null;
    clearSetupRecord: (serverId: string) => void;
    getChannelCount: () => number;
    hasSetupRecord: (serverId: string) => boolean;
}

export class ChannelSetupRerunController {
    private _channelSetupRerunRequested = false;

    constructor(private readonly _deps: ChannelSetupRerunControllerDeps) {}

    requestChannelSetupRerun(): void {
        const serverId = this._deps.getSelectedServerId();
        if (!serverId) {
            return;
        }
        this._deps.clearSetupRecord(serverId);
        this._channelSetupRerunRequested = true;
        this._deps.navigation.goTo('channel-setup');
    }

    clearRerunRequest(): void {
        this._channelSetupRerunRequested = false;
    }

    shouldRunChannelSetup(): boolean {
        const serverId = this._deps.getSelectedServerId();
        if (!serverId) {
            return false;
        }
        if (this._channelSetupRerunRequested) {
            return true;
        }
        if (this._deps.getChannelCount() === 0) {
            return true;
        }
        return !this._deps.hasSetupRecord(serverId);
    }
}
