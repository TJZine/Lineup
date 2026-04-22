/**
 * @jest-environment jsdom
 */
import { EPGDebugRuntime } from '../EPGDebugRuntime';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import * as storageHelpers from '../../../../utils/storage';
import { DebugOverridesStore } from '../../../debug/DebugOverridesStore';

describe('EPGDebugRuntime', () => {
    const activeRuntimes: EPGDebugRuntime[] = [];

    const createRuntime = (): EPGDebugRuntime => {
        const runtime = new EPGDebugRuntime();
        activeRuntimes.push(runtime);
        return runtime;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        for (const runtime of activeRuntimes.splice(0)) {
            runtime.destroy();
        }
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('reuses a cached debug flag between rapid append calls', () => {
        const readEpgDebugSpy = jest
            .spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean')
            .mockReturnValue(false);
        const runtime = createRuntime();

        runtime.append('event:one', { ok: true });
        runtime.append('event:two', { ok: true });
        runtime.append('event:three', { ok: true });

        expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('shares one cached debug-flag read across isEnabled and append in same refresh window', () => {
        const readEpgDebugSpy = jest
            .spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean')
            .mockReturnValue(true);
        const runtime = createRuntime();

        expect(runtime.isEnabled()).toBe(true);
        runtime.append('event:cached', { ok: true });

        expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('updates cached debug flag immediately on EPG debug storage events', () => {
        const readEpgDebugSpy = jest
            .spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean')
            .mockReturnValue(false);
        const runtime = createRuntime();

        expect(runtime.isEnabled()).toBe(false);
        expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new StorageEvent('storage', {
            key: LINEUP_STORAGE_KEYS.EPG_DEBUG,
            newValue: '1',
        }));

        expect(runtime.isEnabled()).toBe(true);
        expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new StorageEvent('storage', {
            key: LINEUP_STORAGE_KEYS.EPG_DEBUG,
            newValue: '0',
        }));

        expect(runtime.isEnabled()).toBe(false);
        expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);
        runtime.destroy();
    });

    it('keeps same-tab debug toggles behind bounded refresh when no storage event is fired', () => {
        let debugEnabled = false;
        const readEpgDebugSpy = jest
            .spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean')
            .mockImplementation(() => debugEnabled);
        const nowSpy = jest.spyOn(Date, 'now');
        const runtime = createRuntime();

        try {
            nowSpy.mockReturnValue(2_000);
            expect(runtime.isEnabled()).toBe(false);
            expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);

            debugEnabled = true;
            nowSpy.mockReturnValue(2_400);
            expect(runtime.isEnabled()).toBe(false);
            expect(readEpgDebugSpy).toHaveBeenCalledTimes(1);

            nowSpy.mockReturnValue(2_501);
            expect(runtime.isEnabled()).toBe(true);
            expect(readEpgDebugSpy).toHaveBeenCalledTimes(2);
        } finally {
            nowSpy.mockRestore();
            runtime.destroy();
        }
    });

    it('normalizes non-array stored debug log payloads to an empty list before append', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean').mockReturnValue(true);
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG, '{"bad":true}');
        const runtime = createRuntime();

        runtime.append('event:normalized', { ok: true });
        jest.advanceTimersByTime(300);

        const stored = localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG);
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored as string) as Array<{ event: string }>;
        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.event).toBe('event:normalized');
    });

    it('remains non-throwing when debug log storage write fails', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean').mockReturnValue(true);
        const setSpy = jest.spyOn(storageHelpers, 'safeLocalStorageSet').mockReturnValue(false);
        const runtime = createRuntime();

        expect(() => {
            runtime.append('event:write-fail', { ok: true });
            jest.advanceTimersByTime(300);
        }).not.toThrow();

        expect(setSpy).toHaveBeenCalled();
    });

    it('keeps storage-event wiring fail-open when window listener APIs throw', () => {
        const addSpy = jest.spyOn(window, 'addEventListener').mockImplementation(() => {
            throw new Error('add failed');
        });
        const removeSpy = jest.spyOn(window, 'removeEventListener').mockImplementation(() => {
            throw new Error('remove failed');
        });
        let runtime: EPGDebugRuntime | null = null;

        expect(() => {
            runtime = createRuntime();
            runtime.destroy();
        }).not.toThrow();

        expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('flushes pending entries immediately on destroy and cancels the timer', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean').mockReturnValue(true);
        const setSpy = jest.spyOn(storageHelpers, 'safeLocalStorageSet');
        const runtime = createRuntime();

        runtime.append('event:destroy', { ok: true });
        runtime.destroy();
        jest.advanceTimersByTime(300);

        expect(setSpy).toHaveBeenCalledTimes(1);
        const stored = localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG);
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored as string) as Array<{ event: string }>;
        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.event).toBe('event:destroy');
    });

    it('keeps destroy non-throwing and idempotent after a pending flush', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean').mockReturnValue(true);
        const runtime = createRuntime();

        runtime.append('event:destroy-safe', { ok: true });

        expect(() => {
            runtime.destroy();
            runtime.destroy();
        }).not.toThrow();
    });

    it('falls back to an empty persisted log when entry serialization throws', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean').mockReturnValue(true);
        const runtime = createRuntime();

        const circular: Record<string, unknown> = {};
        circular.self = circular;

        expect(() => {
            runtime.append('event:circular', circular);
            jest.advanceTimersByTime(300);
        }).not.toThrow();

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG)).toBe('[]');
    });

    it('keeps destroy fail-open when the flush path throws unexpectedly', () => {
        jest.spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean').mockReturnValue(true);
        jest.spyOn(storageHelpers, 'safeLocalStorageSet').mockImplementation(() => {
            throw new Error('write exploded');
        });
        const runtime = createRuntime();

        runtime.append('event:flush-throws', { ok: true });

        expect(() => {
            runtime.destroy();
        }).not.toThrow();
    });
});
