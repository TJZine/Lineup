const MAX_FALLBACK_ATTEMPTS_PER_TRACK = 2;

export type TerminalFallbackReason = 'attempt_exhausted' | 'unusable_cues';

export class SubtitleFallbackAttemptLifecycle {
    private readonly _attemptCounts = new Map<string, number>();
    private readonly _terminalTracks = new Set<string>();
    private readonly _trackTimers = new Map<string, number[]>();
    private readonly _blobUrls = new Map<string, string>();

    public reset(): void {
        for (const timers of this._trackTimers.values()) {
            for (const timerId of timers) window.clearTimeout(timerId);
        }
        this._trackTimers.clear();
        for (const trackId of this._blobUrls.keys()) this._revokeBlobUrl(trackId);
        this._attemptCounts.clear();
        this._terminalTracks.clear();
    }

    public storeTimer(trackId: string, timerId: number): void {
        const existing = this._trackTimers.get(trackId) ?? [];
        existing.push(timerId);
        this._trackTimers.set(trackId, existing);
    }

    public clearTimers(trackId: string): void {
        const timers = this._trackTimers.get(trackId);
        if (!timers) return;
        for (const timerId of timers) window.clearTimeout(timerId);
        this._trackTimers.delete(trackId);
    }

    public consume(trackId: string): boolean {
        const attempts = this._attemptCounts.get(trackId) ?? 0;
        if (attempts >= MAX_FALLBACK_ATTEMPTS_PER_TRACK) return false;
        this._attemptCounts.set(trackId, attempts + 1);
        return true;
    }

    public hasBudget(trackId: string): boolean {
        return (this._attemptCounts.get(trackId) ?? 0) < MAX_FALLBACK_ATTEMPTS_PER_TRACK;
    }

    public markTerminal(trackId: string): boolean {
        if (this._terminalTracks.has(trackId)) return false;
        this._terminalTracks.add(trackId);
        return true;
    }

    public isTerminal(trackId: string): boolean {
        return this._terminalTracks.has(trackId);
    }

    public createBlobUrl(trackId: string, vtt: string): string {
        this._revokeBlobUrl(trackId);
        const blobUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
        this._blobUrls.set(trackId, blobUrl);
        return blobUrl;
    }

    public cleanupTrack(trackId: string): void {
        this.clearTimers(trackId);
        this._revokeBlobUrl(trackId);
    }

    private _revokeBlobUrl(trackId: string): void {
        const blobUrl = this._blobUrls.get(trackId);
        if (!blobUrl) return;
        try {
            URL.revokeObjectURL(blobUrl);
        } catch {
            // ignore
        }
        this._blobUrls.delete(trackId);
    }
}
