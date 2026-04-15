/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { ProfileSessionStore } from '../ProfileSessionStore';

describe('ProfileSessionStore', () => {
    let store: ProfileSessionStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new ProfileSessionStore();
    });

    it('reads/writes profile picker and keep-playing flags', () => {
        store.writeShowProfilePickerOnStartup(true);
        store.writeKeepPlayingInSettings(true);

        expect(store.readShowProfilePickerOnStartupAndClean(false)).toBe(true);
        expect(store.readKeepPlayingInSettingsAndClean(false)).toBe(true);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS)).toBe('1');
    });

    it('reads/writes last profile id and removes empty values', () => {
        store.writeLastProfileId(' profile-1 ');
        expect(store.readLastProfileIdAndClean()).toBe('profile-1');

        store.writeLastProfileId(' ');
        expect(store.readLastProfileIdAndClean()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID)).toBeNull();
    });

    it('returns provided boolean fallbacks when storage is empty', () => {
        expect(store.readShowProfilePickerOnStartupAndClean(false)).toBe(false);
        expect(store.readShowProfilePickerOnStartupAndClean(true)).toBe(true);
        expect(store.readKeepPlayingInSettingsAndClean(false)).toBe(false);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS)).toBeNull();
    });

    it('removes blank last profile ids when reading', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID, '   ');

        expect(store.readLastProfileIdAndClean()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID)).toBeNull();
    });
});
