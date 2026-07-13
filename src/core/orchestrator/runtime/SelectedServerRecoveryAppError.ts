import type { AppError } from '../../../modules/lifecycle';
import { AppErrorCode } from '../../../types/app-errors';

const SELECTED_SERVER_RECOVERY_CONTEXT = Object.freeze({
    recoveryMode: 'selected-server-quarantine',
});

export function createSelectedServerRecoveryAppError(message: string): AppError {
    return {
        code: AppErrorCode.INITIALIZATION_FAILED,
        message,
        recoverable: true,
        context: SELECTED_SERVER_RECOVERY_CONTEXT,
    };
}

export function createSelectedServerRecoveryGateError(method: string): Error & AppError {
    const appError = createSelectedServerRecoveryAppError(
        `Runtime command ${method} is unavailable during selected-server recovery.`
    );
    return Object.assign(new Error(appError.message), appError);
}
