/**
 * @jest-environment jsdom
 */

import { SettingsScreen } from '../SettingsScreen';
import { SettingsStore } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS } from '../constants';
import type { GuideSettingChange, SettingsPersistenceResult } from '../types';
import { THEME_OPTIONS, THEME_CLASSES, type ThemeName } from '../../theme/themeDefinitions';
import { NavigationManager, type KeyEvent } from '../../../navigation';
import { activateCategory, createNavigationStub } from './settings-screen-test-helpers';

const ALL_THEME_CLASSES = Object.values(THEME_CLASSES).filter(Boolean);
const CREATED_CONTAINERS: HTMLElement[] = [];

const chooseSettingOption = (container: HTMLElement, selectId: string, optionIndex: number): void => {
    const select = container.querySelector(`#${selectId}`) as HTMLButtonElement | null;
    if (!select) {
        throw new Error(`Setting select ${selectId} not found`);
    }
    select.click();

    const options = container.querySelectorAll<HTMLButtonElement>('.settings-dropdown-option');
    const option = options[optionIndex];
    if (!option) {
        throw new Error(`Setting option ${optionIndex} not found for ${selectId}`);
    }
    option.click();
};

const createRealNavigation = (): NavigationManager => {
    const navigation = new NavigationManager();
    navigation.initialize({
        enablePointerMode: true,
        keyRepeatDelayMs: 500,
        keyRepeatIntervalMs: 100,
        focusMemoryEnabled: true,
        debugMode: false,
    });
    navigation.replaceScreen('settings');
    return navigation;
};

const makeKeyEvent = (
    button: KeyEvent['button'],
    options: Partial<Pick<KeyEvent, 'isRepeat' | 'isLongPress'>> = {}
): KeyEvent => ({
    button,
    isRepeat: options.isRepeat ?? false,
    isLongPress: options.isLongPress ?? false,
    timestamp: Date.now(),
    originalEvent: new KeyboardEvent('keydown'),
    handled: false,
});

const dispatchRemoteKey = (keyCode: number, type: 'keydown' | 'keyup'): void => {
    const event = new KeyboardEvent(type);
    Object.defineProperty(event, 'keyCode', { configurable: true, value: keyCode });
    document.dispatchEvent(event);
};

const createScreen = (
    onGuideSettingChange: (change: GuideSettingChange) => void,
    getActiveUsername?: () => string | null,
    settingsStore?: SettingsStore,
    initialTheme: ThemeName = 'ember-steel'
): {
    container: HTMLElement;
    nav: ReturnType<typeof createNavigationStub>;
    screen: SettingsScreen;
} => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    CREATED_CONTAINERS.push(container);
    const nav = createNavigationStub();
    let currentTheme = initialTheme;
    const screen = new SettingsScreen({
        container,
        getNavigation: (): never => nav as unknown as never,
        onGuideSettingChange,
        getTheme: (): ThemeName => currentTheme,
        setTheme: (theme): SettingsPersistenceResult => {
            currentTheme = theme;
            document.body.classList.remove(...ALL_THEME_CLASSES);
            const themeClass = THEME_CLASSES[theme];
            if (themeClass) {
                document.body.classList.add(themeClass);
            }
            localStorage.setItem(SETTINGS_STORAGE_KEYS.THEME, theme);
            return { ok: true };
        },
        ...(getActiveUsername ? { getActiveUsername } : {}),
        ...(settingsStore ? { settingsStore } : {}),
    });
    return { container, nav, screen };
};

afterEach(() => {
    for (const container of CREATED_CONTAINERS.splice(0, CREATED_CONTAINERS.length)) {
        container.remove();
    }
});

describe('SettingsScreen (Guide settings)', () => {
    beforeEach(() => {
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('uses a dedicated settings root class without inheriting the onboarding screen shell', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();

        expect(container.classList.contains('settings-screen')).toBe(true);
        expect(container.classList.contains('screen')).toBe(false);
    });

    it('resets owned rail and detail scroll containers on show', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        const rail = container.querySelector('.settings-categories') as HTMLElement | null;
        const detail = container.querySelector('.settings-detail') as HTMLElement | null;
        if (!rail || !detail) {
            throw new Error('Expected settings scroll containers');
        }

        rail.scrollTop = 180;
        rail.scrollLeft = 12;
        detail.scrollTop = 420;
        detail.scrollLeft = 8;

        screen.hide();
        screen.show();

        expect(rail.scrollTop).toBe(0);
        expect(rail.scrollLeft).toBe(0);
        expect(detail.scrollTop).toBe(0);
        expect(detail.scrollLeft).toBe(0);
        expect(container.querySelector('.settings-detail-title')?.textContent).toContain('Audio & Subtitles');
        expect(container.querySelector('#settings-switch-profile')).not.toBeNull();
    });

    it('writes layout mode and emits change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

        screen.show();
        activateCategory(container, 'appearance');

        chooseSettingOption(container, 'settings-epg-layout-mode', 1);

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'layoutMode', mode: 'classic' });
    });

    it('writes past items select and emits guide-setting change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');

        chooseSettingOption(container, 'settings-epg-past-items', 1);

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBe('0');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'pastItemsWindow', value: '0' });
    });

    it('writes info background mode select and emits guide-setting change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');

        chooseSettingOption(container, 'settings-epg-info-background-mode', 1);

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBe('2');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'infoBackgroundMode', mode: 2 });
    });

    it('renders the info background mode options in the locked order', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');

        const select = container.querySelector('#settings-epg-info-background-mode') as HTMLButtonElement | null;
        if (!select) {
            throw new Error('Info background mode select not found');
        }

        expect(select.textContent).toContain('Artwork Bleed');

        chooseSettingOption(container, 'settings-epg-info-background-mode', 1);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBe('2');

        chooseSettingOption(container, 'settings-epg-info-background-mode', 2);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBe('1');
    });

    it('preserves stored theme default semantics for value 1', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '1');
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');

        const value = container.querySelector(
            '#settings-epg-info-background-mode .setup-toggle-value'
        ) as HTMLElement | null;

        expect(value?.textContent?.trim()).toBe('Theme Default');
    });

    it('sanitizes invalid info background mode values from storage', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '999');
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');

        const value = container.querySelector(
            '#settings-epg-info-background-mode .setup-toggle-value'
        ) as HTMLElement | null;

        expect(value?.textContent?.trim()).toBe('Artwork Bleed');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBeNull();
        expect(onGuideSettingChange).not.toHaveBeenCalled();
    });

    it('writes guide density and emits change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');

        chooseSettingOption(container, 'settings-epg-density', 1);

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBe('wide');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'guideDensity', density: 'wide' });
    });

    it('writes now watching toggle and emits change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');

        const toggle = container.querySelector('#settings-epg-now-watching') as HTMLButtonElement;
        toggle.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED)).toBe('0');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'nowWatchingBanner', enabled: false });
    });

    it('writes aggressive preload toggle and emits guide-setting change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');

        const toggle = container.querySelector('#settings-epg-aggressive-preload') as HTMLButtonElement;
        toggle.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED)).toBe('1');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'aggressivePreload', enabled: true });
    });

    it('writes prefer clear logos toggle', () => {
        const { container, screen } = createScreen(jest.fn());
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.PREFER_CLEAR_LOGOS);

        screen.show();
        activateCategory(container, 'appearance');

        const toggle = container.querySelector('#settings-prefer-clear-logos') as HTMLButtonElement | null;
        if (!toggle) throw new Error('Prefer clear logos toggle not found');

        toggle.click();
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.PREFER_CLEAR_LOGOS)).toBe('0');

        toggle.click();
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.PREFER_CLEAR_LOGOS)).toBe('1');
    });

    it('renders aggressive preload toggle in appearance category', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');

        const toggle = container.querySelector('#settings-epg-aggressive-preload');
        expect(toggle).not.toBeNull();
    });

    it('refresh() preserves aggressive preload toggle state from storage metadata', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');

        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED, '1');
        screen.hide();
        screen.show();
        activateCategory(container, 'appearance');
        const onState = container.querySelector('#settings-epg-aggressive-preload .setup-toggle-state');
        expect(onState?.textContent?.trim()).toBe('On');

        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED, '0');
        screen.hide();
        screen.show();
        activateCategory(container, 'appearance');
        const offState = container.querySelector('#settings-epg-aggressive-preload .setup-toggle-state');
        expect(offState?.textContent?.trim()).toBe('Off');
    });

    it('defaults the guide layout selector to classic when storage is unset', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');
        const value = container.querySelector('#settings-epg-layout-mode .setup-toggle-value') as HTMLElement | null;
        expect(value?.textContent?.trim()).toBe('Classic (PIP)');
    });

    it('opens dropdown on select activation and applies selection explicitly', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

        screen.show();
        activateCategory(container, 'appearance');

        const focusable = nav.focusables.get('settings-epg-layout-mode');
        expect(focusable?.onSelect).toBeDefined();
        focusable?.onSelect?.();

        const dropdown = container.querySelector('#settings-dropdown') as HTMLElement | null;
        expect(dropdown).not.toBeNull();
        expect(dropdown?.querySelectorAll('.settings-dropdown-option')?.length).toBeGreaterThan(0);

        // No change until explicit option click.
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');

        const firstNonSelected = dropdown?.querySelector(
            '.settings-dropdown-option:not(.settings-dropdown-option--selected)'
        ) as HTMLButtonElement | null;
        expect(firstNonSelected).not.toBeNull();
        firstNonSelected?.click();

        expect(onGuideSettingChange).toHaveBeenCalled();
        expect(container.querySelector('#settings-dropdown')).toBeNull();
    });

    it('closes dropdown even if applying a selection throws', () => {
        const onGuideSettingChange = jest.fn(() => {
            throw new Error('boom');
        });
        const { container, nav, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');

        const focusable = nav.focusables.get('settings-epg-layout-mode');
        focusable?.onSelect?.();

        const dropdown = container.querySelector('#settings-dropdown') as HTMLElement | null;
        expect(dropdown).not.toBeNull();

        const firstNonSelected = dropdown?.querySelector(
            '.settings-dropdown-option:not(.settings-dropdown-option--selected)'
        ) as HTMLButtonElement | null;
        expect(firstNonSelected).not.toBeNull();

        try {
            const optionId = firstNonSelected?.id ?? '';
            nav.focusables.get(optionId)?.onSelect?.();
        } catch {
            // Expected.
        }

        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect(nav.getFocusedElement()?.id).toBe('settings-epg-layout-mode');
    });

    it('dismisses dropdown on back without mutating the setting', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');

        const focusable = nav.focusables.get('settings-epg-layout-mode');
        focusable?.onSelect?.();
        expect(container.querySelector('#settings-dropdown')).not.toBeNull();

        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        expect(typeof keyHandler).toBe('function');

        const backEvent = { handled: false, button: 'back' };
        keyHandler?.(backEvent);

        expect(backEvent.handled).toBe(true);
        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(onGuideSettingChange).not.toHaveBeenCalled();
        expect(nav.getFocusedElement()?.id).toBe('settings-epg-layout-mode');
    });

    it('keeps a real pointer-opened dropdown trapped and restores its anchor state on dismissal and selection', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');
        const container = document.createElement('div');
        document.body.appendChild(container);
        const navigation = createRealNavigation();
        const screen = new SettingsScreen({
            container,
            getNavigation: (): NavigationManager => navigation,
            onGuideSettingChange: jest.fn(),
        });

        try {
            screen.show();
            (container.querySelector('#settings-category-appearance') as HTMLButtonElement).click();

            const select = container.querySelector('#settings-epg-layout-mode') as HTMLButtonElement | null;
            if (!select) throw new Error('Guide layout select not found');

            select.click();
            expect(container.querySelector('#settings-dropdown')).not.toBeNull();
            expect(select.getAttribute('aria-haspopup')).toBe('listbox');
            expect(select.getAttribute('aria-controls')).toBe('settings-dropdown');
            expect(select.getAttribute('aria-expanded')).toBe('true');
            expect(navigation.getState().focusedElementId).toBe('settings-dropdown-option-0');

            expect(navigation.moveFocus('up')).toBe(false);
            expect(navigation.getState().focusedElementId).toBe('settings-dropdown-option-0');
            navigation.setFocus('settings-dropdown-option-1');
            expect(navigation.moveFocus('down')).toBe(false);
            expect(navigation.getState().focusedElementId).toBe('settings-dropdown-option-1');

            const dismissEvent = makeKeyEvent('back');
            navigation.emit('keyPress', dismissEvent);
            expect(dismissEvent.handled).toBe(true);
            expect(container.querySelector('#settings-dropdown')).toBeNull();
            expect(select.getAttribute('aria-expanded')).toBe('false');
            expect(navigation.getState().focusedElementId).toBe(select.id);
            expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');

            select.click();
            const replacementOption = container.querySelector('#settings-dropdown-option-1') as HTMLButtonElement | null;
            if (!replacementOption) throw new Error('Replacement guide layout option not found');
            replacementOption.click();

            const restoredSelect = container.querySelector('#settings-epg-layout-mode') as HTMLButtonElement | null;
            expect(container.querySelector('#settings-dropdown')).toBeNull();
            expect(restoredSelect?.getAttribute('aria-expanded')).toBe('false');
            expect(navigation.getState().focusedElementId).toBe('settings-epg-layout-mode');
            expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');
        } finally {
            screen.destroy();
            navigation.destroy();
        }
    });

    it('restores focus to newly registered controls after a chooser invalidates settings state', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const navigation = createRealNavigation();
        const screen = new SettingsScreen({
            container,
            getNavigation: (): NavigationManager => navigation,
            onGuideSettingChange: jest.fn(),
        });

        try {
            screen.show();
            const select = container.querySelector('#settings-subtitle-mode') as HTMLButtonElement | null;
            if (!select) throw new Error('Subtitle mode select not found');

            select.click();
            const option = container.querySelector('#settings-dropdown-option-0') as HTMLButtonElement | null;
            if (!option) throw new Error('Subtitle mode option not found');
            option.click();

            const restoredSelect = container.querySelector('#settings-subtitle-mode') as HTMLButtonElement | null;
            expect(container.querySelector('#settings-dropdown')).toBeNull();
            expect(restoredSelect).not.toBeNull();
            expect(restoredSelect?.getAttribute('aria-expanded')).toBe('false');
            expect(navigation.getState().focusedElementId).toBe('settings-subtitle-mode');
            expect(navigation.getFocusedElement()?.element).toBe(restoredSelect);
        } finally {
            screen.destroy();
            navigation.destroy();
        }
    });

    it('ignores repeated and long-press Left and OK without reopening or changing a chooser', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');
        const container = document.createElement('div');
        document.body.appendChild(container);
        const navigation = createRealNavigation();
        const screen = new SettingsScreen({
            container,
            getNavigation: (): NavigationManager => navigation,
            onGuideSettingChange: jest.fn(),
        });

        try {
            screen.show();
            navigation.setFocus('settings-category-appearance');
            navigation.setFocus('settings-epg-layout-mode');
            dispatchRemoteKey(13, 'keydown');
            dispatchRemoteKey(13, 'keyup');
            expect(container.querySelector('#settings-dropdown')).not.toBeNull();

            const focusBefore = navigation.getState().focusedElementId;
            for (const event of [
                makeKeyEvent('left', { isRepeat: true }),
                makeKeyEvent('left', { isLongPress: true }),
                makeKeyEvent('ok', { isRepeat: true }),
                makeKeyEvent('ok', { isLongPress: true }),
            ]) {
                navigation.emit('keyPress', event);
                expect(event.handled).toBe(true);
            }

            expect(container.querySelector('#settings-dropdown')).not.toBeNull();
            expect(navigation.getState().focusedElementId).toBe(focusBefore);
            expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        } finally {
            screen.destroy();
            navigation.destroy();
        }
    });

    it('closes and unregisters dropdown option focusables on destroy', () => {
        const { container, nav, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');

        const focusable = nav.focusables.get('settings-epg-layout-mode');
        focusable?.onSelect?.();
        expect(container.querySelector('#settings-dropdown')).not.toBeNull();
        expect([...nav.focusables.keys()].some((key) => key.startsWith('settings-dropdown-option-'))).toBe(true);

        screen.destroy();

        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect([...nav.focusables.keys()].some((key) => key.startsWith('settings-dropdown-option-'))).toBe(false);
    });

    it('closes an open dropdown when switching categories', () => {
        const { container, nav, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');

        const focusable = nav.focusables.get('settings-epg-layout-mode');
        focusable?.onSelect?.();
        expect(container.querySelector('#settings-dropdown')).not.toBeNull();

        activateCategory(container, 'account');
        expect(container.querySelector('#settings-dropdown')).toBeNull();
    });

    it('opens select choices with RIGHT, returns to the rail with LEFT, and ignores repeats', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');

        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        expect(typeof keyHandler).toBe('function');

        const rightEvent = { handled: false, button: 'right', isRepeat: false, isLongPress: false };
        keyHandler?.(rightEvent);
        expect(rightEvent.handled).toBe(true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(container.querySelector('#settings-dropdown')).not.toBeNull();

        const repeatRightEvent = { handled: false, button: 'right', isRepeat: true, isLongPress: false };
        keyHandler?.(repeatRightEvent);
        expect(repeatRightEvent.handled).toBe(true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');

        const dismissEvent = { handled: false, button: 'back', isRepeat: false, isLongPress: false };
        keyHandler?.(dismissEvent);

        nav.setFocus('settings-epg-layout-mode');
        const leftEvent = { handled: false, button: 'left', isRepeat: false, isLongPress: false };
        keyHandler?.(leftEvent);
        expect(leftEvent.handled).toBe(true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(nav.getFocusedElement()?.id).toBe('settings-category-appearance');
    });

    it('rolls back a failed chooser selection and restores metadata after retry', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');
        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');
        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        const originalSetItem = Storage.prototype.setItem;
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
            this: Storage,
            key,
            value
        ): void {
            if (key === SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE) {
                throw new DOMException('Blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });

        keyHandler?.({
            handled: false,
            button: 'right',
            isRepeat: false,
            isLongPress: false,
        });
        const dropdown = container.querySelector('#settings-dropdown') as HTMLElement;
        const classicOption = dropdown.querySelectorAll<HTMLButtonElement>('.settings-dropdown-option')[1];
        classicOption?.click();

        const select = container.querySelector('#settings-epg-layout-mode') as HTMLButtonElement;
        expect(select.querySelector('.setup-toggle-value')?.textContent).toBe('Overlay');
        expect(select.querySelector('.setup-toggle-meta')?.textContent).toBe(
            'Could not save this setting. Check device storage and try again.'
        );
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(onGuideSettingChange).not.toHaveBeenCalled();
        expect(nav.getFocusedElement()?.id).toBe('settings-epg-layout-mode');

        setSpy.mockRestore();
        nav.setFocus('settings-epg-layout-mode');
        nav.focusables.get('settings-epg-layout-mode')?.onSelect?.();
        const retryDropdown = container.querySelector('#settings-dropdown') as HTMLElement;
        retryDropdown.querySelectorAll<HTMLButtonElement>('.settings-dropdown-option')[1]?.click();

        expect(select.querySelector('.setup-toggle-value')?.textContent).toBe('Classic (PIP)');
        expect(select.querySelector('.setup-toggle-meta')?.textContent).toBe(
            'Overlay keeps full-screen video; Classic shows PIP'
        );
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'layoutMode', mode: 'classic' });
    });

    it('rolls back a failed dropdown select change, closes the dropdown, and restores focus', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');
        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');
        nav.focusables.get('settings-epg-layout-mode')?.onSelect?.();
        const dropdown = container.querySelector('#settings-dropdown') as HTMLElement;
        const firstNonSelected = dropdown.querySelector(
            '.settings-dropdown-option:not(.settings-dropdown-option--selected)'
        ) as HTMLButtonElement;
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Full', 'QuotaExceededError');
        });

        nav.focusables.get(firstNonSelected.id)?.onSelect?.();

        const select = container.querySelector('#settings-epg-layout-mode') as HTMLButtonElement;
        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect(select.querySelector('.setup-toggle-value')?.textContent).toBe('Overlay');
        expect(select.querySelector('.setup-toggle-meta')?.textContent).toBe(
            'Could not save this setting. Check device storage and try again.'
        );
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(onGuideSettingChange).not.toHaveBeenCalled();
        expect(nav.getFocusedElement()?.id).toBe('settings-epg-layout-mode');
        setSpy.mockRestore();
    });

    it('moves left from non-select detail back to active category without mutating value', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-now-watching');

        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        expect(typeof keyHandler).toBe('function');

        const leftEvent = { handled: false, button: 'left' };
        keyHandler?.(leftEvent);

        expect(leftEvent.handled).toBe(true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED)).toBeNull();
        expect(nav.getFocusedElement()?.id).toBe('settings-category-appearance');
    });

});

describe('SettingsScreen (Two-pane layout)', () => {
    const CATEGORY_IDS = [
        'settings-category-audio_subtitles',
        'settings-category-playback_hdr',
        'settings-category-appearance',
        'settings-category-account',
        'settings-category-developer',
    ];

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders categories in locked order and only active category items', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();

        const categoryButtons = Array.from(
            container.querySelectorAll('[id^="settings-category-"]')
        ) as HTMLButtonElement[];
        expect(categoryButtons.map((button) => button.id)).toEqual(CATEGORY_IDS);

        expect(container.querySelector('#settings-dts-passthrough')).not.toBeNull();
        expect(container.querySelector('#settings-keep-playing')).toBeNull();
    });

    it('switches active category detail content', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();

        const playbackCategory = container.querySelector(
            '#settings-category-playback_hdr'
        ) as HTMLButtonElement | null;
        if (!playbackCategory) {
            throw new Error('Playback category not found');
        }
        playbackCategory.click();

        expect(container.querySelector('#settings-keep-playing')).not.toBeNull();
        expect(container.querySelector('#settings-hdr10-fallback-mode')).not.toBeNull();
        expect(container.querySelector('#settings-dts-passthrough')).toBeNull();
    });

    it('moves focus into details when pressing RIGHT on the active category button', () => {
        const { container, nav, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-category-appearance');

        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        expect(typeof keyHandler).toBe('function');

        keyHandler?.({ handled: false, button: 'right' });
        expect(nav.getFocusedElement()?.id).toBe('settings-guide-library-tabs');
    });

	    it('renders the detail pane and registers its controls synchronously on category change', () => {
        const { container, nav, screen } = createScreen(jest.fn());
        screen.show();

        const appearanceButton = container.querySelector('#settings-category-appearance') as HTMLButtonElement | null;
        if (!appearanceButton) {
            throw new Error('Appearance category not found');
        }
        appearanceButton.click();

        const detailItems = container.querySelector('.settings-detail-items') as HTMLElement | null;
        expect(detailItems?.classList.contains('transitioning')).toBe(false);
        expect(container.querySelector('#settings-guide-library-tabs')).not.toBeNull();
        expect(nav.focusables.has('settings-guide-library-tabs')).toBe(true);

        nav.setFocus('settings-category-appearance');
        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        expect(typeof keyHandler).toBe('function');
        keyHandler?.({
            handled: false,
            button: 'right',
            isRepeat: false,
            isLongPress: false,
        });

        expect(nav.getFocusedElement()?.id).toBe('settings-guide-library-tabs');
    });

    it('renders the new category before the real focus-change notification and emits it once', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const navigation = createRealNavigation();
        const screen = new SettingsScreen({
            container,
            getNavigation: (): NavigationManager => navigation,
            onGuideSettingChange: jest.fn(),
        });

        try {
            screen.show();
            const focusChanges: Array<{ from: string | null; to: string }> = [];
            let detailWasRegisteredAtNotification = false;
            navigation.on('focusChange', (change) => {
                focusChanges.push(change);
                if (change.to === 'settings-category-appearance') {
                    detailWasRegisteredAtNotification = navigation.getFocusedElement()?.id
                        === 'settings-category-appearance'
                        && container.querySelector('#settings-guide-library-tabs') !== null;
                }
            });

            navigation.setFocus('settings-category-appearance');

            expect(focusChanges).toEqual([{
                from: 'settings-category-audio_subtitles',
                to: 'settings-category-appearance',
            }]);
            expect(detailWasRegisteredAtNotification).toBe(true);
            expect(navigation.getState().focusedElementId).toBe('settings-category-appearance');
        } finally {
            screen.destroy();
            navigation.destroy();
        }
    });

    it('renders header and profile identity row inside the left rail', () => {
        const { container, screen } = createScreen(jest.fn(), () => 'TestUser');
        screen.show();

        const rail = container.querySelector('.settings-categories') as HTMLElement | null;
        expect(rail).not.toBeNull();

        const header = rail?.querySelector('.settings-header');
        expect(header).not.toBeNull();
        expect((header?.querySelector('.settings-title') as HTMLElement | null)?.textContent).toContain('Settings');

        const profileRow = rail?.querySelector('#settings-switch-profile') as HTMLElement | null;
        expect(profileRow).not.toBeNull();
        expect(profileRow?.classList.contains('settings-profile-row')).toBe(true);
        expect(profileRow?.querySelector('.settings-profile-name')?.textContent).toBe('TestUser');
        expect(profileRow?.querySelector('.settings-profile-action')?.textContent).toBe('Switch Profile →');
    });

    it('falls back to "Profile" when getActiveUsername returns null', () => {
        const { container, screen } = createScreen(jest.fn(), () => null);
        screen.show();

        const profileRow = container.querySelector('#settings-switch-profile') as HTMLElement | null;
        expect(profileRow?.querySelector('.settings-profile-name')?.textContent).toBe('Profile');
    });

    it('refreshes profile name on show', () => {
        let username: string | null = 'FirstUser';
        const { container, screen } = createScreen(jest.fn(), () => username);
        screen.show();

        expect(container.querySelector('.settings-profile-name')?.textContent).toBe('FirstUser');

        screen.hide();
        username = 'SecondUser';
        screen.show();

        expect(container.querySelector('.settings-profile-name')?.textContent).toBe('SecondUser');
    });

	    it('keeps the detail pane visible without a blank crossfade during category changes', () => {
	        const { container, screen } = createScreen(jest.fn());
        screen.show();

        const detailItems = container.querySelector('.settings-detail-items') as HTMLElement | null;
        const playbackCategory = container.querySelector(
            '#settings-category-playback_hdr'
        ) as HTMLButtonElement | null;
        if (!detailItems || !playbackCategory) {
            throw new Error('Expected settings detail controls');
        }

        playbackCategory.click();

        expect(detailItems.classList.contains('transitioning')).toBe(false);
        expect(container.querySelector('#settings-keep-playing')).not.toBeNull();
    });

    it('wires left/right pane transfer and per-category remembered focus', () => {
        const { container, nav, screen } = createScreen(jest.fn());

        screen.show();

        const audioCategory = nav.focusables.get('settings-category-audio_subtitles');
        expect(audioCategory?.neighbors.right).toBe('settings-dts-passthrough');

        const firstAudioDetail = nav.focusables.get('settings-dts-passthrough');
        expect(firstAudioDetail?.neighbors.left).toBe('settings-category-audio_subtitles');

        nav.setFocus('settings-subtitle-mode');

        const playbackCategory = container.querySelector(
            '#settings-category-playback_hdr'
        ) as HTMLButtonElement | null;
        if (!playbackCategory) {
            throw new Error('Playback category not found');
        }
        playbackCategory.click();

        expect(nav.focusables.has('settings-dts-passthrough')).toBe(false);
        expect(nav.focusables.has('settings-keep-playing')).toBe(true);

        nav.setFocus('settings-hdr10-fallback-mode');
        const audioCategoryButton = container.querySelector(
            '#settings-category-audio_subtitles'
        ) as HTMLButtonElement | null;
        if (!audioCategoryButton) {
            throw new Error('Audio category not found');
        }
        audioCategoryButton.click();
        playbackCategory.click();

        const rememberedPlaybackCategory = nav.focusables.get('settings-category-playback_hdr');
        expect(rememberedPlaybackCategory?.neighbors.right).toBe('settings-hdr10-fallback-mode');
    });

    it('refreshes category values from storage when switching categories', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'playback_hdr');

        const stateBefore = container.querySelector('#settings-keep-playing .setup-toggle-state');
        if (!stateBefore) {
            throw new Error('Keep playing state not found');
        }
        const initialState = stateBefore.textContent?.trim();
        if (initialState !== 'On' && initialState !== 'Off') {
            throw new Error(`Unexpected initial state: ${String(initialState)}`);
        }
        const targetState = initialState === 'On' ? 'Off' : 'On';
        const storageValue = targetState === 'On' ? '1' : '0';

        activateCategory(container, 'audio_subtitles');
        localStorage.setItem(SETTINGS_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS, storageValue);
        activateCategory(container, 'playback_hdr');

        const stateAfter = container.querySelector('#settings-keep-playing .setup-toggle-state');
        expect(stateAfter?.textContent?.trim()).toBe(targetState);
    });

    it('rerenders subtitle-dependent controls and preserves focus after subtitle mode changes', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_MODE, 'direct');

        const { container, nav, screen } = createScreen(jest.fn());
        screen.show();
        activateCategory(container, 'audio_subtitles');

        nav.setFocus('settings-subtitle-mode');
        nav.focusables.get('settings-subtitle-mode')?.onSelect?.();
        nav.focusables.get('settings-dropdown-option-0')?.onSelect?.();

        const subtitleLanguage = container.querySelector('#settings-subtitle-language') as HTMLButtonElement | null;
        const preferForced = container.querySelector('#settings-subtitles-prefer-forced') as HTMLButtonElement | null;

        expect(subtitleLanguage?.disabled).toBe(true);
        expect(preferForced?.disabled).toBe(true);
        expect(nav.setFocus).toHaveBeenCalledWith('settings-subtitle-mode');
        expect(nav.setFocus).not.toHaveBeenCalledWith('settings-category-appearance');
        expect(nav.getFocusedElement()?.id).toBe('settings-subtitle-mode');
    });

    it.each([
        ['unavailable', new DOMException('Blocked', 'SecurityError')],
        ['quota-exceeded', new DOMException('Full', 'QuotaExceededError')],
    ])('rolls back a %s setting write, announces it inline, and preserves focus', (_, storageError) => {
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH);
        const { container, nav, screen } = createScreen(jest.fn());
        screen.show();
        nav.setFocus('settings-dts-passthrough');
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw storageError;
        });
        const toggle = container.querySelector('#settings-dts-passthrough') as HTMLButtonElement;

        expect(() => toggle.click()).not.toThrow();
        expect(toggle.querySelector('.setup-toggle-state')?.textContent).toBe('Off');
        expect(toggle.querySelector('.setup-toggle-meta')?.textContent).toBe(
            'Could not save this setting. Check device storage and try again.'
        );
        expect(toggle.querySelector('.setup-toggle-meta')?.getAttribute('role')).toBe('status');
        expect(toggle.querySelector('.setup-toggle-meta')?.getAttribute('aria-live')).toBe('polite');
        expect(nav.getFocusedElement()?.id).toBe('settings-dts-passthrough');

        setSpy.mockRestore();
        toggle.click();
        expect(toggle.querySelector('.setup-toggle-state')?.textContent).toBe('On');
        expect(toggle.querySelector('.setup-toggle-meta')?.textContent).toBe('Enable if you have an eARC receiver');
    });

    it('preserves active category continuity with valid focus on re-open', () => {
        const { container, nav, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'playback_hdr');
        nav.setFocus('settings-hdr10-fallback-mode');
        expect(nav.getFocusedElement()?.id).toBe('settings-hdr10-fallback-mode');

        screen.hide();
        expect(nav.focusables.size).toBe(0);

        screen.show();

        expect(container.querySelector('#settings-keep-playing')).not.toBeNull();
        expect(container.querySelector('#settings-dts-passthrough')).toBeNull();
        expect(nav.focusables.has('settings-hdr10-fallback-mode')).toBe(true);
        expect(nav.getFocusedElement()?.id).toBe('settings-category-playback_hdr');
    });

    it('does not switch active category during initial focus when previous screen focus is unrelated', () => {
        const { container, nav, screen } = createScreen(jest.fn());

        // First open: select a non-default category so the screen has a meaningful active category.
        screen.show();
        activateCategory(container, 'playback_hdr');
        expect(container.querySelector('#settings-keep-playing')).not.toBeNull();
        screen.hide();

        // Simulate NavigationManager.goTo() behavior: focus may still reflect the previous screen
        // when the Settings screen registers focusables during screenChange.
        nav.registerFocusable({
            id: 'previous-screen-focused-id',
            element: document.createElement('button'),
            neighbors: {},
        });
        nav.setFocus('previous-screen-focused-id');

        screen.show();

        // Active category should remain playback_hdr (do not switch to the first rail entry via onFocus).
        expect(container.querySelector('#settings-keep-playing')).not.toBeNull();
        expect(container.querySelector('#settings-dts-passthrough')).toBeNull();
        expect(nav.getFocusedElement()?.id).toBe('settings-category-playback_hdr');
    });
});

describe('SettingsScreen (Transcode controls)', () => {
    beforeEach(() => {
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.TRANSCODE_COMPAT);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('writes transcode compat toggle', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'playback_hdr');

        const toggle = container.querySelector('#settings-transcode-compat') as HTMLButtonElement | null;
        if (!toggle) {
            throw new Error('Transcode compat toggle not found');
        }

        toggle.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.TRANSCODE_COMPAT)).toBe('1');
    });

    it('writes transcode quality select', () => {
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'playback_hdr');

        chooseSettingOption(container, 'settings-transcode-quality', 1);

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY)).toBe('12000-1080p');
    });

    it('loads stored transcode quality on show', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY, '12000-1080p');
        const { container, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'playback_hdr');

        const value = container.querySelector('#settings-transcode-quality .setup-toggle-value');
        expect(value?.textContent?.trim()).toBe('12 Mbps (1080p)');
    });
});

describe('SettingsScreen (Theme selection)', () => {
    beforeEach(() => {
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.THEME);
        document.body.classList.remove(...ALL_THEME_CLASSES);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.classList.remove(...ALL_THEME_CLASSES);
    });

    it('applies the selected theme from the chooser', () => {
        const { container, nav, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');

        const directvIndex = THEME_OPTIONS.findIndex((option) => option.theme === 'directv');
        expect(directvIndex).toBeGreaterThanOrEqual(0);

        nav.setFocus('settings-theme');
        chooseSettingOption(container, 'settings-theme', directvIndex);

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.THEME)).toBe('directv');
        expect(document.body.classList.contains('theme-directv')).toBe(true);
    });
});
