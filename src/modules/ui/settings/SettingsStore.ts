import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import { AudioSettingsStore } from '../../settings/AudioSettingsStore';
import { AccessibilityPreferencesStore } from '../../settings/AccessibilityPreferencesStore';
import { DeveloperSettingsStore } from '../../settings/DeveloperSettingsStore';
import {
    EPG_PAST_ITEMS_WINDOWS,
    EpgPreferencesStore,
    type EpgGuideHours,
    type EpgGuideHoursMigrationCleanupResult,
    type EpgGuideHoursReadResult,
} from '../../settings/EpgPreferencesStore';
import {
    NowPlayingDisplayStore,
    type CompactControlsTimeoutSeconds,
    type OverlayTransparency,
} from '../../settings/NowPlayingDisplayStore';
import {
    PlaybackSettingsStore,
    type Hdr10FallbackModeValue,
} from '../../settings/PlaybackSettingsStore';
import { ProfileSessionStore } from '../../settings/ProfileSessionStore';
import { SupportReportPreferencesStore } from '../../settings/SupportReportPreferencesStore';
import { SubtitlePreferencesStore } from '../../settings/SubtitlePreferencesStore';
import {
    DEFAULT_SUBTITLE_MODE,
    type SubtitleMode,
} from '../../../shared/subtitle-mode';
import { normalizeSubtitleLanguage } from '../../../shared/subtitle-language';
import { DEFAULT_SETTINGS } from './constants';
import type { SafeLocalStorageMutationResult } from '../../../utils/storage';

type SettingsWriteFailureReason = 'quota-exceeded' | 'unavailable' | 'invalid-value';
type SettingsMutationResult<T> =
    | { ok: true }
    | { ok: false; reason: SettingsWriteFailureReason; effectiveValue?: T };

export type SettingsWriteResult<T> =
    | { ok: true; value: T }
    | { ok: false; reason: SettingsWriteFailureReason; effectiveValue: T };

export type ToggleSettingId =
    | 'dtsPassthrough'
    | 'directPlayAudioFallback'
    | 'keepPlayingInSettings'
    | 'transcodeCompat'
    | 'debugLogging'
    | 'subtitleDebugLogging'
    | 'subtitlePreferForced'
    | 'epgLibraryTabsEnabled'
    | 'epgNowWatchingEnabled'
    | 'epgAggressivePreloadEnabled'
    | 'showProfilePickerOnStartup'
    | 'preferClearLogos'
    | 'epgSourceLabelsEnabled'
    | 'reduceMotion'
    | 'largeFocus'
    | 'supportReportOptIn'
    | 'smartHdr10Fallback'
    | 'forceHdr10Fallback';

const TOGGLE_DEFAULT_BY_ID: Record<ToggleSettingId, boolean> = {
    dtsPassthrough: DEFAULT_SETTINGS.audio.dtsPassthrough,
    directPlayAudioFallback: DEFAULT_SETTINGS.audio.directPlayAudioFallback,
    keepPlayingInSettings: DEFAULT_SETTINGS.playback.keepPlayingInSettings,
    transcodeCompat: DEFAULT_SETTINGS.playback.transcodeCompat,
    debugLogging: DEFAULT_SETTINGS.developer.debugLogging,
    subtitleDebugLogging: DEFAULT_SETTINGS.developer.subtitleDebugLogging,
    subtitlePreferForced: DEFAULT_SETTINGS.subtitles.preferForced,
    epgLibraryTabsEnabled: DEFAULT_SETTINGS.guide.libraryTabsEnabled,
    epgNowWatchingEnabled: DEFAULT_SETTINGS.guide.nowWatchingBannerEnabled,
    epgAggressivePreloadEnabled: DEFAULT_SETTINGS.guide.aggressivePreloadEnabled,
    showProfilePickerOnStartup: DEFAULT_SETTINGS.account.showProfilePickerOnStartup,
    preferClearLogos: DEFAULT_SETTINGS.display.preferClearLogos,
    epgSourceLabelsEnabled: DEFAULT_SETTINGS.guide.sourceLabelsEnabled,
    reduceMotion: DEFAULT_SETTINGS.accessibility.reduceMotion,
    largeFocus: DEFAULT_SETTINGS.accessibility.largeFocus,
    supportReportOptIn: DEFAULT_SETTINGS.support.reportCollectionOptIn,
    smartHdr10Fallback: DEFAULT_SETTINGS.playback.smartHdr10Fallback,
    forceHdr10Fallback: DEFAULT_SETTINGS.playback.forceHdr10Fallback,
};

function assertNeverToggleSettingId(id: never): never {
    throw new Error(`Unhandled ToggleSettingId: ${String(id)}`);
}

export interface SettingsStoreOptions {
    audioSettingsStore?: AudioSettingsStore;
    accessibilityPreferencesStore?: AccessibilityPreferencesStore;
    developerSettingsStore?: DeveloperSettingsStore;
    playbackSettingsStore?: PlaybackSettingsStore;
    subtitlePreferencesStore?: SubtitlePreferencesStore;
    epgPreferencesStore?: EpgPreferencesStore;
    nowPlayingDisplayStore?: NowPlayingDisplayStore;
    profileSessionStore?: ProfileSessionStore;
    supportReportPreferencesStore?: SupportReportPreferencesStore;
}

export class SettingsStore {
    private readonly _audioSettingsStore: AudioSettingsStore;
    private readonly _accessibilityPreferencesStore: AccessibilityPreferencesStore;
    private readonly _developerSettingsStore: DeveloperSettingsStore;
    private readonly _playbackSettingsStore: PlaybackSettingsStore;
    private readonly _subtitlePreferencesStore: SubtitlePreferencesStore;
    private readonly _epgPreferencesStore: EpgPreferencesStore;
    private readonly _nowPlayingDisplayStore: NowPlayingDisplayStore;
    private readonly _profileSessionStore: ProfileSessionStore;
    private readonly _supportReportPreferencesStore: SupportReportPreferencesStore;

    constructor(options: SettingsStoreOptions = {}) {
        this._audioSettingsStore = options.audioSettingsStore ?? new AudioSettingsStore();
        this._accessibilityPreferencesStore = options.accessibilityPreferencesStore ?? new AccessibilityPreferencesStore();
        this._developerSettingsStore = options.developerSettingsStore ?? new DeveloperSettingsStore();
        this._playbackSettingsStore = options.playbackSettingsStore ?? new PlaybackSettingsStore();
        this._subtitlePreferencesStore = options.subtitlePreferencesStore ?? new SubtitlePreferencesStore();
        this._epgPreferencesStore = options.epgPreferencesStore ?? new EpgPreferencesStore();
        this._nowPlayingDisplayStore = options.nowPlayingDisplayStore ?? new NowPlayingDisplayStore();
        this._profileSessionStore = options.profileSessionStore ?? new ProfileSessionStore();
        this._supportReportPreferencesStore = options.supportReportPreferencesStore ?? new SupportReportPreferencesStore();
    }

    readToggleSettingAndClean(id: ToggleSettingId): boolean {
        switch (id) {
            case 'dtsPassthrough':
                return this._audioSettingsStore.readDtsPassthroughEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.dtsPassthrough
                );
            case 'directPlayAudioFallback':
                return this._audioSettingsStore.readDirectPlayAudioFallbackEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.directPlayAudioFallback
                );
            case 'keepPlayingInSettings':
                return this._profileSessionStore.readKeepPlayingInSettingsAndClean(
                    TOGGLE_DEFAULT_BY_ID.keepPlayingInSettings
                );
            case 'transcodeCompat':
                return this._playbackSettingsStore.readTranscodeCompatEnabledAndClean(TOGGLE_DEFAULT_BY_ID.transcodeCompat);
            case 'debugLogging':
                return this._developerSettingsStore.readDebugLoggingEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.debugLogging
                );
            case 'subtitleDebugLogging':
                return this._developerSettingsStore.readSubtitleDebugLoggingEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.subtitleDebugLogging
                );
            case 'subtitlePreferForced':
                return this._subtitlePreferencesStore.readSubtitlePreferForcedAndClean(
                    TOGGLE_DEFAULT_BY_ID.subtitlePreferForced
                );
            case 'epgLibraryTabsEnabled':
                return this._epgPreferencesStore.readLibraryTabsEnabledAndClean(TOGGLE_DEFAULT_BY_ID.epgLibraryTabsEnabled);
            case 'epgNowWatchingEnabled':
                return this._epgPreferencesStore.readNowWatchingEnabledAndClean(TOGGLE_DEFAULT_BY_ID.epgNowWatchingEnabled);
            case 'epgAggressivePreloadEnabled':
                return this._epgPreferencesStore.readAggressivePreloadEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.epgAggressivePreloadEnabled
                );
            case 'showProfilePickerOnStartup':
                return this._profileSessionStore.readShowProfilePickerOnStartupAndClean(
                    TOGGLE_DEFAULT_BY_ID.showProfilePickerOnStartup
                );
            case 'preferClearLogos':
                return this._nowPlayingDisplayStore.readPreferClearLogosEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.preferClearLogos
                );
            case 'epgSourceLabelsEnabled':
                return this._epgPreferencesStore.readSourceLabelsEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.epgSourceLabelsEnabled
                );
            case 'reduceMotion':
                return this._accessibilityPreferencesStore.readReduceMotionEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.reduceMotion
                );
            case 'largeFocus':
                return this._accessibilityPreferencesStore.readLargeFocusEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.largeFocus
                );
            case 'supportReportOptIn':
                return this._supportReportPreferencesStore.readCollectionEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.supportReportOptIn
                );
            case 'smartHdr10Fallback':
                return this._playbackSettingsStore.readSmartHdr10FallbackEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.smartHdr10Fallback
                );
            case 'forceHdr10Fallback':
                return this._playbackSettingsStore.readForceHdr10FallbackEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.forceHdr10Fallback
                );
            default:
                return assertNeverToggleSettingId(id);
        }
    }

    writeToggleSetting(id: ToggleSettingId, value: boolean): SettingsWriteResult<boolean> {
        const effectiveBefore = this.readToggleSettingAndClean(id);
        const result = this._writeToggleMutation(id, value);
        if (id === 'supportReportOptIn' && !result.ok) {
            // Turning off can persist consent and then fail to clear retained data.
            // Report the durable policy, not the pre-write value, to the control.
            return { ok: false, reason: result.reason, effectiveValue: this.readToggleSettingAndClean(id) };
        }
        return this._toWriteResult(result, value, effectiveBefore);
    }

    private _writeToggleMutation(id: ToggleSettingId, value: boolean): SafeLocalStorageMutationResult {
        switch (id) {
            case 'dtsPassthrough':
                return this._audioSettingsStore.writeDtsPassthroughEnabled(value);
            case 'directPlayAudioFallback':
                return this._audioSettingsStore.writeDirectPlayAudioFallbackEnabled(value);
            case 'keepPlayingInSettings':
                return this._profileSessionStore.writeKeepPlayingInSettings(value);
            case 'transcodeCompat':
                return this._playbackSettingsStore.writeTranscodeCompatEnabled(value);
            case 'debugLogging':
                return this._developerSettingsStore.writeDebugLoggingEnabled(value);
            case 'subtitleDebugLogging':
                return this._developerSettingsStore.writeSubtitleDebugLoggingEnabled(value);
            case 'subtitlePreferForced':
                return this._subtitlePreferencesStore.writeSubtitlePreferForced(value);
            case 'epgLibraryTabsEnabled':
                return this._epgPreferencesStore.writeLibraryTabsEnabled(value);
            case 'epgNowWatchingEnabled':
                return this._epgPreferencesStore.writeNowWatchingEnabled(value);
            case 'epgAggressivePreloadEnabled':
                return this._epgPreferencesStore.writeAggressivePreloadEnabled(value);
            case 'showProfilePickerOnStartup':
                return this._profileSessionStore.writeShowProfilePickerOnStartup(value);
            case 'preferClearLogos':
                return this._nowPlayingDisplayStore.writePreferClearLogosEnabled(value);
            case 'epgSourceLabelsEnabled':
                return this._epgPreferencesStore.writeSourceLabelsEnabled(value);
            case 'reduceMotion':
                return this._accessibilityPreferencesStore.writeReduceMotionEnabled(value);
            case 'largeFocus':
                return this._accessibilityPreferencesStore.writeLargeFocusEnabled(value);
            case 'supportReportOptIn':
                return this._supportReportPreferencesStore.writeCollectionEnabled(value);
            case 'smartHdr10Fallback':
                return this._playbackSettingsStore.writeSmartHdr10FallbackEnabled(value);
            case 'forceHdr10Fallback':
                return this._playbackSettingsStore.writeForceHdr10FallbackEnabled(value);
            default:
                return assertNeverToggleSettingId(id);
        }
    }

    readHdr10FallbackModeValueAndClean(): Hdr10FallbackModeValue {
        return this._playbackSettingsStore.readHdr10FallbackModeValueAndClean();
    }

    writeHdr10FallbackModeValue(value: Hdr10FallbackModeValue): SettingsWriteResult<Hdr10FallbackModeValue> {
        const effectiveBefore = this.readHdr10FallbackModeValueAndClean();
        const result = this._playbackSettingsStore.writeHdr10FallbackModeValue(value);
        return this._toWriteResult(result, value, effectiveBefore);
    }

    readGuideHoursAndMigrate(): EpgGuideHoursReadResult {
        return this._epgPreferencesStore.readGuideHoursAndMigrate();
    }

    writeGuideHours(hours: EpgGuideHours): SettingsWriteResult<EpgGuideHours> {
        const before = this.readGuideHoursAndMigrate();
        const effectiveBefore = before.ok ? before.value : before.effectiveValue;
        return this._toWriteResult(
            this._epgPreferencesStore.writeGuideHours(hours),
            hours,
            effectiveBefore
        );
    }

    completeGuideHoursMigrationAfterConsumerCutover(): EpgGuideHoursMigrationCleanupResult {
        return this._epgPreferencesStore.completeGuideHoursMigrationAfterConsumerCutover();
    }

    readEpgPastItemsWindowValueAndClean(): number {
        const raw = this._epgPreferencesStore.readPastItemsWindowAndClean('auto');
        const index = EPG_PAST_ITEMS_WINDOWS.findIndex((option) => option === raw);
        if (index >= 0) return index;
        return 0;
    }

    writeEpgPastItemsWindowValue(value: number): SettingsWriteResult<number> {
        const effectiveBefore = this.readEpgPastItemsWindowValueAndClean();
        const normalizedValue = EPG_PAST_ITEMS_WINDOWS[value] ? value : 0;
        const option = EPG_PAST_ITEMS_WINDOWS[normalizedValue] ?? 'auto';
        return this._toWriteResult(
            this._epgPreferencesStore.writePastItemsWindow(option),
            normalizedValue,
            effectiveBefore
        );
    }

    readEpgInfoBackgroundModeValueAndClean(): 0 | 1 | 2 {
        return this._epgPreferencesStore.readInfoBackgroundModeAndClean(DEFAULT_SETTINGS.display.epgInfoBackgroundMode);
    }

    writeEpgInfoBackgroundModeValue(value: number): SettingsWriteResult<0 | 1 | 2> {
        const effectiveBefore = this.readEpgInfoBackgroundModeValueAndClean();
        const mode: 0 | 1 | 2 = value === 2 ? 2 : value === 1 ? 1 : 0;
        return this._toWriteResult(this._epgPreferencesStore.writeInfoBackgroundMode(mode), mode, effectiveBefore);
    }

    readSubtitleModeAndClean(): SubtitleMode {
        return this._subtitlePreferencesStore.readSubtitleModeAndClean(DEFAULT_SUBTITLE_MODE);
    }

    writeSubtitleMode(mode: SubtitleMode): SettingsWriteResult<SubtitleMode> {
        const effectiveBefore = this.readSubtitleModeAndClean();
        return this._toWriteResult(this._subtitlePreferencesStore.writeSubtitleMode(mode), mode, effectiveBefore);
    }

    readSubtitleLanguageAndClean(): string | null {
        return this._subtitlePreferencesStore.readSubtitleLanguageAndClean();
    }

    writeSubtitleLanguage(languageCode: string | null): SettingsWriteResult<string | null> {
        const effectiveBefore = this.readSubtitleLanguageAndClean();
        const normalizedValue = normalizeSubtitleLanguage(languageCode);
        return this._toWriteResult(
            this._subtitlePreferencesStore.writeSubtitleLanguage(normalizedValue),
            normalizedValue,
            effectiveBefore
        );
    }

    readTranscodeQualityValueAndClean(options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS): number {
        return this._playbackSettingsStore.readTranscodeQualityValueAndClean(options);
    }

    writeTranscodeQualityValue(
        value: number,
        options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS
    ): SettingsWriteResult<number> {
        const effectiveBefore = this.readTranscodeQualityValueAndClean(options);
        const normalizedValue = options[value] ? value : 0;
        return this._toWriteResult(
            this._playbackSettingsStore.writeTranscodeQualityValue(normalizedValue, options),
            normalizedValue,
            effectiveBefore
        );
    }

    readOverlayTransparencyAndClean(): OverlayTransparency {
        return this._nowPlayingDisplayStore.readOverlayTransparencyAndClean(DEFAULT_SETTINGS.display.overlayTransparency);
    }

    writeOverlayTransparency(value: OverlayTransparency): SettingsWriteResult<OverlayTransparency> {
        const effectiveBefore = this.readOverlayTransparencyAndClean();
        return this._toWriteResult(
            this._nowPlayingDisplayStore.writeOverlayTransparency(value),
            value,
            effectiveBefore
        );
    }

    readCompactControlsTimeoutSecondsAndClean(): CompactControlsTimeoutSeconds {
        return this._nowPlayingDisplayStore.readCompactControlsTimeoutSecondsAndClean();
    }

    writeCompactControlsTimeoutSeconds(
        value: CompactControlsTimeoutSeconds
    ): SettingsWriteResult<CompactControlsTimeoutSeconds> {
        const effectiveBefore = this.readCompactControlsTimeoutSecondsAndClean();
        return this._toWriteResult(
            this._nowPlayingDisplayStore.writeCompactControlsTimeoutSeconds(value),
            value,
            effectiveBefore
        );
    }

    private _toWriteResult<T>(
        result: SettingsMutationResult<T>,
        value: T,
        effectiveBefore: T
    ): SettingsWriteResult<T> {
        if (result.ok) return { ok: true, value };
        return {
            ok: false,
            reason: result.reason,
            effectiveValue: result.effectiveValue ?? effectiveBefore,
        };
    }
}
