import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import { NOW_PLAYING_INFO_DEFAULTS } from '../now-playing-info';
import {
    parseStoredEpgInfoBackgroundMode,
    readStoredBoolean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../../utils/storage';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEYS } from './constants';

const EPG_PAST_ITEMS_STORAGE_VALUES = ['auto', '0', '15', '30'] as const;

type EpgPastItemsStorageValue = (typeof EPG_PAST_ITEMS_STORAGE_VALUES)[number];
type SubtitleLanguageOption = Readonly<{ code: string | null }>;
type TranscodeQualityOption = Readonly<{ storageValue: string }>;

export class SettingsStore {
    readBool(key: string, defaultValue: boolean): boolean {
        return readStoredBoolean(key, defaultValue);
    }

    writeBool(key: string, value: boolean): void {
        safeLocalStorageSet(key, value ? '1' : '0');
    }

    readNumber(key: string, defaultValue: number): number {
        const raw = safeLocalStorageGet(key);
        if (raw === null) return defaultValue;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : defaultValue;
    }

    writeNumber(key: string, value: number): void {
        safeLocalStorageSet(key, String(value));
    }

    readEpgLayoutModeValue(): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE);
        return raw === 'overlay' ? 0 : 1;
    }

    writeEpgLayoutModeValue(value: number): void {
        const mode = value === 1 ? 'classic' : 'overlay';
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, mode);
    }

    readEpgGuideDensityValue(): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        return raw === 'wide' ? 1 : 0;
    }

    writeEpgGuideDensityValue(value: number): void {
        const density = value === 1 ? 'wide' : 'detailed';
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY, density);
    }

    readEpgPastItemsWindowValue(): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        const index = EPG_PAST_ITEMS_STORAGE_VALUES.findIndex((option) => option === raw);
        if (index >= 0) return index;
        if (raw !== null) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        }
        return 0;
    }

    writeEpgPastItemsWindowValue(value: number): EpgPastItemsStorageValue {
        const option = EPG_PAST_ITEMS_STORAGE_VALUES[value] ?? EPG_PAST_ITEMS_STORAGE_VALUES[0];
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, option);
        return option;
    }

    readEpgInfoBackgroundModeValue(): 0 | 1 | 2 {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        const parsed = parseStoredEpgInfoBackgroundMode(raw);
        if (parsed !== null) return parsed;
        if (raw !== null) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        }
        return DEFAULT_SETTINGS.display.epgInfoBackgroundMode;
    }

    writeEpgInfoBackgroundModeValue(value: number): 0 | 1 | 2 {
        const mode: 0 | 1 | 2 = value === 2 ? 2 : value === 1 ? 1 : 0;
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, String(mode));
        return mode;
    }

    readSubtitleLanguageValue(options: ReadonlyArray<SubtitleLanguageOption>): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        if (raw === null) return 0;

        const normalized = raw.trim().toLowerCase();
        if (!normalized) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return 0;
        }

        const index = options.findIndex((option) => {
            if (!option.code) return false;
            return option.code.toLowerCase() === normalized;
        });

        if (index >= 0) return index;

        safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        return 0;
    }

    writeSubtitleLanguageValue(value: number, options: ReadonlyArray<SubtitleLanguageOption>): void {
        const option = options[value];
        if (!option || !option.code) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return;
        }
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, option.code);
    }

    readTranscodeQualityValue(options: ReadonlyArray<TranscodeQualityOption> = TRANSCODE_QUALITY_OPTIONS): number {
        const stored = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY) ?? '';
        const matchIndex = options.findIndex((option) => option.storageValue === stored);
        if (matchIndex >= 0) return matchIndex;
        if (stored) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY);
        }
        return 0;
    }

    writeTranscodeQualityValue(value: number, options: ReadonlyArray<TranscodeQualityOption> = TRANSCODE_QUALITY_OPTIONS): void {
        const option = options[value] ?? options[0];
        if (!option || option.storageValue.length === 0) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY);
            return;
        }
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY, option.storageValue);
    }

    readClampedNowPlayingAutoHideValue(validOptions: readonly number[], fallback: number = NOW_PLAYING_INFO_DEFAULTS.autoHideMs): number {
        const rawValue = this.readNumber(
            SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS,
            DEFAULT_SETTINGS.display.nowPlayingInfoAutoHideMs
        );

        if (validOptions.includes(rawValue)) {
            return rawValue;
        }

        this.writeNumber(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, fallback);
        return fallback;
    }
}
