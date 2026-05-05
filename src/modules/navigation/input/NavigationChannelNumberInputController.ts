import type { RemoteButton } from '../contracts/interfaces';

interface NavigationChannelNumberInputControllerDeps {
    getChannelInputConfig: () => { timeoutMs: number; maxDigits: number };
    emitChannelInputUpdate: (payload: { digits: string; isComplete: boolean }) => void;
    emitChannelNumberEntered: (payload: { channelNumber: number }) => void;
}

export class NavigationChannelNumberInputController {
    private readonly deps: NavigationChannelNumberInputControllerDeps;
    private channelDigits = '';
    private channelInputTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(deps: NavigationChannelNumberInputControllerDeps) {
        this.deps = deps;
    }

    public handleNumberKey(button: RemoteButton): void {
        const digit = button.replace('num', '');
        this._clearChannelInputTimer();

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
        this._clearChannelInputTimer();
        this.channelDigits = '';
    }

    private _clearChannelInputTimer(): void {
        if (this.channelInputTimer !== null) {
            globalThis.clearTimeout(this.channelInputTimer);
            this.channelInputTimer = null;
        }
    }

    private _commitChannelNumber(): void {
        this._clearChannelInputTimer();

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
