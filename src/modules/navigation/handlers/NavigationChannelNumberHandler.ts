import { isAbortLikeError } from '../../../utils/errors';
import { isChannelSwitchSuccessful } from '../../../types/channelSwitch';
import type {
    NavigationChannelSwitchingPort,
    NavigationEpgPort,
} from '../contracts/NavigationFeaturePorts';
import type { NavigationChannelNumberHandlerRuntime } from '../contracts/NavigationHandlerContracts';

export interface NavigationChannelNumberPort {
    epg: NavigationEpgPort | null;
    channelSwitching: NavigationChannelSwitchingPort;
}

export class NavigationChannelNumberHandler implements NavigationChannelNumberHandlerRuntime {
    constructor(private readonly deps: NavigationChannelNumberPort) { }

    async handleChannelNumberEntered(channelNumber: number): Promise<void> {
        this.deps.channelSwitching.setLastChannelChangeSourceNumber();
        try {
            const outcome = await this.deps.channelSwitching.switchToChannelByNumber(channelNumber);
            if (!isChannelSwitchSuccessful(outcome)) {
                return;
            }
            if (this.deps.epg?.isVisible()) {
                this.deps.channelSwitching.focusEpgOnCurrentChannel();
            }
        } catch (error: unknown) {
            if (isAbortLikeError(error)) {
                return;
            }
            throw error;
        }
    }
}
