import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

export class AccessibilityPreferencesStore {
    readReduceMotionEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.ACCESSIBILITY_REDUCE_MOTION, fallback);
    }

    writeReduceMotionEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(
            LINEUP_STORAGE_KEYS.ACCESSIBILITY_REDUCE_MOTION,
            enabled ? '1' : '0'
        );
    }

    readLargeFocusEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.ACCESSIBILITY_LARGE_FOCUS, fallback);
    }

    writeLargeFocusEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(
            LINEUP_STORAGE_KEYS.ACCESSIBILITY_LARGE_FOCUS,
            enabled ? '1' : '0'
        );
    }
}
