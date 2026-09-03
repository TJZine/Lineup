import type { INavigationManager } from '../../navigation';
import type { ChannelSwitchOutcome, ChannelSwitchPresentationOptions } from '../../../types/channelSwitch';
import type { PlaybackStartOutcome } from '../../../types/playbackStart';
export type { ChannelSetupScreenWorkflowPort } from '../../../core/channel-setup/workflow/ChannelSetupScreenWorkflowPort';

export interface ChannelSetupScreenPorts {
    getNavigation(): INavigationManager | null;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
    switchToChannelByNumberWithOutcome(
        number: number,
        options?: ChannelSwitchPresentationOptions
    ): Promise<ChannelSwitchOutcome>;
    waitForNextPlaybackStart(signal?: AbortSignal): Promise<PlaybackStartOutcome>;
    openEPG(): void;
    appendBuilderGuideDiagnostic(event: string, data: unknown): void;
}
