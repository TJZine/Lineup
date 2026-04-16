/**
 * @jest-environment jsdom
 */

import { SettingsScreenStateController } from '../SettingsScreenStateController';
import { SettingsStore } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS } from '../constants';
import type { SettingsSelectConfig, SettingsToggleConfig } from '../types';
import * as ConfigEvents from '../../../../config/events';
import { SubtitlePreferencesStore } from '../../../settings/SubtitlePreferencesStore';
import { THEME_OPTIONS } from '../../theme';

beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
});

it('reads current theme from injected runtime callback and writes via injected setter', () => {
    const setTheme = jest.fn();
    const getTheme = jest.fn((): 'glass' => 'glass');
    const controller = new SettingsScreenStateController({
        settingsStore: new SettingsStore(),
        getTheme,
        setTheme,
    });

    const categories = controller.getCategories();
    const appearanceCategory = categories.find((category) => category.id === 'appearance');
    const themeSelect = appearanceCategory?.items.find((item) => item.id === 'settings-theme');

    if (!themeSelect || !('options' in themeSelect)) {
        throw new Error('Theme item not found');
    }

    expect(themeSelect.value).toBe(THEME_OPTIONS.findIndex((option) => option.theme === 'glass'));
    expect(getTheme).toHaveBeenCalledTimes(1);

    (themeSelect as SettingsSelectConfig).onChange(0);
    expect(setTheme).toHaveBeenCalledWith('ember-steel');
});

it('builds the current settings categories from persisted state', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_MODE, 'off');
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, 'es');
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_PREFER_FORCED, '1');

    const controller = new SettingsScreenStateController({ settingsStore: new SettingsStore() });
    const categories = controller.getCategories();

    expect(categories.map((category) => category.id)).toEqual([
        'audio_subtitles',
        'playback_hdr',
        'appearance',
        'account',
        'developer',
    ]);

    const audioCategory = categories.find((category) => category.id === 'audio_subtitles');
    const subtitleMode = audioCategory?.items.find((item) => item.id === 'settings-subtitle-mode');
    const subtitleLanguage = audioCategory?.items.find((item) => item.id === 'settings-subtitle-language');
    const preferForced = audioCategory?.items.find((item) => item.id === 'settings-subtitles-prefer-forced');

    expect(subtitleMode?.value).toBe(0);
    expect(subtitleLanguage?.value).toBe(2);
    expect(subtitleLanguage?.disabled).toBe(true);
    expect(preferForced?.disabled).toBe(true);
});

it('writes subtitle mode, emits subtitle callback, and invalidates state', () => {
    const onSubtitleModeChange = jest.fn();
    const onStateInvalidated = jest.fn();

    const controller = new SettingsScreenStateController({
        settingsStore: new SettingsStore(),
        onSubtitleModeChange,
        onStateInvalidated,
    });

    const categories = controller.getCategories();
    const audioCategory = categories.find((category) => category.id === 'audio_subtitles');
    const subtitleMode = audioCategory?.items.find((item) => item.id === 'settings-subtitle-mode');

    if (!subtitleMode || !('options' in subtitleMode)) {
        throw new Error('Subtitle mode item not found');
    }

    (subtitleMode as SettingsSelectConfig).onChange(0);

    expect(new SubtitlePreferencesStore().readSubtitleModeAndClean()).toBe('off');
    expect(onSubtitleModeChange).toHaveBeenCalledWith('off');
    expect(onStateInvalidated).toHaveBeenCalledTimes(1);
});

it('writes layout mode and emits the guide layout change', () => {
    const settingsStore = new SettingsStore();
    const writeSpy = jest.spyOn(settingsStore, 'writeEpgLayoutModeValue');
    const onGuideSettingChange = jest.fn();

    const controller = new SettingsScreenStateController({
        settingsStore,
        onGuideSettingChange,
    });

    const categories = controller.getCategories();
    const appearanceCategory = categories.find((category) => category.id === 'appearance');
    const layoutMode = appearanceCategory?.items.find((item) => item.id === 'settings-epg-layout-mode');

    if (!layoutMode || !('options' in layoutMode)) {
        throw new Error('Guide layout item not found');
    }

    (layoutMode as SettingsSelectConfig).onChange(0);

    expect(writeSpy).toHaveBeenCalledWith(0);
    expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'layoutMode', mode: 'overlay' });
});

it('writes debug logging and dispatches the shared debug event', () => {
    const settingsStore = new SettingsStore();
    const writeSpy = jest.spyOn(settingsStore, 'writeToggleSetting');
    const dispatchSpy = jest.spyOn(ConfigEvents, 'dispatchDebugLoggingChanged');

    const controller = new SettingsScreenStateController({ settingsStore });
    const categories = controller.getCategories();
    const developerCategory = categories.find((category) => category.id === 'developer');
    const debugLogging = developerCategory?.items.find((item) => item.id === 'settings-debug-logging');

    if (!debugLogging || 'options' in debugLogging) {
        throw new Error('Debug logging item not found');
    }

    (debugLogging as SettingsToggleConfig).onChange(true);

    expect(writeSpy).toHaveBeenCalledWith('debugLogging', true);
    expect(dispatchSpy).toHaveBeenCalledWith(true);
});
