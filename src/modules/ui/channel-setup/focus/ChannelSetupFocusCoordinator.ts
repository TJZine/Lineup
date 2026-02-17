import type { FocusableElement } from '../../../navigation/interfaces';
import { STEP2_ADJUSTABLE_CONTROL_IDS } from '../steps/constants';
import { scrollToNearest } from './scrollToNearest';
import type { FocusCoordinatorDeps } from './types';

const STEP2_ADJUSTABLE_IDS = new Set<string>(STEP2_ADJUSTABLE_CONTROL_IDS);

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

    registerStep2(
        categoryButtons: HTMLButtonElement[],
        detailButtons: HTMLButtonElement[],
        footerButtons: HTMLButtonElement[],
        activeCategoryId: string,
        detailFocusTarget: string | null,
        preferredFocusId: string | null,
        onDetailFocus: (id: string) => void
    ): boolean {
        const nav = this._deps.getNavigation();
        if (!nav) {
            this._registeredIds = [];
            return false;
        }

        for (const id of this._registeredIds) {
            nav.unregisterFocusable(id);
        }
        this._registeredIds = [];

        const focusableButtons = [...categoryButtons, ...detailButtons, ...footerButtons]
            .filter((button) => !button.disabled);
        this._registeredIds = focusableButtons.map((button) => button.id);

        const detailIdSet = new Set<string>(
            detailButtons.filter((button) => !button.disabled).map((button) => button.id)
        );
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
            const isAdjustable = STEP2_ADJUSTABLE_IDS.has(button.id) || button.id.startsWith('setup-priority-');
            if (isDetailButton && !isAdjustable) {
                neighbors.left = activeCategoryId;
            }

            nav.registerFocusable({
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

        return this._setPreferredOrFirst(nav, focusableButtons, preferredFocusId);
    }

    unregisterAll(): void {
        const nav = this._deps.getNavigation();
        if (nav) {
            for (const id of this._registeredIds) {
                nav.unregisterFocusable(id);
            }
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

        for (const id of this._registeredIds) {
            nav.unregisterFocusable(id);
        }
        this._registeredIds = [];

        const focusableButtons = buttons.filter(
            (button): button is HTMLButtonElement =>
                button instanceof HTMLButtonElement && !button.disabled
        );
        this._registeredIds = focusableButtons.map((button) => button.id);

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
            nav.registerFocusable(focusable);
        }

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
