/**
 * @fileoverview Types for Mini Guide overlay.
 * @module modules/ui/mini-guide/types
 */

export interface MiniGuideConfig {
    containerId: string;
    autoHideMs?: number;
}

export interface MiniGuideChannelViewModel {
    channelId: string;
    channelNumber: number;
    channelName: string;
    buildStrategy?: import('../../scheduler/channel-manager/types').BuildStrategy | null;
    /**
     * Optional status hint for loading visuals.
     */
    status?: 'loading' | 'ready' | 'unavailable';
    /**
     * Uses 'Loading...' while resolving; 'Unavailable' on error.
     */
    nowTitle: string;
    nowStartTime?: string | null;
    /**
     * Null when unknown.
     */
    nextTitle: string | null;
    /**
     * Clamped to [0, 1]; defaults to 0.
     */
    nowProgress: number;
}

export interface MiniGuideViewModel {
    channels: MiniGuideChannelViewModel[];
}
