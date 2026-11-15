/** @jest-environment jsdom */

import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';

import { SettingsScreenStateController } from '../SettingsScreenStateController';
import { SettingsStore } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS } from '../constants';
import type { SettingsSelectConfig, SettingsToggleConfig } from '../types';
import { SUPPORTED_SUBTITLE_LANGUAGES } from '../../../../shared/subtitle-language';

const controller = (options: ConstructorParameters<typeof SettingsScreenStateController>[0] = {}): SettingsScreenStateController =>
    new SettingsScreenStateController({ settingsStore: new SettingsStore(), ...options });

const select = (state: SettingsScreenStateController, categoryId: string, id: string): SettingsSelectConfig => {
    const item = state.getCategories().find((category) => category.id === categoryId)?.items.find((entry) => entry.id === id);
    if (!item || !('options' in item)) throw new Error(`Missing select ${id}`);
    return item;
};

const toggle = (state: SettingsScreenStateController, categoryId: string, id: string): SettingsToggleConfig => {
    const item = state.getCategories().find((category) => category.id === categoryId)?.items.find((entry) => entry.id === id);
    if (!item || !('onChange' in item) || 'options' in item) throw new Error(`Missing toggle ${id}`);
    return item;
};

beforeEach(() => { localStorage.clear(); jest.restoreAllMocks(); });

it('composes seven categories and retires obsolete rows', () => {
    const categories = controller().getCategories();
    expect(categories.map((category) => category.id)).toEqual([
        'appearance', 'guide', 'playback', 'audio_subtitles', 'accessibility', 'account', 'support',
    ]);
    const ids = categories.flatMap((category) => category.items.map((item) => item.id));
    expect(ids).toContain('settings-guide-hours');
    expect(ids).toContain('settings-overlay-transparency');
    expect(ids).toContain('settings-compact-controls-timeout');
    expect(ids).not.toContain('settings-epg-layout-mode');
    expect(ids).not.toContain('settings-cinematic-now-playing');
    expect(ids).not.toContain('settings-now-playing-timeout');
    expect(ids).not.toContain('settings-epg-density');
});

it('offers Manage channels in Guide when the app supplies the route action', () => {
    const onManageChannels = jest.fn();
    const guide = controller({ onManageChannels }).getCategories().find(category => category.id === 'guide');
    const action = guide?.items.find(item => item.id === 'settings-manage-channels');
    if (!action || !('action' in action)) throw new Error('Missing Manage channels action');
    action.action();
    expect(onManageChannels).toHaveBeenCalledTimes(1);
});

it('preserves semantic subtitle language and disables only dependent rows when mode is Off', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_MODE, 'off');
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, 'zz');
    const state = controller();
    const language = select(state, 'audio_subtitles', 'settings-subtitle-language');
    expect(language.value).toBe(SUPPORTED_SUBTITLE_LANGUAGES.length + 1);
    expect(language.options.at(-1)?.label).toBe('Saved preference (zz)');
    expect(language.disabled).toBe(true);
    expect(toggle(state, 'audio_subtitles', 'settings-subtitles-prefer-forced').disabled).toBe(true);
    expect(toggle(state, 'audio_subtitles', 'settings-dts-passthrough').disabled).toBeUndefined();
    expect(toggle(state, 'audio_subtitles', 'settings-direct-play-audio-fallback').disabled).toBeUndefined();
});

it('keeps an unlisted saved subtitle language after a failed save and reopen', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_MODE, 'full');
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, 'zz');
    const state = controller();
    const storageWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const result = select(state, 'audio_subtitles', 'settings-subtitle-language').onChange(2);
    expect(result).toMatchObject({ ok: false, effectiveValue: SUPPORTED_SUBTITLE_LANGUAGES.length + 1 });
    storageWrite.mockRestore();
    expect(select(controller(), 'audio_subtitles', 'settings-subtitle-language').value).toBe(SUPPORTED_SUBTITLE_LANGUAGES.length + 1);
});

it('applies keep-running policy only after a successful saved write', () => {
    const apply = jest.fn();
    const state = controller({ onKeepPlayingInSettingsChange: apply });
    expect(toggle(state, 'playback', 'settings-keep-playing').onChange(true)).toEqual({ ok: true });
    expect(apply).toHaveBeenCalledWith(true);
    const storageWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(toggle(state, 'playback', 'settings-keep-playing').onChange(false).ok).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
    storageWrite.mockRestore();
});

it('returns the effective theme on failure and offers a retry action', () => {
    const retry = jest.fn(() => ({ ok: true as const, effectiveValue: 'ember-steel' as const, migration: null }));
    const state = controller({
        getTheme: () => 'ember-steel',
        getThemePersistenceResult: () => ({ ok: false, effectiveValue: 'ember-steel', migration: 'glass-to-ember-steel', reason: 'unavailable', retryable: true }),
        setTheme: () => ({ ok: false, effectiveValue: 'ember-steel', migration: 'glass-to-ember-steel', reason: 'unavailable', retryable: true }),
        retryThemePersistence: retry,
    });
    const result = select(state, 'appearance', 'settings-theme').onChange(1);
    expect(result).toMatchObject({ ok: false, effectiveValue: 0 });
    const retryRow = state.getCategories()[0]?.items.find((item) => item.id === 'settings-theme-retry');
    if (!retryRow || !('action' in retryRow)) throw new Error('Missing retry action');
    retryRow.action();
    expect(retry).toHaveBeenCalledTimes(1);
});

it('keeps runtime overlay and accessibility attributes at saved values after failures', () => {
    const overlay = jest.fn();
    const accessibility = jest.fn();
    const state = controller({ onOverlayTransparencyChange: overlay, onAccessibilityChange: accessibility });
    const storageWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(select(state, 'appearance', 'settings-overlay-transparency').onChange(0).ok).toBe(false);
    expect(toggle(state, 'accessibility', 'settings-large-focus').onChange(true).ok).toBe(false);
    expect(overlay).not.toHaveBeenCalled();
    expect(accessibility).not.toHaveBeenCalled();
    storageWrite.mockRestore();
    expect(select(state, 'appearance', 'settings-overlay-transparency').onChange(0)).toEqual({ ok: true });
    expect(toggle(state, 'accessibility', 'settings-large-focus').onChange(true)).toEqual({ ok: true });
    expect(overlay).toHaveBeenCalledWith('more-transparent');
    expect(accessibility).toHaveBeenCalledWith('largeFocus', true);
});

it('shows guide migration failure without claiming four-hour behavior on old density', () => {
    localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
    expect(select(controller(), 'guide', 'settings-guide-hours').value).toBe(1);
});

it('offers retry for a failed Guide Hours migration when the effective value is already selected', () => {
    localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
    const storageWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    const state = controller();
    const retryRow = state.getCategories().find((category) => category.id === 'guide')?.items.find((item) => item.id === 'settings-guide-hours-retry');
    if (!retryRow || !('action' in retryRow)) throw new Error('Missing migration retry');
    expect(select(state, 'guide', 'settings-guide-hours').value).toBe(1);
    storageWrite.mockRestore();
    retryRow.action();
    expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('3');
    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
});

it('publishes Guide hours and source labels only after successful persistence', () => {
    const onGuideSettingChange = jest.fn();
    const state = controller({ onGuideSettingChange });
    const hours = select(state, 'guide', 'settings-guide-hours');
    const labels = toggle(state, 'guide', 'settings-epg-source-labels');

    const blockedWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
    });
    expect(hours.onChange(2).ok).toBe(false);
    expect(labels.onChange(true).ok).toBe(false);
    expect(onGuideSettingChange).not.toHaveBeenCalled();

    blockedWrite.mockRestore();
    expect(hours.onChange(2)).toEqual({ ok: true });
    expect(labels.onChange(true)).toEqual({ ok: true });
    expect(onGuideSettingChange).toHaveBeenNthCalledWith(1, { key: 'guideHours', hours: 4 });
    expect(onGuideSettingChange).toHaveBeenNthCalledWith(2, { key: 'sourceLabels', enabled: true });
});

it('a retained migration retry preserves a newer saved Guide range', () => {
    localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
    const blockedWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
    });
    const onGuideSettingChange = jest.fn();
    const state = controller({ onGuideSettingChange });
    const items = state.getCategories().find(category => category.id === 'guide')?.items;
    const retry = items?.find(item => item.id === 'settings-guide-hours-retry');
    const hours = items?.find(item => item.id === 'settings-guide-hours');
    if (!retry || !('action' in retry) || !hours || !('options' in hours)) {
        throw new Error('Missing Guide migration controls');
    }
    blockedWrite.mockRestore();
    expect(hours.onChange(2)).toEqual({ ok: true });
    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('4');

    retry.action();

    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('4');
    expect(onGuideSettingChange).toHaveBeenLastCalledWith({ key: 'guideHours', hours: 4 });
});

it('does not overwrite an unreadable Guide preference with the displayed default on retry', () => {
    localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS, '4');
    const nativeGet = Storage.prototype.getItem;
    const blockedRead = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
        this: Storage, key: string
    ): string | null {
        if (key === LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS) throw new DOMException('blocked', 'SecurityError');
        return nativeGet.call(this, key);
    });
    const onGuideSettingChange = jest.fn();
    const state = controller({ onGuideSettingChange });
    const retry = state.getCategories().find(category => category.id === 'guide')?.items
        .find(item => item.id === 'settings-guide-hours-retry');
    if (!retry || !('action' in retry)) throw new Error('Missing Guide migration retry');
    const write = jest.spyOn(Storage.prototype, 'setItem');

    expect(() => retry.action()).toThrow();
    expect(write).not.toHaveBeenCalled();
    expect(onGuideSettingChange).not.toHaveBeenCalled();
    blockedRead.mockRestore();
    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('4');
});
