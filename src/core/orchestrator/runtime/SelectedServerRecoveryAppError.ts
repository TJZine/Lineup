import type { AppError } from '../../../modules/lifecycle';
import { AppErrorCode } from '../../../types/app-errors';
import type {
    SelectedServerQuarantineCommandState,
    SelectedServerQuarantinePhase,
} from '../../server-selection/SelectedServerQuarantineRecoveryState';
import { projectSelectedServerRecoveryDiagnosticForLog } from '../../server-selection/SelectedServerRecoveryDiagnostics';

const RECOVERY_PHASES = new Set<SelectedServerQuarantinePhase>([
    'discovery_restore',
    'persistence_restore',
    'selected_runtime_restore',
    'unselected_runtime_restore',
    'preparation',
    'proof',
]);

export function createSelectedServerRecoveryAppError(
    message: string,
    quarantine?: Extract<SelectedServerQuarantineCommandState, { kind: 'quarantined' }>
): AppError {
    return {
        code: AppErrorCode.INITIALIZATION_FAILED,
        message,
        recoverable: true,
        context: Object.freeze({
            recoveryMode: 'selected-server-quarantine',
            ...(quarantine ? {
                recoveryPhase: quarantine.phase,
                recoveryDiagnostic: quarantine.diagnostic,
            } : {}),
        }),
    };
}

export function createSelectedServerRecoveryGateError(method: string): Error & AppError {
    const appError = createSelectedServerRecoveryAppError(
        `Runtime command ${method} is unavailable during selected-server recovery.`
    );
    return Object.assign(new Error(appError.message), appError);
}

export function createSelectedServerRecoveryLogData(
    error: AppError
): Record<string, unknown> | undefined {
    const context = error.context;
    if (
        !context
        || context['recoveryMode'] !== 'selected-server-quarantine'
        || typeof context['recoveryPhase'] !== 'string'
        || !RECOVERY_PHASES.has(context['recoveryPhase'] as SelectedServerQuarantinePhase)
    ) {
        return undefined;
    }
    const diagnostic = projectSelectedServerRecoveryDiagnosticForLog(
        context['recoveryDiagnostic']
    );
    if (!diagnostic) return undefined;
    return {
        selectedServerRecovery: Object.freeze({
            recoveryMode: 'selected-server-quarantine',
            recoveryPhase: context['recoveryPhase'],
            recoveryDiagnostic: diagnostic,
        }),
    };
}
