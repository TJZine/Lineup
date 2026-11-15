import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

export const OVERLAY_TRANSPARENCY_OPTIONS = ['more-transparent', 'standard', 'reduced'] as const;
export type OverlayTransparency = (typeof OVERLAY_TRANSPARENCY_OPTIONS)[number];
export const DEFAULT_OVERLAY_TRANSPARENCY: OverlayTransparency = 'standard';

export const COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS = [2, 4, 6, 8, 10, 15] as const;
export type CompactControlsTimeoutSeconds = (typeof COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS)[number];
export const DEFAULT_COMPACT_CONTROLS_TIMEOUT_SECONDS: CompactControlsTimeoutSeconds = 4;

const RETIRED_VIEWING_SETTINGS_KEYS = [
    'lineup_cinematic_now_playing',
    'lineup_now_playing_info_auto_hide_ms',
] as const;

type RetiredViewingSettingsKey = (typeof RETIRED_VIEWING_SETTINGS_KEYS)[number];
export type RetiredViewingSettingsCleanupResult =
    | { ok: true }
    | { ok: false; failedKeys: RetiredViewingSettingsKey[] };

export class NowPlayingDisplayStore {
    cleanupRetiredViewingSettings(): RetiredViewingSettingsCleanupResult {
        const failedKeys: RetiredViewingSettingsKey[] = [];
        for (const key of RETIRED_VIEWING_SETTINGS_KEYS) {
            if (!safeLocalStorageRemoveWithResult(key).ok) failedKeys.push(key);
        }
        return failedKeys.length === 0 ? { ok: true } : { ok: false, failedKeys };
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
}
