import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

export const OVERLAY_TRANSPARENCY_OPTIONS = ['more-transparent', 'standard', 'reduced'] as const;
export type OverlayTransparency = (typeof OVERLAY_TRANSPARENCY_OPTIONS)[number];
export const DEFAULT_OVERLAY_TRANSPARENCY: OverlayTransparency = 'standard';

export const COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS = [2, 4, 6, 8, 10, 15] as const;
export type CompactControlsTimeoutSeconds = (typeof COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS)[number];
export const DEFAULT_COMPACT_CONTROLS_TIMEOUT_SECONDS: CompactControlsTimeoutSeconds = 4;

export class NowPlayingDisplayStore {
    readCinematicNowPlayingEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.CINEMATIC_NOW_PLAYING, fallback);
    }

    writeCinematicNowPlayingEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.CINEMATIC_NOW_PLAYING, enabled ? '1' : '0');
    }

    readPreferClearLogosEnabledAndClean(fallback: boolean = true): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, fallback);
    }

    writePreferClearLogosEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, enabled ? '1' : '0');
    }

    readOverlayTransparencyAndClean(fallback: OverlayTransparency = DEFAULT_OVERLAY_TRANSPARENCY): OverlayTransparency {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.OVERLAY_TRANSPARENCY);
        const stored = OVERLAY_TRANSPARENCY_OPTIONS.find((option) => option === raw);
        if (stored) return stored;
        if (raw !== null) safeLocalStorageRemove(LINEUP_STORAGE_KEYS.OVERLAY_TRANSPARENCY);
        return fallback;
    }

    writeOverlayTransparency(
        value: OverlayTransparency
    ): SafeLocalStorageMutationResult | { ok: false; reason: 'invalid-value' } {
        if (!OVERLAY_TRANSPARENCY_OPTIONS.some((option) => option === value)) {
            return { ok: false, reason: 'invalid-value' };
        }
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.OVERLAY_TRANSPARENCY, value);
    }

    readCompactControlsTimeoutSecondsAndClean(): CompactControlsTimeoutSeconds {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.COMPACT_CONTROLS_TIMEOUT_SECONDS);
        const stored = COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS.find((option) => String(option) === raw);
        if (stored !== undefined) return stored;
        if (raw !== null) safeLocalStorageRemove(LINEUP_STORAGE_KEYS.COMPACT_CONTROLS_TIMEOUT_SECONDS);
        return DEFAULT_COMPACT_CONTROLS_TIMEOUT_SECONDS;
    }

    writeCompactControlsTimeoutSeconds(
        value: CompactControlsTimeoutSeconds
    ): SafeLocalStorageMutationResult | { ok: false; reason: 'invalid-value' } {
        if (!COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS.some((option) => option === value)) {
            return { ok: false, reason: 'invalid-value' };
        }
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.COMPACT_CONTROLS_TIMEOUT_SECONDS, String(value));
    }

    readClampedAutoHideMsAndClean(validOptions: readonly number[], fallback: number): number {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS);
        const parsed = ((): number => {
            if (raw === null) return NaN;
            const trimmed = raw.trim();
            if (!/^\d+$/.test(trimmed)) {
                return NaN;
            }
            return Number.parseInt(trimmed, 10);
        })();
        const candidate = Number.isFinite(parsed) ? parsed : fallback;

        const normalized = ((): number => {
            if (validOptions.includes(candidate)) return candidate;
            if (validOptions.includes(fallback)) return fallback;
            return validOptions[0] ?? fallback;
        })();

        if (raw === null) {
            return normalized;
        }

        if (Number.isFinite(parsed) && validOptions.includes(parsed)) {
            return parsed;
        }

        safeLocalStorageSet(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, String(normalized));
        return normalized;
    }

    writeAutoHideMs(value: number, validOptions: readonly number[]): SafeLocalStorageMutationResult {
        const normalized = validOptions.includes(value)
            ? value
            : (validOptions[0] ?? value);

        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, String(normalized));
    }
}
