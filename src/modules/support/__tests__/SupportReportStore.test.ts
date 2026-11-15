/** @jest-environment jsdom */
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { SupportReportPreferencesStore } from '../../settings/SupportReportPreferencesStore';
import { SupportReportStore } from '../SupportReportStore';

const sample = { code: 'restore', at: 1_790_000_000_000, outcome: 'failed' };
const canary = 'plex.tv/library/SecretTitle?X-Plex-Token=secret-pin';

beforeEach(() => { localStorage.clear(); jest.restoreAllMocks(); });

it('defaults off and never reads the raw developer diagnostics namespace', () => {
    localStorage.setItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG, canary);
    const store = new SupportReportStore();
    expect(store.record(sample)).toEqual({ ok: false, reason: 'collection-off' });
    expect(store.read()).toMatchObject({ ok: true, count: 0 });
    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG)).toBe(canary);
});

it('rejects arbitrary nested payloads and serialized reports contain only allowlisted fields', () => {
    const prefs = new SupportReportPreferencesStore();
    const store = new SupportReportStore(prefs);
    expect(prefs.writeCollectionEnabled(true)).toEqual({ ok: true });
    expect(store.record({ ...sample, error: { url: canary, title: canary } })).toEqual({ ok: false, reason: 'invalid-event' });
    expect(store.record({ ...sample, code: canary })).toEqual({ ok: false, reason: 'invalid-event' });
    expect(store.record({ ...sample, get outcome() { throw new Error(canary); } })).toEqual({ ok: false, reason: 'invalid-event' });
    expect(store.record(sample)).toEqual({ ok: true });
    const reopened = new SupportReportStore();
    const result = reopened.read();
    expect(result).toMatchObject({ ok: true, count: 1 });
    if (result.ok) expect(result.report).not.toContain(canary);
});

it('bounds entries, fails closed on corruption and future schemas, and can clear/recover', () => {
    const prefs = new SupportReportPreferencesStore();
    const store = new SupportReportStore(prefs);
    prefs.writeCollectionEnabled(true);
    for (let i = 0; i < 45; i++) expect(store.record({ ...sample, at: sample.at + i })).toEqual({ ok: true });
    expect(store.read()).toMatchObject({ ok: true, count: 40 });
    localStorage.setItem(LINEUP_STORAGE_KEYS.SUPPORT_REPORT, JSON.stringify({ version: 2, events: [sample] }));
    expect(store.read()).toMatchObject({ ok: false, reason: 'invalid-data' });
    expect(store.record(sample)).toEqual({ ok: false, reason: 'invalid-data' });
    expect(store.clear()).toEqual({ ok: true });
    expect(store.record(sample)).toEqual({ ok: true });
    localStorage.setItem(LINEUP_STORAGE_KEYS.SUPPORT_REPORT, JSON.stringify({
        version: 1, events: [{ ...sample, context: { url: canary } }],
    }));
    expect(store.read()).toMatchObject({ ok: false, reason: 'invalid-data', report: '' });
    localStorage.setItem(LINEUP_STORAGE_KEYS.SUPPORT_REPORT, 'x'.repeat(8193));
    expect(store.read()).toMatchObject({ ok: false, reason: 'invalid-data' });
    expect(store.clear()).toEqual({ ok: true });
    expect(store.record(sample)).toEqual({ ok: true });
});

it('persists off before clear, stops collection, reports failed cleanup and retries it on read', () => {
    const prefs = new SupportReportPreferencesStore();
    const store = new SupportReportStore(prefs);
    prefs.writeCollectionEnabled(true);
    store.record(sample);
    const remove = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(prefs.writeCollectionEnabled(false)).toEqual({ ok: false, reason: 'unavailable' });
    expect(prefs.readCollectionEnabledAndClean()).toBe(false);
    expect(store.record(sample)).toEqual({ ok: false, reason: 'collection-off' });
    expect(store.read()).toMatchObject({ ok: false, reason: 'storage-unavailable' });
    remove.mockRestore();
    expect(new SupportReportStore().read()).toMatchObject({ ok: true, count: 0 });
    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUPPORT_REPORT)).toBeNull();
});

it('keeps actual consent on a failed preference write and reports quota failure', () => {
    const prefs = new SupportReportPreferencesStore();
    const store = new SupportReportStore(prefs);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(prefs.writeCollectionEnabled(true)).toEqual({ ok: false, reason: 'quota-exceeded' });
    expect(store.record(sample)).toEqual({ ok: false, reason: 'collection-off' });
});

it('reports blocked reads and report-write quota without exposing stored data', () => {
    const prefs = new SupportReportPreferencesStore();
    const store = new SupportReportStore(prefs);
    prefs.writeCollectionEnabled(true);
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
        if (key === LINEUP_STORAGE_KEYS.SUPPORT_REPORT) throw new DOMException('blocked', 'SecurityError');
        return key === LINEUP_STORAGE_KEYS.SUPPORT_REPORT_OPT_IN ? '1' : null;
    });
    expect(store.read()).toMatchObject({ ok: false, reason: 'storage-unavailable', report: '' });
    get.mockRestore();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(store.record(sample)).toEqual({ ok: false, reason: 'quota-exceeded' });
});
