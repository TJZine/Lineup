import { TRANSCODE_QUALITY_OPTIONS, getTranscodeQualityOption } from '../../config/transcodeQuality';
import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageGetWithResult,
    safeLocalStorageRemove,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

export type Hdr10FallbackMode = 'off' | 'smart' | 'force';
export type Hdr10FallbackModeValue = 0 | 1 | 2;
export type Hdr10FallbackMutationResult =
    | { ok: true }
    | {
        ok: false;
        reason: 'quota-exceeded' | 'unavailable';
        effectiveValue?: Hdr10FallbackModeValue;
        compensationSucceeded?: boolean;
    };

export class PlaybackSettingsStore {
    readTranscodeCompatEnabledAndClean(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT, fallback);
    }

    writeTranscodeCompatEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT, enabled ? '1' : '0');
    }

    readSmartHdr10FallbackEnabledAndClean(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, fallback);
    }

    writeSmartHdr10FallbackEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, enabled ? '1' : '0');
    }

    readForceHdr10FallbackEnabledAndClean(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, fallback);
    }

    writeForceHdr10FallbackEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, enabled ? '1' : '0');
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

    writeHdr10FallbackModeValue(value: Hdr10FallbackModeValue): Hdr10FallbackMutationResult {
        const priorPair = this._readRawHdrPair();
        if (!priorPair.ok) return priorPair;
        const { smart: priorSmart, force: priorForce } = priorPair;
        const originalEffectiveValue = this._rawPairToModeValue(priorSmart, priorForce);
        const target = this._getHdrWriteTarget(value);

        const firstResult = safeLocalStorageSetWithResult(target.first.key, target.first.value);
        if (!firstResult.ok) {
            return {
                ...firstResult,
                effectiveValue: originalEffectiveValue,
            };
        }

        const secondResult = safeLocalStorageSetWithResult(target.second.key, target.second.value);
        if (secondResult.ok) {
            return { ok: true };
        }

        const priorFirstValue = target.first.key === LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK
            ? priorSmart
            : priorForce;
        const compensation = priorFirstValue === null
            ? safeLocalStorageRemoveWithResult(target.first.key)
            : safeLocalStorageSetWithResult(target.first.key, priorFirstValue);

        return {
            ...secondResult,
            effectiveValue: compensation.ok
                ? originalEffectiveValue
                : this._effectiveValueAfterFailedCompensation(target.first, priorSmart, priorForce),
            compensationSucceeded: compensation.ok,
        };
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

    writeTranscodeQualityValue(
        value: number,
        options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS
    ): SafeLocalStorageMutationResult {
        const option = options[value] ?? options[0];
        if (!option || option.storageValue.length === 0) {
            return safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY);
        }

        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY, option.storageValue);
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

    private _rawPairToModeValue(smart: string | null, force: string | null): Hdr10FallbackModeValue {
        if (force === '1') return 2;
        if (smart === '1') return 1;
        return 0;
    }

    private _readRawHdrPair():
        | { ok: true; smart: string | null; force: string | null }
        | { ok: false; reason: 'unavailable' } {
        const smart = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK);
        if (!smart.ok) return smart;
        const force = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK);
        if (!force.ok) return force;
        return { ok: true, smart: smart.value, force: force.value };
    }

    private _getHdrWriteTarget(value: Hdr10FallbackModeValue): {
        first: { key: string; value: string };
        second: { key: string; value: string };
    } {
        if (value === 2) {
            return {
                first: { key: LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, value: '1' },
                second: { key: LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, value: '0' },
            };
        }
        return {
            first: { key: LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, value: value === 1 ? '1' : '0' },
            second: { key: LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, value: '0' },
        };
    }

    private _effectiveValueAfterFailedCompensation(
        firstWrite: { key: string; value: string },
        priorSmart: string | null,
        priorForce: string | null
    ): Hdr10FallbackModeValue {
        const smart = firstWrite.key === LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK
            ? firstWrite.value
            : priorSmart;
        const force = firstWrite.key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK
            ? firstWrite.value
            : priorForce;
        return this._rawPairToModeValue(smart, force);
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
