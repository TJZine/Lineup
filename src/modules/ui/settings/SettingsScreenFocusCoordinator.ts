import type { FocusableElement, INavigationManager, KeyEvent } from '../../navigation';
import { syncFocusableRegistry } from '../common/focus/syncFocusableRegistry';
import { createSettingsDropdown } from './SettingsDropdown';
import type { createSettingsSelect } from './SettingsSelect';
import type { createSettingsToggle } from './SettingsToggle';
import type { SettingsCategoryConfig, SettingsCategoryId } from './types';

type SettingsToggleControl = ReturnType<typeof createSettingsToggle>;
type SettingsSelectControl = ReturnType<typeof createSettingsSelect>;
type SettingsDropdownHandle = ReturnType<typeof createSettingsDropdown>;

export interface SettingsScreenSetActiveCategoryOptions {
    preferredFocusId?: string | null;
    focusDetail?: boolean;
}

export interface SettingsScreenFocusCoordinatorOptions {
    container: HTMLElement;
    getNavigation: () => INavigationManager | null;
    getCategories: () => SettingsCategoryConfig[];
    getActiveCategoryId: () => SettingsCategoryId | null;
    getActiveCategoryItemIds: () => string[];
    getCategoryButton: (categoryId: SettingsCategoryId) => HTMLButtonElement | null;
    getSwitchProfileButton: () => HTMLButtonElement | null;
    getToggle: (id: string) => SettingsToggleControl | undefined;
    getSelect: (id: string) => SettingsSelectControl | undefined;
    setActiveCategory: (categoryId: SettingsCategoryId, options?: SettingsScreenSetActiveCategoryOptions) => void;
    isVisible: () => boolean;
    isDeferredDetailSwapActive: () => boolean;
}

export class SettingsScreenFocusCoordinator {
    private readonly _container: HTMLElement;
    private readonly _getNavigation: () => INavigationManager | null;
    private readonly _getCategories: () => SettingsCategoryConfig[];
    private readonly _getActiveCategoryId: () => SettingsCategoryId | null;
    private readonly _getActiveCategoryItemIds: () => string[];
    private readonly _getCategoryButton: (categoryId: SettingsCategoryId) => HTMLButtonElement | null;
    private readonly _getSwitchProfileButton: () => HTMLButtonElement | null;
    private readonly _getToggle: (id: string) => SettingsToggleControl | undefined;
    private readonly _getSelect: (id: string) => SettingsSelectControl | undefined;
    private readonly _setActiveCategory: (
        categoryId: SettingsCategoryId,
        options?: SettingsScreenSetActiveCategoryOptions
    ) => void;
    private readonly _isVisible: () => boolean;
    private readonly _isDeferredDetailSwapActive: () => boolean;
    private _activeDropdown: SettingsDropdownHandle | null = null;
    private _focusableIds: string[] = [];
    private _lastFocusedItemByCategory: Partial<Record<SettingsCategoryId, string>> = {};
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _navKeyHandlerOwner: INavigationManager | null = null;
    private _pendingFocusRestore: { categoryId: SettingsCategoryId; preferredFocusId: string | null } | null = null;

    public constructor(options: SettingsScreenFocusCoordinatorOptions) {
        this._container = options.container;
        this._getNavigation = options.getNavigation;
        this._getCategories = options.getCategories;
        this._getActiveCategoryId = options.getActiveCategoryId;
        this._getActiveCategoryItemIds = options.getActiveCategoryItemIds;
        this._getCategoryButton = options.getCategoryButton;
        this._getSwitchProfileButton = options.getSwitchProfileButton;
        this._getToggle = options.getToggle;
        this._getSelect = options.getSelect;
        this._setActiveCategory = options.setActiveCategory;
        this._isVisible = options.isVisible;
        this._isDeferredDetailSwapActive = options.isDeferredDetailSwapActive;
    }

    public getCategoryButtonId(id: SettingsCategoryId): string {
        return `settings-category-${id}`;
    }

    public hasRegisteredFocusables(): boolean {
        return this._focusableIds.length > 0;
    }

    public resolveCategoryChangePreferredFocus(
        categoryId: SettingsCategoryId | null,
        options: SettingsScreenSetActiveCategoryOptions = {}
    ): string | null {
        if (!this._isVisible() || !categoryId) {
            return null;
        }

        const categoryButtonId = this.getCategoryButtonId(categoryId);
        const categoryConfig = this._getCategories().find((entry) => entry.id === categoryId);
        if (options.focusDetail) {
            const rememberedId = this._lastFocusedItemByCategory[categoryId];
            const rememberedStillBelongsToCategory = Boolean(
                rememberedId && categoryConfig?.items.some((item) => item.id === rememberedId)
            );
            return rememberedStillBelongsToCategory
                ? rememberedId ?? categoryButtonId
                : categoryConfig?.items[0]?.id ?? categoryButtonId;
        }

        return options.preferredFocusId ?? categoryButtonId;
    }

    public focusActiveCategoryDetail(categoryId: SettingsCategoryId): void {
        if (!this._isVisible()) {
            return;
        }

        const categoryButtonId = this.getCategoryButtonId(categoryId);
        const preferredFocusId = this._getPreferredDetailFocusId(categoryId) ?? categoryButtonId;
        if (this._isDeferredDetailSwapActive() && preferredFocusId !== categoryButtonId) {
            this.setPendingFocusRestore(categoryId, preferredFocusId);
        }
        this.resetFocusables(preferredFocusId);
    }

    public setPendingFocusRestore(categoryId: SettingsCategoryId, preferredFocusId: string | null): void {
        this._pendingFocusRestore = { categoryId, preferredFocusId };
    }

    public consumePendingFocusRestore(categoryId: SettingsCategoryId | null): string | null {
        if (!categoryId || this._pendingFocusRestore?.categoryId !== categoryId) {
            return null;
        }

        const preferredFocusId = this._pendingFocusRestore.preferredFocusId;
        this._pendingFocusRestore = null;
        return preferredFocusId;
    }

    public clearPendingFocusRestore(): void {
        this._pendingFocusRestore = null;
    }

    public attachKeyHandler(): void {
        const nav = this._getNavigation();
        if (!nav || this._navKeyHandler) {
            return;
        }

        this._navKeyHandler = (event: KeyEvent): void => {
            if (event.handled) return;

            if (this._activeDropdown && event.button === 'back') {
                event.handled = true;
                this._dismissDropdown();
                return;
            }

            const focusedId = nav.getFocusedElement()?.id;
            if (!focusedId) return;

            const focusedCategoryId = this._getCategoryIdFromButtonId(focusedId);
            if (focusedCategoryId && event.button === 'right') {
                this._setActiveCategory(focusedCategoryId, { focusDetail: true });
                event.handled = true;
                return;
            }

            const select = this._getSelect(focusedId);
            if (select && !select.isDisabled() && event.button === 'left') {
                const changed = select.cyclePrev();
                if (!changed) {
                    const activeCategoryId = this._getActiveCategoryId();
                    if (activeCategoryId) {
                        nav.setFocus(this.getCategoryButtonId(activeCategoryId));
                    }
                }
                event.handled = true;
                return;
            }

            if (select && !select.isDisabled() && event.button === 'right') {
                select.cycleNext();
                event.handled = true;
                return;
            }

            if (event.button === 'left' && this._isDetailFocusable(focusedId)) {
                const activeCategoryId = this._getActiveCategoryId();
                if (activeCategoryId) {
                    nav.setFocus(this.getCategoryButtonId(activeCategoryId));
                    event.handled = true;
                }
            }
        };
        this._navKeyHandlerOwner = nav;
        nav.on('keyPress', this._navKeyHandler);
    }

    public detachKeyHandler(): void {
        if (!this._navKeyHandler) {
            return;
        }

        this._navKeyHandlerOwner?.off('keyPress', this._navKeyHandler);
        this._navKeyHandler = null;
        this._navKeyHandlerOwner = null;
    }

    public openDropdownForSelect(selectId: string): void {
        this.closeDropdown();

        const select = this._getSelect(selectId);
        if (!select || select.isDisabled()) return;

        const nav = this._getNavigation();
        let dropdown: SettingsDropdownHandle | null = null;
        let completedDuringCreate = false;
        dropdown = createSettingsDropdown({
            anchor: select.element,
            container: this._container,
            options: select.getOptions(),
            currentValue: select.getValue(),
            onSelect: (value: number): void => {
                try {
                    select.setValue(value);
                } finally {
                    if (!dropdown) {
                        completedDuringCreate = true;
                    }
                    this.closeDropdown();
                    try {
                        nav?.setFocus(selectId);
                    } catch {
                        // Ignore focus restore failures.
                    }
                }
            },
            onDismiss: (): void => {
                if (!dropdown) {
                    completedDuringCreate = true;
                } else if (this._activeDropdown === dropdown) {
                    this._activeDropdown = null;
                }
                try {
                    nav?.setFocus(selectId);
                } catch {
                    // Ignore focus restore failures.
                }
            },
            nav,
        });
        if (!completedDuringCreate) {
            this._activeDropdown = dropdown;
        }
    }

    public closeDropdown(): void {
        if (this._activeDropdown) {
            this._activeDropdown.destroy();
            this._activeDropdown = null;
        }
    }

    public registerFocusables(preferredFocusId?: string | null): void {
        const nav = this._getNavigation();
        if (!nav) return;

        const categories = this._getCategories();
        const categoryIds = categories.map((category) => this.getCategoryButtonId(category.id));
        const detailIds = this._getActiveCategoryItemIds().filter((id) => this._isFocusableEnabled(id));
        const switchProfileId = this._getSwitchProfileButton()?.id;

        const candidateFocusableIds = [
            ...categoryIds,
            ...detailIds,
            ...(switchProfileId ? [switchProfileId] : []),
        ].filter((id) => {
            const element = this._getFocusableElement(id);
            return Boolean(element) && this._isFocusableEnabled(id);
        });

        const currentFocusId = nav.getFocusedElement()?.id ?? null;
        const activeCategoryId = this._getActiveCategoryId();
        const activeCategoryButtonId = activeCategoryId ? this.getCategoryButtonId(activeCategoryId) : undefined;
        const lastDetailId = detailIds.length > 0 ? detailIds[detailIds.length - 1] : undefined;

        const entries: FocusableElement[] = [];
        for (const id of candidateFocusableIds) {
            const element = this._getFocusableElement(id);
            if (!element) continue;

            const neighbors: FocusableElement['neighbors'] = {};
            let onFocus: (() => void) | undefined;
            let onSelect: (() => void) | undefined;

            const categoryId = this._getCategoryIdFromButtonId(id);
            if (categoryId) {
                const categoryIndex = categoryIds.indexOf(id);
                const upId = categoryIndex > 0 ? categoryIds[categoryIndex - 1] : undefined;
                const downId = categoryIndex >= 0 && categoryIndex < categoryIds.length - 1
                    ? categoryIds[categoryIndex + 1]
                    : undefined;
                if (upId) neighbors.up = upId;
                if (downId) neighbors.down = downId;
                const preferredDetailId = this._getPreferredDetailFocusId(categoryId);
                if (preferredDetailId) {
                    neighbors.right = preferredDetailId;
                }
                onFocus = (): void => {
                    if (this._getActiveCategoryId() === categoryId) return;
                    this._setActiveCategory(categoryId, { preferredFocusId: id });
                };
                onSelect = (): void => {
                    this._setActiveCategory(categoryId, { preferredFocusId: id });
                };
            } else if (detailIds.includes(id)) {
                const detailIndex = detailIds.indexOf(id);
                const upId = detailIndex > 0 ? detailIds[detailIndex - 1] : undefined;
                const downId = detailIndex < detailIds.length - 1
                    ? detailIds[detailIndex + 1]
                    : switchProfileId;
                if (upId) neighbors.up = upId;
                if (downId) neighbors.down = downId;
                if (activeCategoryButtonId) {
                    neighbors.left = activeCategoryButtonId;
                }
                onFocus = (): void => {
                    if (!activeCategoryId) return;
                    this._lastFocusedItemByCategory[activeCategoryId] = id;
                };
                const isSelect = Boolean(this._getSelect(id));
                onSelect = isSelect
                    ? (): void => {
                        this.openDropdownForSelect(id);
                    }
                    : (): void => {
                        element.click();
                    };
            } else if (switchProfileId && id === switchProfileId) {
                if (lastDetailId) {
                    neighbors.up = lastDetailId;
                }
                if (activeCategoryButtonId) {
                    neighbors.left = activeCategoryButtonId;
                }
                onSelect = (): void => {
                    element.click();
                };
            }

            const focusable: FocusableElement = {
                id,
                element,
                neighbors,
            };
            if (onFocus) {
                focusable.onFocus = onFocus;
            }
            if (onSelect) {
                focusable.onSelect = onSelect;
            }
            entries.push(focusable);
        }

        this._focusableIds = syncFocusableRegistry(nav, this._focusableIds, entries);
        const focusableIds = this._focusableIds;

        const currentFocusedCategoryId = currentFocusId ? this._getCategoryIdFromButtonId(currentFocusId) : null;
        const shouldIgnoreCurrentFocus =
            Boolean(currentFocusedCategoryId && activeCategoryId && currentFocusedCategoryId !== activeCategoryId);
        const usableCurrentFocusId = shouldIgnoreCurrentFocus ? null : currentFocusId;

        const preferredId = preferredFocusId && focusableIds.includes(preferredFocusId)
            ? preferredFocusId
            : usableCurrentFocusId && focusableIds.includes(usableCurrentFocusId)
                ? usableCurrentFocusId
                : activeCategoryButtonId && focusableIds.includes(activeCategoryButtonId)
                    ? activeCategoryButtonId
                    : focusableIds[0];
        if (preferredId) {
            nav.setFocus(preferredId);
        }
    }

    public resetFocusables(preferredFocusId?: string | null): void {
        this.unregisterFocusables();
        this.registerFocusables(preferredFocusId);
    }

    public unregisterFocusables(): void {
        const nav = this._getNavigation();
        if (!nav) return;

        this._focusableIds = syncFocusableRegistry(nav, this._focusableIds, []);
    }

    public destroy(): void {
        this.detachKeyHandler();
        this.closeDropdown();
        this.unregisterFocusables();
        this._focusableIds = [];
        this._lastFocusedItemByCategory = {};
        this._pendingFocusRestore = null;
    }

    private _dismissDropdown(): void {
        if (!this._activeDropdown) return;
        const dropdown = this._activeDropdown;
        try {
            dropdown.dismiss();
        } finally {
            if (this._activeDropdown === dropdown) {
                this._activeDropdown = null;
            }
        }
    }

    private _getPreferredDetailFocusId(categoryId: SettingsCategoryId): string | undefined {
        const rememberedId = this._lastFocusedItemByCategory[categoryId];
        if (rememberedId) {
            if (this._getActiveCategoryId() !== categoryId || this._isFocusableEnabled(rememberedId)) {
                return rememberedId;
            }
        }
        if (this._getActiveCategoryId() === categoryId) {
            const activeItemIds = this._getActiveCategoryItemIds();
            const activeId = activeItemIds.find((id) => this._isFocusableEnabled(id)) ?? activeItemIds[0];
            if (activeId) {
                return activeId;
            }
        }
        const category = this._getCategories().find((entry) => entry.id === categoryId);
        return category?.items[0]?.id;
    }

    private _isDetailFocusable(id: string): boolean {
        return Boolean(this._getToggle(id) ?? this._getSelect(id)) || id === this._getSwitchProfileButton()?.id;
    }

    private _isFocusableEnabled(id: string): boolean {
        if (this._getCategoryIdFromButtonId(id)) {
            return true;
        }
        const switchProfileButton = this._getSwitchProfileButton();
        if (switchProfileButton && id === switchProfileButton.id) {
            return true;
        }
        const toggle = this._getToggle(id);
        if (toggle) {
            return !toggle.isDisabled();
        }
        const select = this._getSelect(id);
        if (select) {
            return !select.isDisabled();
        }
        return false;
    }

    private _getFocusableElement(id: string): HTMLButtonElement | null {
        const categoryId = this._getCategoryIdFromButtonId(id);
        if (categoryId) {
            return this._getCategoryButton(categoryId);
        }
        const switchProfileButton = this._getSwitchProfileButton();
        if (switchProfileButton && id === switchProfileButton.id) {
            return switchProfileButton;
        }
        const toggle = this._getToggle(id);
        if (toggle) return toggle.element;
        const select = this._getSelect(id);
        if (select) return select.element;
        return null;
    }

    private _getCategoryIdFromButtonId(id: string): SettingsCategoryId | null {
        const prefix = 'settings-category-';
        if (!id.startsWith(prefix)) return null;
        const categoryId = id.slice(prefix.length) as SettingsCategoryId;
        return this._getCategories().some((category) => category.id === categoryId) ? categoryId : null;
    }
}
