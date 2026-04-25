import type { FocusableElement } from '../../../navigation/interfaces';
import { syncFocusableRegistry } from '../../common/focus/syncFocusableRegistry';
import { scrollToNearest } from './scrollToNearest';
import type { FocusCoordinatorDeps, RegisterStep2FocusOptions } from './types';

export class ChannelSetupFocusCoordinator {
    private readonly _deps: FocusCoordinatorDeps;
    private _registeredIds: string[] = [];

    constructor(deps: FocusCoordinatorDeps) {
        this._deps = deps;
    }

    registerLinear(buttons: HTMLElement[], preferredFocusId: string | null): boolean {
        return this._registerButtons(buttons, 'linear', preferredFocusId);
    }

    registerSpatial(buttons: HTMLElement[], preferredFocusId: string | null): boolean {
        return this._registerButtons(buttons, 'spatial', preferredFocusId);
    }

    registerStep2(options: RegisterStep2FocusOptions): boolean {
        const nav = this._deps.getNavigation();
        if (!nav) {
            this._registeredIds = [];
            return false;
        }
        const {
            categoryButtons,
            detailButtons,
            footerButtons,
            activeCategoryId,
            detailFocusTarget,
            preferredFocusId,
            onDetailFocus,
        } = options;

        const focusableButtons = [...categoryButtons, ...detailButtons, ...footerButtons]
            .filter((button) => !button.disabled);

        const detailIdSet = new Set<string>(
            detailButtons.filter((button) => !button.disabled).map((button) => button.id)
        );
        const entries: FocusableElement[] = [];
        for (const [index, button] of focusableButtons.entries()) {
            const neighbors: FocusableElement['neighbors'] = {};
            const up = index > 0 ? focusableButtons[index - 1] : undefined;
            if (up) {
                neighbors.up = up.id;
            }
            const down = index < focusableButtons.length - 1 ? focusableButtons[index + 1] : undefined;
            if (down) {
                neighbors.down = down.id;
            }

            if (button.id === activeCategoryId && detailFocusTarget) {
                neighbors.right = detailFocusTarget;
            }

            const isDetailButton = detailIdSet.has(button.id);
            if (isDetailButton) {
                neighbors.left = activeCategoryId;
            }

            entries.push({
                id: button.id,
                element: button,
                neighbors,
                onFocus: () => {
                    scrollToNearest(button);
                    if (isDetailButton) {
                        onDetailFocus(button.id);
                    }
                },
            });
        }
        this._registeredIds = syncFocusableRegistry(nav, this._registeredIds, entries);

        return this._setPreferredOrFirst(nav, focusableButtons, preferredFocusId);
    }

    unregisterAll(): void {
        const nav = this._deps.getNavigation();
        if (nav) {
            this._registeredIds = syncFocusableRegistry(nav, this._registeredIds, []);
        }
        this._registeredIds = [];
    }

    private _registerButtons(
        buttons: HTMLElement[],
        mode: 'linear' | 'spatial',
        preferredFocusId: string | null
    ): boolean {
        const nav = this._deps.getNavigation();
        if (!nav) {
            this._registeredIds = [];
            return false;
        }

        const focusableButtons = buttons.filter(
            (button): button is HTMLButtonElement =>
                button instanceof HTMLButtonElement && !button.disabled
        );
        const entries: FocusableElement[] = [];
        for (const [index, button] of focusableButtons.entries()) {
            const focusable: FocusableElement = {
                id: button.id,
                element: button,
                neighbors: {},
                onFocus: () => {
                    scrollToNearest(button);
                },
            };
            if (mode === 'linear') {
                const up = index > 0 ? focusableButtons[index - 1] : undefined;
                if (up) {
                    focusable.neighbors.up = up.id;
                }
                const down = index < focusableButtons.length - 1 ? focusableButtons[index + 1] : undefined;
                if (down) {
                    focusable.neighbors.down = down.id;
                }
            }
            entries.push(focusable);
        }
        this._registeredIds = syncFocusableRegistry(nav, this._registeredIds, entries);

        return this._setPreferredOrFirst(nav, focusableButtons, preferredFocusId);
    }

    private _setPreferredOrFirst(
        nav: { setFocus: (id: string) => void },
        buttons: HTMLButtonElement[],
        preferredFocusId: string | null
    ): boolean {
        if (preferredFocusId && buttons.some((button) => button.id === preferredFocusId)) {
            nav.setFocus(preferredFocusId);
            return true;
        }

        const first = buttons[0];
        if (first) {
            nav.setFocus(first.id);
        }
        return false;
    }
}
