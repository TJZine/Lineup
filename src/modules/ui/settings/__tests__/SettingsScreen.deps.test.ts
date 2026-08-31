/**
 * @jest-environment jsdom
 */

import { SettingsScreen } from '../SettingsScreen';
import { SettingsStore } from '../SettingsStore';
import { THEME_OPTIONS, type ThemeName } from '../../theme/themeDefinitions';
import type { SubtitleMode } from '../../../../shared/subtitle-mode';
import { activateCategory, createNavigationStub } from './settings-screen-test-helpers';

class TrackingSettingsStore extends SettingsStore {
    public override readonly writeSubtitleMode = jest.fn<
        ReturnType<SettingsStore['writeSubtitleMode']>,
        Parameters<SettingsStore['writeSubtitleMode']>
    >((mode) => ({ ok: true, value: mode }));
    public override readonly writeToggleSetting = jest.fn<
        ReturnType<SettingsStore['writeToggleSetting']>,
        Parameters<SettingsStore['writeToggleSetting']>
    >((_, value) => ({ ok: true, value }));

    override readSubtitleModeAndClean(): SubtitleMode {
        return 'off';
    }

    override readToggleSettingAndClean(id: Parameters<SettingsStore['readToggleSettingAndClean']>[0]): boolean {
        if (id === 'epgLibraryTabsEnabled') return false;
        return super.readToggleSettingAndClean(id);
    }
}

describe('SettingsScreen deps constructor', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
        localStorage.clear();
    });

    it('uses a navigation stub that mirrors focus and subscription contracts', () => {
        const nav = createNavigationStub();
        const focusable = {
            id: 'settings-test-focusable',
            element: document.createElement('button'),
            neighbors: {},
            onFocus: jest.fn(),
        };
        const keyHandler = jest.fn();

        nav.registerFocusable(focusable);
        const disposable = nav.on('keyPress', keyHandler);
        nav.setFocus(focusable.id);

        expect(nav.getFocusedElement()).toBe(focusable);
        expect(focusable.onFocus).toHaveBeenCalledTimes(1);

        disposable.dispose();

        expect(nav.off).toHaveBeenCalledWith('keyPress', keyHandler);
    });

    it('constructs from the required named deps only', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const nav = createNavigationStub();

        const screen = new SettingsScreen({
            container,
            getNavigation: (): never => nav as unknown as never,
        });

        screen.show();

        expect(container.classList.contains('visible')).toBe(true);
        expect(container.querySelector('.settings-profile-name')?.textContent).toBe('Profile');
        expect(nav.registerFocusable).toHaveBeenCalled();

        screen.destroy();

        expect(container.childElementCount).toBe(0);
    });

    it('routes optional named deps to Settings runtime collaborators', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const nav = createNavigationStub();
        const settingsStore = new TrackingSettingsStore();
        const onSubtitleModeChange = jest.fn();
        const onGuideSettingChange = jest.fn();
        const getActiveUsername = jest.fn(() => 'NamedUser');
        const getTheme = jest.fn<ThemeName, []>(() => 'ember-steel');
        const setTheme = jest.fn(() => ({ ok: true } as const));

        const screen = new SettingsScreen({
            container,
            getNavigation: (): never => nav as unknown as never,
            onSubtitleModeChange,
            onGuideSettingChange,
            getActiveUsername,
            getTheme,
            setTheme,
            settingsStore,
        });

        screen.show();

        expect(container.querySelector('.settings-profile-name')?.textContent).toBe('NamedUser');
        expect(getActiveUsername).toHaveBeenCalled();

        const subtitleMode = container.querySelector('#settings-subtitle-mode') as HTMLButtonElement | null;
        subtitleMode?.click();
        const directSubtitleOption = container.querySelectorAll<HTMLButtonElement>('.settings-dropdown-option')[1];
        directSubtitleOption?.click();
        expect(settingsStore.writeSubtitleMode).toHaveBeenCalledWith('direct');
        expect(onSubtitleModeChange).toHaveBeenCalledWith('direct');

        activateCategory(container, 'appearance');
        const theme = container.querySelector('#settings-theme') as HTMLButtonElement | null;
        theme?.click();
        const emberSteelIndex = THEME_OPTIONS.findIndex((option) => option.theme === 'ember-steel');
        const nextThemeOption = container.querySelectorAll<HTMLButtonElement>('.settings-dropdown-option')[emberSteelIndex + 1];
        nextThemeOption?.click();
        expect(getTheme).toHaveBeenCalled();
        expect(setTheme).toHaveBeenCalledWith(THEME_OPTIONS[emberSteelIndex + 1]?.theme);

        const libraryTabs = container.querySelector(
            '#settings-guide-library-tabs'
        ) as HTMLButtonElement | null;
        libraryTabs?.click();
        expect(settingsStore.writeToggleSetting).toHaveBeenCalledWith('epgLibraryTabsEnabled', true);
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'libraryTabs', enabled: true });

        screen.destroy();
    });
});
