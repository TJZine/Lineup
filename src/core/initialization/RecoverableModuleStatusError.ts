import { AppErrorCode, getAppErrorCode, type AppError } from '../../types/app-errors';

function readErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string' &&
        (error as { message: string }).message.trim()
    ) {
        return (error as { message: string }).message;
    }
    if (typeof error === 'string' && error.trim()) {
        return error;
    }
    return fallbackMessage;
}

function readErrorContext(error: unknown): Record<string, unknown> | undefined {
    if (
        typeof error === 'object' &&
        error !== null &&
        'context' in error &&
        typeof (error as { context?: unknown }).context === 'object' &&
        (error as { context?: unknown }).context !== null &&
        !Array.isArray((error as { context?: unknown }).context)
    ) {
        return (error as { context: Record<string, unknown> }).context;
    }

    return undefined;
}

export function toRecoverableModuleStatusError(
    error: unknown,
    fallbackMessage: string,
    fallbackCode: AppErrorCode = AppErrorCode.MODULE_INIT_FAILED
): AppError {
    const code = getAppErrorCode(
        typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
    ) ?? fallbackCode;
    const recoverable =
        typeof error === 'object' &&
        error !== null &&
        typeof (error as { recoverable?: unknown }).recoverable === 'boolean'
            ? (error as { recoverable: boolean }).recoverable
            : true;
    const context = readErrorContext(error);

    return {
        code,
        message: readErrorMessage(error, fallbackMessage),
        recoverable,
        ...(context ? { context } : {}),
    };
}
