import { isAbortLikeError } from '../../utils/errors';
import type {
    NavigationChannelSwitchingPort,
    NavigationEpgPort,
} from './NavigationFeaturePorts';

export interface NavigationChannelNumberPort {
    epg: NavigationEpgPort | null;
    channelSwitching: NavigationChannelSwitchingPort;
}

export interface NavigationChannelNumberHandlerRuntime {
    handleChannelNumberEntered(channelNumber: number): Promise<void>;
}

export class NavigationChannelNumberHandler implements NavigationChannelNumberHandlerRuntime {
    constructor(private readonly deps: NavigationChannelNumberPort) { }

    async handleChannelNumberEntered(channelNumber: number): Promise<void> {
        this.deps.channelSwitching.setLastChannelChangeSourceNumber();
        try {
            const outcome = await this.deps.channelSwitching.switchToChannelByNumber(channelNumber);
            if (outcome !== 'switched') {
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
