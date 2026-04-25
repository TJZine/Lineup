export function isSignalAborted(signal?: AbortSignal | null): boolean {
    if (signal?.aborted) return true;
    return false;
}
