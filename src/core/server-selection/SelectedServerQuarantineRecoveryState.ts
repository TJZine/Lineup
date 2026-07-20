import type { SelectedServerRecoveryDiagnostic } from './SelectedServerRecoveryDiagnostics';

export type SelectedServerQuarantinePhase =
    | 'discovery_restore'
    | 'persistence_restore'
    | 'selected_runtime_restore'
    | 'unselected_runtime_restore'
    | 'preparation'
    | 'proof';

export type SelectedServerQuarantineCommandState =
    | { kind: 'clear' }
    | {
        kind: 'quarantined';
        phase: SelectedServerQuarantinePhase;
        commandPending: boolean;
        diagnostic: SelectedServerRecoveryDiagnostic;
    };

export type SelectedServerQuarantineRecovery = {
    phase: SelectedServerQuarantinePhase;
    diagnostic: SelectedServerRecoveryDiagnostic;
    retry(priorDiagnostic?: SelectedServerRecoveryDiagnostic): Promise<void>;
};

export class SelectedServerQuarantineRecoveryState {
    private _recovery: SelectedServerQuarantineRecovery | null = null;
    private _commandTail: Promise<void> = Promise.resolve();
    private _commandPending = false;

    constructor(private readonly _exit: () => Promise<void>) {}

    enter(recovery: SelectedServerQuarantineRecovery): void {
        this._recovery = Object.freeze({ ...recovery });
    }

    getState(): SelectedServerQuarantineCommandState {
        return this._recovery
            ? {
                kind: 'quarantined',
                phase: this._recovery.phase,
                commandPending: this._commandPending,
                diagnostic: this._recovery.diagnostic,
            }
            : { kind: 'clear' };
    }

    assertSelectionAllowed(): void {
        if (this._recovery) throw new Error('Selected-server recovery is quarantined.');
    }

    retry(): Promise<void> {
        return this._enqueue(async () => {
            const recovery = this._recovery;
            if (!recovery) return;
            await recovery.retry();
            if (this._recovery === recovery) this._recovery = null;
        });
    }

    exit(): Promise<void> {
        return this._enqueue(() => this._exit());
    }

    private _enqueue(command: () => Promise<void>): Promise<void> {
        const run = this._commandTail.then(async () => {
            this._commandPending = true;
            try {
                await command();
            } finally {
                this._commandPending = false;
            }
        });
        this._commandTail = run.then(() => undefined, () => undefined);
        return run;
    }
}
