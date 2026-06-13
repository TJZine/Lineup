import type { INavigationManager } from '../../navigation';
import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';
export type { ChannelSetupScreenWorkflowPort } from '../../../core/channel-setup/workflow/ChannelSetupScreenWorkflowPort';

export interface ChannelSetupScreenPorts {
    getNavigation(): INavigationManager | null;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
    switchToChannelByNumberWithOutcome(number: number, options?: { signal?: AbortSignal }): Promise<ChannelSwitchOutcome>;
    openEPG(): void;
}
