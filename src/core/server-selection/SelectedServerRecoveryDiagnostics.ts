import { sanitizeDiagnosticText } from '../../utils/redact';
import type { SelectedServerQuarantinePhase } from './SelectedServerQuarantineRecoveryState';

export interface SelectedServerSafeErrorDiagnostic {
    name: string;
    message: string;
    code?: string | number;
}

export interface SelectedServerRecoveryStepDiagnostic {
    step: string;
    error: SelectedServerSafeErrorDiagnostic;
}

export interface SelectedServerRecoveryDiagnostic {
    operationFailure: SelectedServerRecoveryStepDiagnostic;
    recoveryFailure: SelectedServerRecoveryStepDiagnostic;
    preparationFailures?: readonly SelectedServerRecoveryStepDiagnostic[];
}

interface ErrorLike {
    name?: unknown;
    message?: unknown;
    code?: unknown;
}

export function createSelectedServerSafeErrorDiagnostic(
    error: unknown
): SelectedServerSafeErrorDiagnostic {
    const errorLike = toErrorLike(error);
    const name = sanitizeDiagnosticText(
        typeof errorLike?.name === 'string' ? errorLike.name : 'Error',
        { maxLength: 80 }
    );
    const message = sanitizeDiagnosticText(
        typeof errorLike?.message === 'string'
            ? errorLike.message
            : typeof error === 'string'
                ? error
                : 'Unknown failure',
        { maxLength: 240 }
    );
    const code = createSafeCode(errorLike?.code);
    return Object.freeze({
        name,
        message,
        ...(code !== undefined ? { code } : {}),
    });
}

export function createSelectedServerRecoveryDiagnostic(
    operationStep: 'selection' | 'clear',
    operationFailure: unknown,
    phase: SelectedServerQuarantinePhase,
    recoveryFailure: unknown
): SelectedServerRecoveryDiagnostic {
    return Object.freeze({
        operationFailure: Object.freeze({
            step: operationStep,
            error: createSelectedServerSafeErrorDiagnostic(operationFailure),
        }),
        recoveryFailure: Object.freeze({
            step: phase,
            error: createSelectedServerSafeErrorDiagnostic(unwrapRecoveryCause(recoveryFailure)),
        }),
    });
}

export class SelectedServerQuarantinePreparationError extends Error {
    readonly failureDiagnostics: readonly SelectedServerRecoveryStepDiagnostic[];

    constructor(failures: readonly { step: string; error: unknown }[]) {
        super('Selected-server quarantine preparation failed.');
        this.name = 'SelectedServerQuarantinePreparationError';
        this.failureDiagnostics = Object.freeze(failures.map(({ step, error }) => Object.freeze({
            step,
            error: createSelectedServerSafeErrorDiagnostic(error),
        })));
    }
}

export function withSelectedServerPreparationFailures(
    diagnostic: SelectedServerRecoveryDiagnostic,
    error: unknown
): SelectedServerRecoveryDiagnostic {
    const preparationFailures = error instanceof SelectedServerQuarantinePreparationError
        ? error.failureDiagnostics
        : [Object.freeze({
            step: 'preparation',
            error: createSelectedServerSafeErrorDiagnostic(error),
        })];
    return Object.freeze({
        operationFailure: diagnostic.operationFailure,
        recoveryFailure: diagnostic.recoveryFailure,
        preparationFailures: Object.freeze([...preparationFailures]),
    });
}

export function retainSelectedServerPreparationFailures(
    diagnostic: SelectedServerRecoveryDiagnostic,
    priorDiagnostic?: SelectedServerRecoveryDiagnostic
): SelectedServerRecoveryDiagnostic {
    if (!priorDiagnostic?.preparationFailures) return diagnostic;
    return Object.freeze({
        operationFailure: diagnostic.operationFailure,
        recoveryFailure: diagnostic.recoveryFailure,
        preparationFailures: priorDiagnostic.preparationFailures,
    });
}

export function projectSelectedServerRecoveryDiagnosticForLog(
    value: unknown
): SelectedServerRecoveryDiagnostic | null {
    const record = toRecord(value);
    const operationFailure = projectStepDiagnostic(record?.['operationFailure']);
    const recoveryFailure = projectStepDiagnostic(record?.['recoveryFailure']);
    if (!operationFailure || !recoveryFailure) return null;
    const rawPreparationFailures = record?.['preparationFailures'];
    const preparationFailures = Array.isArray(rawPreparationFailures)
        ? rawPreparationFailures
            .slice(0, 8)
            .map(projectStepDiagnostic)
            .filter((failure): failure is SelectedServerRecoveryStepDiagnostic => failure !== null)
        : [];
    return Object.freeze({
        operationFailure,
        recoveryFailure,
        ...(preparationFailures.length > 0
            ? { preparationFailures: Object.freeze(preparationFailures) }
            : {}),
    });
}

function toErrorLike(error: unknown): ErrorLike | null {
    if (error instanceof Error) return error;
    if (error && typeof error === 'object') return error as ErrorLike;
    return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object'
        ? value as Record<string, unknown>
        : null;
}

function projectStepDiagnostic(value: unknown): SelectedServerRecoveryStepDiagnostic | null {
    const record = toRecord(value);
    if (!record || typeof record['step'] !== 'string' || !('error' in record)) return null;
    return Object.freeze({
        step: sanitizeDiagnosticText(record['step'], { maxLength: 80 }),
        error: createSelectedServerSafeErrorDiagnostic(record['error']),
    });
}

function createSafeCode(code: unknown): string | number | undefined {
    if (typeof code === 'number' && Number.isFinite(code)) return code;
    if (typeof code !== 'string') return undefined;
    return sanitizeDiagnosticText(code, { maxLength: 80 });
}

function unwrapRecoveryCause(error: unknown): unknown {
    if (error && typeof error === 'object' && 'cause' in error) {
        return (error as { cause?: unknown }).cause;
    }
    return error;
}
