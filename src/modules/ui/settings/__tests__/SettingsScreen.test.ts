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
    onFocus?: () => void;
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
            focusables.get(id)?.onFocus?.();
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

const activateCategory = (container: HTMLElement, categoryId: string): void => {
    const button = container.querySelector(`#settings-category-${categoryId}`) as HTMLButtonElement | null;
    if (!button) {
        throw new Error(`Category ${categoryId} not found`);
    }
    button.click();
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
        activateCategory(container, 'appearance');

        const layoutSelect = container.querySelector('#settings-epg-layout-mode') as HTMLButtonElement;
        layoutSelect.click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('classic');
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'layoutMode', mode: 'classic' });
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

    it('does not change select value on OK', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);

        screen.show();
        activateCategory(container, 'appearance');
        nav.setFocus('settings-epg-layout-mode');

        const focusable = nav.focusables.get('settings-epg-layout-mode');
        focusable?.onSelect?.();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBeNull();
        expect(onGuideSettingChange).not.toHaveBeenCalled();
    });

    it('cycles select with left/right keys and returns to rail at left edge', () => {
        const onGuideSettingChange = jest.fn();
        const { container, nav, screen } = createScreen(onGuideSettingChange);

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
