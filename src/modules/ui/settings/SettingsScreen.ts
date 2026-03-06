/**
 * @fileoverview Settings screen component.
 * @module modules/ui/settings/SettingsScreen
 * @version 1.0.0
 */

import type { INavigationManager, FocusableElement, KeyEvent } from '../../navigation';
import { createSettingsToggle } from './SettingsToggle';
import { createSettingsSelect } from './SettingsSelect';
import { createSettingsDropdown } from './SettingsDropdown';
import type {
    SettingsCategoryConfig,
    SettingsItemConfig,
    SettingsSelectConfig,
    SettingsCategoryId,
    GuideSettingChange,
} from './types';
import { SettingsStore } from './SettingsStore';
import type { SubtitleMode } from '../../../shared/subtitle-mode';
import { SettingsScreenStateController } from './SettingsScreenStateController';

/**
 * Settings screen component.
 * Manages settings display, pane transitions, and focus navigation.
 */
export class SettingsScreen {
    private _container: HTMLElement;
    private _getNavigation: () => INavigationManager | null;
    private _onSubtitleModeChange: ((mode: SubtitleMode) => void) | null = null;
    private _onGuideSettingChange: ((change: GuideSettingChange) => void) | null = null;
    private _getActiveUsername: (() => string | null) | null = null;
    private _categories: SettingsCategoryConfig[] = [];
    private _activeCategoryId: SettingsCategoryId | null = null;
    private _lastFocusedItemByCategory: Partial<Record<SettingsCategoryId, string>> = {};
    private _focusableIds: string[] = [];
    private _toggleElements: Map<string, ReturnType<typeof createSettingsToggle>> = new Map();
    private _selectElements: Map<string, ReturnType<typeof createSettingsSelect>> = new Map();
    private _categoryButtons: Map<SettingsCategoryId, HTMLButtonElement> = new Map();
    private _activeCategoryItemIds: string[] = [];
    private _detailTitle: HTMLHeadingElement | null = null;
    private _detailItems: HTMLElement | null = null;
    private _switchProfileButton: HTMLButtonElement | null = null;
    private _activeDropdown: { destroy: () => void; dismiss: () => void } | null = null;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _detailSwapFrame: number | null = null;
    private _detailRevealFrame: number | null = null;
    private readonly _stateController: SettingsScreenStateController;
    // When a category swap is deferred via RAF, we must preserve the focus intent
    // (e.g., RIGHT into details) and apply it after detail items exist.
    private _pendingFocusRestore: { categoryId: SettingsCategoryId; preferredFocusId: string | null } | null = null;

    constructor(
        container: HTMLElement,
        getNavigation: () => INavigationManager | null,
        onSubtitleModeChange?: (mode: SubtitleMode) => void,
        onGuideSettingChange?: (change: GuideSettingChange) => void,
        getActiveUsername?: () => string | null,
        settingsStore: SettingsStore = new SettingsStore()
    ) {
        this._container = container;
        this._getNavigation = getNavigation;
        this._onSubtitleModeChange = onSubtitleModeChange ?? null;
        this._onGuideSettingChange = onGuideSettingChange ?? null;
        this._getActiveUsername = getActiveUsername ?? null;
        this._stateController = new SettingsScreenStateController({
            settingsStore,
            onSubtitleModeChange: (mode): void => {
                this._onSubtitleModeChange?.(mode);
            },
            onGuideSettingChange: (change): void => {
                this._onGuideSettingChange?.(change);
            },
            onStateInvalidated: (): void => {
                this._handleStateInvalidated();
            },
        });
        this._buildUI();
    }

    /**
     * Build the settings UI.
     */
    private _buildUI(): void {
        this._container.className = 'settings-screen';
        this._container.id = 'settings-screen';
        this._categoryButtons.clear();
        this._toggleElements.clear();
        this._selectElements.clear();
        this._activeCategoryItemIds = [];

        const panel = document.createElement('div');
        panel.className = 'settings-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'settings-header';

        const title = document.createElement('h1');
        title.className = 'settings-title';
        title.textContent = '⚙ Settings';

        const hint = document.createElement('span');
        hint.className = 'settings-hint';
        hint.textContent = 'Press BACK to return';

        header.appendChild(title);
        header.appendChild(hint);

        const categoryRail = document.createElement('div');
        categoryRail.className = 'settings-categories';
        categoryRail.setAttribute('aria-label', 'Settings categories');
        categoryRail.appendChild(header);

        const content = document.createElement('div');
        content.className = 'settings-content';

        const detail = document.createElement('div');
        detail.className = 'settings-detail';

        const detailTitle = document.createElement('h2');
        detailTitle.className = 'settings-detail-title';
        this._detailTitle = detailTitle;

        const detailItems = document.createElement('div');
        detailItems.className = 'settings-detail-items';
        this._detailItems = detailItems;

        detail.appendChild(detailTitle);
        detail.appendChild(detailItems);

        this._reloadCategoriesFromState();
        for (const category of this._categories) {
            categoryRail.appendChild(this._createCategoryButton(category));
        }
        this._renderActiveCategory();

        content.appendChild(detail);
        panel.appendChild(categoryRail);
        panel.appendChild(content);

        const profileRow = document.createElement('button');
        profileRow.id = 'settings-switch-profile';
        profileRow.className = 'settings-profile-row';
        profileRow.addEventListener('click', () => {
            const nav = this._getNavigation();
            nav?.replaceScreen('profile-select');
        });

        const profileIcon = document.createElement('span');
        profileIcon.className = 'settings-profile-icon';
        profileIcon.textContent = '👤';
        profileIcon.setAttribute('aria-hidden', 'true');

        const profileText = document.createElement('div');
        profileText.className = 'settings-profile-text';

        const profileName = document.createElement('span');
        profileName.className = 'settings-profile-name';
        profileName.textContent = this._getActiveUsername?.() ?? 'Profile';

        const profileAction = document.createElement('span');
        profileAction.className = 'settings-profile-action';
        profileAction.textContent = 'Switch Profile →';

        profileText.appendChild(profileName);
        profileText.appendChild(profileAction);
        profileRow.appendChild(profileIcon);
        profileRow.appendChild(profileText);
        profileRow.setAttribute('aria-label', `Switch profile. Current: ${profileName.textContent}`);

        this._switchProfileButton = profileRow;
        categoryRail.appendChild(profileRow);

        this._container.appendChild(panel);
    }

    private _createCategoryButton(config: SettingsCategoryConfig): HTMLButtonElement {
        const button = document.createElement('button');
        button.id = this._getCategoryButtonId(config.id);
        button.className = 'settings-category-button';
        button.textContent = config.label;
        button.setAttribute('aria-selected', config.id === this._activeCategoryId ? 'true' : 'false');
        button.addEventListener('click', () => {
            this._setActiveCategory(config.id, { preferredFocusId: button.id });
        });
        this._categoryButtons.set(config.id, button);
        return button;
    }

    private _cancelDetailFrames(): void {
        if (this._detailSwapFrame !== null) {
            cancelAnimationFrame(this._detailSwapFrame);
            this._detailSwapFrame = null;
        }
        if (this._detailRevealFrame !== null) {
            cancelAnimationFrame(this._detailRevealFrame);
            this._detailRevealFrame = null;
        }
    }

    private _reloadCategoriesFromState(): void {
        this._categories = this._stateController.getCategories();
        if (!this._activeCategoryId || !this._categories.some((category) => category.id === this._activeCategoryId)) {
            this._activeCategoryId = this._categories[0]?.id ?? null;
        }
    }

    private _renderActiveCategory(): void {
        const activeCategory = this._getActiveCategory();
        this._toggleElements.clear();
        this._selectElements.clear();
        this._activeCategoryItemIds = [];

        if (this._detailTitle) {
            this._detailTitle.textContent = activeCategory?.label ?? '';
        }

        this._cancelDetailFrames();

        if (this._detailItems) {
            const renderItems = (): void => {
                if (!this._detailItems) return;
                this._detailItems.innerHTML = '';
                if (activeCategory) {
                    for (const item of activeCategory.items) {
                        this._activeCategoryItemIds.push(item.id);
                        this._detailItems.appendChild(this._createItem(item));
                    }
                }
            };

            const shouldCrossfade = this._detailItems.childElementCount > 0 && this._focusableIds.length > 0;
            if (!shouldCrossfade) {
                this._detailItems.classList.remove('transitioning');
                renderItems();
            } else {
                const expectedCategoryId = this._activeCategoryId;
                this._detailItems.classList.add('transitioning');

                this._detailSwapFrame = requestAnimationFrame(() => {
                    this._detailSwapFrame = null;
                    if (!this._detailItems || expectedCategoryId !== this._activeCategoryId) return;

                    renderItems();

                    // Detail controls are recreated asynchronously; re-register focusables
                    // so D-pad navigation reflects the active category after the swap frame.
                    const pendingPreferredFocusId =
                        this._pendingFocusRestore?.categoryId === expectedCategoryId
                            ? this._pendingFocusRestore.preferredFocusId
                            : null;
                    // Always clear pending intent once the swap for that category has completed, even if hidden.
                    if (this._pendingFocusRestore?.categoryId === expectedCategoryId) {
                        this._pendingFocusRestore = null;
                    }

                    if (this._container.classList.contains('visible')) {
                        const nav = this._getNavigation();
                        const preferredFocusId = pendingPreferredFocusId ?? nav?.getFocusedElement()?.id ?? null;
                        this._unregisterFocusables();
                        this._registerFocusables(preferredFocusId);
                    }

                    this._detailRevealFrame = requestAnimationFrame(() => {
                        this._detailRevealFrame = null;
                        if (expectedCategoryId !== this._activeCategoryId) return;
                        this._detailItems?.classList.remove('transitioning');
                    });
                });
            }
        }

        for (const category of this._categories) {
            const button = this._categoryButtons.get(category.id);
            if (!button) continue;
            const isActive = category.id === this._activeCategoryId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
    }

    private _setActiveCategory(
        categoryId: SettingsCategoryId,
        options: { preferredFocusId?: string | null; focusDetail?: boolean } = {}
    ): void {
        if (this._activeDropdown) {
            this._closeDropdown();
        }

        // Focus-only path: pressing RIGHT on an already-active category should not re-render
        // the detail pane. It should simply move focus into the detail controls.
        if (this._activeCategoryId === categoryId && options.focusDetail) {
            if (!this._container.classList.contains('visible')) {
                return;
            }
            const preferredFocusId =
                this._getPreferredDetailFocusId(categoryId) ?? this._getCategoryButtonId(categoryId);
            // If a category swap is currently deferred, detail items may not exist yet. Preserve intent so
            // the swap frame can focus the desired detail control once it is created.
            const isDeferredSwapActive =
                this._detailSwapFrame !== null || this._detailItems?.classList.contains('transitioning') === true;
            if (isDeferredSwapActive && preferredFocusId !== this._getCategoryButtonId(categoryId)) {
                this._pendingFocusRestore = { categoryId, preferredFocusId };
            }
            this._unregisterFocusables();
            this._registerFocusables(preferredFocusId);
            return;
        }

        if (this._activeCategoryId === categoryId && !options.focusDetail) {
            return;
        }

        this._activeCategoryId = categoryId;
        this._reloadCategoriesFromState();

        const resolvedCategoryId = this._activeCategoryId;
        const isVisible = this._container.classList.contains('visible');
        const resolvedCategoryButtonId = resolvedCategoryId ? this._getCategoryButtonId(resolvedCategoryId) : null;
        const resolvedCategoryConfig = resolvedCategoryId
            ? this._categories.find((entry) => entry.id === resolvedCategoryId)
            : undefined;
        const preferredFocusId = !isVisible || !resolvedCategoryId || !resolvedCategoryButtonId
            ? null
            : options.focusDetail
                ? this._lastFocusedItemByCategory[resolvedCategoryId] ??
                    resolvedCategoryConfig?.items[0]?.id ??
                    resolvedCategoryButtonId
                : options.preferredFocusId ?? resolvedCategoryButtonId;
        if (isVisible && resolvedCategoryId) {
            this._pendingFocusRestore = { categoryId: resolvedCategoryId, preferredFocusId };
        }

        this._renderActiveCategory();

        if (!isVisible) {
            return;
        }
        this._unregisterFocusables();
        this._registerFocusables(preferredFocusId);
    }

    private _getActiveCategory(): SettingsCategoryConfig | undefined {
        if (!this._activeCategoryId) return undefined;
        return this._categories.find((category) => category.id === this._activeCategoryId);
    }

    private _getCategoryButtonId(id: SettingsCategoryId): string {
        return `settings-category-${id}`;
    }

    private _getCategoryIdFromButtonId(id: string): SettingsCategoryId | null {
        const prefix = 'settings-category-';
        if (!id.startsWith(prefix)) return null;
        const categoryId = id.slice(prefix.length) as SettingsCategoryId;
        return this._categories.some((category) => category.id === categoryId) ? categoryId : null;
    }

    private _getPreferredDetailFocusId(categoryId: SettingsCategoryId): string | undefined {
        const rememberedId = this._lastFocusedItemByCategory[categoryId];
        if (rememberedId) {
            if (this._activeCategoryId !== categoryId || this._isFocusableEnabled(rememberedId)) {
                return rememberedId;
            }
        }
        if (this._activeCategoryId === categoryId) {
            // During deferred detail swaps, `_activeCategoryItemIds` may not be populated yet.
            // Prefer the first enabled detail id if available, otherwise fall back to the category config below.
            const activeId =
                this._activeCategoryItemIds.find((id) => this._isFocusableEnabled(id)) ?? this._activeCategoryItemIds[0];
            if (activeId) {
                return activeId;
            }
        }
        const category = this._categories.find((entry) => entry.id === categoryId);
        return category?.items[0]?.id;
    }

    private _isDetailFocusable(id: string): boolean {
        return this._toggleElements.has(id) || this._selectElements.has(id) || id === this._switchProfileButton?.id;
    }

    /**
     * Show the settings screen and register focusables.
     */
    public show(): void {
        this._container.classList.add('visible');
        this._reloadCategoriesFromState();
        this._renderActiveCategory();
        if (this._switchProfileButton && this._getActiveUsername) {
            const username = this._getActiveUsername() ?? 'Profile';
            const nameEl = this._switchProfileButton.querySelector('.settings-profile-name');
            if (nameEl) nameEl.textContent = username;
            this._switchProfileButton.setAttribute('aria-label', `Switch profile. Current: ${username}`);
        }
        const nav = this._getNavigation();
        if (nav && !this._navKeyHandler) {
            this._navKeyHandler = (event: KeyEvent): void => {
                if (event.handled) return;

                // Dismiss dropdown on Back key.
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
                const select = this._selectElements.get(focusedId);
                if (select && !select.isDisabled() && event.button === 'left') {
                    const changed = select.cyclePrev();
                    if (!changed) {
                        const activeCategoryId = this._activeCategoryId;
                        if (activeCategoryId) {
                            nav.setFocus(this._getCategoryButtonId(activeCategoryId));
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
                    const activeCategoryId = this._activeCategoryId;
                    if (activeCategoryId) {
                        nav.setFocus(this._getCategoryButtonId(activeCategoryId));
                        event.handled = true;
                    }
                }
            };
            nav.on('keyPress', this._navKeyHandler);
        }
        this._registerFocusables();
    }

    private _handleStateInvalidated(): void {
        const focusedId = this._getNavigation()?.getFocusedElement()?.id ?? null;
        this._closeDropdown();
        this._reloadCategoriesFromState();
        this._renderActiveCategory();
        if (this._container.classList.contains('visible')) {
            this._unregisterFocusables();
            this._registerFocusables(focusedId);
        }
    }

    /**
     * Hide the settings screen and unregister focusables.
     */
    public hide(): void {
        this._closeDropdown();
        this._container.classList.remove('visible');
        if (this._navKeyHandler) {
            const nav = this._getNavigation();
            nav?.off('keyPress', this._navKeyHandler);
            this._navKeyHandler = null;
        }
        this._cancelDetailFrames();
        this._detailItems?.classList.remove('transitioning');
        this._pendingFocusRestore = null;
        this._unregisterFocusables();
    }

    private _openDropdownForSelect(selectId: string): void {
        // Close any existing dropdown.
        this._closeDropdown();

        const select = this._selectElements.get(selectId);
        if (!select || select.isDisabled()) return;

        const nav = this._getNavigation();
        this._activeDropdown = createSettingsDropdown({
            anchor: select.element,
            container: this._container,
            options: select.getOptions(),
            currentValue: select.getValue(),
            onSelect: (value: number): void => {
                try {
                    select.setValue(value);
                } finally {
                    this._closeDropdown();
                    try {
                        nav?.setFocus(selectId);
                    } catch {
                        // Ignore focus restore failures.
                    }
                }
            },
            onDismiss: (): void => {
                if (nav) {
                    nav.setFocus(selectId);
                }
            },
            nav,
        });
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

    private _closeDropdown(): void {
        if (this._activeDropdown) {
            this._activeDropdown.destroy();
            this._activeDropdown = null;
        }
    }

    /**
     * Register all toggles as focusable elements.
     */
    private _registerFocusables(preferredFocusId?: string | null): void {
        const nav = this._getNavigation();
        if (!nav) return;

        const categoryIds = this._categories.map((category) => this._getCategoryButtonId(category.id));
        const detailIds = this._activeCategoryItemIds.filter((id) => this._isFocusableEnabled(id));
        const switchProfileId = this._switchProfileButton?.id;

        const focusableIds = [
            ...categoryIds,
            ...detailIds,
            ...(switchProfileId ? [switchProfileId] : []),
        ].filter((id) => {
            const element = this._getFocusableElement(id);
            return Boolean(element) && this._isFocusableEnabled(id);
        });
        this._focusableIds = focusableIds;

        const currentFocusId = nav.getFocusedElement()?.id ?? null;
        const activeCategoryId = this._activeCategoryId;
        const activeCategoryButtonId = activeCategoryId ? this._getCategoryButtonId(activeCategoryId) : undefined;
        const lastDetailId = detailIds.length > 0 ? detailIds[detailIds.length - 1] : undefined;

        for (const id of focusableIds) {
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
                    if (this._activeCategoryId === categoryId) return;
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
                const isSelect = this._selectElements.has(id);
                onSelect = isSelect
                    ? (): void => {
                        this._openDropdownForSelect(id);
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
            nav.registerFocusable(focusable);
        }

        // If focus currently points at a different category button than the active one, do not preserve it.
        // Preserving it would immediately trigger that button's onFocus handler and revert the active category swap.
        const currentFocusedCategoryId = currentFocusId ? this._getCategoryIdFromButtonId(currentFocusId) : null;
        const shouldIgnoreCurrentFocus =
            Boolean(currentFocusedCategoryId && activeCategoryId && currentFocusedCategoryId !== activeCategoryId);
        const usableCurrentFocusId = shouldIgnoreCurrentFocus ? null : currentFocusId;

        // Preserve current focus if still enabled, otherwise focus the first available
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

    /**
     * Unregister all focusables.
     */
    private _unregisterFocusables(): void {
        const nav = this._getNavigation();
        if (!nav) return;

        for (const id of this._focusableIds) {
            nav.unregisterFocusable(id);
        }
        this._focusableIds = [];
    }

    private _isFocusableEnabled(id: string): boolean {
        if (this._getCategoryIdFromButtonId(id)) {
            return true;
        }
        if (this._switchProfileButton && id === this._switchProfileButton.id) {
            return true;
        }
        const toggle = this._toggleElements.get(id);
        if (toggle) {
            return !toggle.isDisabled();
        }
        const select = this._selectElements.get(id);
        if (select) {
            return !select.isDisabled();
        }
        return false;
    }

    private _createItem(item: SettingsItemConfig): HTMLElement {
        if (isSelectItem(item)) {
            const select = createSettingsSelect(item);
            this._selectElements.set(item.id, select);
            return select.element;
        }

        const toggle = createSettingsToggle(item);
        this._toggleElements.set(item.id, toggle);
        return toggle.element;
    }

    private _getFocusableElement(id: string): HTMLButtonElement | null {
        const categoryId = this._getCategoryIdFromButtonId(id);
        if (categoryId) {
            return this._categoryButtons.get(categoryId) ?? null;
        }
        if (this._switchProfileButton && id === this._switchProfileButton.id) {
            return this._switchProfileButton;
        }
        const toggle = this._toggleElements.get(id);
        if (toggle) return toggle.element;
        const select = this._selectElements.get(id);
        if (select) return select.element;
        return null;
    }

    /**
     * Destroy the component.
     */
    public destroy(): void {
        if (this._navKeyHandler) {
            this._getNavigation()?.off('keyPress', this._navKeyHandler);
            this._navKeyHandler = null;
        }
        this._closeDropdown();
        this._unregisterFocusables();
        this._categories = [];
        this._activeCategoryId = null;
        this._lastFocusedItemByCategory = {};
        this._toggleElements.clear();
        this._selectElements.clear();
        this._categoryButtons.clear();
        this._activeCategoryItemIds = [];
        this._detailTitle = null;
        this._detailItems = null;
        this._switchProfileButton = null;
        this._cancelDetailFrames();
        this._container.innerHTML = '';
    }
}

function isSelectItem(item: SettingsItemConfig): item is SettingsSelectConfig {
    return 'options' in item;
}
