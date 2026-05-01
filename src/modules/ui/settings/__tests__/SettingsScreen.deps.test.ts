/**
 * @jest-environment jsdom
 */

import { SettingsScreen } from '../SettingsScreen';
import { SettingsStore } from '../SettingsStore';
import { THEME_OPTIONS, type ThemeName } from '../../theme/themeDefinitions';
import type { SubtitleMode } from '../../../../shared/subtitle-mode';
import { activateCategory, createNavigationStub } from './settings-screen-test-helpers';

class TrackingSettingsStore extends SettingsStore {
    public override readonly writeSubtitleMode = jest.fn();
    public override readonly writeToggleSetting = jest.fn();

    override readSubtitleModeAndClean(): SubtitleMode {
        return 'off';
    }

    override readToggleSettingAndClean(id: Parameters<SettingsStore['readToggleSettingAndClean']>[0]): boolean {
        if (id === 'guideCategoryColors') return false;
        return super.readToggleSettingAndClean(id);
    }
}

describe('SettingsScreen deps constructor', () => {
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
        const setTheme = jest.fn();

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
        expect(settingsStore.writeSubtitleMode).toHaveBeenCalledWith('direct');
        expect(onSubtitleModeChange).toHaveBeenCalledWith('direct');

        activateCategory(container, 'appearance');
        const theme = container.querySelector('#settings-theme') as HTMLButtonElement | null;
        theme?.click();
        const emberSteelIndex = THEME_OPTIONS.findIndex((option) => option.theme === 'ember-steel');
        expect(getTheme).toHaveBeenCalled();
        expect(setTheme).toHaveBeenCalledWith(THEME_OPTIONS[emberSteelIndex + 1]?.theme);

        const guideCategoryColors = container.querySelector(
            '#settings-guide-category-colors'
        ) as HTMLButtonElement | null;
        guideCategoryColors?.click();
        expect(settingsStore.writeToggleSetting).toHaveBeenCalledWith('guideCategoryColors', true);
        expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'categoryColors', enabled: true });

        screen.destroy();
    });
});
