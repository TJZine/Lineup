import type { AppError } from '../../../modules/lifecycle';
import { AppErrorCode } from '../../../types/app-errors';
import type {
    SelectedServerQuarantineCommandState,
} from '../../server-selection/SelectedServerQuarantineRecoveryState';

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
