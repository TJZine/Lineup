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
import { createLineupBrandGlyph } from '../common/brandGlyph';
import { SupportReportStore } from '../../support/SupportReportStore';
import { SupportReader } from '../support/SupportReader';
import { OFFLINE_NOTICES } from '../support/OfflineNotices';

export interface SettingsScreenDeps {
    container: HTMLElement;
    getNavigation: () => INavigationManager | null;
    onSubtitleModeChange?: (mode: SubtitleMode) => void;
    onGuideSettingChange?: (change: GuideSettingChange) => void;
    getActiveUsername?: () => string | null;
    getTheme?: () => ThemeName;
    setTheme?: (theme: ThemeName) => SettingsPersistenceResult;
    getThemePersistenceResult?: () => SettingsPersistenceResult;
    retryThemePersistence?: () => SettingsPersistenceResult;
    onKeepPlayingInSettingsChange?: (enabled: boolean) => void;
    onAccessibilityChange?: (name: 'reduceMotion' | 'largeFocus', enabled: boolean) => void;
    onOverlayTransparencyChange?: (value: 'more-transparent' | 'standard' | 'reduced') => void;
    onSwitchProfile?: () => void;
    onSwitchServer?: () => void;
    onManageChannels?: () => void;
    onSignOut?: () => void | Promise<void>;
    settingsStore?: SettingsStore;
}

/**
 * Settings screen component.
 * Manages settings display and focus navigation.
 */
export class SettingsScreen {
    private _container: HTMLElement;
    private _getNavigation: () => INavigationManager | null;
    private _onSubtitleModeChange: ((mode: SubtitleMode) => void) | null = null;
    private _onGuideSettingChange: ((change: GuideSettingChange) => void) | null = null;
    private _categories: SettingsCategoryConfig[] = [];
    private _activeCategoryId: SettingsCategoryId | null = null;
    private _toggleElements: Map<string, ReturnType<typeof createSettingsToggle>> = new Map();
    private _selectElements: Map<string, ReturnType<typeof createSettingsSelect>> = new Map();
    private _actionElements: Map<string, HTMLButtonElement> = new Map();
    private readonly _pendingActionIds = new Set<string>();
    private _pendingAccountActionId: string | null = null;
    private _renderRevision = 0;
    private _destroyed = false;
    private _categoryButtons: Map<SettingsCategoryId, HTMLButtonElement> = new Map();
    private _activeCategoryItemIds: string[] = [];
    private _categoryRail: HTMLElement | null = null;
    private _detailPane: HTMLElement | null = null;
    private _detailTitle: HTMLHeadingElement | null = null;
    private _detailDescription: HTMLParagraphElement | null = null;
    private _sectionLabel: HTMLHeadingElement | null = null;
    private _detailItems: HTMLElement | null = null;
    private _backButton: HTMLButtonElement | null = null;
    private readonly _stateController: SettingsScreenStateController;
    private readonly _focusCoordinator: SettingsScreenFocusCoordinator;
    private readonly _supportReport = new SupportReportStore();
    private readonly _supportReader: SupportReader;

    constructor({
        container,
        getNavigation,
        onSubtitleModeChange,
        onGuideSettingChange,
        getTheme,
        setTheme,
        getThemePersistenceResult,
        retryThemePersistence,
        onKeepPlayingInSettingsChange,
        onAccessibilityChange,
        onOverlayTransparencyChange,
        onSwitchProfile,
        onSwitchServer,
        onManageChannels,
        onSignOut,
        getActiveUsername,
        settingsStore = new SettingsStore(),
    }: SettingsScreenDeps) {
        this._container = container;
        this._getNavigation = getNavigation;
        this._supportReader = new SupportReader(container, getNavigation, (id) => {
            if (this._container.classList.contains('visible')) this._focusCoordinator.resetFocusables(id);
        });
        this._onSubtitleModeChange = onSubtitleModeChange ?? null;
        this._onGuideSettingChange = onGuideSettingChange ?? null;
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
            ...(getThemePersistenceResult ? { getThemePersistenceResult } : {}),
            ...(retryThemePersistence ? { retryThemePersistence } : {}),
            ...(onKeepPlayingInSettingsChange ? { onKeepPlayingInSettingsChange } : {}),
            ...(onAccessibilityChange ? { onAccessibilityChange } : {}),
            ...(onOverlayTransparencyChange ? { onOverlayTransparencyChange } : {}),
            ...(onSwitchProfile ? { onSwitchProfile } : {}),
            ...(onSwitchServer ? { onSwitchServer } : {}),
            ...(onManageChannels ? { onManageChannels } : {}),
            ...(onSignOut ? { onSignOut } : {}),
            ...(getActiveUsername ? { getActiveUsername } : {}),
            onOpenSupportReport: (): void => this._openSupportReport(),
            onOpenNotices: (): void => this._openNotices(),
            onClearSupportReport: (): void => {
                const result = this._supportReport.clear();
                if (!result.ok) throw new Error('Support report clear failed');
            },
        });
        this._focusCoordinator = new SettingsScreenFocusCoordinator({
            container: this._container,
            getNavigation: this._getNavigation,
            getCategories: (): SettingsCategoryConfig[] => this._categories,
            getActiveCategoryId: (): SettingsCategoryId | null => this._activeCategoryId,
            getActiveCategoryItemIds: (): string[] => this._activeCategoryItemIds,
            getCategoryButton: (categoryId): HTMLButtonElement | null =>
                this._categoryButtons.get(categoryId) ?? null,
            getBackButton: (): HTMLButtonElement | null => this._backButton,
            getToggle: (id): ReturnType<typeof createSettingsToggle> | undefined => this._toggleElements.get(id),
            getSelect: (id): ReturnType<typeof createSettingsSelect> | undefined => this._selectElements.get(id),
            getAction: (id): HTMLButtonElement | undefined => {
                const button = this._actionElements.get(id);
                return button && !button.disabled ? button : undefined;
            },
            setActiveCategory: (categoryId, options): void => {
                this._setActiveCategory(categoryId, options);
            },
            isVisible: (): boolean => this._container.classList.contains('visible'),
        });
        this._buildUI();
    }

    private _buildUI(): void {
        this._container.className = 'settings-screen';
        this._container.id = 'settings-screen';
        this._categoryButtons.clear();
        this._toggleElements.clear();
        this._selectElements.clear();
        this._actionElements.clear();
        this._activeCategoryItemIds = [];

        const panel = document.createElement('div');
        panel.className = 'settings-panel';

        const topbar = document.createElement('header');
        topbar.className = 'settings-topbar';
        const brand = document.createElement('div');
        brand.className = 'settings-brand';
        const glyph = createLineupBrandGlyph({ variant: 'color', className: 'settings-brand-glyph' });
        const wordmark = document.createElement('span');
        wordmark.className = 'settings-brand-wordmark';
        wordmark.textContent = 'LINEUP';
        const menu = document.createElement('span');
        menu.className = 'settings-brand-menu';
        menu.textContent = '☰';
        menu.setAttribute('aria-hidden', 'true');
        brand.append(glyph, wordmark, menu);
        topbar.appendChild(brand);

        const header = document.createElement('div');
        header.className = 'settings-header';

        const back = document.createElement('button');
        back.id = 'settings-back';
        back.className = 'settings-back';
        back.textContent = '‹ Back to Guide';
        back.addEventListener('click', () => { this._getNavigation()?.goBack(); });
        this._backButton = back;

        const title = document.createElement('h1');
        title.className = 'settings-title';
        title.textContent = 'Settings';

        header.appendChild(back);
        header.appendChild(title);

        const categoryRail = document.createElement('div');
        categoryRail.className = 'settings-categories';
        categoryRail.setAttribute('aria-label', 'Settings categories');
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

        const detailDescription = document.createElement('p');
        detailDescription.className = 'settings-detail-description';
        this._detailDescription = detailDescription;

        const sectionLabel = document.createElement('h3');
        sectionLabel.className = 'settings-section-label';
        this._sectionLabel = sectionLabel;

        detail.appendChild(detailTitle);
        detail.appendChild(detailDescription);
        detail.appendChild(sectionLabel);
        detail.appendChild(detailItems);

        this._reloadCategoriesFromState();
        for (const category of this._categories) {
            categoryRail.appendChild(this._createCategoryButton(category));
        }
        this._renderActiveCategory();

        content.appendChild(detail);
        panel.appendChild(categoryRail);
        panel.appendChild(content);

        this._container.append(topbar, header, panel);
    }

    private _createCategoryButton(config: SettingsCategoryConfig): HTMLButtonElement {
        const button = document.createElement('button');
        button.id = this._focusCoordinator.getCategoryButtonId(config.id);
        button.className = 'settings-category-button';
        button.textContent = config.label;
        button.setAttribute('aria-selected', config.id === this._activeCategoryId ? 'true' : 'false');
        this._categoryButtons.set(config.id, button);
        return button;
    }

    private _reloadCategoriesFromState(): void {
        this._categories = this._stateController.getCategories();
        if (!this._activeCategoryId || !this._categories.some((category) => category.id === this._activeCategoryId)) {
            this._activeCategoryId = this._categories[0]?.id ?? null;
        }
    }

    private _renderActiveCategory(): void {
        this._renderRevision += 1;
        const activeCategory = this._getActiveCategory();
        this._toggleElements.clear();
        this._selectElements.clear();
        this._actionElements.clear();
        this._activeCategoryItemIds = [];

        if (this._detailTitle) {
            this._detailTitle.textContent = activeCategory?.label ?? '';
        }
        if (this._detailDescription) {
            this._detailDescription.textContent = activeCategory?.description ?? '';
        }
        if (this._sectionLabel) {
            this._sectionLabel.textContent = activeCategory?.sectionLabel ?? '';
            this._sectionLabel.hidden = !activeCategory?.sectionLabel;
        }

        if (this._detailItems) {
            this._detailItems.replaceChildren();
            if (activeCategory) {
                for (const item of activeCategory.items) {
                    this._activeCategoryItemIds.push(item.id);
                    this._detailItems.appendChild(this._createItem(item));
                }
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
        this._focusCoordinator.attachKeyHandler();
        this._focusCoordinator.registerFocusables();
    }

    /** Recovery enters the same local Support category and readers as Settings. */
    public showSupport(): void {
        this._activeCategoryId = 'support';
        this._renderActiveCategory();
        if (this._container.classList.contains('visible')) {
            this._focusCoordinator.resetFocusables('settings-category-support');
        }
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
        this._supportReader.close();
        this._renderRevision += 1;
        this._focusCoordinator.closeDropdown();
        this._container.classList.remove('visible');
        this._focusCoordinator.detachKeyHandler();
        this._focusCoordinator.unregisterFocusables();
    }

    private _createItem(item: SettingsItemConfig): HTMLElement {
        if ('action' in item) {
            const row = document.createElement('div');
            row.className = 'settings-item';
            const button = document.createElement('button');
            button.id = item.id;
            button.className = 'settings-action-row';
            const label = document.createElement('span');
            label.className = 'setup-toggle-label';
            label.textContent = item.label;
            const help = document.createElement('span');
            help.className = 'setup-toggle-meta';
            help.textContent = item.description ?? '';
            button.append(label, help);
            const feedback = document.createElement('div');
            feedback.className = 'settings-save-feedback';
            feedback.setAttribute('role', 'status');
            feedback.setAttribute('aria-live', 'polite');
            button.addEventListener('click', () => { this._activateAction(item, button, feedback); });
            this._actionElements.set(item.id, button);
            row.append(button, feedback);
            this._syncActionDisabledState();
            return row;
        }
        if (isSelectItem(item)) {
            const select = createSettingsSelect(item);
            this._selectElements.set(item.id, select);
            const row = document.createElement('div');
            row.className = 'settings-item';
            row.append(select.element, select.feedbackElement);
            return row;
        }

        const toggle = createSettingsToggle(item);
        this._toggleElements.set(item.id, toggle);
        const row = document.createElement('div');
        row.className = 'settings-item';
        row.append(toggle.element, toggle.feedbackElement);
        return row;
    }

    private _activateAction(
        item: Extract<SettingsItemConfig, { action: () => void | Promise<void> }>,
        button: HTMLButtonElement,
        feedback: HTMLElement
    ): void {
        if (item.id === 'settings-support-view-report' || item.id === 'settings-support-notices') {
            void item.action();
            return;
        }
        const isAccountAction = this._activeCategoryId === 'account';
        if (this._pendingActionIds.has(item.id) || (isAccountAction && this._pendingAccountActionId)) return;

        const revision = this._renderRevision;
        const categoryId = this._activeCategoryId;
        this._pendingActionIds.add(item.id);
        if (isAccountAction) this._pendingAccountActionId = item.id;
        feedback.textContent = 'Working…';
        this._syncActionDisabledState();
        if (this._container.classList.contains('visible')) {
            this._focusCoordinator.resetFocusables(categoryId ? `settings-category-${categoryId}` : null);
        }

        let actionResult: Promise<void>;
        try {
            actionResult = Promise.resolve(item.action());
        } catch (error) {
            actionResult = Promise.reject(error);
        }

        void actionResult.then(
            () => { this._finishAction(item.id, button, feedback, revision, categoryId, false); },
            () => { this._finishAction(item.id, button, feedback, revision, categoryId, true); }
        );
    }

    private _finishAction(
        actionId: string,
        button: HTMLButtonElement,
        feedback: HTMLElement,
        revision: number,
        categoryId: SettingsCategoryId | null,
        failed: boolean
    ): void {
        this._pendingActionIds.delete(actionId);
        if (this._pendingAccountActionId === actionId) this._pendingAccountActionId = null;
        if (this._destroyed) return;

        this._syncActionDisabledState();
        const navigation = this._getNavigation();
        const route = navigation?.getCurrentScreen?.();
        const currentRouteVisible = this._container.classList.contains('visible')
            && (route === undefined || route === 'settings');
        const sameView = revision === this._renderRevision
            && categoryId === this._activeCategoryId
            && currentRouteVisible
            && button.isConnected;
        if (sameView) {
            feedback.textContent = failed
                ? 'Could not complete this action. Press OK to retry.'
                : actionId === 'settings-support-clear-report' ? 'Local report cleared.' : '';
            this._focusCoordinator.resetFocusables(failed ? actionId : navigation?.getFocusedElement()?.id ?? null);
        } else if (currentRouteVisible) {
            this._focusCoordinator.resetFocusables(navigation?.getFocusedElement()?.id ?? null);
        }
    }

    private _syncActionDisabledState(): void {
        for (const [id, button] of this._actionElements) {
            const blocked = this._pendingActionIds.has(id)
                || (this._activeCategoryId === 'account' && this._pendingAccountActionId !== null);
            button.disabled = blocked;
            button.setAttribute('aria-disabled', String(blocked));
        }
    }

    private _openSupportReport(): void {
        const result = this._supportReport.read();
        const text = result.ok
            ? result.report
            : `Report unavailable (${result.reason}). Check device storage or clear the report and retry.`;
        this._openReader('Local Support report', text, 'settings-support-view-report');
    }

    private _openNotices(): void {
        const text = OFFLINE_NOTICES.map(({ name, version, license, source, text: notice }) =>
            `${name} — ${version} — ${license}\nSource: ${source}\n\n${notice}`
        ).join('\n\n' + '='.repeat(48) + '\n\n');
        this._openReader('Offline notices', text, 'settings-support-notices');
    }

    private _openReader(title: string, text: string, invokerId: string): void {
        this._focusCoordinator.unregisterFocusables();
        if (this._supportReader.open(title, text, invokerId)) return;
        this._focusCoordinator.resetFocusables(invokerId);
        const feedback = this._actionElements.get(invokerId)?.parentElement?.querySelector<HTMLElement>('.settings-save-feedback');
        if (feedback) feedback.textContent = 'Reader could not open. Close the current dialog and try again.';
    }

    public destroy(): void {
        this._supportReader.close();
        this._destroyed = true;
        this._renderRevision += 1;
        this._focusCoordinator.destroy();
        this._categories = [];
        this._activeCategoryId = null;
        this._toggleElements.clear();
        this._selectElements.clear();
        this._actionElements.clear();
        this._categoryButtons.clear();
        this._activeCategoryItemIds = [];
        this._categoryRail = null;
        this._detailPane = null;
        this._detailTitle = null;
        this._detailDescription = null;
        this._sectionLabel = null;
        this._detailItems = null;
        this._backButton = null;
        this._container.replaceChildren();
    }
}

function isSelectItem(item: SettingsItemConfig): item is SettingsSelectConfig {
    return 'options' in item;
}
