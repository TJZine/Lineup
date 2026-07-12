import { readAbortSignalReason } from '../../utils/abortSignalReason';
import type { PlexAuthValidationGuard } from '../../modules/plex/auth';

export interface StartupDiscoveryValidity {
    readonly signal: AbortSignal;
    assertCurrent(): void;
}

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
    guard: PlexAuthValidationGuard,
    discovery?: StartupDiscoveryValidity
): StartupPassValidity {
    const controller = new AbortController();
    const activeCallerSignal = callerSignal ?? null;
    const onCallerAbort = (): void => {
        if (activeCallerSignal) controller.abort(readAbortSignalReason(activeCallerSignal));
    };
    const onAuthAbort = (): void => controller.abort(readAbortSignalReason(guard.signal));
    const discoverySignal = discovery?.signal;
    const onDiscoveryAbort = (): void => {
        if (discoverySignal) controller.abort(readAbortSignalReason(discoverySignal));
    };
    activeCallerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    guard.signal.addEventListener('abort', onAuthAbort, { once: true });
    discoverySignal?.addEventListener('abort', onDiscoveryAbort, { once: true });
    if (activeCallerSignal?.aborted) onCallerAbort();
    else if (guard.signal.aborted) onAuthAbort();
    else if (discoverySignal?.aborted) onDiscoveryAbort();
    return {
        signal: controller.signal,
        assertCurrent(): void {
            throwIfStartupAborted(activeCallerSignal);
            guard.assertCurrent();
            discovery?.assertCurrent();
        },
        dispose(): void {
            activeCallerSignal?.removeEventListener('abort', onCallerAbort);
            guard.signal.removeEventListener('abort', onAuthAbort);
            discoverySignal?.removeEventListener('abort', onDiscoveryAbort);
        },
    };
}
