import type { INavigationManager } from '../../navigation';
export type { ChannelSetupScreenWorkflowPort } from '../../../core/channel-setup/workflow/ChannelSetupScreenWorkflowPort';

export interface ChannelSetupScreenPorts {
    getNavigation(): INavigationManager | null;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
    switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void>;
    openEPG(): void;
}
