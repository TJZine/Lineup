import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { installMockLocalStorage, mockLocalStorage } from '../../../__tests__/mocks/localStorage';
import { DeveloperSettingsStore } from '../DeveloperSettingsStore';

installMockLocalStorage();

describe('DeveloperSettingsStore', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
    });

    it('reads debug logging default when missing', () => {
        mockLocalStorage.removeItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);
        const store = new DeveloperSettingsStore();
        expect(store.readDebugLoggingEnabledAndClean(false)).toBe(false);
        expect(store.readDebugLoggingEnabledAndClean(true)).toBe(true);
    });

    it('reads debug logging true/false', () => {
        const store = new DeveloperSettingsStore();
        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '1');
        expect(store.readDebugLoggingEnabledAndClean(false)).toBe(true);
        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '0');
        expect(store.readDebugLoggingEnabledAndClean(true)).toBe(false);
    });

    it('writes debug logging true/false', () => {
        const store = new DeveloperSettingsStore();
        store.writeDebugLoggingEnabled(true);
        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING)).toBe('1');
        store.writeDebugLoggingEnabled(false);
        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING)).toBe('0');
    });

    it('clears persisted debug logging value', () => {
        const store = new DeveloperSettingsStore();
        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '1');

        store.clearDebugLoggingEnabled();

        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING)).toBe(null);
    });

    it('normalizes invalid debug logging values', () => {
        const store = new DeveloperSettingsStore();
        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, 'true');
        expect(store.readDebugLoggingEnabledAndClean(false)).toBe(false);
        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING)).toBe(null);
    });

    it('detects whether debug logging is configured', () => {
        const store = new DeveloperSettingsStore();

        mockLocalStorage.removeItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);
        expect(store.hasDebugLoggingEnabledValue()).toBe(false);

        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '0');
        expect(store.hasDebugLoggingEnabledValue()).toBe(true);

        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, 'true');
        expect(store.hasDebugLoggingEnabledValue()).toBe(false);
        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING)).toBe(null);
    });

    it('reads subtitle debug logging default when missing', () => {
        mockLocalStorage.removeItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING);
        const store = new DeveloperSettingsStore();
        expect(store.readSubtitleDebugLoggingEnabledAndClean(false)).toBe(false);
        expect(store.readSubtitleDebugLoggingEnabledAndClean(true)).toBe(true);
    });

    it('reads subtitle debug logging true/false', () => {
        const store = new DeveloperSettingsStore();
        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, '1');
        expect(store.readSubtitleDebugLoggingEnabledAndClean(false)).toBe(true);
        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, '0');
        expect(store.readSubtitleDebugLoggingEnabledAndClean(true)).toBe(false);
    });

    it('writes subtitle debug logging true/false', () => {
        const store = new DeveloperSettingsStore();
        store.writeSubtitleDebugLoggingEnabled(true);
        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING)).toBe('1');
        store.writeSubtitleDebugLoggingEnabled(false);
        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING)).toBe('0');
    });

    it('clears persisted subtitle debug logging value', () => {
        const store = new DeveloperSettingsStore();
        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, '1');

        store.clearSubtitleDebugLoggingEnabled();

        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING)).toBe(null);
    });

    it('normalizes invalid subtitle debug logging values', () => {
        const store = new DeveloperSettingsStore();
        mockLocalStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, 'yes');
        expect(store.readSubtitleDebugLoggingEnabledAndClean(false)).toBe(false);
        expect(mockLocalStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING)).toBe(null);
    });

    it('keeps debug toggle clear operations non-fatal when storage is blocked', () => {
        const store = new DeveloperSettingsStore();
        const removeSpy = jest.spyOn(mockLocalStorage, 'removeItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        try {
            expect(() => store.clearDebugLoggingEnabled()).not.toThrow();
            expect(() => store.clearSubtitleDebugLoggingEnabled()).not.toThrow();
        } finally {
            removeSpy.mockRestore();
        }
    });

    it('keeps debug toggle reads/writes non-fatal when storage is blocked', () => {
        const store = new DeveloperSettingsStore();
        const getSpy = jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const setSpy = jest.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        try {
            expect(() => store.readDebugLoggingEnabledAndClean(false)).not.toThrow();
            expect(() => store.readSubtitleDebugLoggingEnabledAndClean(false)).not.toThrow();
            expect(() => store.writeDebugLoggingEnabled(true)).not.toThrow();
            expect(() => store.writeSubtitleDebugLoggingEnabled(true)).not.toThrow();
        } finally {
            getSpy.mockRestore();
            setSpy.mockRestore();
        }
    });
});
