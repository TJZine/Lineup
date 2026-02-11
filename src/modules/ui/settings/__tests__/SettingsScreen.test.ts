/**
 * @jest-environment jsdom
 */

import { SettingsScreen } from '../SettingsScreen';
import { SETTINGS_STORAGE_KEYS } from '../constants';
import type { GuideSettingChange } from '../types';
import { ThemeManager } from '../../theme';
import { THEME_OPTIONS, THEME_CLASSES } from '../theme';

type StubFocusable = {
    id: string;
    neighbors: { up?: string; down?: string; left?: string; right?: string };
    onSelect?: () => void;
};

const ALL_THEME_CLASSES = Object.values(THEME_CLASSES).filter(Boolean);

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
        }),
        getFocusedElement: jest.fn(() => (focusedId ? ({ id: focusedId } as HTMLElement) : null)),
        on: jest.fn(),
        off: jest.fn(),
    };
};

const createScreen = (onGuideSettingChange: (change: GuideSettingChange) => void): {
    container: HTMLElement;
    nav: ReturnType<typeof createNavigationStub>;
    screen: SettingsScreen;
} => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const nav = createNavigationStub();
    const screen = new SettingsScreen(
        container,
        () => nav as unknown as never,
        undefined,
        onGuideSettingChange
    );
    return { container, nav, screen };
};

describe('SettingsScreen (Guide settings)', () => {
    beforeEach(() => {
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('writes layout mode and emits change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();

        const layoutSelect = container.querySelector('#settings-epg-layout-mode') as HTMLButtonElement;
        layoutSelect.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'layoutMode', mode: 'classic' });
    });

    it('writes guide density and emits change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();

        const densitySelect = container.querySelector('#settings-epg-density') as HTMLButtonElement;
        densitySelect.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBe('wide');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'guideDensity', density: 'wide' });
    });

    it('writes now watching toggle and emits change', () => {
        const onGuideSettingChange = jest.fn();
        const { container, screen } = createScreen(onGuideSettingChange);

        screen.show();

        const toggle = container.querySelector('#settings-epg-now-watching') as HTMLButtonElement;
        toggle.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED)).toBe('0');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'nowWatchingBanner', enabled: false });
    });

    it('does not change select value on OK', () => {
        const onGuideSettingChange = jest.fn();
        const { nav, screen } = createScreen(onGuideSettingChange);

        screen.show();
        nav.setFocus('settings-epg-layout-mode');

        const focusable = nav.focusables.get('settings-epg-layout-mode');
        focusable?.onSelect?.();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBeNull();
        expect(onGuideSettingChange).not.toHaveBeenCalled();
    });

    it('cycles select with left/right keys and clamps at edges', () => {
        const onGuideSettingChange = jest.fn();
        const { nav, screen } = createScreen(onGuideSettingChange);

        screen.show();
        nav.setFocus('settings-epg-layout-mode');

        const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
        expect(typeof keyHandler).toBe('function');

        keyHandler?.({ handled: false, button: 'right' });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');

        keyHandler?.({ handled: false, button: 'right' });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');

        keyHandler?.({ handled: false, button: 'left' });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');

        keyHandler?.({ handled: false, button: 'left' });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
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
        const { nav, screen } = createScreen(jest.fn());

        screen.show();

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
