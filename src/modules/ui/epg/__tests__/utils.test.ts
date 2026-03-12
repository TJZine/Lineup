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
import * as storageHelpers from '../../../../utils/storage';

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
        jest.useFakeTimers();
        __resetEpgDebugStateForTests();
        localStorage.clear();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
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

    it('normalizes non-array stored debug log payloads to an empty list before append', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG, '{"bad":true}');

        appendEpgDebugLog('event:normalized', { ok: true });
        jest.advanceTimersByTime(300);

        const stored = localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG);
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored as string) as Array<{ event: string }>;
        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.event).toBe('event:normalized');
    });

    it('remains non-throwing when debug log storage write fails', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG, '1');
        const setSpy = jest.spyOn(storageHelpers, 'safeLocalStorageSet').mockReturnValue(false);

        expect(() => {
            appendEpgDebugLog('event:write-fail', { ok: true });
            jest.advanceTimersByTime(300);
        }).not.toThrow();

        expect(setSpy).toHaveBeenCalled();
    });
});
