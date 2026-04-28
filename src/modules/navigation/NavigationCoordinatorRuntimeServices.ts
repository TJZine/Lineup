import { recordNonBlockingFailureTimestamp } from './nonBlockingFailureTimestamps';
import type { KeyEvent } from './interfaces';
import type { NavigationCoordinatorEventPort } from './NavigationCoordinatorEventPort';

export type NavigationFireAndReport = (
    key: string,
    promiseFactory: () => Promise<void>,
    message: string,
    toastMessage: string
) => Promise<void> | null;

export type NavigationObserveNonBlockingPromise = (
    key: string,
    promiseFactory: () => Promise<void>,
    message: string
) => Promise<void>;

export type NavigationLogInputNotHandled = (
    reason: 'modal_open' | 'screen_not_player' | 'input_blocked',
    event: KeyEvent
) => void;

export interface NavigationCoordinatorRuntimeServices {
    fireAndReport: NavigationFireAndReport;
    observeNonBlockingPromise: NavigationObserveNonBlockingPromise;
    logInputNotHandled: NavigationLogInputNotHandled;
}

export function createNavigationCoordinatorRuntimeServices(
    events: NavigationCoordinatorEventPort
): NavigationCoordinatorRuntimeServices {
    const nonBlockingFailureTimestamps = new Map<string, number>();
    const suppressedLogTimestamps = new Map<string, number>();

    const reportNonBlockingFailure = (
        key: string,
        event: string,
        message: string,
        error: unknown,
        toastMessage?: string
    ): void => {
        const now = Date.now();
        if (!recordNonBlockingFailureTimestamp(nonBlockingFailureTimestamps, key, now)) {
            return;
        }
        try {
            events.reportRecoverableAsyncFailure(event, message, error);
        } catch {
            // Diagnostics are best-effort in non-blocking failure paths.
        }
        if (toastMessage) {
            try {
                events.reportToast?.({ message: toastMessage, type: 'warning' });
            } catch {
                // Toast delivery must remain best-effort here.
            }
        }
    };

    return {
        fireAndReport: (
            key: string,
            promiseFactory: () => Promise<void>,
            message: string,
            toastMessage: string
        ): Promise<void> | null => {
            let promise: Promise<void>;
            try {
                promise = promiseFactory();
            } catch (error: unknown) {
                reportNonBlockingFailure(
                    key,
                    `navigation.${key}`,
                    message,
                    error,
                    toastMessage
                );
                return null;
            }
            void promise.catch((error: unknown) => {
                reportNonBlockingFailure(
                    key,
                    `navigation.${key}`,
                    message,
                    error,
                    toastMessage
                );
            });
            return promise;
        },
        observeNonBlockingPromise: async (
            key: string,
            promiseFactory: () => Promise<void>,
            message: string
        ): Promise<void> => {
            let promise: Promise<void>;
            try {
                promise = promiseFactory();
            } catch (error: unknown) {
                reportNonBlockingFailure(
                    key,
                    `navigation.${key}`,
                    message,
                    error
                );
                return;
            }
            try {
                await promise;
            } catch (error: unknown) {
                reportNonBlockingFailure(
                    key,
                    `navigation.${key}`,
                    message,
                    error
                );
            }
        },
        logInputNotHandled: (
            reason: 'modal_open' | 'screen_not_player' | 'input_blocked',
            event: KeyEvent
        ): void => {
            if (!events.readDebugLoggingEnabled()) return;
            const navigation = events.navigation;
            const state = navigation.getState();
            const currentScreen = state?.currentScreen ?? 'unknown';
            const modalStack = state?.modalStack ?? [];
            const inputBlocked = navigation.isInputBlocked();
            const key = [
                reason,
                event.button,
                currentScreen,
                modalStack.join(','),
                inputBlocked ? 'blocked' : 'open',
            ].join('|');
            const now = Date.now();
            const last = suppressedLogTimestamps.get(key) ?? 0;
            if (now - last < 1000) {
                return;
            }
            if (suppressedLogTimestamps.size > 50) {
                suppressedLogTimestamps.clear();
            }
            suppressedLogTimestamps.set(key, now);
            try {
                events.logDebug?.('navigation.inputNotHandled', {
                    reason,
                    button: event.button,
                    currentScreen,
                    modalStack,
                    inputBlocked,
                });
            } catch {
                // Debug diagnostics are best-effort and must not affect input handling.
            }
        },
    };
}
