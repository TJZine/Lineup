import { summarizeErrorForLog } from '../../../../utils/errors';
import type { ChannelConfig } from '../contracts/types';

type ChannelRetrySchedulerLogger = {
    warn: (message: string, ...args: unknown[]) => void;
};

type ChannelRetrySchedulerConfig = {
    getChannel: (channelId: string) => ChannelConfig | null;
    resolve: (channel: ChannelConfig, isCurrent: () => boolean) => Promise<unknown>;
    logger: ChannelRetrySchedulerLogger;
};

type PendingRetry = {
    timeout: ReturnType<typeof setTimeout>;
    generation: number;
};

export class ChannelRetryScheduler {
    private static readonly RETRY_DELAY_MS = 30000;

    private readonly _getChannel: (channelId: string) => ChannelConfig | null;
    private readonly _resolve: (channel: ChannelConfig, isCurrent: () => boolean) => Promise<unknown>;
    private readonly _logger: ChannelRetrySchedulerLogger;
    private readonly _pendingRetries = new Map<string, PendingRetry>();
    private _generation = 0;

    constructor(config: ChannelRetrySchedulerConfig) {
        this._getChannel = config.getChannel;
        this._resolve = config.resolve;
        this._logger = config.logger;
    }

    queue(channelId: string): void {
        if (this._pendingRetries.has(channelId)) {
            return;
        }

        const generation = this._generation;
        const timeout = setTimeout(() => {
            this._pendingRetries.delete(channelId);
            void this._execute(channelId, generation);
        }, ChannelRetryScheduler.RETRY_DELAY_MS);

        this._pendingRetries.set(channelId, { timeout, generation });
    }

    cancel(channelId: string): void {
        const pendingRetry = this._pendingRetries.get(channelId);
        if (!pendingRetry) {
            return;
        }
        clearTimeout(pendingRetry.timeout);
        this._pendingRetries.delete(channelId);
    }

    cancelAll(): void {
        this._generation += 1;
        for (const pendingRetry of this._pendingRetries.values()) {
            clearTimeout(pendingRetry.timeout);
        }
        this._pendingRetries.clear();
    }

    private async _execute(channelId: string, generation: number): Promise<void> {
        const isCurrent = (): boolean => generation === this._generation;
        if (!isCurrent()) {
            return;
        }
        const channel = this._getChannel(channelId);
        if (!channel) {
            return;
        }

        try {
            await this._resolve(channel, isCurrent);
            if (!isCurrent()) {
                return;
            }
            this._logger.warn(`Retry succeeded for channel ${channelId}`);
        } catch (error) {
            if (!isCurrent()) {
                return;
            }
            this._logger.warn(`Retry failed for channel ${channelId}`, summarizeErrorForLog(error));
        }
    }
}
