import type { IPlexLibrary } from '../../plex/library';
import type { IChannelManager } from '../../scheduler/channel-manager';
import type { IChannelScheduler } from '../../scheduler/scheduler';
import type { IVideoPlayer } from '../../player';
import type { EpgLayoutMode } from '../../settings/EpgPreferencesStore';
import { APP_SHELL_CONTAINER_IDS } from '../common/appShellContainerIds';
import type { IEPGDebugRuntime } from './EPGDebugRuntime';
import { toEpgItemDetails } from './model/adapters';
import type { EPGConfig } from './types';
import { formatTimeRange } from './utils';

export const CLASSIC_EPG_PIP_CLASS = 'epg-pip-active';

export interface EPGStartupConfigInputs {
    epgConfig: EPGConfig;
    plexLibrary: IPlexLibrary | null;
    videoPlayer: IVideoPlayer | null;
    channelManager: IChannelManager | null;
    scheduler: IChannelScheduler | null;
    buildPlexResourceUrl: (pathOrUrl: string | null) => string | null;
    readEpgLayoutMode: () => EpgLayoutMode;
    readShowNowWatchingBanner: () => boolean;
    debugRuntime: IEPGDebugRuntime | null;
}

export function buildEPGStartupConfig(inputs: EPGStartupConfigInputs): EPGConfig {
    const layoutMode = inputs.readEpgLayoutMode();
    const showNowWatchingBanner = inputs.readShowNowWatchingBanner();
    const previousOnLayoutModeChange = inputs.epgConfig.onLayoutModeChange ?? null;

    return {
        ...inputs.epgConfig,
        layoutMode,
        showNowWatchingBanner,
        debugRuntime: inputs.debugRuntime,
        fetchItemDetails: async (
            ratingKey: string,
            options?: { signal?: AbortSignal | null }
        ) =>
            toEpgItemDetails(await (inputs.plexLibrary?.getItem(
                ratingKey,
                { signal: options?.signal ?? null }
            ) ?? Promise.resolve(null))),
        resolveThumbUrl: (
            pathOrUrl: string | null,
            width?: number,
            height?: number
        ): string | null => {
            if (!pathOrUrl) return null;
            if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
                return pathOrUrl;
            }
            const plexLibrary = inputs.plexLibrary;
            if (plexLibrary) {
                const resized = plexLibrary.getImageUrl(pathOrUrl, width, height);
                if (resized) return resized;
            }
            return inputs.buildPlexResourceUrl(pathOrUrl);
        },
        isVideoPlaying: (): boolean => inputs.videoPlayer?.isPlaying?.() ?? false,
        getCurrentChannelInfo: (): {
            channelNumber: number;
            channelName: string;
            programTitle: string;
            timeLabel: string;
        } | null => {
            const channel = inputs.channelManager?.getCurrentChannel();
            const scheduler = inputs.scheduler;
            if (!channel || !scheduler) return null;
            let program;
            try {
                program = scheduler.getCurrentProgram();
            } catch {
                return null;
            }
            if (!program) return null;
            const programTitle =
                program.item?.title ?? program.item?.fullTitle ?? 'Unknown';
            const startTime = program.scheduledStartTime;
            const endTime = program.scheduledEndTime;
            const hasValidTimes =
                Number.isFinite(startTime) &&
                Number.isFinite(endTime) &&
                endTime >= startTime;
            return {
                channelNumber: channel.number,
                channelName: channel.name,
                programTitle,
                timeLabel: hasValidTimes ? formatTimeRange(startTime, endTime) : '',
            };
        },
        onLayoutModeChange: (mode: EpgLayoutMode): void => {
            if (previousOnLayoutModeChange) {
                previousOnLayoutModeChange(mode);
            }
            const videoContainer = document.getElementById(APP_SHELL_CONTAINER_IDS.VIDEO);
            if (!videoContainer) return;
            if (mode === 'classic') {
                videoContainer.classList.add(CLASSIC_EPG_PIP_CLASS);
            } else {
                videoContainer.classList.remove(CLASSIC_EPG_PIP_CLASS);
            }
        },
    };
}
