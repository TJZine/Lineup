import type { INavigationManager } from '../../navigation';
import { createSettingsToggle } from './SettingsToggle';
import { createSettingsSelect } from './SettingsSelect';
import type {
    SettingsCategoryConfig,
    SettingsItemConfig,
    SettingsSelectConfig,
    SettingsCategoryId,
    GuideSettingChange,
    SettingsPersistenceResult,
} from './types';
import { SettingsStore } from './SettingsStore';
import type { SubtitleMode } from '../../../shared/subtitle-mode';
import { SettingsScreenStateController } from './SettingsScreenStateController';
import {
    SettingsScreenFocusCoordinator,
    type SettingsScreenSetActiveCategoryOptions,
} from './SettingsScreenFocusCoordinator';
import type { ThemeName } from '../theme/themeDefinitions';

export interface SettingsScreenDeps {
    container: HTMLElement;
    getNavigation: () => INavigationManager | null;
    onSubtitleModeChange?: (mode: SubtitleMode) => void;
    onGuideSettingChange?: (change: GuideSettingChange) => void;
    getActiveUsername?: () => string | null;
    getTheme?: () => ThemeName;
    setTheme?: (theme: ThemeName) => SettingsPersistenceResult;
    settingsStore?: SettingsStore;
}

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
    private _toggleElements: Map<string, ReturnType<typeof createSettingsToggle>> = new Map();
    private _selectElements: Map<string, ReturnType<typeof createSettingsSelect>> = new Map();
    private _categoryButtons: Map<SettingsCategoryId, HTMLButtonElement> = new Map();
    private _activeCategoryItemIds: string[] = [];
    private _categoryRail: HTMLElement | null = null;
    private _detailPane: HTMLElement | null = null;
    private _detailTitle: HTMLHeadingElement | null = null;
    private _detailItems: HTMLElement | null = null;
    private _switchProfileButton: HTMLButtonElement | null = null;
    private _detailSwapFrame: number | null = null;
    private _detailRevealFrame: number | null = null;
    private readonly _stateController: SettingsScreenStateController;
    private readonly _focusCoordinator: SettingsScreenFocusCoordinator;

    constructor({
        container,
        getNavigation,
        onSubtitleModeChange,
        onGuideSettingChange,
        getActiveUsername,
        getTheme,
        setTheme,
        settingsStore = new SettingsStore(),
    }: SettingsScreenDeps) {
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
            ...(getTheme ? { getTheme } : {}),
            ...(setTheme ? { setTheme } : {}),
        });
        this._focusCoordinator = new SettingsScreenFocusCoordinator({
            container: this._container,
            getNavigation: this._getNavigation,
            getCategories: (): SettingsCategoryConfig[] => this._categories,
            getActiveCategoryId: (): SettingsCategoryId | null => this._activeCategoryId,
            getActiveCategoryItemIds: (): string[] => this._activeCategoryItemIds,
            getCategoryButton: (categoryId): HTMLButtonElement | null =>
                this._categoryButtons.get(categoryId) ?? null,
            getSwitchProfileButton: (): HTMLButtonElement | null => this._switchProfileButton,
            getToggle: (id): ReturnType<typeof createSettingsToggle> | undefined => this._toggleElements.get(id),
            getSelect: (id): ReturnType<typeof createSettingsSelect> | undefined => this._selectElements.get(id),
            setActiveCategory: (categoryId, options): void => {
                this._setActiveCategory(categoryId, options);
            },
            isVisible: (): boolean => this._container.classList.contains('visible'),
            isDeferredDetailSwapActive: (): boolean =>
                this._detailSwapFrame !== null || this._detailItems?.classList.contains('transitioning') === true,
        });
        this._buildUI();
    }

    private _buildUI(): void {
        this._container.className = 'settings-screen';
        this._container.id = 'settings-screen';
        this._categoryButtons.clear();
        this._toggleElements.clear();
        this._selectElements.clear();
        this._activeCategoryItemIds = [];

        const panel = document.createElement('div');
        panel.className = 'settings-panel';

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
        this._categoryRail = categoryRail;

        const content = document.createElement('div');
        content.className = 'settings-content';

        const detail = document.createElement('div');
        detail.className = 'settings-detail';
        this._detailPane = detail;

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
        button.id = this._focusCoordinator.getCategoryButtonId(config.id);
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
                this._detailItems.replaceChildren();
                if (activeCategory) {
                    for (const item of activeCategory.items) {
                        this._activeCategoryItemIds.push(item.id);
                        this._detailItems.appendChild(this._createItem(item));
                    }
                }
            };

            const shouldCrossfade =
                this._detailItems.childElementCount > 0 && this._focusCoordinator.hasRegisteredFocusables();
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

                    const pendingPreferredFocusId =
                        this._focusCoordinator.consumePendingFocusRestore(expectedCategoryId);

                    if (this._container.classList.contains('visible')) {
                        const nav = this._getNavigation();
                        const preferredFocusId = pendingPreferredFocusId ?? nav?.getFocusedElement()?.id ?? null;
                        this._focusCoordinator.resetFocusables(preferredFocusId);
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
        options: SettingsScreenSetActiveCategoryOptions = {}
    ): void {
        this._focusCoordinator.closeDropdown();

        // Focus-only path: pressing RIGHT on an already-active category should not re-render
        // the detail pane. It should simply move focus into the detail controls.
        if (this._activeCategoryId === categoryId && options.focusDetail) {
            this._focusCoordinator.focusActiveCategoryDetail(categoryId);
            return;
        }

        if (this._activeCategoryId === categoryId && !options.focusDetail) {
            return;
        }

        this._activeCategoryId = categoryId;
        this._reloadCategoriesFromState();

        const resolvedCategoryId = this._activeCategoryId;
        const isVisible = this._container.classList.contains('visible');
        const preferredFocusId = this._focusCoordinator.resolveCategoryChangePreferredFocus(
            resolvedCategoryId,
            options
        );
        if (isVisible && resolvedCategoryId) {
            this._focusCoordinator.setPendingFocusRestore(resolvedCategoryId, preferredFocusId);
        }

        this._renderActiveCategory();

        if (!isVisible) {
            return;
        }
        this._focusCoordinator.resetFocusables(preferredFocusId);
    }

    private _getActiveCategory(): SettingsCategoryConfig | undefined {
        if (!this._activeCategoryId) return undefined;
        return this._categories.find((category) => category.id === this._activeCategoryId);
    }

    public show(): void {
        this._container.classList.add('visible');
        this._reloadCategoriesFromState();
        this._renderActiveCategory();
        this._resetOwnedScrollContainers();
        if (this._switchProfileButton && this._getActiveUsername) {
            const username = this._getActiveUsername() ?? 'Profile';
            const nameEl = this._switchProfileButton.querySelector('.settings-profile-name');
            if (nameEl) nameEl.textContent = username;
            this._switchProfileButton.setAttribute('aria-label', `Switch profile. Current: ${username}`);
        }
        this._focusCoordinator.attachKeyHandler();
        this._focusCoordinator.registerFocusables();
    }

    private _resetOwnedScrollContainers(): void {
        if (this._categoryRail) {
            this._categoryRail.scrollTop = 0;
            this._categoryRail.scrollLeft = 0;
        }
        if (this._detailPane) {
            this._detailPane.scrollTop = 0;
            this._detailPane.scrollLeft = 0;
        }
    }

    private _handleStateInvalidated(): void {
        const focusedId = this._getNavigation()?.getFocusedElement()?.id ?? null;
        this._focusCoordinator.closeDropdown();
        this._reloadCategoriesFromState();
        this._renderActiveCategory();
        if (this._container.classList.contains('visible')) {
            this._focusCoordinator.resetFocusables(focusedId);
        }
    }

    public hide(): void {
        this._focusCoordinator.closeDropdown();
        this._container.classList.remove('visible');
        this._focusCoordinator.detachKeyHandler();
        this._cancelDetailFrames();
        this._detailItems?.classList.remove('transitioning');
        this._focusCoordinator.clearPendingFocusRestore();
        this._focusCoordinator.unregisterFocusables();
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

    public destroy(): void {
        this._focusCoordinator.destroy();
        this._categories = [];
        this._activeCategoryId = null;
        this._toggleElements.clear();
        this._selectElements.clear();
        this._categoryButtons.clear();
        this._activeCategoryItemIds = [];
        this._categoryRail = null;
        this._detailPane = null;
        this._detailTitle = null;
        this._detailItems = null;
        this._switchProfileButton = null;
        this._cancelDetailFrames();
        this._container.replaceChildren();
    }
}

function isSelectItem(item: SettingsItemConfig): item is SettingsSelectConfig {
    return 'options' in item;
}
