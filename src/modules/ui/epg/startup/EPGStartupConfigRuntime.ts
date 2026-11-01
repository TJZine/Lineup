import type { IPlexLibrary } from '../../../plex/library';
import type { IChannelManager } from '../../../scheduler/channel-manager';
import type { IChannelScheduler } from '../../../scheduler/scheduler';
import type { IVideoPlayer } from '../../../player';
import { APP_SHELL_CONTAINER_IDS } from '../../common/appShellContainerIds';
import type { IDisposable } from '../../../../utils/interfaces';
import type { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
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
    hasUsableRetainedSession: () => boolean;
    epgPreferencesStore: EpgPreferencesStore;
    readShowNowWatchingBanner: () => boolean;
    debugRuntime: IEPGDebugRuntime | null;
}

export interface EPGStartupConfigRuntimeDependencies {
    plexLibrary: IPlexLibrary | null;
    videoPlayer: IVideoPlayer | null;
    channelManager: IChannelManager | null;
    scheduler: IChannelScheduler | null;
    buildPlexResourceUrl: (pathOrUrl: string | null) => string | null;
    hasUsableRetainedSession: () => boolean;
    previousOnPictureOperation: ((operation: 'guide-pip' | 'fullscreen') => void) | null;
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

    public getPictureStatus(): 'untuned' | 'playing' | 'paused' | 'buffering' | 'seeking' | 'error' {
        const player = this.deps.videoPlayer;
        if (!player) return 'untuned';
        const state = player.getState();
        let status: 'untuned' | 'playing' | 'paused' | 'buffering' | 'seeking' | 'error';
        if (state.status === 'error') status = 'error';
        else if (!player.getCurrentDescriptor?.() || !this.deps.hasUsableRetainedSession()) status = 'untuned';
        else status = state.status === 'playing' || state.status === 'paused' ||
            state.status === 'buffering' || state.status === 'seeking'
            ? state.status : 'untuned';
        const videoContainer = document.getElementById(APP_SHELL_CONTAINER_IDS.VIDEO);
        if (videoContainer) videoContainer.dataset.guidePictureStatus = status;
        return status;
    }

    public subscribePictureStatus(listener: () => void): IDisposable {
        return this.deps.videoPlayer?.on('stateChange', listener) ?? { dispose(): void {} };
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

    public onPictureOperation(operation: 'guide-pip' | 'fullscreen'): void {
        this.deps.previousOnPictureOperation?.(operation);

        const videoContainer = document.getElementById(APP_SHELL_CONTAINER_IDS.VIDEO);
        if (!videoContainer) {
            return;
        }

        if (operation === 'guide-pip') {
            videoContainer.classList.add(CLASSIC_EPG_PIP_CLASS);
            return;
        }

        videoContainer.classList.remove(CLASSIC_EPG_PIP_CLASS);
        delete videoContainer.dataset.guidePictureStatus;
    }
}

export function buildEPGStartupConfig(inputs: EPGStartupConfigInputs): EPGConfig {
    const runtime = new EPGStartupConfigRuntime({
        plexLibrary: inputs.plexLibrary,
        videoPlayer: inputs.videoPlayer,
        channelManager: inputs.channelManager,
        scheduler: inputs.scheduler,
        buildPlexResourceUrl: inputs.buildPlexResourceUrl,
        hasUsableRetainedSession: inputs.hasUsableRetainedSession,
        previousOnPictureOperation: inputs.epgConfig.onPictureOperation ?? null,
    });

    return {
        ...inputs.epgConfig,
        showNowWatchingBanner: inputs.readShowNowWatchingBanner(),
        debugRuntime: inputs.debugRuntime,
        fetchItemDetails: runtime.fetchItemDetails.bind(runtime),
        resolveThumbUrl: runtime.resolveThumbUrl.bind(runtime),
        getPictureStatus: runtime.getPictureStatus.bind(runtime),
        subscribePictureStatus: runtime.subscribePictureStatus.bind(runtime),
        getCurrentChannelInfo: runtime.getCurrentChannelInfo.bind(runtime),
        onPictureOperation: runtime.onPictureOperation.bind(runtime),
        onGuideHoursChange: (hours): boolean => inputs.epgPreferencesStore.writeGuideHours(hours).ok,
    };
}
