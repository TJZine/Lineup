/**
 * @jest-environment jsdom
 */

import { SettingsScreen } from '../SettingsScreen';
import { SettingsStore } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS } from '../constants';
import type { GuideSettingChange } from '../types';
import { ThemeManager } from '../../theme';
import { THEME_OPTIONS, THEME_CLASSES } from '../../theme';

type StubFocusable = {
    id: string;
    neighbors: { up?: string; down?: string; left?: string; right?: string };
    onFocus?: () => void;
    onSelect?: () => void;
};

const ALL_THEME_CLASSES = Object.values(THEME_CLASSES).filter(Boolean);
const REAL_REQUEST_ANIMATION_FRAME = window.requestAnimationFrame;
const REAL_CANCEL_ANIMATION_FRAME = window.cancelAnimationFrame;
const CREATED_CONTAINERS: HTMLElement[] = [];

const setupQueuedRaf = (): {
    rafQueue: Array<{ id: number; cb: FrameRequestCallback }>;
    cancelSpy: jest.SpyInstance<void, [handle: number]>;
    restore: () => void;
} => {
    const rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
    let nextId = 1;
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
        const id = nextId++;
        rafQueue.push({ id, cb });
        return id;
    });
    const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle: number): void => {
        const index = rafQueue.findIndex((entry) => entry.id === handle);
        if (index >= 0) {
            rafQueue.splice(index, 1);
        }
    });
    return {
        rafQueue,
        cancelSpy,
        restore: (): void => {
            rafSpy.mockRestore();
            cancelSpy.mockRestore();
        },
    };
};

const createNavigationStub = (): {
    focusables: Map<string, StubFocusable>;
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    getFocusedElement: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
} => {
    const focusables = new Map<string, StubFocusable>();
    let focusedId: string | null = null;

    return {
        focusables,
        registerFocusable: jest.fn((element: StubFocusable) => {
            focusables.set(element.id, element);
        }),
        unregisterFocusable: jest.fn((id: string) => {
            focusables.delete(id);
        }),
        setFocus: jest.fn((id: string) => {
            focusedId = id;
            focusables.get(id)?.onFocus?.();
        }),
        getFocusedElement: jest.fn(() => (focusedId ? ({ id: focusedId } as HTMLElement) : null)),
        on: jest.fn(),
        off: jest.fn(),
    };
};

const createScreen = (
    onGuideSettingChange: (change: GuideSettingChange) => void,
    getActiveUsername?: () => string | null,
    settingsStore?: SettingsStore
): {
    container: HTMLElement;
    nav: ReturnType<typeof createNavigationStub>;
    screen: SettingsScreen;
} => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    CREATED_CONTAINERS.push(container);
    const nav = createNavigationStub();
    const screen = new SettingsScreen(
        container,
        () => nav as unknown as never,
        undefined,
        onGuideSettingChange,
        getActiveUsername,
        settingsStore
    );
    return { container, nav, screen };
};

const activateCategory = (container: HTMLElement, categoryId: string): void => {
    const button = container.querySelector(`#settings-category-${categoryId}`) as HTMLButtonElement | null;
    if (!button) {
        throw new Error(`Category ${categoryId} not found`);
    }
    button.click();
};

beforeEach(() => {
    Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: (cb: FrameRequestCallback): number => {
            cb(16);
            return 1;
        },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
        configurable: true,
        writable: true,
        value: (): void => {},
    });
});

afterEach(() => {
    Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: REAL_REQUEST_ANIMATION_FRAME,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
        configurable: true,
        writable: true,
        value: REAL_CANCEL_ANIMATION_FRAME,
    });
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

    it('writes layout mode and emits change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

        screen.show();
        activateCategory(container, 'appearance');

        const layoutSelect = container.querySelector('#settings-epg-layout-mode') as HTMLButtonElement;
        layoutSelect.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'layoutMode', mode: 'classic' });
    });

    it('writes past items select and emits guide-setting change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');

        const select = container.querySelector('#settings-epg-past-items') as HTMLButtonElement;
        select.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBe('0');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'pastItemsWindow', value: '0' });
    });

    it('writes info background mode select and emits guide-setting change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');

        const select = container.querySelector('#settings-epg-info-background-mode') as HTMLButtonElement | null;
        if (!select) {
            throw new Error('Info background mode select not found');
        }

        select.click();

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

        select.click();
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBe('2');

        select.click();
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

        const densitySelect = container.querySelector('#settings-epg-density') as HTMLButtonElement;
        densitySelect.click();

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

    it('cycles select with left/right keys and returns to rail at left edge', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');

        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        expect(typeof keyHandler).toBe('function');

        keyHandler?.({ handled: false, button: 'right' });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');

        keyHandler?.({ handled: false, button: 'right' });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');

        const leftEvent = { handled: false, button: 'left' };
        keyHandler?.(leftEvent);
        expect(leftEvent.handled).toBe(true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(nav.getFocusedElement()?.id).toBe('settings-epg-layout-mode');

        const edgeLeftEvent = { handled: false, button: 'left' };
        keyHandler?.(edgeLeftEvent);
        expect(edgeLeftEvent.handled).toBe(true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(nav.getFocusedElement()?.id).toBe('settings-category-appearance');
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
        expect(nav.getFocusedElement()?.id).toBe('settings-guide-category-colors');
    });

	    it('moves focus into the newly-rendered detail pane when RIGHT is pressed during a deferred category swap', () => {
	        const { rafQueue, restore } = setupQueuedRaf();

	        try {
	            const { container, nav, screen } = createScreen(jest.fn());
	            screen.show();

            // Trigger a deferred swap by switching categories while detail items exist.
            const appearanceButton = container.querySelector('#settings-category-appearance') as HTMLButtonElement | null;
            if (!appearanceButton) {
                throw new Error('Appearance category not found');
            }
            appearanceButton.click();

            // Focus the newly selected category and press RIGHT before the swap frame runs.
            nav.setFocus('settings-category-appearance');
            const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
            expect(typeof keyHandler).toBe('function');
            keyHandler?.({ handled: false, button: 'right' });

	            const swapFrame = rafQueue.shift()?.cb;
	            if (!swapFrame) {
	                throw new Error('Expected swap frame');
	            }
	            swapFrame(16);

            // After detail items exist, focus should transfer into the detail pane.
            expect(nav.getFocusedElement()?.id).toBe('settings-guide-category-colors');
	        } finally {
	            restore();
	        }
	    });

	    it('cancels deferred swap work and clears pending intent on hide', () => {
	        const { rafQueue, cancelSpy, restore } = setupQueuedRaf();

	        try {
	            const { container, nav, screen } = createScreen(jest.fn());
	            screen.show();

            // Queue a deferred swap and preserve the same RIGHT-into-detail intent as the
            // existing deferred-swap focus test before hiding.
            const appearanceButton = container.querySelector('#settings-category-appearance') as HTMLButtonElement | null;
            if (!appearanceButton) {
                throw new Error('Appearance category not found');
            }
            appearanceButton.click();
            nav.setFocus('settings-category-appearance');
            const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
            expect(typeof keyHandler).toBe('function');
            keyHandler?.({ handled: false, button: 'right' });

	            const swapFrameId = rafQueue[0]?.id;
	            if (!swapFrameId) {
	                throw new Error('Expected deferred swap frame');
	            }

	            screen.hide();
	            expect(cancelSpy).toHaveBeenCalled();
            const detailItems = container.querySelector('.settings-detail-items') as HTMLElement | null;
            expect(detailItems?.classList.contains('transitioning')).toBe(false);

	            // The deferred swap frame must be canceled (it should not be runnable after hide).
	            expect(rafQueue.find((entry) => entry.id === swapFrameId)).toBeUndefined();

	            screen.show();
	            expect(nav.getFocusedElement()?.id).toBe('settings-category-appearance');
	            nav.setFocus.mockClear();

	            // Only advance frames scheduled after show().
	            while (rafQueue.length > 0) {
	                const frame = rafQueue.shift()?.cb;
	                frame?.(16);
	            }

	            expect(nav.setFocus).not.toHaveBeenCalledWith(expect.stringContaining('settings-guide-category-colors'));
	            expect(nav.getFocusedElement()?.id).toBe('settings-category-appearance');
	        } finally {
	            restore();
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

	    it('applies transitioning class during category detail swap and removes it after reveal frame', () => {
	        const { rafQueue, restore } = setupQueuedRaf();

        try {
            const { container, screen } = createScreen(jest.fn());
            screen.show();

            const detailItems = container.querySelector('.settings-detail-items') as HTMLElement | null;
            if (!detailItems) {
                throw new Error('settings-detail-items not found');
            }

            const playbackCategory = container.querySelector(
                '#settings-category-playback_hdr'
            ) as HTMLButtonElement | null;
            if (!playbackCategory) {
                throw new Error('Playback category not found');
            }

            playbackCategory.click();

            expect(detailItems.classList.contains('transitioning')).toBe(true);
            expect(container.querySelector('#settings-keep-playing')).toBeNull();

	            const swapFrame = rafQueue.shift()?.cb;
	            if (!swapFrame) {
	                throw new Error('Expected swap frame');
	            }
	            swapFrame(16);
            expect(container.querySelector('#settings-keep-playing')).not.toBeNull();
            expect(detailItems.classList.contains('transitioning')).toBe(true);

	            const revealFrame = rafQueue.shift()?.cb;
	            if (!revealFrame) {
	                throw new Error('Expected reveal frame');
	            }
	            revealFrame(32);
	            expect(detailItems.classList.contains('transitioning')).toBe(false);
	        } finally {
	            restore();
	        }
	    });

	    it('re-registers active detail focusables after deferred category swap', () => {
	        const { rafQueue, restore } = setupQueuedRaf();

        try {
            const { container, nav, screen } = createScreen(jest.fn());
            screen.show();

            const playbackCategory = container.querySelector(
                '#settings-category-playback_hdr'
            ) as HTMLButtonElement | null;
            if (!playbackCategory) {
                throw new Error('Playback category not found');
            }

            playbackCategory.click();

            // Before swap frame runs, only rail focusables are registered.
            expect(nav.focusables.has('settings-keep-playing')).toBe(false);

	            const swapFrame = rafQueue.shift()?.cb;
	            if (!swapFrame) {
	                throw new Error('Expected swap frame');
	            }
	            swapFrame(16);

            // After deferred render, detail focusables must be present for D-pad navigation.
            expect(nav.focusables.has('settings-keep-playing')).toBe(true);
            const categoryFocusable = nav.focusables.get('settings-category-playback_hdr');
            expect(categoryFocusable?.neighbors.right).toBe('settings-keep-playing');

	            const revealFrame = rafQueue.shift()?.cb;
	            if (!revealFrame) {
	                throw new Error('Expected reveal frame');
	            }
	            revealFrame(32);
	        } finally {
	            restore();
	        }
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

    it('preserves settings roundtrip continuity with valid focus on re-open', () => {
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
        expect(nav.getFocusedElement()?.id).toBe('settings-hdr10-fallback-mode');
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

        const select = container.querySelector('#settings-transcode-quality') as HTMLButtonElement | null;
        if (!select) {
            throw new Error('Transcode quality select not found');
        }

        select.click();

        // Click cycles from Default -> first cap tier.
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
        ThemeManager.__resetForTests();
        document.body.classList.remove(...ALL_THEME_CLASSES);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.classList.remove(...ALL_THEME_CLASSES);
        ThemeManager.__resetForTests();
    });

    it('cycles to DirecTV and applies the theme class', () => {
        const { container, nav, screen } = createScreen(jest.fn());

        screen.show();
        activateCategory(container, 'appearance');

        const directvIndex = THEME_OPTIONS.findIndex((option) => option.theme === 'directv');
        const currentIndex = THEME_OPTIONS.findIndex((option) => option.theme === ThemeManager.getInstance().getTheme());
        expect(directvIndex).toBeGreaterThanOrEqual(0);
        expect(currentIndex).toBeGreaterThanOrEqual(0);

        nav.setFocus('settings-theme');
        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        expect(typeof keyHandler).toBe('function');

        const delta = directvIndex - currentIndex;
        const button = delta >= 0 ? 'right' : 'left';
        for (let i = 0; i < Math.abs(delta); i += 1) {
            keyHandler?.({ handled: false, button });
        }

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.THEME)).toBe('directv');
        expect(document.body.classList.contains('theme-directv')).toBe(true);
    });
});
