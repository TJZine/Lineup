import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../../utils/storage';
import { DeveloperSettingsStore } from '../settings/DeveloperSettingsStore';

export interface IssueDiagnosticEntry {
    ts: number;
    issue: string;
    event: string;
    data: unknown;
}

const ISSUE_DIAGNOSTICS_MAX_ENTRIES = 250;

export class IssueDiagnosticsStore {
    private readonly _developerSettingsStore = new DeveloperSettingsStore();

    readEntries(): IssueDiagnosticEntry[] {
        try {
            const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG);
            if (!raw) {
                return [];
            }
            const parsed: unknown = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as IssueDiagnosticEntry[]) : [];
        } catch {
            return [];
        }
    }

    append(issue: string, event: string, data: unknown): void {
        if (!this._developerSettingsStore.readDebugLoggingEnabled(false)) {
            return;
        }

        try {
            const entries = this.readEntries();
            entries.push({
                ts: Date.now(),
                issue,
                event,
                data,
            });
            if (entries.length > ISSUE_DIAGNOSTICS_MAX_ENTRIES) {
                entries.splice(0, entries.length - ISSUE_DIAGNOSTICS_MAX_ENTRIES);
            }
            safeLocalStorageSet(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG, JSON.stringify(entries));
        } catch {
            // Diagnostics must stay non-fatal.
        }
    }

    clear(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG);
    }
}
