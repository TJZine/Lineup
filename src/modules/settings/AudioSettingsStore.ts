import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    parseStoredBoolean,
    readStoredBooleanAndClean,
    safeLocalStorageGetWithResult,
    safeLocalStorageRemove,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

export type AudioPreferenceReadResult =
    | { kind: 'stored'; value: boolean }
    | { kind: 'default'; effectiveValue: boolean; reason: 'missing' | 'invalid' }
    | { kind: 'unavailable'; effectiveValue: boolean };

export class AudioSettingsStore {
    readDtsPassthroughState(fallback: boolean = false): AudioPreferenceReadResult {
        return this._readPreferenceState(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH, fallback);
    }

    readDtsPassthroughEnabledAndClean(fallback: boolean = false): boolean {
        return this._effectiveValue(this.readDtsPassthroughState(fallback));
    }

    writeDtsPassthroughEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH, enabled ? '1' : '0');
    }

    readDirectPlayAudioFallbackState(fallback: boolean = false): AudioPreferenceReadResult {
        return this._readPreferenceState(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, fallback);
    }

    readDirectPlayAudioFallbackEnabledAndClean(fallback: boolean = false): boolean {
        return this._effectiveValue(this.readDirectPlayAudioFallbackState(fallback));
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

    private _readPreferenceState(key: string, fallback: boolean): AudioPreferenceReadResult {
        const read = safeLocalStorageGetWithResult(key);
        if (!read.ok) return { kind: 'unavailable', effectiveValue: fallback };
        if (read.value === null) return { kind: 'default', effectiveValue: fallback, reason: 'missing' };

        const value = parseStoredBoolean(read.value);
        if (value !== null) return { kind: 'stored', value };

        safeLocalStorageRemove(key);
        return { kind: 'default', effectiveValue: fallback, reason: 'invalid' };
    }

    private _effectiveValue(result: AudioPreferenceReadResult): boolean {
        return result.kind === 'stored' ? result.value : result.effectiveValue;
    }
}
