/**
 * @jest-environment jsdom
 */
import { EPGDebugRuntime } from '../EPGDebugRuntime';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import * as storageHelpers from '../../../../utils/storage';
import { DebugOverridesStore } from '../../../debug/DebugOverridesStore';

describe('EPGDebugRuntime', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('reuses a cached debug flag between rapid append calls', () => {
        const readEpgDebugSpy = jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabled').mockReturnValue(false);
        const runtime = new EPGDebugRuntime();

        runtime.append('event:one', { ok: true });
        runtime.append('event:two', { ok: true });
        runtime.append('event:three', { ok: true });

        expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('shares one cached debug-flag read across isEnabled and append in same refresh window', () => {
        const readEpgDebugSpy = jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabled').mockReturnValue(true);
        const runtime = new EPGDebugRuntime();

        expect(runtime.isEnabled()).toBe(true);
        runtime.append('event:cached', { ok: true });

        expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('normalizes non-array stored debug log payloads to an empty list before append', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabled').mockReturnValue(true);
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG, '{"bad":true}');
        const runtime = new EPGDebugRuntime();

        runtime.append('event:normalized', { ok: true });
        jest.advanceTimersByTime(300);

        const stored = localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG);
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored as string) as Array<{ event: string }>;
        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.event).toBe('event:normalized');
    });

    it('remains non-throwing when debug log storage write fails', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabled').mockReturnValue(true);
        const setSpy = jest.spyOn(storageHelpers, 'safeLocalStorageSet').mockReturnValue(false);
        const runtime = new EPGDebugRuntime();

        expect(() => {
            runtime.append('event:write-fail', { ok: true });
            jest.advanceTimersByTime(300);
        }).not.toThrow();

        expect(setSpy).toHaveBeenCalled();
    });

    it('clears pending flush timer on destroy', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabled').mockReturnValue(true);
        const setSpy = jest.spyOn(storageHelpers, 'safeLocalStorageSet');
        const runtime = new EPGDebugRuntime();

        runtime.append('event:destroy', { ok: true });
        runtime.destroy();
        jest.advanceTimersByTime(300);

        expect(setSpy).not.toHaveBeenCalled();
    });
});
