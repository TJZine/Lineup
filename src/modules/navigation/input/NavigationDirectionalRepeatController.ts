import type { Direction, RemoteButton } from '../contracts/interfaces';

interface NavigationDirectionalRepeatControllerDeps {
    getRepeatConfig: () => { delayMs: number; intervalMs: number };
    tryMoveFocus: (direction: Direction) => boolean;
}

export class NavigationDirectionalRepeatController {
    private readonly deps: NavigationDirectionalRepeatControllerDeps;
    private activeDpadButton: Direction | null = null;
    private dpadRepeatDelayTimer: ReturnType<typeof setTimeout> | null = null;
    private dpadRepeatIntervalTimer: ReturnType<typeof setInterval> | null = null;

    constructor(deps: NavigationDirectionalRepeatControllerDeps) {
        this.deps = deps;
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
            this.stop();
        }
    }

    public stop(): void {
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

    public destroy(): void {
        this.stop();
    }

    private _startDpadRepeat(button: Direction): void {
        this.stop();
        this.activeDpadButton = button;

        const { delayMs, intervalMs } = this.deps.getRepeatConfig();
        this.dpadRepeatDelayTimer = globalThis.setTimeout(() => {
            this.dpadRepeatDelayTimer = null;
            this.dpadRepeatIntervalTimer = globalThis.setInterval(() => {
                if (!this.activeDpadButton) {
                    this.stop();
                    return;
                }
                const moved = this.deps.tryMoveFocus(this.activeDpadButton);
                if (!moved) {
                    this.stop();
                }
            }, intervalMs);
        }, delayMs);
    }
}
