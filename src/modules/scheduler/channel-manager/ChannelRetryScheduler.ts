import { summarizeErrorForLog } from '../../../utils/errors';
import type { ChannelConfig } from './types';

type ChannelRetrySchedulerLogger = {
    warn: (message: string, ...args: unknown[]) => void;
};

type ChannelRetrySchedulerConfig = {
    getChannel: (channelId: string) => ChannelConfig | null;
    resolve: (channel: ChannelConfig) => Promise<unknown>;
    logger: ChannelRetrySchedulerLogger;
};

export class ChannelRetryScheduler {
    private static readonly RETRY_DELAY_MS = 30000;

    private readonly _getChannel: (channelId: string) => ChannelConfig | null;
    private readonly _resolve: (channel: ChannelConfig) => Promise<unknown>;
    private readonly _logger: ChannelRetrySchedulerLogger;
    private readonly _pendingRetries = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(config: ChannelRetrySchedulerConfig) {
        this._getChannel = config.getChannel;
        this._resolve = config.resolve;
        this._logger = config.logger;
    }

    queue(channelId: string): void {
        if (this._pendingRetries.has(channelId)) {
            return;
        }

        const timeout = setTimeout(() => {
            this._pendingRetries.delete(channelId);
            this._execute(channelId);
        }, ChannelRetryScheduler.RETRY_DELAY_MS);

        this._pendingRetries.set(channelId, timeout);
    }

    cancel(channelId: string): void {
        const pendingRetry = this._pendingRetries.get(channelId);
        if (!pendingRetry) {
            return;
        }
        clearTimeout(pendingRetry);
        this._pendingRetries.delete(channelId);
    }

    cancelAll(): void {
        for (const timeout of this._pendingRetries.values()) {
            clearTimeout(timeout);
        }
        this._pendingRetries.clear();
    }

    private _execute(channelId: string): void {
        const channel = this._getChannel(channelId);
        if (!channel) {
            return;
        }

        this._resolve(channel)
            .then(() => {
                this._logger.warn(`Retry succeeded for channel ${channelId}`);
            })
            .catch((error) => {
                this._logger.warn(`Retry failed for channel ${channelId}`, summarizeErrorForLog(error));
            });
    }
}
