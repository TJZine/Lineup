import type { INavigationManager } from './interfaces';

export type AuthScreenNavigationPort = Pick<
    INavigationManager,
    'registerFocusable' | 'unregisterFocusable' | 'setFocus' | 'getFocusedElement'
>;

export type ServerSelectScreenNavigationPort = Pick<
    INavigationManager,
    | 'registerFocusable'
    | 'unregisterFocusable'
    | 'setFocus'
    | 'restoreFocusForCurrentScreen'
    | 'getCurrentScreen'
    | 'replaceScreen'
>;
