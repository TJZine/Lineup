import { ChannelRetryScheduler } from '../resolution/ChannelRetryScheduler';
import { createBaseChannel } from './channel-manager-test-helpers';

describe('ChannelRetryScheduler', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('does not report a retry result after cancelAll invalidates an in-flight retry generation', async () => {
        const channel = createBaseChannel({ id: 'channel-1' });
        const logger = { warn: jest.fn() };
        let resolveRetry: () => void = () => undefined;
        const scheduler = new ChannelRetryScheduler({
            getChannel: (): typeof channel => channel,
            resolve: jest.fn((): Promise<void> => new Promise<void>((resolve) => {
                resolveRetry = resolve;
            })),
            logger,
        });

        scheduler.queue(channel.id);
        jest.advanceTimersByTime(30000);
        await Promise.resolve();

        scheduler.cancelAll();
        resolveRetry?.();
        await Promise.resolve();

        expect(logger.warn).not.toHaveBeenCalledWith('Retry succeeded for channel channel-1');
    });
});
