import type { FocusableElement, NavigationEventMap } from '../../../navigation';
import type { IDisposable } from '../../../../utils/interfaces';

export const createNavigationStub = (): {
    focusables: Map<string, FocusableElement>;
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    getFocusedElement: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
} => {
    const focusables = new Map<string, FocusableElement>();
    const clickHandlers = new Map<string, () => void>();
    let focusedId: string | null = null;
    const listeners = new Map<keyof NavigationEventMap, Set<(payload: never) => void>>();

    const setFocus = jest.fn((id: string): void => {
        if (!focusables.has(id)) return;
        focusedId = id;
        focusables.get(id)?.onFocus?.();
    });

    const off = jest.fn(<K extends keyof NavigationEventMap>(
        event: K,
        handler: (payload: NavigationEventMap[K]) => void
    ): void => {
        listeners.get(event)?.delete(handler as (payload: never) => void);
    });

    const on = jest.fn(<K extends keyof NavigationEventMap>(
        event: K,
        handler: (payload: NavigationEventMap[K]) => void
    ): IDisposable => {
        const eventListeners = listeners.get(event) ?? new Set<(payload: never) => void>();
        eventListeners.add(handler as (payload: never) => void);
        listeners.set(event, eventListeners);
        return {
            dispose: (): void => {
                off(event, handler);
            },
        };
    });

    return {
        focusables,
        registerFocusable: jest.fn((element: FocusableElement) => {
            const previousHandler = clickHandlers.get(element.id);
            if (previousHandler) {
                focusables.get(element.id)?.element.removeEventListener('click', previousHandler);
            }

            focusables.set(element.id, element);
            const clickHandler = (): void => {
                if (!focusables.has(element.id)) return;
                focusedId = element.id;
                element.onFocus?.();
                element.onSelect?.();
            };
            clickHandlers.set(element.id, clickHandler);
            element.element.addEventListener('click', clickHandler);
        }),
        unregisterFocusable: jest.fn((id: string) => {
            const clickHandler = clickHandlers.get(id);
            if (clickHandler) {
                focusables.get(id)?.element.removeEventListener('click', clickHandler);
                clickHandlers.delete(id);
            }
            focusables.delete(id);
            if (focusedId === id) {
                focusedId = null;
            }
        }),
        setFocus,
        getFocusedElement: jest.fn(() => (focusedId ? focusables.get(focusedId) ?? null : null)),
        on,
        off,
    };
};

export const activateCategory = (container: HTMLElement, categoryId: string): void => {
    const button = container.querySelector(`#settings-category-${categoryId}`) as HTMLButtonElement | null;
    if (!button) {
        throw new Error(`Category ${categoryId} not found`);
    }
    button.click();
};
