import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

/** Owns local consent for the sanitized Support report, separate from debug logging. */
export class SupportReportPreferencesStore {
    readCollectionEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.SUPPORT_REPORT_OPT_IN, fallback);
    }

    writeCollectionEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        const saved = safeLocalStorageSetWithResult(
            LINEUP_STORAGE_KEYS.SUPPORT_REPORT_OPT_IN,
            enabled ? '1' : '0'
        );
        if (!saved.ok || enabled) return saved;
        // Consent is durable before clearing. A failed clear is reported; reads retry it.
        return safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.SUPPORT_REPORT);
    }
}
