import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../../utils/storage';
import { DebugOverridesStore } from '../../debug/DebugOverridesStore';

type EpgDebugEntry = { ts: number; event: string; data: unknown };

const EPG_DEBUG_LOG_STORAGE_KEY = LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG;
const EPG_DEBUG_FLAG_STORAGE_KEY = LINEUP_STORAGE_KEYS.EPG_DEBUG;
const EPG_DEBUG_LOG_MAX_ENTRIES = 200;
const EPG_DEBUG_LOG_FLUSH_DELAY_MS = 250;
const EPG_DEBUG_FLAG_REFRESH_MS = 500;

export interface IEPGDebugRuntime {
    isEnabled(): boolean;
    append(event: string, data: unknown): void;
    destroy(): void;
}

export class EPGDebugRuntime implements IEPGDebugRuntime {
    private readonly _debugOverridesStore: DebugOverridesStore;
    private _entries: EpgDebugEntry[] | null = null;
    private _flushTimer: ReturnType<typeof setTimeout> | null = null;
    private _enabledCache: boolean | null = null;
    private _enabledCacheReadMs = 0;
    private readonly _onStorage = (event: StorageEvent): void => {
        if (event.key !== EPG_DEBUG_FLAG_STORAGE_KEY) {
            return;
        }
        this._enabledCache = event.newValue === '1';
        this._enabledCacheReadMs = Date.now();
    };

    constructor(debugOverridesStore: DebugOverridesStore = new DebugOverridesStore()) {
        this._debugOverridesStore = debugOverridesStore;
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            try {
                window.addEventListener('storage', this._onStorage);
            } catch {
                // ignore
            }
        }
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
            this._enabledCache = this._debugOverridesStore.readEpgDebugEnabledAndClean(false);
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
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            try {
                window.removeEventListener('storage', this._onStorage);
            } catch {
                // ignore
            }
        }
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
        if (this._entries && this._entries.length > 0) {
            try {
                this._flushEntries();
            } catch {
                // ignore
            }
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

    private _flushEntries(): void {
        try {
            const serialized = JSON.stringify(this._entries ?? []);
            safeLocalStorageSet(EPG_DEBUG_LOG_STORAGE_KEY, serialized);
        } catch {
            safeLocalStorageSet(EPG_DEBUG_LOG_STORAGE_KEY, '[]');
        }
    }

    private _scheduleFlush(): void {
        if (this._flushTimer) {
            return;
        }
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null;
            this._flushEntries();
        }, EPG_DEBUG_LOG_FLUSH_DELAY_MS);
    }
}
