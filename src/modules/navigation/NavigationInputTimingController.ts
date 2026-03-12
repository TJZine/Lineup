import type { Direction, RemoteButton } from './interfaces';

interface NavigationInputTimingControllerDeps {
    getRepeatConfig: () => { delayMs: number; intervalMs: number };
    getChannelInputConfig: () => { timeoutMs: number; maxDigits: number };
    tryMoveFocus: (direction: Direction) => boolean;
    emitChannelInputUpdate: (payload: { digits: string; isComplete: boolean }) => void;
    emitChannelNumberEntered: (payload: { channelNumber: number }) => void;
}

export class NavigationInputTimingController {
    private readonly deps: NavigationInputTimingControllerDeps;
    private activeDpadButton: Direction | null = null;
    private dpadRepeatDelayTimer: ReturnType<typeof setTimeout> | null = null;
    private dpadRepeatIntervalTimer: ReturnType<typeof setInterval> | null = null;
    private channelDigits = '';
    private channelInputTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(deps: NavigationInputTimingControllerDeps) {
        this.deps = deps;
    }

    public handleNonDirectionalKeyDown(): void {
        this._stopDpadRepeat();
    }

    public handleDirectionalKeyDown(button: Direction, isRepeat: boolean): void {
        if (isRepeat) {
            return;
        }
        const moved = this.deps.tryMoveFocus(button);
        if (moved) {
            this._startDpadRepeat(button);
        }
    }

    public handleDirectionalKeyUp(button: RemoteButton): void {
        if (button === this.activeDpadButton) {
            this._stopDpadRepeat();
        }
    }

    public handleNumberKey(button: RemoteButton): void {
        const digit = button.replace('num', '');
        if (this.channelInputTimer !== null) {
            globalThis.clearTimeout(this.channelInputTimer);
        }

        this.channelDigits += digit;
        this.deps.emitChannelInputUpdate({
            digits: this.channelDigits,
            isComplete: false,
        });

        const { maxDigits, timeoutMs } = this.deps.getChannelInputConfig();
        if (this.channelDigits.length >= maxDigits) {
            this._commitChannelNumber();
            return;
        }

        this.channelInputTimer = globalThis.setTimeout(() => {
            this._commitChannelNumber();
        }, timeoutMs);
    }

    public destroy(): void {
        this._stopDpadRepeat();
        if (this.channelInputTimer !== null) {
            globalThis.clearTimeout(this.channelInputTimer);
            this.channelInputTimer = null;
        }
        this.channelDigits = '';
    }

    private _startDpadRepeat(button: Direction): void {
        this._stopDpadRepeat();
        this.activeDpadButton = button;

        const { delayMs, intervalMs } = this.deps.getRepeatConfig();
        this.dpadRepeatDelayTimer = globalThis.setTimeout(() => {
            this.dpadRepeatDelayTimer = null;
            this.dpadRepeatIntervalTimer = globalThis.setInterval(() => {
                if (!this.activeDpadButton) {
                    this._stopDpadRepeat();
                    return;
                }
                const moved = this.deps.tryMoveFocus(this.activeDpadButton);
                if (!moved) {
                    this._stopDpadRepeat();
                }
            }, intervalMs);
        }, delayMs);
    }

    private _stopDpadRepeat(): void {
        this.activeDpadButton = null;
        if (this.dpadRepeatDelayTimer !== null) {
            globalThis.clearTimeout(this.dpadRepeatDelayTimer);
            this.dpadRepeatDelayTimer = null;
        }
        if (this.dpadRepeatIntervalTimer !== null) {
            globalThis.clearInterval(this.dpadRepeatIntervalTimer);
            this.dpadRepeatIntervalTimer = null;
        }
    }

    private _commitChannelNumber(): void {
        if (this.channelInputTimer !== null) {
            globalThis.clearTimeout(this.channelInputTimer);
        }
        this.channelInputTimer = null;

        if (this.channelDigits.length === 0) {
            this.deps.emitChannelInputUpdate({ digits: '', isComplete: true });
            return;
        }

        const channelNumber = parseInt(this.channelDigits, 10);
        this.channelDigits = '';

        if (!Number.isFinite(channelNumber)) {
            this.deps.emitChannelInputUpdate({ digits: '', isComplete: true });
            return;
        }

        this.deps.emitChannelNumberEntered({ channelNumber });
        this.deps.emitChannelInputUpdate({ digits: '', isComplete: true });
    }
}
