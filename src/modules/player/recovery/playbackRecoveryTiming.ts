export function clampPlaybackOffsetMs(elapsedMs: number, durationMs: number): number {
    const safeElapsedMs = Number.isFinite(elapsedMs) ? elapsedMs : 0;
    const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
    return Math.max(0, Math.min(safeElapsedMs, safeDurationMs));
}
