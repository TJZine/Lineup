import { ChannelSetupCompletionTracker } from '../ChannelSetupCompletionTracker';
import type { ChannelSetupConfig } from '../types';

describe('ChannelSetupCompletionTracker', () => {
    it('marks setup complete via record store and then clears rerun request', () => {
        const markSetupComplete = jest.fn();
        const clearRerunRequest = jest.fn();
        const tracker = new ChannelSetupCompletionTracker({
            recordStore: { markSetupComplete },
            clearRerunRequest,
        });
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        tracker.markSetupComplete('server-1', config);

        expect(markSetupComplete).toHaveBeenCalledWith('server-1', config);
        expect(clearRerunRequest).toHaveBeenCalledTimes(1);
    });
});
