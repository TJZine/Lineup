import type { FocusableElement, INavigationManager } from '../../../navigation/interfaces';

export function syncFocusableRegistry(
    nav: Pick<INavigationManager, 'registerFocusable' | 'unregisterFocusable'>,
    prevIds: string[],
    entries: FocusableElement[]
): string[] {
    for (const id of prevIds) {
        nav.unregisterFocusable(id);
    }

    for (const entry of entries) {
        nav.registerFocusable(entry);
    }

    return entries.map((entry) => entry.id);
}
