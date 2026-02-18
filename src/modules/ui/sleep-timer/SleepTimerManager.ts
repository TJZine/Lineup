import { SLEEP_TIMER_PRESETS_MIN, SLEEP_TIMER_WARNING_MS } from './constants';

interface SleepTimerCallbacks {
    onWarning: (remainingMs: number) => void;
    onSleep: () => void;
    onCancel: () => void;
    onTick: (remainingMs: number) => void;
}

export class SleepTimerManager {
    private intervalId: number | null = null;
    private endTimeMs = 0;
    private remainingMs = 0;
    private presetIndex = 0;
    private warningEmitted = false;

    constructor(private readonly callbacks: SleepTimerCallbacks) {}

    cyclePreset(): number {
        this.presetIndex = (this.presetIndex + 1) % SLEEP_TIMER_PRESETS_MIN.length;
        const nextPresetMin = SLEEP_TIMER_PRESETS_MIN[this.presetIndex] ?? 0;
        if (nextPresetMin <= 0) {
            this.cancel();
            return 0;
        }
        this.start(nextPresetMin);
        return nextPresetMin;
    }

    start(minutes: number): void {
        const normalizedMinutes = Math.max(0, Math.floor(minutes));
        if (normalizedMinutes <= 0) {
            this.cancel();
            return;
        }

        const presetIndex = SLEEP_TIMER_PRESETS_MIN.indexOf(normalizedMinutes as (typeof SLEEP_TIMER_PRESETS_MIN)[number]);
        if (presetIndex >= 0) {
            this.presetIndex = presetIndex;
        }

        this._clearInterval();
        this.warningEmitted = false;
        this.remainingMs = normalizedMinutes * 60_000;
        this.endTimeMs = Date.now() + this.remainingMs;
        this.callbacks.onTick(this.remainingMs);

        this.intervalId = globalThis.setInterval(() => {
            this._tick();
        }, 1_000) as unknown as number;
    }

    cancel(): void {
        const wasActive = this.isActive();
        this._clearInterval();
        this.endTimeMs = 0;
        this.remainingMs = 0;
        this.warningEmitted = false;
        this.presetIndex = 0;
        if (wasActive) {
            this.callbacks.onCancel();
            this.callbacks.onTick(0);
        }
    }

    getRemainingMs(): number {
        if (!this.isActive()) {
            return 0;
        }
        return this._computeRemainingMs();
    }

    isActive(): boolean {
        return this.intervalId !== null && this.endTimeMs > Date.now();
    }

    destroy(): void {
        this._clearInterval();
        this.endTimeMs = 0;
        this.remainingMs = 0;
        this.warningEmitted = false;
        this.presetIndex = 0;
    }

    private _tick(): void {
        this.remainingMs = this._computeRemainingMs();

        if (!this.warningEmitted && this.remainingMs > 0 && this.remainingMs <= SLEEP_TIMER_WARNING_MS) {
            this.warningEmitted = true;
            this.callbacks.onWarning(this.remainingMs);
        }

        this.callbacks.onTick(this.remainingMs);

        if (this.remainingMs <= 0) {
            this._clearInterval();
            this.endTimeMs = 0;
            this.presetIndex = 0;
            this.callbacks.onSleep();
        }
    }

    private _computeRemainingMs(): number {
        return Math.max(0, this.endTimeMs - Date.now());
    }

    private _clearInterval(): void {
        if (this.intervalId !== null) {
            globalThis.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
