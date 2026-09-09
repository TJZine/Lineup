import type { EpgLayoutMode } from '../../settings/EpgPreferencesStore';
import type {
    ScheduledProgram,
    ScheduleWindow,
    ChannelConfig,
    EPGConfig,
    EPGState,
    EPGEventMap,
    EpgRowLifecycleState,
    EpgHeldScheduleSnapshot,
    EpgScheduleLoadMetadata,
} from './types';
import type { IDisposable } from '../../../utils/interfaces';

export interface IEPGComponent {
    initialize(config: EPGConfig): void;

    destroy(): void;

    show(options?: { preserveFocus?: boolean }): void;

    hide(): void;

    toggle(): void;

    isVisible(): boolean;

    loadChannels(channels: ChannelConfig[]): void;

    setLayoutMode(mode: EpgLayoutMode): void;

    setVisibleHours(hours: number): void;

    setNowWatchingBannerEnabled(enabled: boolean): void;

    setLibraryTabs(libraries: Array<{ id: string; name: string }>, selectedId: string | null): void;

    loadScheduleForChannel(
        channelId: string,
        schedule: ScheduleWindow,
        metadata?: EpgScheduleLoadMetadata
    ): void;

    hasScheduleForChannelRange(channelId: string, startTime: number, endTime: number): boolean;

    getHeldScheduleForChannel(channelId: string): EpgHeldScheduleSnapshot | null;

    clearScheduleForChannel(channelId: string): void;

    getRowLifecycle(channelId: string): EpgRowLifecycleState | null;

    setRowLifecycle(channelId: string, state: EpgRowLifecycleState): void;

    clearRowLifecycle(channelId: string, rangeKey?: string): void;

    clearAllRowLifecycles(): void;

    clearSchedules(): void;

    refreshCurrentTime(): void;

    focusChannel(channelIndex: number): void;

    focusProgram(channelIndex: number, programIndex: number): void;

    focusNow(): void;

    scrollToTime(time: number): void;

    scrollToChannel(channelIndex: number): void;

    handleNavigation(direction: 'up' | 'down' | 'left' | 'right'): boolean;

    // Page up/down by a screenful of channels while preserving time focus.
    handlePage(direction: 'up' | 'down'): boolean;

    handleSelect(): boolean;

    handleBack(): boolean;

    getState(): EPGState;

    getFocusedProgram(): ScheduledProgram | null;

    // Set the grid anchor time so the guide can start at "now" instead of midnight.
    setGridAnchorTime(anchorTime: number): void;

    on<K extends keyof EPGEventMap>(
        event: K,
        handler: (payload: EPGEventMap[K]) => void
    ): IDisposable;

    off<K extends keyof EPGEventMap>(
        event: K,
        handler: (payload: EPGEventMap[K]) => void
    ): void;
}

export interface IEPGReadinessPort {
    ensureReady(signal?: AbortSignal | null): Promise<void>;
}

export interface IEPGInfoPanel {
    setPresentationMode(mode: EpgLayoutMode): void;

    getPresentationMode(): EpgLayoutMode;

    show(program: ScheduledProgram): void;

    hide(): void;

    update(program: ScheduledProgram): void;

    // Fast update without artwork/description.
    updateFast(program: ScheduledProgram): void;

    // Full update including poster/description.
    updateFull(program: ScheduledProgram): void;

    isShowing(): boolean;
}
