import {
    NON_BLOCKING_FAILURE_DEDUPE_WINDOW_MS,
    NON_BLOCKING_FAILURE_MAX_ENTRIES,
    recordNonBlockingFailureTimestamp,
} from '../coordinator/nonBlockingFailureTimestamps';

describe('recordNonBlockingFailureTimestamp', () => {
    it('throttles duplicate keys within the dedupe window', () => {
        const timestamps = new Map<string, number>();

        expect(recordNonBlockingFailureTimestamp(timestamps, 'channel-number', 1_000)).toBe(true);
        expect(
            recordNonBlockingFailureTimestamp(
                timestamps,
                'channel-number',
                1_000 + NON_BLOCKING_FAILURE_DEDUPE_WINDOW_MS - 1
            )
        ).toBe(false);
        expect(timestamps).toEqual(new Map([['channel-number', 1_000]]));
    });

    it('allows retries after the dedupe window', () => {
        const timestamps = new Map<string, number>([['channel-number', 1_000]]);

        expect(
            recordNonBlockingFailureTimestamp(
                timestamps,
                'channel-number',
                1_000 + NON_BLOCKING_FAILURE_DEDUPE_WINDOW_MS
            )
        ).toBe(true);
        expect(timestamps.get('channel-number')).toBe(1_000 + NON_BLOCKING_FAILURE_DEDUPE_WINDOW_MS);
    });

    it('evicts the lowest timestamp at capacity even when insertion order differs', () => {
        const timestamps = new Map<string, number>();
        for (let index = 0; index < NON_BLOCKING_FAILURE_MAX_ENTRIES; index += 1) {
            timestamps.set(`key-${index}`, 100 + index);
        }
        timestamps.delete('key-0');
        timestamps.set('key-0', 1);

        expect(
            recordNonBlockingFailureTimestamp(timestamps, 'new-key', 10_000)
        ).toBe(true);

        expect(timestamps.has('key-0')).toBe(false);
        expect(timestamps.has('new-key')).toBe(true);
        expect(timestamps.size).toBe(NON_BLOCKING_FAILURE_MAX_ENTRIES);
    });

    it('keeps existing-key updates from triggering eviction', () => {
        const timestamps = new Map<string, number>();
        for (let index = 0; index < NON_BLOCKING_FAILURE_MAX_ENTRIES; index += 1) {
            timestamps.set(`key-${index}`, 100 + index);
        }

        expect(recordNonBlockingFailureTimestamp(timestamps, 'key-5', 10_000)).toBe(true);

        expect(timestamps.size).toBe(NON_BLOCKING_FAILURE_MAX_ENTRIES);
        expect(timestamps.get('key-5')).toBe(10_000);
        expect(timestamps.has('key-0')).toBe(true);
    });

    it('still evicts one entry at capacity when existing timestamps are not finite', () => {
        const timestamps = new Map<string, number>();
        for (let index = 0; index < NON_BLOCKING_FAILURE_MAX_ENTRIES; index += 1) {
            timestamps.set(`key-${index}`, Number.NaN);
        }

        expect(recordNonBlockingFailureTimestamp(timestamps, 'new-key', 10_000)).toBe(true);

        expect(timestamps.size).toBe(NON_BLOCKING_FAILURE_MAX_ENTRIES);
        expect(timestamps.has('new-key')).toBe(true);
    });
});
