import { readAbortSignalReason } from '../../utils/abortSignalReason';
import type { PlexAuthValidationGuard } from '../../modules/plex/auth';

export interface StartupSignalOptions {
    signal?: AbortSignal | null | undefined;
}

export function throwIfStartupAborted(signal: AbortSignal | null | undefined): void {
    if (!signal?.aborted) {
        return;
    }
    throw readStartupAbortReason(signal);
}

export function isStartupAbortError(
    error: unknown,
    signal: AbortSignal | null | undefined
): boolean {
    if (!signal?.aborted) {
        return false;
    }
    return error === readStartupAbortReason(signal);
}

export function readStartupAbortReason(signal: AbortSignal): unknown {
    return readAbortSignalReason(signal);
}

export interface StartupPassValidity {
    readonly signal: AbortSignal;
    assertCurrent(): void;
    dispose(): void;
}

/** Compose caller cancellation with auth supersession while preserving caller-first observation. */
export function createStartupPassValidity(
    callerSignal: AbortSignal | null | undefined,
    guard: PlexAuthValidationGuard
): StartupPassValidity {
    const controller = new AbortController();
    const onCallerAbort = (): void => controller.abort(readAbortSignalReason(callerSignal!));
    const onAuthAbort = (): void => controller.abort(readAbortSignalReason(guard.signal));
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    guard.signal.addEventListener('abort', onAuthAbort, { once: true });
    if (callerSignal?.aborted) onCallerAbort();
    else if (guard.signal.aborted) onAuthAbort();
    return {
        signal: controller.signal,
        assertCurrent(): void {
            throwIfStartupAborted(callerSignal);
            guard.assertCurrent();
        },
        dispose(): void {
            callerSignal?.removeEventListener('abort', onCallerAbort);
            guard.signal.removeEventListener('abort', onAuthAbort);
        },
    };
}
