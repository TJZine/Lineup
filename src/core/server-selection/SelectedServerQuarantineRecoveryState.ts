import type { SelectedServerRecoveryDiagnostic } from './SelectedServerRecoveryDiagnostics';

export const SELECTED_SERVER_QUARANTINE_PHASES = [
    'discovery_restore',
    'persistence_restore',
    'selected_runtime_restore',
    'unselected_runtime_restore',
    'preparation',
    'proof',
] as const;

export type SelectedServerQuarantinePhase =
    typeof SELECTED_SERVER_QUARANTINE_PHASES[number];

const SELECTED_SERVER_QUARANTINE_PHASE_SET: ReadonlySet<string> =
    new Set(SELECTED_SERVER_QUARANTINE_PHASES);

export function isSelectedServerQuarantinePhase(
    value: unknown
): value is SelectedServerQuarantinePhase {
    return typeof value === 'string'
        && SELECTED_SERVER_QUARANTINE_PHASE_SET.has(value);
}

export type SelectedServerQuarantineCommandState =
    | { kind: 'clear' }
    | {
        kind: 'quarantined';
        phase: SelectedServerQuarantinePhase;
        commandPending: boolean;
        diagnostic: SelectedServerRecoveryDiagnostic;
    };

export type SelectedServerQuarantineRecoveryPresentation = 'none' | 'server-select';

export type SelectedServerQuarantineRecovery = {
    phase: SelectedServerQuarantinePhase;
    diagnostic: SelectedServerRecoveryDiagnostic;
    retry(
        priorDiagnostic?: SelectedServerRecoveryDiagnostic
    ): Promise<SelectedServerQuarantineRecoveryPresentation>;
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

    retry(): Promise<SelectedServerQuarantineRecoveryPresentation> {
        return this._enqueue(async () => {
            const recovery = this._recovery;
            if (!recovery) return 'none';
            const presentation = await recovery.retry();
            if (this._recovery === recovery) this._recovery = null;
            return presentation;
        });
    }

    exit(): Promise<void> {
        return this._enqueue(() => this._exit());
    }

    private _enqueue<T>(command: () => Promise<T>): Promise<T> {
        const run = this._commandTail.then(async () => {
            this._commandPending = true;
            try {
                return await command();
            } finally {
                this._commandPending = false;
            }
        });
        this._commandTail = run.then(() => undefined, () => undefined);
        return run;
    }
}
