import { EPG_CLASSES, EPG_CONSTANTS } from '../constants';
import type { EPGChannelList } from '../view/EPGChannelList';
import type { EPGLibraryTabs } from '../view/EPGLibraryTabs';
import type { EPGTimeHeader } from '../view/EPGTimeHeader';
import type { EPGVirtualizer } from '../view/EPGVirtualizer';
import type {
    EPGConfig,
    EPGEventMap,
    EPGFocusPosition,
    EPGInternalState,
    EpgRowLifecycleKind,
    ScheduledProgram,
} from '../types';
import {
    EPG_ROW_LOADING_LABEL,
    EPG_ROW_RETRYING_LABEL,
    EPG_ROW_UNAVAILABLE_LABEL,
} from '../types';

type EmitEvent = <K extends keyof EPGEventMap>(event: K, payload: EPGEventMap[K]) => void;

export type EPGFocusNavigatorContext = {
    getConfig: () => EPGConfig;
    getState: () => EPGInternalState;
    getChannelList: () => EPGChannelList;
    getTimeHeader: () => EPGTimeHeader;
    getVirtualizer: () => EPGVirtualizer;
    getLibraryTabs: () => EPGLibraryTabs | null;
    getIsLibraryTabsFocused: () => boolean;
    setIsLibraryTabsFocused: (focused: boolean) => void;
    renderGrid: () => void;
    renderGridInternal: () => void;
    hide: () => void;
    syncFocusedProgram: (program: ScheduledProgram) => void;
    clearInfoPanel: () => void;
    emit: EmitEvent;
    appendDebugLog: (event: string, payload: Record<string, unknown>) => void;
    isDebugEnabled: () => boolean;
};

export class EPGFocusNavigator {
    private _isSelectInProgress = false;
    private _placeholderAutoFocusKeys: Set<string> = new Set();

    constructor(private readonly context: EPGFocusNavigatorContext) {}

    isSelectInProgress(): boolean {
        return this._isSelectInProgress;
    }

    clearPlaceholderAutoFocusKeys(): void {
        this._placeholderAutoFocusKeys.clear();
    }

    didAutoFocusPlaceholder(channelId: string, focused: EPGFocusPosition): boolean {
        if (focused.kind !== 'placeholder') {
            return false;
        }
        const placeholderKey = `${channelId}-placeholder-${focused.placeholder.scheduledStartTime}`;
        if (this._placeholderAutoFocusKeys.has(placeholderKey)) {
            return false;
        }
        this._placeholderAutoFocusKeys.add(placeholderKey);
        this.focusProgramAtTime(focused.channelIndex, focused.focusTimeMs);
        return true;
    }

    getFocusKey(focusedCell: EPGFocusPosition | null): string | null {
        if (!focusedCell) return null;
        const channel = this.context.getState().channels[focusedCell.channelIndex];
        if (!channel) return null;
        if (focusedCell.kind === 'program') {
            return `${channel.id}-${focusedCell.program.scheduledStartTime}`;
        }
        return `${channel.id}-placeholder-${focusedCell.placeholder.scheduledStartTime}`;
    }

    focusChannel(channelIndex: number): void {
        const state = this.context.getState();
        if (channelIndex < 0 || channelIndex >= state.channels.length) return;

        const channel = state.channels[channelIndex];
        if (!channel) return;
        const schedule = state.schedules.get(channel.id);

        const targetTime = state.focusTimeMs || Date.now();
        if (schedule && schedule.programs.length > 0) {
            this.focusProgramAtTime(channelIndex, targetTime);
            return;
        }

        this.focusPlaceholder(channelIndex, targetTime);
    }

    focusProgram(channelIndex: number, programIndex: number, requestedFocusTimeMs?: number): void {
        const state = this.context.getState();
        if (channelIndex < 0 || channelIndex >= state.channels.length) return;

        const channel = state.channels[channelIndex];
        if (!channel) return;
        const schedule = state.schedules.get(channel.id);

        if (!schedule || programIndex < 0 || programIndex >= schedule.programs.length) return;

        const program = schedule.programs[programIndex];
        if (!program) return;

        const previousFocus = state.focusedCell;
        if (previousFocus && previousFocus.cellElement) {
            previousFocus.cellElement.classList.remove(EPG_CLASSES.CELL_FOCUSED);
        }

        const focusTimeMs = this.resolveProgramFocusTime(program, requestedFocusTimeMs);
        let didScroll = false;
        if (requestedFocusTimeMs === undefined) {
            didScroll = this.ensureCellVisible(channelIndex, program);
        } else {
            const channelScrolled = this.ensureChannelVisible(channelIndex);
            const timeScrolled = this.ensureTimeVisible(focusTimeMs);
            didScroll = channelScrolled || timeScrolled;
        }
        state.focusTimeMs = focusTimeMs;
        state.focusedCell = {
            kind: 'program',
            channelIndex,
            programIndex,
            program,
            focusTimeMs,
            cellElement: null,
        };

        this.context.getChannelList().setFocusedChannel(channelIndex);
        this.context.syncFocusedProgram(program);

        const cellElement = this.context.getVirtualizer().setFocusedCell(
            channel.id,
            program.scheduledStartTime,
            focusTimeMs,
            { syncTicker: state.isVisible }
        );
        state.focusedCell.cellElement = cellElement;
        if (didScroll || !cellElement) {
            this.context.renderGridInternal();
        }

        this.context.emit('focusChange', state.focusedCell);
    }

    focusNow(): void {
        const state = this.context.getState();
        const now = Date.now();
        state.focusTimeMs = now;

        state.scrollPosition.timeOffset = 0;
        this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);

        let didFocus = false;
        const channelIndex = state.focusedCell ? state.focusedCell.channelIndex : 0;

        if (channelIndex >= 0 && channelIndex < state.channels.length) {
            const channel = state.channels[channelIndex];
            if (channel) {
                const schedule = state.schedules.get(channel.id);

                if (schedule) {
                    const currentProgramIndex = schedule.programs.findIndex(
                        (p) => now >= p.scheduledStartTime && now < p.scheduledEndTime
                    );

                    if (currentProgramIndex >= 0) {
                        this.focusProgram(channelIndex, currentProgramIndex);
                        didFocus = true;
                    }
                }
            }
        }

        if (!didFocus) {
            this.context.renderGrid();
        }
    }

    scrollToTime(time: number): void {
        const state = this.context.getState();
        const previousOffset = state.scrollPosition.timeOffset;
        const minutesFromAnchor = (time - state.gridAnchorTime) / 60000;
        state.scrollPosition.timeOffset = this.clampTimeOffset(minutesFromAnchor);
        state.focusTimeMs = time;

        this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
        this.context.renderGrid();

        this.context.emit('timeScroll', {
            direction: state.scrollPosition.timeOffset >= previousOffset ? 'right' : 'left',
            newOffset: state.scrollPosition.timeOffset,
        });
    }

    scrollToChannel(channelIndex: number): void {
        const state = this.context.getState();
        const config = this.context.getConfig();
        const previousOffset = state.scrollPosition.channelOffset;
        const maxOffset = Math.max(0, state.channels.length - config.visibleChannels);
        state.scrollPosition.channelOffset = Math.max(0, Math.min(channelIndex, maxOffset));

        this.context.getChannelList().updateScrollPosition(state.scrollPosition.channelOffset);
        this.context.renderGrid();

        this.context.emit('channelScroll', {
            direction: state.scrollPosition.channelOffset >= previousOffset ? 'down' : 'up',
            newOffset: state.scrollPosition.channelOffset,
        });
    }

    handleNavigation(direction: 'up' | 'down' | 'left' | 'right'): boolean {
        const libraryTabs = this.context.getLibraryTabs();
        if (this.context.getIsLibraryTabsFocused()) {
            if (!libraryTabs || !libraryTabs.isVisible()) {
                this.context.setIsLibraryTabsFocused(false);
                libraryTabs?.setPillFocused(false);
                return false;
            }
            if (libraryTabs.isPickerOpen()) {
                switch (direction) {
                    case 'up':
                        libraryTabs.moveFocus(-1);
                        return true;
                    case 'down':
                        libraryTabs.moveFocus(1);
                        return true;
                    case 'left':
                    case 'right':
                        return true;
                    default:
                        return false;
                }
            }
            switch (direction) {
                case 'down':
                    this.context.setIsLibraryTabsFocused(false);
                    libraryTabs.setPillFocused(false);
                    this.focusProgramAtTime(0, this.context.getState().focusTimeMs);
                    return true;
                case 'left':
                case 'right':
                    return true;
                case 'up':
                default:
                    return false;
            }
        }

        const { focusedCell, channels, gridAnchorTime, scrollPosition } = this.context.getState();

        if (!focusedCell) {
            if (channels.length > 0) {
                const targetTime = gridAnchorTime + (scrollPosition.timeOffset * 60000);
                this.focusProgramAtTime(scrollPosition.channelOffset, targetTime);
                return true;
            }
            return false;
        }

        switch (direction) {
            case 'up':
                return this.navigateUp();
            case 'down':
                return this.navigateDown();
            case 'left':
                return this.navigateLeft();
            case 'right':
                return this.navigateRight();
            default:
                return false;
        }
    }

    handlePage(direction: 'up' | 'down'): boolean {
        const state = this.context.getState();
        const config = this.context.getConfig();
        if (!state.isVisible) return false;
        if (state.channels.length === 0) return false;

        const focused = state.focusedCell;
        const baseChannelIndex = focused ? focused.channelIndex : state.scrollPosition.channelOffset;
        const focusedTimeMs = focused?.focusTimeMs;
        const baseTimeMs = Number.isFinite(focusedTimeMs)
            ? (focusedTimeMs as number)
            : Number.isFinite(state.focusTimeMs)
                ? (state.focusTimeMs as number)
                : state.gridAnchorTime + (state.scrollPosition.timeOffset * 60000);

        const pageSize = Math.max(1, config.visibleChannels);
        const delta = direction === 'down' ? pageSize : -pageSize;
        const targetChannelIndex = Math.max(0, Math.min(baseChannelIndex + delta, state.channels.length - 1));
        if (targetChannelIndex === baseChannelIndex) {
            return false;
        }

        this.focusProgramAtTime(targetChannelIndex, baseTimeMs);
        return true;
    }

    handleSelect(): boolean {
        const libraryTabs = this.context.getLibraryTabs();
        if (this.context.getIsLibraryTabsFocused()) {
            if (libraryTabs) {
                libraryTabs.selectFocused();
                return true;
            }
            return false;
        }

        const state = this.context.getState();
        const { focusedCell } = state;
        if (!focusedCell) return false;

        const channel = state.channels[focusedCell.channelIndex];
        if (!channel) return false;
        if (focusedCell.kind === 'program' && this._isSelectInProgress) return false;

        if (this.context.isDebugEnabled()) {
            const payload = {
                rowOrdinal: focusedCell.channelIndex,
                scheduleIndex: focusedCell.kind === 'program' ? focusedCell.program.scheduleIndex : null,
                scheduledStartTime:
                    focusedCell.kind === 'program'
                        ? focusedCell.program.scheduledStartTime
                        : focusedCell.placeholder.scheduledStartTime,
                scheduledEndTime:
                    focusedCell.kind === 'program'
                        ? focusedCell.program.scheduledEndTime
                        : focusedCell.placeholder.scheduledEndTime,
                focusedKind: focusedCell.kind,
                scheduleLoaded: state.schedules.has(channel.id),
            };
            this.context.appendDebugLog('EPG.handleSelect', payload);
        }

        if (focusedCell.kind === 'placeholder') {
            const lifecycle = state.rowLifecycle.get(channel.id)?.kind ?? 'loading';
            if (lifecycle !== 'unavailable') {
                return false;
            }
            this.context.emit('rowRetryRequested', { channelId: channel.id });
            return true;
        }

        this._isSelectInProgress = true;
        window.setTimeout(() => {
            this._isSelectInProgress = false;
        }, 0);

        this.context.emit('channelSelected', {
            channel,
            program: focusedCell.program,
        });

        this.context.emit('programSelected', focusedCell.program);
        return true;
    }

    handleBack(): boolean {
        const libraryTabs = this.context.getLibraryTabs();
        if (libraryTabs?.isPickerOpen()) {
            libraryTabs.closePicker();
            return true;
        }
        if (this.context.getState().isVisible) {
            this.context.hide();
            return true;
        }
        return false;
    }

    private ensureCellVisible(channelIndex: number, program: ScheduledProgram): boolean {
        const state = this.context.getState();
        const { scrollPosition } = state;
        const { visibleHours } = this.context.getConfig();
        let didScroll = this.ensureChannelVisible(channelIndex);

        const programStartMinutes = (program.scheduledStartTime - state.gridAnchorTime) / 60000;
        const programEndMinutes = (program.scheduledEndTime - state.gridAnchorTime) / 60000;
        const visibleEndMinutes = scrollPosition.timeOffset + (visibleHours * 60);

        if (programStartMinutes < scrollPosition.timeOffset) {
            state.scrollPosition.timeOffset = this.clampTimeOffset(programStartMinutes);
            this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
            didScroll = true;
        } else if (programEndMinutes > visibleEndMinutes) {
            state.scrollPosition.timeOffset = this.clampTimeOffset(programEndMinutes - (visibleHours * 60));
            this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
            didScroll = true;
        }

        return didScroll;
    }

    private ensureTimeVisible(targetTimeMs: number): boolean {
        const state = this.context.getState();
        const { visibleHours } = this.context.getConfig();
        const minutesFromAnchor = (targetTimeMs - state.gridAnchorTime) / 60000;
        let didScroll = false;

        if (minutesFromAnchor < state.scrollPosition.timeOffset) {
            state.scrollPosition.timeOffset = this.clampTimeOffset(minutesFromAnchor);
            this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
            didScroll = true;
        } else if (minutesFromAnchor > state.scrollPosition.timeOffset + (visibleHours * 60)) {
            state.scrollPosition.timeOffset = this.clampTimeOffset(minutesFromAnchor - (visibleHours * 60));
            this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
            didScroll = true;
        }

        return didScroll;
    }

    private getProgramFocusTime(program: ScheduledProgram): number {
        const start = program.scheduledStartTime;
        const end = program.scheduledEndTime;
        const elapsed = typeof program.elapsedMs === 'number' ? program.elapsedMs : 0;
        const candidate = start + Math.max(0, elapsed);
        return Math.min(Math.max(candidate, start), Math.max(start, end - 1));
    }

    private resolveProgramFocusTime(program: ScheduledProgram, requestedFocusTimeMs?: number): number {
        if (!Number.isFinite(requestedFocusTimeMs)) {
            return this.getProgramFocusTime(program);
        }
        const start = program.scheduledStartTime;
        const end = Math.max(start, program.scheduledEndTime - 1);
        return Math.min(Math.max(requestedFocusTimeMs as number, start), end);
    }

    private resolvePlaceholderLifecycle(channelId: string | undefined): EpgRowLifecycleKind {
        if (!channelId) {
            return 'loading';
        }
        return this.context.getState().rowLifecycle.get(channelId)?.kind ?? 'loading';
    }

    private resolvePlaceholderLabel(lifecycle: EpgRowLifecycleKind): string {
        if (lifecycle === 'unavailable') {
            return EPG_ROW_UNAVAILABLE_LABEL;
        }
        if (lifecycle === 'retrying') {
            return EPG_ROW_RETRYING_LABEL;
        }
        return EPG_ROW_LOADING_LABEL;
    }

    private focusPlaceholder(channelIndex: number, targetTime: number): void {
        const state = this.context.getState();
        const config = this.context.getConfig();
        if (channelIndex < 0 || channelIndex >= state.channels.length) return;

        this.ensureChannelVisible(channelIndex);
        this.ensureTimeVisible(targetTime);

        const visibleStartMs = state.gridAnchorTime + (state.scrollPosition.timeOffset * 60000);
        const visibleEndMs = state.gridAnchorTime +
            ((state.scrollPosition.timeOffset + (config.visibleHours * 60)) * 60000);
        const clampedTime = Math.min(Math.max(targetTime, visibleStartMs), Math.max(visibleStartMs, visibleEndMs - 1));
        const channelId = state.channels[channelIndex]?.id;
        const lifecycle = this.resolvePlaceholderLifecycle(channelId);

        state.focusTimeMs = clampedTime;
        state.focusedCell = {
            kind: 'placeholder',
            channelIndex,
            programIndex: -1,
            placeholder: {
                label: this.resolvePlaceholderLabel(lifecycle),
                scheduledStartTime: visibleStartMs,
                scheduledEndTime: visibleEndMs,
            },
            focusTimeMs: clampedTime,
            cellElement: null,
        };

        this.context.getChannelList().setFocusedChannel(channelIndex);
        this.context.clearInfoPanel();
        this.context.renderGridInternal();
        this.context.emit('focusChange', state.focusedCell);
    }

    private ensureChannelVisible(channelIndex: number): boolean {
        const state = this.context.getState();
        const { visibleChannels } = this.context.getConfig();
        const { channelOffset } = state.scrollPosition;
        let didScroll = false;

        if (channelIndex < channelOffset) {
            const maxOffset = Math.max(0, state.channels.length - visibleChannels);
            state.scrollPosition.channelOffset = Math.max(0, Math.min(channelIndex, maxOffset));
            this.context.getChannelList().updateScrollPosition(state.scrollPosition.channelOffset);
            didScroll = true;
        } else if (channelIndex >= channelOffset + visibleChannels) {
            const targetOffset = channelIndex - visibleChannels + 1;
            const maxOffset = Math.max(0, state.channels.length - visibleChannels);
            state.scrollPosition.channelOffset = Math.max(0, Math.min(targetOffset, maxOffset));
            this.context.getChannelList().updateScrollPosition(state.scrollPosition.channelOffset);
            didScroll = true;
        }

        return didScroll;
    }

    private navigateUp(): boolean {
        const state = this.context.getState();
        const { focusedCell } = state;
        if (!focusedCell) return false;

        if (focusedCell.channelIndex > 0) {
            const targetTime = focusedCell.focusTimeMs ?? state.focusTimeMs;
            this.focusProgramAtTime(focusedCell.channelIndex - 1, targetTime);
            return true;
        }

        const libraryTabs = this.context.getLibraryTabs();
        if (focusedCell.channelIndex === 0 && libraryTabs?.isVisible()) {
            this.context.setIsLibraryTabsFocused(true);
            libraryTabs.setFocusedToSelected();
            libraryTabs.setPillFocused(true);
            return true;
        }

        const lastIndex = state.channels.length - 1;
        if (lastIndex < 0) return false;
        this.context.getChannelList().flashWrapCue();
        const targetTime = focusedCell.focusTimeMs ?? state.focusTimeMs;
        this.focusProgramAtTime(lastIndex, targetTime);
        return true;
    }

    private navigateDown(): boolean {
        const state = this.context.getState();
        const { focusedCell, channels } = state;
        if (!focusedCell) return false;

        if (focusedCell.channelIndex < channels.length - 1) {
            const targetTime = focusedCell.focusTimeMs ?? state.focusTimeMs;
            this.focusProgramAtTime(focusedCell.channelIndex + 1, targetTime);
            return true;
        }

        if (channels.length === 0) return false;
        this.context.getChannelList().flashWrapCue();
        const targetTime = focusedCell.focusTimeMs ?? state.focusTimeMs;
        this.focusProgramAtTime(0, targetTime);
        return true;
    }

    private navigateLeft(): boolean {
        const state = this.context.getState();
        const { focusedCell } = state;
        if (!focusedCell) return false;

        if (focusedCell.kind === 'placeholder') {
            const nextTime = Math.max(
                state.gridAnchorTime,
                focusedCell.focusTimeMs - (EPG_CONSTANTS.TIME_SCROLL_AMOUNT * 60000)
            );
            if (nextTime === focusedCell.focusTimeMs && state.scrollPosition.timeOffset === 0) {
                return false;
            }
            this.focusPlaceholder(focusedCell.channelIndex, nextTime);
            return true;
        }

        if (focusedCell.programIndex > 0) {
            this.focusProgram(focusedCell.channelIndex, focusedCell.programIndex - 1);
            return true;
        }

        const minutesFromAnchor = (focusedCell.program.scheduledStartTime - state.gridAnchorTime) / 60000;
        if (minutesFromAnchor <= 0) {
            return false;
        }

        state.scrollPosition.timeOffset = Math.max(
            0,
            state.scrollPosition.timeOffset - EPG_CONSTANTS.TIME_SCROLL_AMOUNT
        );
        this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
        this.context.renderGrid();

        const channel = state.channels[focusedCell.channelIndex];
        if (channel) {
            const schedule = state.schedules.get(channel.id);
            if (schedule) {
                let prevIndex = -1;
                for (let i = schedule.programs.length - 1; i >= 0; i--) {
                    const p = schedule.programs[i];
                    if (p && p.scheduledEndTime <= focusedCell.program.scheduledStartTime) {
                        prevIndex = i;
                        break;
                    }
                }

                if (prevIndex >= 0) {
                    this.focusProgram(focusedCell.channelIndex, prevIndex);
                    return true;
                }
            }
        }

        return false;
    }

    private navigateRight(): boolean {
        const state = this.context.getState();
        const config = this.context.getConfig();
        const { focusedCell } = state;
        if (!focusedCell) return false;

        if (focusedCell.kind === 'placeholder') {
            const nextTime = focusedCell.focusTimeMs + (EPG_CONSTANTS.TIME_SCROLL_AMOUNT * 60000);
            this.focusPlaceholder(focusedCell.channelIndex, nextTime);
            return true;
        }

        const channel = state.channels[focusedCell.channelIndex];
        if (!channel) return false;
        const schedule = state.schedules.get(channel.id);

        if (!schedule) return false;

        if (focusedCell.programIndex < schedule.programs.length - 1) {
            this.focusProgram(focusedCell.channelIndex, focusedCell.programIndex + 1);
            return true;
        }

        const programEndMinutes = (focusedCell.program.scheduledEndTime - state.gridAnchorTime) / 60000;
        const maxMinutes = config.totalHours * 60;

        if (programEndMinutes >= maxMinutes) {
            return false;
        }

        state.scrollPosition.timeOffset = this.clampTimeOffset(
            state.scrollPosition.timeOffset + EPG_CONSTANTS.TIME_SCROLL_AMOUNT
        );
        this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
        this.context.renderGrid();

        const nextIndex = schedule.programs.findIndex(
            (p) => p.scheduledStartTime >= focusedCell.program.scheduledEndTime
        );
        if (nextIndex >= 0) {
            this.focusProgram(focusedCell.channelIndex, nextIndex);
        }

        return true;
    }

    focusProgramAtTime(channelIndex: number, targetTime: number): void {
        const state = this.context.getState();
        const channel = state.channels[channelIndex];
        if (!channel) return;

        const schedule = state.schedules.get(channel.id);
        if (!schedule || schedule.programs.length === 0) {
            this.focusPlaceholder(channelIndex, targetTime);
            return;
        }

        state.focusTimeMs = targetTime;

        let programIndex = schedule.programs.findIndex(
            (p) => targetTime >= p.scheduledStartTime && targetTime < p.scheduledEndTime
        );

        if (programIndex < 0) {
            programIndex = schedule.programs.findIndex((p) => p.scheduledStartTime >= targetTime);
            if (programIndex < 0) {
                programIndex = schedule.programs.length - 1;
            }
        }

        this.focusProgram(channelIndex, programIndex, targetTime);
    }

    private getMaxTimeOffsetMinutes(): number {
        const { visibleHours, totalHours } = this.context.getConfig();
        return Math.max(0, (totalHours * 60) - (visibleHours * 60));
    }

    private clampTimeOffset(minutes: number): number {
        return Math.max(0, Math.min(minutes, this.getMaxTimeOffsetMinutes()));
    }
}
