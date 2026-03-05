import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../../utils/storage';

export class AudioSettingsStore {
    readDtsPassthroughEnabled(): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH, false);
    }

    writeDtsPassthroughEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH, enabled ? '1' : '0');
    }

    readDirectPlayAudioFallbackEnabled(): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, false);
    }

    writeDirectPlayAudioFallbackEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, enabled ? '1' : '0');
    }

    clearDirectPlayAudioFallbackEnabled(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK);
    }

    private _readBooleanKey(key: string, fallback: boolean): boolean {
        const raw = safeLocalStorageGet(key);
        if (raw === '1') return true;
        if (raw === '0') return false;

        if (raw !== null) {
            safeLocalStorageRemove(key);
        }

        return fallback;
    }
}
