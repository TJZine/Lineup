import type { FocusableElement } from '../../../navigation/contracts/interfaces';
import { syncFocusableRegistry } from '../../common/focus/syncFocusableRegistry';
import { scrollToNearest } from './scrollToNearest';
import type { FocusCoordinatorDeps, RegisterLibraryStepFocusOptions, RegisterStep2FocusOptions } from './types';

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

    registerLibraryStep(options: RegisterLibraryStepFocusOptions): boolean {
        const nav = this._deps.getNavigation();
        if (!nav) {
            this._registeredIds = [];
            return false;
        }

        const {
            selectAllButton,
            clearAllButton,
            listButtons,
            footerButtons,
            preferredFocusId,
        } = options;
        const downNeighbor = listButtons[0]?.id;
        const focusableButtons = [
            selectAllButton,
            clearAllButton,
            ...listButtons,
            ...footerButtons,
        ].filter((button) => !button.disabled);

        const entries = focusableButtons.map((button): FocusableElement => {
            const neighbors: FocusableElement['neighbors'] = {};
            if (button === selectAllButton) {
                if (!clearAllButton.disabled) {
                    neighbors.right = clearAllButton.id;
                }
                if (downNeighbor) {
                    neighbors.down = downNeighbor;
                }
            } else if (button === clearAllButton) {
                if (!selectAllButton.disabled) {
                    neighbors.left = selectAllButton.id;
                }
                if (downNeighbor) {
                    neighbors.down = downNeighbor;
                }
            }

            return {
                id: button.id,
                element: button,
                neighbors,
                onFocus: (): void => {
                    scrollToNearest(button);
                },
            };
        });
        this._registeredIds = syncFocusableRegistry(nav, this._registeredIds, entries);

        return this._setPreferredOrFirst(nav, focusableButtons, preferredFocusId);
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
            onFocus,
            onDetailFocus,
        } = options;

        const focusableCategories = categoryButtons.filter((button) => !button.disabled);
        const focusableDetails = detailButtons.filter((button) => !button.disabled);
        const focusableFooters = footerButtons.filter((button) => !button.disabled);
        const focusableButtons = [...focusableCategories, ...focusableDetails, ...focusableFooters];
        const categoryIdSet = new Set(focusableCategories.map((button) => button.id));
        const detailIdSet = new Set(focusableDetails.map((button) => button.id));
        const footerIdSet = new Set(focusableFooters.map((button) => button.id));
        const backButton = focusableFooters[0];
        const nextButton = focusableFooters[1] ?? focusableFooters[0];
        const entries: FocusableElement[] = [];
        for (const button of focusableButtons) {
            const neighbors: FocusableElement['neighbors'] = {};
            if (categoryIdSet.has(button.id)) {
                const index = focusableCategories.indexOf(button);
                const up = focusableCategories[index - 1] ?? button;
                const down = focusableCategories[index + 1] ?? backButton ?? button;
                neighbors.up = up.id;
                neighbors.down = down.id;
                neighbors.left = button.id;
                if (button.id === activeCategoryId && detailFocusTarget && detailIdSet.has(detailFocusTarget)) {
                    neighbors.right = detailFocusTarget;
                } else {
                    neighbors.right = button.id;
                }
            } else if (detailIdSet.has(button.id)) {
                const index = focusableDetails.indexOf(button);
                const up = focusableDetails[index - 1] ?? button;
                const down = focusableDetails[index + 1] ?? nextButton ?? button;
                neighbors.up = up.id;
                neighbors.down = down.id;
                neighbors.left = categoryIdSet.has(activeCategoryId) ? activeCategoryId : button.id;
                neighbors.right = button.id;
            } else if (footerIdSet.has(button.id)) {
                const index = focusableFooters.indexOf(button);
                const previousFooter = focusableFooters[index - 1];
                const nextFooter = focusableFooters[index + 1];
                neighbors.left = previousFooter?.id ?? button.id;
                neighbors.right = nextFooter?.id ?? button.id;
                if (button === backButton) {
                    neighbors.up = focusableCategories[focusableCategories.length - 1]?.id ?? button.id;
                } else if (button === nextButton) {
                    neighbors.up = focusableDetails[focusableDetails.length - 1]?.id
                        ?? backButton?.id
                        ?? button.id;
                } else {
                    neighbors.up = button.id;
                }
                neighbors.down = button.id;
            }

            const isDetailButton = detailIdSet.has(button.id);
            entries.push({
                id: button.id,
                element: button,
                neighbors,
                onFocus: () => {
                    scrollToNearest(button);
                    onFocus?.(button.id);
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
