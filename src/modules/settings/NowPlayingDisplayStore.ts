import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageSet,
} from '../../utils/storage';

export class NowPlayingDisplayStore {
    readCinematicNowPlayingEnabled(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.CINEMATIC_NOW_PLAYING, fallback);
    }

    writeCinematicNowPlayingEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.CINEMATIC_NOW_PLAYING, enabled ? '1' : '0');
    }

    readPreferClearLogosEnabled(fallback: boolean = true): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, fallback);
    }

    writePreferClearLogosEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, enabled ? '1' : '0');
    }

    readClampedAutoHideMs(validOptions: readonly number[], fallback: number): number {
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

    writeAutoHideMs(value: number, validOptions: readonly number[]): void {
        const normalized = validOptions.includes(value)
            ? value
            : (validOptions[0] ?? value);

        safeLocalStorageSet(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, String(normalized));
    }
}
