import { isAbortLikeError } from '../../utils/errors';
import type { NavigationChannelNumberPort } from './NavigationCoordinatorContracts';

export class NavigationChannelNumberHandler {
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
