import type { ChannelBuildProgress } from '../types';

export function createAbortError(
    lastTask?: ChannelBuildProgress['task']
): DOMException & { lastTask?: ChannelBuildProgress['task'] } {
    const error = new DOMException('Aborted', 'AbortError') as DOMException & {
        lastTask?: ChannelBuildProgress['task'];
    };
    if (lastTask !== undefined) {
        error.lastTask = lastTask;
    }
    return error;
}
