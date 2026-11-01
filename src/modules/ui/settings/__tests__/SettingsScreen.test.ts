/** @jest-environment jsdom */

import { SettingsScreen } from '../SettingsScreen';
import { SettingsStore } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS } from '../constants';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import { createNavigationStub, activateCategory } from './settings-screen-test-helpers';
import type { SettingsPersistenceResult } from '../types';
import type { ThemeName } from '../../theme/themeDefinitions';
import { NavigationManager, type INavigationManager, type KeyEvent } from '../../../navigation';

const mounted: HTMLElement[] = [];
const createScreen = (overrides: Partial<ConstructorParameters<typeof SettingsScreen>[0]> = {}): {
    container: HTMLElement;
    nav: ReturnType<typeof createNavigationStub>;
    screen: SettingsScreen;
} => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mounted.push(container);
    const nav = createNavigationStub();
    const screen = new SettingsScreen({
        container,
        getNavigation: (): INavigationManager => nav as unknown as INavigationManager,
        settingsStore: new SettingsStore(),
        getTheme: (): ThemeName => 'ember-steel',
        setTheme: (theme): SettingsPersistenceResult => ({ ok: true, effectiveValue: theme, migration: null }),
        onSwitchServer: jest.fn(),
        onSignOut: jest.fn(async () => {}),
        ...overrides,
    });
    screen.show();
    return { container, nav, screen };
};

const choose = (container: HTMLElement, id: string, index: number): void => {
    const button = container.querySelector<HTMLButtonElement>(`#${id}`);
    if (!button) throw new Error(`Missing ${id}`);
    button.click();
    const option = container.querySelectorAll<HTMLButtonElement>('.settings-dropdown-option')[index];
    if (!option) throw new Error(`Missing option ${index}`);
    option.click();
};

afterEach(() => {
    for (const container of mounted.splice(0)) container.remove();
    document.body.innerHTML = '';
    localStorage.clear();
    jest.restoreAllMocks();
});

it('renders seven categories in approved order, with stable rail and focused detail', () => {
    const { container, nav } = createScreen();
    expect([...container.querySelectorAll('.settings-category-button')].map((button) => button.textContent)).toEqual([
        'Appearance', 'Guide', 'Playback', 'Audio & Subtitles', 'Accessibility', 'Account', 'Support',
    ]);
    expect(container.querySelector('.settings-detail-title')?.textContent).toBe('Appearance');
    expect(container.querySelector('.settings-brand-wordmark')?.textContent).toBe('LINEUP');
    expect(container.querySelector('#settings-back')?.textContent).toContain('Back to Guide');
    expect(nav.focusables.has('settings-back')).toBe(true);
    expect(nav.focusables.has('settings-category-appearance')).toBe(true);
    expect(nav.focusables.has('settings-theme')).toBe(true);
    expect(container.querySelector('#settings-epg-layout-mode')).toBeNull();
    expect(container.querySelector('#settings-cinematic-now-playing')).toBeNull();
});

it('writes Guide hours and keeps a valid migrated wide choice', () => {
    localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
    const { container } = createScreen();
    activateCategory(container, 'guide');
    expect(container.querySelector('#settings-guide-hours .setup-toggle-value')?.textContent).toBe('3 hours');
    choose(container, 'settings-guide-hours', 2);
    expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('4');
    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
});

it('writes source labels and the retained Guide toggles without moving scoped library state', () => {
    const callback = jest.fn();
    const { container } = createScreen({ onGuideSettingChange: callback });
    activateCategory(container, 'guide');
    container.querySelector<HTMLButtonElement>('#settings-epg-source-labels')?.click();
    expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_SOURCE_LABELS_ENABLED)).toBe('1');
    container.querySelector<HTMLButtonElement>('#settings-epg-now-watching')?.click();
    expect(callback).toHaveBeenCalledWith({ key: 'nowWatchingBanner', enabled: false });
});

it('keeps artwork background and overlay transparency separate', () => {
    const overlay = jest.fn();
    const callback = jest.fn();
    const { container } = createScreen({ onOverlayTransparencyChange: overlay, onGuideSettingChange: callback });
    choose(container, 'settings-epg-info-background-mode', 2);
    expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBe('2');
    expect(callback).toHaveBeenCalledWith({ key: 'infoBackgroundMode', mode: 2 });
    choose(container, 'settings-overlay-transparency', 0);
    expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.OVERLAY_TRANSPARENCY)).toBe('more-transparent');
    expect(overlay).toHaveBeenCalledWith('more-transparent');
});

it('renders failed save feedback below the row and keeps the effective value', () => {
    const { container } = createScreen();
    activateCategory(container, 'audio_subtitles');
    const button = container.querySelector<HTMLButtonElement>('#settings-dts-passthrough');
    const storageWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    button?.click();
    expect(button?.getAttribute('aria-checked')).toBe('false');
    const row = button?.parentElement;
    expect(row?.classList.contains('settings-item')).toBe(true);
    expect(row?.querySelector('.settings-save-feedback')?.textContent).toContain('Press OK to retry');
    storageWrite.mockRestore();
    button?.click();
    expect(button?.getAttribute('aria-checked')).toBe('true');
    expect(row?.querySelector('.settings-save-feedback')?.textContent).toBe('');
});

it('keeps DTS and fallback traversable when subtitle mode is Off', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_MODE, 'off');
    const { container, nav } = createScreen();
    activateCategory(container, 'audio_subtitles');
    expect(nav.focusables.has('settings-dts-passthrough')).toBe(true);
    expect(nav.focusables.has('settings-direct-play-audio-fallback')).toBe(true);
    expect(nav.focusables.has('settings-subtitle-mode')).toBe(true);
    expect(nav.focusables.has('settings-subtitle-language')).toBe(false);
    expect(nav.focusables.has('settings-subtitles-prefer-forced')).toBe(false);
    expect(container.querySelector('#settings-subtitle-language .setup-toggle-meta')?.textContent).toBe('Enable Subtitle Mode first.');
});

it('re-registers dependent controls and preserves the invoker after changing subtitle mode', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_MODE, 'off');
    const { container, nav } = createScreen();
    activateCategory(container, 'audio_subtitles');
    choose(container, 'settings-subtitle-mode', 3);
    expect(nav.focusables.has('settings-subtitle-language')).toBe(true);
    expect(nav.focusables.has('settings-subtitles-prefer-forced')).toBe(true);
    expect(nav.getFocusedElement()?.id).toBe('settings-subtitle-mode');
});

it('opens a chooser from D-pad focus, dismisses Back, and restores its anchor without writing', () => {
    const { container, nav } = createScreen();
    activateCategory(container, 'guide');
    nav.setFocus('settings-guide-hours');
    nav.focusables.get('settings-guide-hours')?.onSelect?.();
    expect(container.querySelector('#settings-dropdown')).not.toBeNull();
    const before = localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_HOURS);
    const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
    const backEvent = { handled: false, button: 'back' };
    keyHandler?.(backEvent);
    expect(backEvent.handled).toBe(true);
    expect(container.querySelector('#settings-dropdown')).toBeNull();
    expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe(before);
    expect(nav.getFocusedElement()?.id).toBe('settings-guide-hours');
});

it('traps a pointer-opened chooser in real navigation and restores focus on Back and selection', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const navigation = new NavigationManager();
    navigation.initialize({
        enablePointerMode: true,
        keyRepeatDelayMs: 500,
        keyRepeatIntervalMs: 100,
        focusMemoryEnabled: true,
        debugMode: false,
    });
    navigation.replaceScreen('settings');
    const screen = new SettingsScreen({ container, getNavigation: (): NavigationManager => navigation });
    try {
        screen.show();
        activateCategory(container, 'guide');
        const select = container.querySelector<HTMLButtonElement>('#settings-guide-hours');
        if (!select) throw new Error('Guide Hours select missing');
        select.click();
        expect(select.getAttribute('aria-expanded')).toBe('true');
        expect(navigation.getState().focusedElementId).toBe('settings-dropdown-option-0');
        expect(navigation.moveFocus('up')).toBe(false);
        navigation.setFocus('settings-dropdown-option-2');
        expect(navigation.moveFocus('down')).toBe(false);

        const backEvent: KeyEvent = {
            button: 'back', handled: false, isRepeat: false, isLongPress: false,
            timestamp: Date.now(), originalEvent: new KeyboardEvent('keydown'),
        };
        navigation.emit('keyPress', backEvent);
        expect(backEvent.handled).toBe(true);
        expect(navigation.getState().focusedElementId).toBe(select.id);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBeNull();

        select.click();
        container.querySelector<HTMLButtonElement>('#settings-dropdown-option-1')?.click();
        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect(navigation.getState().focusedElementId).toBe('settings-guide-hours');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('3');
    } finally {
        screen.destroy();
        navigation.destroy();
        container.remove();
    }
});

it('moves between the rail and detail controls without mutating the selected value', () => {
    const { container, nav } = createScreen();
    activateCategory(container, 'guide');
    expect(nav.focusables.get('settings-guide-hours')?.neighbors.left).toBe('settings-category-guide');
    nav.setFocus('settings-guide-hours');
    const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
    keyHandler?.({ handled: false, button: 'left', isRepeat: false, isLongPress: false });
    expect(nav.getFocusedElement()?.id).toBe('settings-category-guide');
    expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBeNull();
    keyHandler?.({ handled: false, button: 'right', isRepeat: false, isLongPress: false });
    expect(nav.getFocusedElement()?.id).toBe('settings-guide-hours');
});

it('restores a valid remembered row when returning to a category', () => {
    const { container, nav } = createScreen();
    activateCategory(container, 'guide');
    nav.setFocus('settings-epg-now-watching');
    activateCategory(container, 'playback');
    activateCategory(container, 'guide');
    nav.focusables.get('settings-category-guide')?.onSelect?.();
    nav.setFocus('settings-category-guide');
    const keyHandler = nav.on.mock.calls.find((call) => call[0] === 'keyPress')?.[1];
    keyHandler?.({ button: 'right', handled: false, isRepeat: false, isLongPress: false, timestamp: Date.now(), originalEvent: new KeyboardEvent('keydown') });
    expect(nav.getFocusedElement()?.id).toBe('settings-epg-now-watching');
});

it('shows visible Account actions and invokes the existing route ports', async () => {
    const profile = jest.fn();
    const server = jest.fn();
    const signOut = jest.fn(async () => {});
    const { container } = createScreen({ onSwitchProfile: profile, onSwitchServer: server, onSignOut: signOut, getActiveUsername: () => 'Alex' });
    activateCategory(container, 'account');
    expect(container.querySelector('.settings-detail-description')?.textContent).toContain('Current profile: Alex');
    container.querySelector<HTMLButtonElement>('#settings-switch-profile')?.click();
    await Promise.resolve();
    container.querySelector<HTMLButtonElement>('#settings-switch-server')?.click();
    await Promise.resolve();
    container.querySelector<HTMLButtonElement>('#settings-sign-out')?.click();
    await Promise.resolve();
    expect(profile).toHaveBeenCalledTimes(1);
    expect(server).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
});

it('runs one Account action at a time and restores the failed sign-out invoker for retry', async () => {
    let rejectSignOut: ((reason: Error) => void) | undefined;
    const pendingSignOut = new Promise<void>((_resolve, reject) => { rejectSignOut = reject; });
    const profile = jest.fn();
    const server = jest.fn();
    const signOut = jest.fn().mockReturnValueOnce(pendingSignOut).mockResolvedValue(undefined);
    const { container, nav } = createScreen({ onSwitchProfile: profile, onSwitchServer: server, onSignOut: signOut });
    activateCategory(container, 'account');
    nav.setFocus('settings-sign-out');
    const signOutButton = container.querySelector<HTMLButtonElement>('#settings-sign-out');
    const profileButton = container.querySelector<HTMLButtonElement>('#settings-switch-profile');
    const serverButton = container.querySelector<HTMLButtonElement>('#settings-switch-server');
    signOutButton?.click();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOutButton?.disabled).toBe(true);
    expect(profileButton?.disabled).toBe(true);
    expect(serverButton?.disabled).toBe(true);
    expect(signOutButton?.getAttribute('aria-disabled')).toBe('true');
    expect(nav.focusables.has('settings-sign-out')).toBe(false);
    expect(signOutButton?.parentElement?.querySelector('.settings-save-feedback')?.textContent).toBe('Working…');
    signOutButton?.click();
    profileButton?.click();
    serverButton?.click();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(profile).not.toHaveBeenCalled();
    expect(server).not.toHaveBeenCalled();

    rejectSignOut?.(new Error('Auth failed'));
    await Promise.resolve();
    expect(signOutButton?.disabled).toBe(false);
    expect(profileButton?.disabled).toBe(false);
    expect(serverButton?.disabled).toBe(false);
    expect(nav.focusables.has('settings-sign-out')).toBe(true);
    expect(nav.getFocusedElement()?.id).toBe('settings-sign-out');
    expect(signOutButton?.parentElement?.querySelector('.settings-save-feedback')?.textContent).toContain('Press OK to retry');

    signOutButton?.click();
    await Promise.resolve();
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(signOutButton?.parentElement?.querySelector('.settings-save-feedback')?.textContent).toBe('');
});

it('does not restore stale Account focus or failure text after leaving its category', async () => {
    let rejectSignOut: ((reason: Error) => void) | undefined;
    const pendingSignOut = new Promise<void>((_resolve, reject) => { rejectSignOut = reject; });
    const { container, nav } = createScreen({ onSignOut: jest.fn(() => pendingSignOut) });
    activateCategory(container, 'account');
    container.querySelector<HTMLButtonElement>('#settings-sign-out')?.click();
    activateCategory(container, 'support');
    rejectSignOut?.(new Error('Auth failed'));
    await Promise.resolve();
    expect(container.querySelector('#settings-sign-out')).toBeNull();
    expect(nav.focusables.has('settings-sign-out')).toBe(false);
    activateCategory(container, 'account');
    const signOutButton = container.querySelector<HTMLButtonElement>('#settings-sign-out');
    expect(signOutButton?.disabled).toBe(false);
    expect(signOutButton?.parentElement?.querySelector('.settings-save-feedback')?.textContent).toBe('');
});

it('does not restore Account focus or failure text after Settings is hidden', async () => {
    let rejectSignOut: ((reason: Error) => void) | undefined;
    const pendingSignOut = new Promise<void>((_resolve, reject) => { rejectSignOut = reject; });
    const { container, nav, screen } = createScreen({ onSignOut: jest.fn(() => pendingSignOut) });
    activateCategory(container, 'account');
    container.querySelector<HTMLButtonElement>('#settings-sign-out')?.click();
    screen.hide();
    rejectSignOut?.(new Error('Auth failed'));
    await Promise.resolve();
    expect(nav.focusables.has('settings-sign-out')).toBe(false);
    screen.show();
    const signOutButton = container.querySelector<HTMLButtonElement>('#settings-sign-out');
    expect(signOutButton?.disabled).toBe(false);
    expect(signOutButton?.parentElement?.querySelector('.settings-save-feedback')?.textContent).toBe('');
});

it('hides obsolete developer category while retaining advanced logging in Support', () => {
    const { container } = createScreen();
    expect(container.querySelector('#settings-category-developer')).toBeNull();
    activateCategory(container, 'support');
    expect(container.querySelector('#settings-debug-logging')).not.toBeNull();
    expect(container.querySelector('#settings-subtitle-debug-logging')).not.toBeNull();
});
