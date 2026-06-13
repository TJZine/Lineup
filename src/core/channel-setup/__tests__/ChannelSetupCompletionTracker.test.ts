import { ChannelSetupCompletionTracker } from '../persistence/ChannelSetupCompletionTracker';
import type { ChannelSetupCompletionResult, ChannelSetupConfig } from '../types';

describe('ChannelSetupCompletionTracker', () => {
    it('marks setup complete via record store and then clears rerun request', () => {
        const result = { ok: true, record: { serverId: 'server-1' } } as ChannelSetupCompletionResult;
        const markSetupComplete = jest.fn(() => result);
        const clearRerunRequest = jest.fn();
        const tracker = new ChannelSetupCompletionTracker({
            recordStore: { markSetupComplete },
            clearRerunRequest,
        });
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        expect(tracker.markSetupComplete('server-1', config)).toBe(result);

        expect(markSetupComplete).toHaveBeenCalledWith('server-1', config);
        expect(clearRerunRequest).toHaveBeenCalledTimes(1);
    });

    it('does not clear rerun request when setup completion persistence returns failure', () => {
        const result = {
            ok: false,
            reason: 'unavailable',
            message: 'Unable to save setup completion.',
        } as const;
        const markSetupComplete = jest.fn(() => result);
        const clearRerunRequest = jest.fn();
        const tracker = new ChannelSetupCompletionTracker({
            recordStore: { markSetupComplete },
            clearRerunRequest,
        });
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        expect(tracker.markSetupComplete('server-1', config)).toBe(result);
        expect(markSetupComplete).toHaveBeenCalledWith('server-1', config);
        expect(clearRerunRequest).not.toHaveBeenCalled();
    });

    it('does not clear rerun request when setup completion persistence throws', () => {
        const error = new Error('persist failed');
        const markSetupComplete = jest.fn(() => {
            throw error;
        });
        const clearRerunRequest = jest.fn();
        const tracker = new ChannelSetupCompletionTracker({
            recordStore: { markSetupComplete },
            clearRerunRequest,
        });
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        expect(() => tracker.markSetupComplete('server-1', config)).toThrow(error);
        expect(markSetupComplete).toHaveBeenCalledWith('server-1', config);
        expect(clearRerunRequest).not.toHaveBeenCalled();
    });
});
