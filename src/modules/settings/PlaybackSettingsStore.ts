import { TRANSCODE_QUALITY_OPTIONS, getTranscodeQualityOption } from '../../config/transcodeQuality';
import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../utils/storage';

export type Hdr10FallbackMode = 'off' | 'smart' | 'force';
export type Hdr10FallbackModeValue = 0 | 1 | 2;

export class PlaybackSettingsStore {
    readTranscodeCompatEnabledAndClean(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT, fallback);
    }

    writeTranscodeCompatEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT, enabled ? '1' : '0');
    }

    readSmartHdr10FallbackEnabledAndClean(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, fallback);
    }

    writeSmartHdr10FallbackEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, enabled ? '1' : '0');
    }

    readForceHdr10FallbackEnabledAndClean(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, fallback);
    }

    writeForceHdr10FallbackEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, enabled ? '1' : '0');
    }

    readHdr10FallbackModeAndClean(): Hdr10FallbackMode {
        const force = this.readForceHdr10FallbackEnabledAndClean(false);
        if (force) return 'force';

        const smart = this.readSmartHdr10FallbackEnabledAndClean(false);
        if (smart) return 'smart';

        return 'off';
    }

    readHdr10FallbackModeValueAndClean(): Hdr10FallbackModeValue {
        return this._modeToValue(this.readHdr10FallbackModeAndClean());
    }

    writeHdr10FallbackModeValue(value: Hdr10FallbackModeValue): void {
        switch (value) {
            case 1:
                this.writeSmartHdr10FallbackEnabled(true);
                this.writeForceHdr10FallbackEnabled(false);
                return;
            case 2:
                this.writeSmartHdr10FallbackEnabled(false);
                this.writeForceHdr10FallbackEnabled(true);
                return;
            case 0:
            default:
                this.writeSmartHdr10FallbackEnabled(false);
                this.writeForceHdr10FallbackEnabled(false);
        }
    }

    readTranscodeQualityOptionAndClean(): ReturnType<typeof getTranscodeQualityOption> {
        const { option } = this._readNormalizedTranscodeQualityOption();
        return option;
    }

    readTranscodeQualityValueAndClean(options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS): number {
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
        return readStoredBooleanAndClean(key, fallback);
    }

    private _modeToValue(mode: Hdr10FallbackMode): Hdr10FallbackModeValue {
        switch (mode) {
            case 'force':
                return 2;
            case 'smart':
                return 1;
            case 'off':
            default:
                return 0;
        }
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
