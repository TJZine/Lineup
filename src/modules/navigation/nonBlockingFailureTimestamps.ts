export const NON_BLOCKING_FAILURE_DEDUPE_WINDOW_MS = 5_000;
export const NON_BLOCKING_FAILURE_MAX_ENTRIES = 20;

export function recordNonBlockingFailureTimestamp(
    timestamps: Map<string, number>,
    key: string,
    now: number
): boolean {
    const lastRecordedTimestamp = timestamps.get(key);
    if (
        typeof lastRecordedTimestamp === 'number' &&
        now - lastRecordedTimestamp < NON_BLOCKING_FAILURE_DEDUPE_WINDOW_MS
    ) {
        return false;
    }

    if (lastRecordedTimestamp === undefined && timestamps.size >= NON_BLOCKING_FAILURE_MAX_ENTRIES) {
        let oldestKey: string | null = null;
        let oldestTimestamp = Number.POSITIVE_INFINITY;

        for (const [candidateKey, candidateTimestamp] of timestamps) {
            if (candidateTimestamp < oldestTimestamp) {
                oldestKey = candidateKey;
                oldestTimestamp = candidateTimestamp;
            }
        }

        if (oldestKey !== null) {
            timestamps.delete(oldestKey);
        }
    }

    timestamps.set(key, now);
    return true;
}
