import type { BuildStrategy } from '../../scheduler/channel-manager/contracts/types';

export interface MiniGuideConfig {
    containerId: string;
}

export interface MiniGuideChannelViewModel {
    channelId: string;
    channelNumber: number;
    channelName: string;
    isWatching?: boolean;
    buildStrategy?: BuildStrategy | null;
    /** True when buildStrategy icon should be shown (only when channel.icon is not set). */
    showBrandingIcon?: boolean;
    /**
     * Optional status hint for loading visuals.
     */
    status?: 'loading' | 'ready' | 'unavailable';
    /**
     * Uses 'Loading...' while resolving; 'Unavailable' on error.
     */
    nowTitle: string;
    nowStartTime?: string | null;
    nowEndTime?: string | null;
    nowElapsedTime?: string | null;
    nowRemainingTime?: string | null;
    /**
     * Null when unknown.
     */
    nextTitle: string | null;
    nextStartTime?: string | null;
    /**
     * Clamped to [0, 1]; defaults to 0.
     */
    nowProgress: number;
}

export interface MiniGuideViewModel {
    channels: MiniGuideChannelViewModel[];
    emptyMessage?: string;
}
