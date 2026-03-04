/**
 * @jest-environment jsdom
 */
import {
    __resetEpgDebugStateForTests,
    appendEpgDebugLog,
    formatCellTimeLabel,
    isEpgDebugLoggingEnabled,
} from '../utils';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';

describe('formatCellTimeLabel', () => {
    it('returns full range when forceFull is true', () => {
        expect(formatCellTimeLabel(1700000000000, 1700003600000, { compact: true, forceFull: true }))
            .toContain(' - ');
    });

    it('returns start time only when compact is true and forceFull is false', () => {
        expect(formatCellTimeLabel(1700000000000, 1700003600000, { compact: true, forceFull: false }))
            .toMatch(/^\d{1,2}:\d{2}$/);
    });

    it('returns full range when compact is false and forceFull is false', () => {
        expect(formatCellTimeLabel(1700000000000, 1700003600000, { compact: false, forceFull: false }))
            .toContain(' - ');
    });
});

describe('appendEpgDebugLog', () => {
    beforeEach(() => {
        __resetEpgDebugStateForTests();
        localStorage.clear();
        jest.restoreAllMocks();
    });

    it('reuses a cached debug flag between rapid calls', () => {
        const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG, '0');

        appendEpgDebugLog('event:one', { ok: true });
        appendEpgDebugLog('event:two', { ok: true });
        appendEpgDebugLog('event:three', { ok: true });

        const debugReads = getItemSpy.mock.calls
            .map(([key]) => key)
            .filter((key) => key === LINEUP_STORAGE_KEYS.EPG_DEBUG).length;
        expect(debugReads).toBe(1);
    });

    it('shares one cached debug-flag read across helper and append calls in same refresh window', () => {
        const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG, '1');

        expect(isEpgDebugLoggingEnabled()).toBe(true);
        appendEpgDebugLog('event:cached', { ok: true });

        const debugReads = getItemSpy.mock.calls
            .map(([key]) => key)
            .filter((key) => key === LINEUP_STORAGE_KEYS.EPG_DEBUG).length;

        expect(debugReads).toBe(1);
    });
});
