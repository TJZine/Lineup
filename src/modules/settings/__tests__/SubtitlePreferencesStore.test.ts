/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { SubtitlePreferencesStore } from '../SubtitlePreferencesStore';

describe('SubtitlePreferencesStore', () => {
    let store: SubtitlePreferencesStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new SubtitlePreferencesStore();
    });

    it('reads/writes subtitle mode and defaults to full when missing', () => {
        expect(store.readSubtitleModeAndClean()).toBe('full');

        store.writeSubtitleMode('direct');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE)).toBe('direct');
        expect(store.readSubtitleModeAndClean()).toBe('direct');
    });

    it('persists subtitle mode off for burn-in policy checks', () => {
        store.writeSubtitleMode('off');
        expect(store.readSubtitleModeAndClean('full')).toBe('off');
    });

    it('normalizes invalid subtitle mode values by removing them', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'weird');

        expect(store.readSubtitleModeAndClean()).toBe('full');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE)).toBeNull();
    });

    it('reads/writes forced-subtitle preference as boolean 1/0', () => {
        store.writeSubtitlePreferForced(true);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED)).toBe('1');
        expect(store.readSubtitlePreferForcedAndClean(false)).toBe(true);

        store.writeSubtitlePreferForced(false);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED)).toBe('0');
        expect(store.readSubtitlePreferForcedAndClean(true)).toBe(false);
    });

    it('reads/writes normalized subtitle language and clears invalid values', () => {
        store.writeSubtitleLanguage(' EN ');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE)).toBe('en');
        expect(store.readSubtitleLanguageAndClean()).toBe('en');

        store.writeSubtitleLanguage(' eng ');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE)).toBe('en');
        expect(store.readSubtitleLanguageAndClean()).toBe('en');

        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE, '   ');
        expect(store.readSubtitleLanguageAndClean()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE)).toBeNull();
    });

    it('reports blocked set and remove mutations without throwing', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(store.writeSubtitleMode('direct')).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writeSubtitlePreferForced(true)).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writeSubtitleLanguage(null)).toEqual({ ok: false, reason: 'unavailable' });
    });
});
