import type { IPlexLibrary } from '../../../plex/library';
import type { IChannelManager } from '../../../scheduler/channel-manager';
import type { IChannelScheduler } from '../../../scheduler/scheduler';
import type { IVideoPlayer } from '../../../player';
import type { EpgLayoutMode } from '../../../settings/EpgPreferencesStore';
import { APP_SHELL_CONTAINER_IDS } from '../../common/appShellContainerIds';
import type { IEPGDebugRuntime } from '../debug/EPGDebugRuntime';
import { toEpgItemDetails } from '../model/adapters';
import type { EPGConfig } from '../types';
import { formatTimeRange } from '../utils';

export const CLASSIC_EPG_PIP_CLASS = 'epg-pip-active';

type FetchItemDetails = NonNullable<EPGConfig['fetchItemDetails']>;
type EpgCurrentChannelInfo = ReturnType<NonNullable<EPGConfig['getCurrentChannelInfo']>>;

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

export interface EPGStartupConfigRuntimeDependencies {
    plexLibrary: IPlexLibrary | null;
    videoPlayer: IVideoPlayer | null;
    channelManager: IChannelManager | null;
    scheduler: IChannelScheduler | null;
    buildPlexResourceUrl: (pathOrUrl: string | null) => string | null;
    previousOnLayoutModeChange: ((mode: EpgLayoutMode) => void) | null;
}

export class EPGStartupConfigRuntime {
    public constructor(
        private readonly deps: EPGStartupConfigRuntimeDependencies
    ) {}

    public async fetchItemDetails(
        ratingKey: string,
        options?: { signal?: AbortSignal | null }
    ): ReturnType<FetchItemDetails> {
        return toEpgItemDetails(
            await (this.deps.plexLibrary?.getItem(
                ratingKey,
                { signal: options?.signal ?? null }
            ) ?? Promise.resolve(null))
        );
    }

    public resolveThumbUrl(
        pathOrUrl: string | null,
        width?: number,
        height?: number
    ): string | null {
        if (!pathOrUrl) return null;
        if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
            return pathOrUrl;
        }

        const resized = this.deps.plexLibrary?.getImageUrl(pathOrUrl, width, height);
        if (resized) {
            return resized;
        }

        return this.deps.buildPlexResourceUrl(pathOrUrl);
    }

    public isVideoPlaying(): boolean {
        return this.deps.videoPlayer?.isPlaying?.() ?? false;
    }

    public getCurrentChannelInfo(): EpgCurrentChannelInfo {
        const channel = this.deps.channelManager?.getCurrentChannel();
        if (!channel || !this.deps.scheduler) {
            return null;
        }

        let program;
        try {
            program = this.deps.scheduler.getCurrentProgram();
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

    public onLayoutModeChange(mode: EpgLayoutMode): void {
        this.deps.previousOnLayoutModeChange?.(mode);

        const videoContainer = document.getElementById(APP_SHELL_CONTAINER_IDS.VIDEO);
        if (!videoContainer) {
            return;
        }

        if (mode === 'classic') {
            videoContainer.classList.add(CLASSIC_EPG_PIP_CLASS);
            return;
        }

        videoContainer.classList.remove(CLASSIC_EPG_PIP_CLASS);
    }
}

export function buildEPGStartupConfig(inputs: EPGStartupConfigInputs): EPGConfig {
    const runtime = new EPGStartupConfigRuntime({
        plexLibrary: inputs.plexLibrary,
        videoPlayer: inputs.videoPlayer,
        channelManager: inputs.channelManager,
        scheduler: inputs.scheduler,
        buildPlexResourceUrl: inputs.buildPlexResourceUrl,
        previousOnLayoutModeChange: inputs.epgConfig.onLayoutModeChange ?? null,
    });

    return {
        ...inputs.epgConfig,
        layoutMode: inputs.readEpgLayoutMode(),
        showNowWatchingBanner: inputs.readShowNowWatchingBanner(),
        debugRuntime: inputs.debugRuntime,
        fetchItemDetails: runtime.fetchItemDetails.bind(runtime),
        resolveThumbUrl: runtime.resolveThumbUrl.bind(runtime),
        isVideoPlaying: runtime.isVideoPlaying.bind(runtime),
        getCurrentChannelInfo: runtime.getCurrentChannelInfo.bind(runtime),
        onLayoutModeChange: runtime.onLayoutModeChange.bind(runtime),
    };
}
