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

type EpgCurrentChannelInfo = {
    channelNumber: number;
    channelName: string;
    programTitle: string;
    timeLabel: string;
};

function createFetchItemDetails(
    plexLibrary: IPlexLibrary | null
): NonNullable<EPGConfig['fetchItemDetails']> {
    return async (
        ratingKey: string,
        options?: { signal?: AbortSignal | null }
    ) =>
        toEpgItemDetails(
            await (plexLibrary?.getItem(
                ratingKey,
                { signal: options?.signal ?? null }
            ) ?? Promise.resolve(null))
        );
}

function resolveThumbUrl(
    plexLibrary: IPlexLibrary | null,
    buildPlexResourceUrl: (pathOrUrl: string | null) => string | null,
    pathOrUrl: string | null,
    width?: number,
    height?: number
): string | null {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        return pathOrUrl;
    }

    const resized = plexLibrary?.getImageUrl(pathOrUrl, width, height);
    if (resized) {
        return resized;
    }

    return buildPlexResourceUrl(pathOrUrl);
}

function createResolveThumbUrl(
    plexLibrary: IPlexLibrary | null,
    buildPlexResourceUrl: (pathOrUrl: string | null) => string | null
): NonNullable<EPGConfig['resolveThumbUrl']> {
    return (pathOrUrl: string | null, width?: number, height?: number): string | null =>
        resolveThumbUrl(plexLibrary, buildPlexResourceUrl, pathOrUrl, width, height);
}

function getCurrentChannelInfo(
    channelManager: IChannelManager | null,
    scheduler: IChannelScheduler | null
): EpgCurrentChannelInfo | null {
    const channel = channelManager?.getCurrentChannel();
    if (!channel || !scheduler) {
        return null;
    }

    let program;
    try {
        program = scheduler.getCurrentProgram();
    } catch {
        return null;
    }

    if (!program) {
        return null;
    }

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
}

function applyLayoutModeToVideoContainer(mode: EpgLayoutMode): void {
    const videoContainer = document.getElementById(APP_SHELL_CONTAINER_IDS.VIDEO);
    if (!videoContainer) {
        return;
    }

    if (mode === 'classic') {
        videoContainer.classList.add(CLASSIC_EPG_PIP_CLASS);
    } else {
        videoContainer.classList.remove(CLASSIC_EPG_PIP_CLASS);
    }
}

function createOnLayoutModeChange(
    previousOnLayoutModeChange: ((mode: EpgLayoutMode) => void) | null
): NonNullable<EPGConfig['onLayoutModeChange']> {
    return (mode: EpgLayoutMode): void => {
        previousOnLayoutModeChange?.(mode);
        applyLayoutModeToVideoContainer(mode);
    };
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
        fetchItemDetails: createFetchItemDetails(inputs.plexLibrary),
        resolveThumbUrl: createResolveThumbUrl(
            inputs.plexLibrary,
            inputs.buildPlexResourceUrl
        ),
        isVideoPlaying: (): boolean => inputs.videoPlayer?.isPlaying?.() ?? false,
        getCurrentChannelInfo: (): EpgCurrentChannelInfo | null =>
            getCurrentChannelInfo(inputs.channelManager, inputs.scheduler),
        onLayoutModeChange: createOnLayoutModeChange(previousOnLayoutModeChange),
    };
}
