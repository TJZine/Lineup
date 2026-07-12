import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageRemove,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

export class AudioSettingsStore {
    readDtsPassthroughEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH, fallback);
    }

    writeDtsPassthroughEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH, enabled ? '1' : '0');
    }

    readDirectPlayAudioFallbackEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, fallback);
    }

    writeDirectPlayAudioFallbackEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, enabled ? '1' : '0');
    }

    readAudioSetupCompleteAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE, fallback);
    }

    writeAudioSetupComplete(completed: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE, completed ? '1' : '0');
    }

    clearDirectPlayAudioFallbackEnabled(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK);
    }
}
