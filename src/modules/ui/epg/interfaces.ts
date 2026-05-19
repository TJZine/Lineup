import type { EpgLayoutMode } from '../../settings/EpgPreferencesStore';
import type {
    ScheduledProgram,
    ScheduleWindow,
    ChannelConfig,
    EPGConfig,
    EPGState,
    EPGEventMap,
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

    loadScheduleForChannel(channelId: string, schedule: ScheduleWindow): void;

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
    ensureReady(): Promise<void>;
}

export interface IEPGInfoPanel {
    setPresentationMode(mode: EpgLayoutMode): void;

    getPresentationMode(): EpgLayoutMode;

    show(program: ScheduledProgram): void;

    hide(): void;

    update(program: ScheduledProgram): void;

    // Fast update without poster/description.
    updateFast(program: ScheduledProgram): void;

    // Full update including poster/description.
    updateFull(program: ScheduledProgram): void;

    isShowing(): boolean;
}
