/**
 * @jest-environment jsdom
 */
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import * as storageHelpers from '../../../utils/storage';
import { IssueDiagnosticsStore } from '../IssueDiagnosticsStore';

describe('IssueDiagnosticsStore', () => {
    let store: IssueDiagnosticsStore;

    beforeEach(() => {
        localStorage.clear();
        store = new IssueDiagnosticsStore();
        jest.restoreAllMocks();
    });

    it('returns an empty list when no entries exist', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '1');

        expect(store.readEntries()).toEqual([]);
    });

    it('returns stored entries when payload is valid', () => {
        const expected = [{ ts: 1, issue: 'QA-003b', event: 'test', data: { ok: true } }];
        localStorage.setItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG, JSON.stringify(expected));

        expect(store.readEntries()).toEqual(expected);
    });

    it('normalizes invalid stored payloads to an empty list before append', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG, '{"bad":true}');

        store.append('QA-003b', 'event:normalized', { ok: true });

        const parsed = JSON.parse(
            localStorage.getItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG) as string
        ) as Array<{ event: string }>;
        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.event).toBe('event:normalized');
    });

    it('truncates stored entries to the maximum size when appending', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '1');
        const maxEntries = 250;
        const existing = Array.from({ length: maxEntries }, (_, index) => ({
            ts: index,
            issue: 'QA-003b',
            event: `event:${index}`,
            data: { index },
        }));
        localStorage.setItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG, JSON.stringify(existing));

        store.append('QA-003b', 'event:new', { ok: true });

        const entries = store.readEntries();
        expect(entries).toHaveLength(maxEntries);
        expect(entries[0]?.event).toBe('event:1');
        expect(entries[entries.length - 1]?.event).toBe('event:new');
    });

    it('does not append when debug logging is disabled', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '0');

        store.append('QA-003b', 'event:disabled', { ok: true });

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG)).toBeNull();
    });

    it('remains non-throwing when storage write fails', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '1');
        jest.spyOn(storageHelpers, 'safeLocalStorageSet').mockReturnValue(false);

        expect(() => {
            store.append('QA-003b', 'event:write-fail', { ok: true });
        }).not.toThrow();
    });
});
