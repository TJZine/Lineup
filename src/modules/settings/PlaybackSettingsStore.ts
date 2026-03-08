import { TRANSCODE_QUALITY_OPTIONS, getTranscodeQualityOption } from '../../config/transcodeQuality';
import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../utils/storage';

export class PlaybackSettingsStore {
    readTranscodeCompatEnabled(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT, fallback);
    }

    writeTranscodeCompatEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT, enabled ? '1' : '0');
    }

    readSmartHdr10FallbackEnabled(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, fallback);
    }

    writeSmartHdr10FallbackEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, enabled ? '1' : '0');
    }

    readForceHdr10FallbackEnabled(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, fallback);
    }

    writeForceHdr10FallbackEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, enabled ? '1' : '0');
    }

    readHdr10FallbackMode(): 'off' | 'smart' | 'force' {
        const force = this.readForceHdr10FallbackEnabled(false);
        if (force) return 'force';

        const smart = this.readSmartHdr10FallbackEnabled(false);
        if (smart) return 'smart';

        return 'off';
    }

    readTranscodeQualityOption(): ReturnType<typeof getTranscodeQualityOption> {
        const { option } = this._readNormalizedTranscodeQualityOption();
        return option;
    }

    readTranscodeQualityValue(options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS): number {
        const { rawValue, option: storedOption } = this._readNormalizedTranscodeQualityOption();
        if (!storedOption) {
            return 0;
        }

        const index = options.findIndex((option) => option.storageValue === storedOption.storageValue);
        if (index >= 0) {
            return index;
        }

        if (rawValue) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY);
        }

        return 0;
    }

    writeTranscodeQualityValue(value: number, options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS): void {
        const option = options[value] ?? options[0];
        if (!option || option.storageValue.length === 0) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY);
            return;
        }

        safeLocalStorageSet(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY, option.storageValue);
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

    private _readNormalizedTranscodeQualityOption(): {
        rawValue: string | null;
        option: ReturnType<typeof getTranscodeQualityOption>;
    } {
        const rawValue = safeLocalStorageGet(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY);
        const option = getTranscodeQualityOption(rawValue);

        if (option === null && rawValue !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY);
            return { rawValue, option: null };
        }

        return { rawValue, option };
    }
}
