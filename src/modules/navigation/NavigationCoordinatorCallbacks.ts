import type { KeyEvent } from './interfaces';

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
