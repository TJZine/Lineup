import type { ChannelConfig } from '../../../scheduler/channel-manager';
import { runIfEpgRefreshCurrent } from './EPGScheduleRefreshCurrentness';
import type { RefreshMetrics, RefreshSession } from './EPGScheduleRefreshRuntimeTypes';
import type { EPGBackgroundWarmQueue } from './EPGBackgroundWarmQueue';

export function startRetainedEpgBackgroundRefresh(options: {
    queue: EPGBackgroundWarmQueue;
    session: RefreshSession;
    metrics: RefreshMetrics;
    refreshChannel: (session: RefreshSession, metrics: RefreshMetrics, channel: ChannelConfig) => Promise<void>;
    shouldContinue?: () => boolean;
}): void {
    const { queue, session, metrics } = options;
    const operation = session.operation.retain('background-schedule-refresh');
    const backgroundSession = { ...session, operation };
    const onOperationAbort = (): void => queue.cancel('operation-superseded');
    operation.signal.addEventListener('abort', onOperationAbort, { once: true });
    let handedOff = false;
    try {
        runIfEpgRefreshCurrent(session, () => {
            queue.start({
                refreshId: session.refreshId,
                reason: session.reason,
                channels: session.backgroundChannels,
                refreshChannelSchedule: (channel) =>
                    options.refreshChannel(backgroundSession, metrics, channel),
                concurrency: session.backgroundConcurrency,
                ...(options.shouldContinue ? { shouldContinue: options.shouldContinue } : {}),
                assertCurrent: (): void => operation.assertCurrent(),
                onSettled: (): void => {
                    operation.signal.removeEventListener('abort', onOperationAbort);
                    operation.release();
                },
            });
            handedOff = true;
        });
    } catch (error) {
        if (!handedOff) {
            operation.signal.removeEventListener('abort', onOperationAbort);
            operation.release();
        }
        throw error;
    }
}
