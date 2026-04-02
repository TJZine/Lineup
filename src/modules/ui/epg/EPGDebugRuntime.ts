import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../../utils/storage';
import { DebugOverridesStore } from '../../debug/DebugOverridesStore';

type EpgDebugEntry = { ts: number; event: string; data: unknown };

const EPG_DEBUG_LOG_STORAGE_KEY = LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG;
const EPG_DEBUG_LOG_MAX_ENTRIES = 200;
const EPG_DEBUG_LOG_FLUSH_DELAY_MS = 250;
const EPG_DEBUG_FLAG_REFRESH_MS = 500;

export interface IEpgDebugRuntime {
    isEnabled(): boolean;
    append(event: string, data: unknown): void;
    destroy(): void;
}

export class EPGDebugRuntime implements IEpgDebugRuntime {
    private readonly _debugOverridesStore: DebugOverridesStore;
    private _entries: EpgDebugEntry[] | null = null;
    private _flushTimer: ReturnType<typeof setTimeout> | null = null;
    private _enabledCache: boolean | null = null;
    private _enabledCacheReadMs = 0;

    constructor(debugOverridesStore: DebugOverridesStore = new DebugOverridesStore()) {
        this._debugOverridesStore = debugOverridesStore;
    }

    isEnabled(): boolean {
        const now = Date.now();
        if (
            this._enabledCache !== null &&
            now - this._enabledCacheReadMs < EPG_DEBUG_FLAG_REFRESH_MS
        ) {
            return this._enabledCache;
        }
        this._enabledCacheReadMs = now;
        try {
            this._enabledCache = this._debugOverridesStore.readEpgDebugEnabled(false);
        } catch {
            this._enabledCache = false;
        }
        return this._enabledCache;
    }

    append(event: string, data: unknown): void {
        if (!this.isEnabled()) {
            return;
        }
        const entries = this._loadEntries();
        entries.push({ ts: Date.now(), event, data });
        if (entries.length > EPG_DEBUG_LOG_MAX_ENTRIES) {
            entries.splice(0, entries.length - EPG_DEBUG_LOG_MAX_ENTRIES);
        }
        this._scheduleFlush();
    }

    destroy(): void {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
        this._entries = null;
        this._enabledCache = null;
        this._enabledCacheReadMs = 0;
    }

    private _loadEntries(): EpgDebugEntry[] {
        if (this._entries) {
            return this._entries;
        }
        try {
            const raw = safeLocalStorageGet(EPG_DEBUG_LOG_STORAGE_KEY);
            const parsed: unknown = raw ? JSON.parse(raw) : [];
            this._entries = Array.isArray(parsed) ? (parsed as EpgDebugEntry[]) : [];
            return this._entries;
        } catch {
            this._entries = [];
            return this._entries;
        }
    }

    private _scheduleFlush(): void {
        if (this._flushTimer) {
            return;
        }
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null;
            safeLocalStorageSet(EPG_DEBUG_LOG_STORAGE_KEY, JSON.stringify(this._entries ?? []));
        }, EPG_DEBUG_LOG_FLUSH_DELAY_MS);
    }
}
