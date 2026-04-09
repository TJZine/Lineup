export function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
}

export function formatTimeRange(startTime: number, endTime: number): string {
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

export function formatTimeCompact(timestamp: number): string {
    // 12-hour without meridiem for compact rail (e.g. 3:53)
    const date = new Date(timestamp);
    const hours = date.getHours() % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

export function formatCellTimeLabel(
    startTime: number,
    endTime: number,
    options: { compact: boolean; forceFull: boolean }
): string {
    if (options.forceFull || !options.compact) {
        return formatTimeRange(startTime, endTime);
    }
    return formatTimeCompact(startTime);
}

export function formatDuration(durationMs: number): string {
    const totalMinutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes}m`;
    }
    if (minutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
}

export function rafThrottle<T extends (...args: unknown[]) => void>(
    fn: T
): (...args: Parameters<T>) => void {
    // In test environments (jsdom), RAF may not fire reliably
    // Fall back to synchronous execution
    const isTestEnv = typeof process !== 'undefined' &&
        process.env.NODE_ENV === 'test';

    if (isTestEnv || typeof requestAnimationFrame === 'undefined') {
        return fn;
    }

    let rafId: number | null = null;
    let latestArgs: Parameters<T> | null = null;

    return (...args: Parameters<T>): void => {
        latestArgs = args;

        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                rafId = null;
                if (latestArgs !== null) {
                    fn(...latestArgs);
                }
            });
        }
    };
}
