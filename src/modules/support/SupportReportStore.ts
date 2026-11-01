import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    safeLocalStorageGetWithResult,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';
import { SupportReportPreferencesStore } from '../settings/SupportReportPreferencesStore';

const CODES = ['app-start', 'restore', 'guide-load', 'playback-start', 'playback-stop', 'server-switch'] as const;
const OUTCOMES = ['started', 'succeeded', 'failed', 'cancelled'] as const;
const MAX_ENTRIES = 40;
const MAX_BYTES = 8192;

export type SupportEventCode = typeof CODES[number];
export type SupportEventOutcome = typeof OUTCOMES[number];
export interface SupportEvent {
    code: SupportEventCode;
    at: number;
    outcome: SupportEventOutcome;
}

interface StoredReport {
    version: 1;
    events: SupportEvent[];
}

export type SupportReportReadResult =
    | { ok: true; report: string; count: number }
    | { ok: false; reason: 'storage-unavailable' | 'invalid-data'; report: string; count: 0 };

export type SupportRecordResult =
    | { ok: true }
    | { ok: false; reason: 'collection-off' | 'invalid-event' | 'invalid-data' | 'quota-exceeded' | 'unavailable' };

function isSupportEvent(value: unknown): value is SupportEvent {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    try {
        const keys = Object.keys(value);
        if (keys.length !== 3 || !keys.includes('code') || !keys.includes('at') || !keys.includes('outcome')) return false;
        const item = value as { code?: unknown; at?: unknown; outcome?: unknown };
        return CODES.some((code) => code === item.code)
            && typeof item.at === 'number' && Number.isSafeInteger(item.at)
            && item.at >= 0 && item.at <= 8_640_000_000_000_000
            && OUTCOMES.some((outcome) => outcome === item.outcome);
    } catch {
        return false;
    }
}

function parseReport(raw: string | null): StoredReport | null {
    if (raw === null) return { version: 1, events: [] };
    if (raw.length > MAX_BYTES) return null;
    try {
        const value: unknown = JSON.parse(raw);
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
        const keys = Object.keys(value);
        if (keys.length !== 2 || !keys.includes('version') || !keys.includes('events')) return null;
        const candidate = value as { version?: unknown; events?: unknown };
        if (candidate.version !== 1 || !Array.isArray(candidate.events)
            || candidate.events.length > MAX_ENTRIES || !candidate.events.every(isSupportEvent)) return null;
        return { version: 1, events: candidate.events.map((event) => ({
            code: event.code, at: event.at, outcome: event.outcome,
        })) };
    } catch {
        return null;
    }
}

/** The only owner of the public, sanitized Support report namespace. */
export class SupportReportStore {
    constructor(private readonly preferences = new SupportReportPreferencesStore()) {}

    public clear(): SafeLocalStorageMutationResult {
        return safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.SUPPORT_REPORT);
    }

    public read(): SupportReportReadResult {
        if (!this.preferences.readCollectionEnabledAndClean()) {
            const cleanup = this.clear();
            if (!cleanup.ok) return { ok: false, reason: 'storage-unavailable', report: '', count: 0 };
            return { ok: true, report: this.serialize({ version: 1, events: [] }), count: 0 };
        }
        const stored = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.SUPPORT_REPORT);
        if (!stored.ok) return { ok: false, reason: 'storage-unavailable', report: '', count: 0 };
        const parsed = parseReport(stored.value);
        if (!parsed) return { ok: false, reason: 'invalid-data', report: '', count: 0 };
        return { ok: true, report: this.serialize(parsed), count: parsed.events.length };
    }

    public record(input: unknown): SupportRecordResult {
        if (!this.preferences.readCollectionEnabledAndClean()) return { ok: false, reason: 'collection-off' };
        if (!isSupportEvent(input)) return { ok: false, reason: 'invalid-event' };
        let event: SupportEvent;
        try {
            event = { code: input.code, at: input.at, outcome: input.outcome };
        } catch {
            return { ok: false, reason: 'invalid-event' };
        }
        if (!isSupportEvent(event)) return { ok: false, reason: 'invalid-event' };
        const stored = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.SUPPORT_REPORT);
        if (!stored.ok) return { ok: false, reason: 'unavailable' };
        const parsed = parseReport(stored.value);
        if (!parsed) return { ok: false, reason: 'invalid-data' };
        const events = [...parsed.events, event];
        while (events.length > MAX_ENTRIES || this.serialize({ version: 1, events }).length > MAX_BYTES) events.shift();
        const result = safeLocalStorageSetWithResult(
            LINEUP_STORAGE_KEYS.SUPPORT_REPORT,
            JSON.stringify({ version: 1, events })
        );
        return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    }

    private serialize(report: StoredReport): string {
        // Reproject even validated stored objects at the final text boundary.
        const safeEvents = report.events.filter(isSupportEvent).slice(-MAX_ENTRIES)
            .map(({ code, at, outcome }) => ({ code, at, outcome }));
        return JSON.stringify({
            app: 'Lineup', version: '1.0.0', platform: 'webOS TV',
            events: safeEvents,
        }, null, 2);
    }
}
