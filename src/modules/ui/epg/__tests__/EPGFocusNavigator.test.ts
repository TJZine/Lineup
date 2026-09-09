/**
 * @jest-environment jsdom
 */

import { EPGFocusNavigator } from '../focus/EPGFocusNavigator';
import type { EPGConfig, EPGEventMap, EPGInternalState, ScheduleWindow, ScheduledProgram } from '../types';

describe('EPGFocusNavigator', () => {
    const anchor = new Date('2026-04-30T00:00:00Z').getTime();

    const createProgram = (index: number): ScheduledProgram => ({
        item: {
            ratingKey: `program-${index}`,
            type: 'movie',
            title: `Program ${index}`,
            fullTitle: `Program ${index}`,
            durationMs: 60 * 60 * 1000,
            thumb: null,
            year: 2026,
            scheduledIndex: index,
        },
        scheduledStartTime: anchor + index * 60 * 60 * 1000,
        scheduledEndTime: anchor + (index + 1) * 60 * 60 * 1000,
        elapsedMs: 0,
        remainingMs: 60 * 60 * 1000,
        scheduleIndex: index,
        loopNumber: 0,
        isCurrent: false,
    });

    const createHarness = (debugEnabled = false): {
        navigator: EPGFocusNavigator;
        config: EPGConfig;
        state: EPGInternalState;
        events: Array<[keyof EPGEventMap, unknown]>;
        appendDebugLog: jest.Mock;
        renderGrid: jest.Mock;
        timeHeader: {
            updateScrollPosition: jest.Mock;
        };
        libraryTabs: {
            visible: boolean;
            pickerOpen: boolean;
            moveFocus: jest.Mock;
            selectFocused: jest.Mock;
            closePicker: jest.Mock;
            setPillFocused: jest.Mock;
            setFocusedToSelected: jest.Mock;
            isVisible: () => boolean;
            isPickerOpen: () => boolean;
        };
        setLibraryTabsFocused: (focused: boolean) => void;
        getLibraryTabsFocused: () => boolean;
    } => {
        const schedule: ScheduleWindow = {
            startTime: anchor,
            endTime: anchor + 3 * 60 * 60 * 1000,
            programs: [createProgram(0), createProgram(1), createProgram(2)],
        };
        const state: EPGInternalState = {
            isInitialized: true,
            isVisible: true,
            channels: [
                { id: 'ch0', number: 1, name: 'One' },
                { id: 'ch1', number: 2, name: 'Two' },
                { id: 'ch2', number: 3, name: 'Three' },
            ] as EPGInternalState['channels'],
            schedules: new Map([
                ['ch0', schedule],
                ['ch1', schedule],
                ['ch2', schedule],
            ]),
            scheduleLoadTimes: new Map(),
            rowLifecycle: new Map(),
            focusedCell: null,
            focusTimeMs: anchor,
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            currentTime: anchor,
            gridAnchorTime: anchor,
            lastRenderTime: 0,
        };
        const config: EPGConfig = {
            containerId: 'epg',
            visibleChannels: 2,
            timeSlotMinutes: 30,
            visibleHours: 2,
            totalHours: 24,
            pixelsPerMinute: 4,
            rowHeight: 80,
            autoScrollToNow: false,
        };
        const events: Array<[keyof EPGEventMap, unknown]> = [];
        const appendDebugLog = jest.fn();
        const renderGrid = jest.fn();
        const timeHeader = { updateScrollPosition: jest.fn() };
        let libraryTabsFocused = false;
        const libraryTabs = {
            visible: true,
            pickerOpen: false,
            moveFocus: jest.fn(),
            selectFocused: jest.fn(),
            closePicker: jest.fn(),
            setPillFocused: jest.fn(),
            setFocusedToSelected: jest.fn(),
            isVisible: (): boolean => libraryTabs.visible,
            isPickerOpen: (): boolean => libraryTabs.pickerOpen,
        };

        const navigator = new EPGFocusNavigator({
            getConfig: (): EPGConfig => config,
            getState: (): EPGInternalState => state,
            getChannelList: (): never => ({
                setFocusedChannel: jest.fn(),
                updateScrollPosition: jest.fn(),
                flashWrapCue: jest.fn(),
            }) as never,
            getTimeHeader: (): never => timeHeader as never,
            getVirtualizer: (): never => ({
                setFocusedCell: jest.fn(() => document.createElement('button')),
            }) as never,
            getLibraryTabs: (): never => libraryTabs as never,
            getIsLibraryTabsFocused: (): boolean => libraryTabsFocused,
            setIsLibraryTabsFocused: (focused): void => {
                libraryTabsFocused = focused;
            },
            renderGrid,
            renderGridInternal: jest.fn(),
            hide: jest.fn((): void => {
                state.isVisible = false;
            }),
            syncFocusedProgram: jest.fn(),
            clearInfoPanel: jest.fn(),
            emit: (event, payload): void => {
                events.push([event, payload]);
            },
            appendDebugLog,
            isDebugEnabled: (): boolean => debugEnabled,
        });

        return {
            navigator,
            config,
            state,
            events,
            appendDebugLog,
            renderGrid,
            timeHeader,
            libraryTabs,
            setLibraryTabsFocused: (focused): void => {
                libraryTabsFocused = focused;
            },
            getLibraryTabsFocused: (): boolean => libraryTabsFocused,
        };
    };

    it('wraps vertical navigation and preserves focus time across rows', () => {
        const { navigator, state, libraryTabs } = createHarness();
        libraryTabs.visible = false;

        navigator.focusProgram(0, 1);
        expect(navigator.handleNavigation('up')).toBe(true);
        expect(state.focusedCell?.channelIndex).toBe(2);
        expect(state.focusTimeMs).toBe(anchor + 60 * 60 * 1000);
    });

    it('preserves explicit target time when focusing a program by time', () => {
        const { navigator, state } = createHarness();
        const targetTime = anchor + 90 * 60 * 1000;

        navigator.focusProgramAtTime(0, targetTime);

        expect(state.focusedCell?.kind).toBe('program');
        expect(state.focusedCell?.programIndex).toBe(1);
        expect(state.focusedCell?.focusTimeMs).toBe(targetTime);
        expect(state.focusTimeMs).toBe(targetTime);
    });

    it('keeps requested-time focus visible after scrolling rows', () => {
        const { navigator, state, timeHeader } = createHarness();
        const targetTime = anchor + 150 * 60 * 1000;

        navigator.focusProgramAtTime(2, targetTime);

        expect(state.focusedCell?.kind).toBe('program');
        expect(state.focusedCell?.channelIndex).toBe(2);
        expect(state.focusedCell?.programIndex).toBe(2);
        expect(state.scrollPosition.channelOffset).toBe(1);
        expect(state.scrollPosition.timeOffset).toBe(30);
        expect(timeHeader.updateScrollPosition).toHaveBeenCalledWith(30);
    });

    it('moves horizontally between programs and emits select payloads for focused programs', () => {
        const { navigator, state, events } = createHarness();

        navigator.focusProgram(0, 0);
        expect(navigator.handleNavigation('right')).toBe(true);
        expect(state.focusedCell?.kind).toBe('program');
        expect(state.focusedCell?.programIndex).toBe(1);

        expect(navigator.handleSelect()).toBe(true);
        expect(events.some(([event]) => event === 'channelSelected')).toBe(true);
        expect(events.some(([event]) => event === 'programSelected')).toBe(true);
    });

    it('records selection diagnostics without channel, focus, or rating identifiers', () => {
        const { navigator, appendDebugLog } = createHarness(true);

        navigator.focusProgram(1, 1);
        expect(navigator.handleSelect()).toBe(true);

        expect(appendDebugLog).toHaveBeenCalledWith(
            'EPG.handleSelect',
            expect.objectContaining({
                rowOrdinal: 1,
                scheduleIndex: 1,
                focusedKind: 'program',
                scheduleLoaded: true,
            })
        );
        const payload = appendDebugLog.mock.calls[0]?.[1];
        expect(payload).not.toHaveProperty('channelId');
        expect(payload).not.toHaveProperty('focusKey');
        expect(payload).not.toHaveProperty('ratingKey');
        expect(JSON.stringify(payload)).not.toContain('ch1');
        expect(JSON.stringify(payload)).not.toContain('program-1');
    });

    it('dedupes same-tick program selection events', () => {
        jest.useFakeTimers();
        try {
            const { navigator, events } = createHarness();

            navigator.focusProgram(0, 0);
            expect(navigator.handleNavigation('right')).toBe(true);

            expect(navigator.handleSelect()).toBe(true);
            expect(navigator.handleSelect()).toBe(false);

            jest.runOnlyPendingTimers();

            expect(events.filter(([event]) => event === 'channelSelected')).toHaveLength(1);
            expect(events.filter(([event]) => event === 'programSelected')).toHaveLength(1);
            expect(navigator.isSelectInProgress()).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });

    it('focuses placeholders when schedules are missing and returns false for placeholder selection', () => {
        const { navigator, state } = createHarness();
        state.schedules.delete('ch1');

        navigator.focusChannel(1);

        expect(state.focusedCell?.kind).toBe('placeholder');
        expect(state.focusedCell?.channelIndex).toBe(1);
        expect(navigator.handleSelect()).toBe(false);
    });

    it('emits a retry intent and consumes OK on an unavailable row', () => {
        const { navigator, state, events } = createHarness();
        state.schedules.delete('ch1');
        state.rowLifecycle.set('ch1', { kind: 'unavailable', rangeKey: 'day' });

        navigator.focusChannel(1);

        expect(state.focusedCell?.kind).toBe('placeholder');
        expect(navigator.handleSelect()).toBe(true);
        expect(events.filter(([event]) => event === 'rowRetryRequested')).toEqual([
            ['rowRetryRequested', { channelId: 'ch1' }],
        ]);
    });

    it('performs no duplicate work for OK on loading or retrying rows', () => {
        const loading = createHarness();
        loading.state.schedules.delete('ch1');
        loading.navigator.focusChannel(1);
        expect(loading.navigator.handleSelect()).toBe(false);
        expect(loading.events.filter(([event]) => event === 'rowRetryRequested')).toEqual([]);

        const retrying = createHarness();
        retrying.state.schedules.delete('ch1');
        retrying.state.rowLifecycle.set('ch1', { kind: 'retrying', rangeKey: 'day' });
        retrying.navigator.focusChannel(1);
        expect(retrying.navigator.handleSelect()).toBe(false);
        expect(retrying.events.filter(([event]) => event === 'rowRetryRequested')).toEqual([]);
    });

    it('labels focused placeholders from the row lifecycle without moving focus time', () => {
        const { navigator, state } = createHarness();
        state.schedules.delete('ch1');
        state.rowLifecycle.set('ch1', { kind: 'unavailable', rangeKey: 'day' });
        const targetTime = anchor + 90 * 60 * 1000;

        navigator.focusProgramAtTime(1, targetTime);

        expect(state.focusedCell?.kind).toBe('placeholder');
        if (state.focusedCell?.kind === 'placeholder') {
            expect(state.focusedCell.placeholder.label).toBe('Unavailable — OK to retry');
        }
        expect(state.focusTimeMs).toBe(targetTime);
    });

    it('pages by visible channel count while preserving the focused time', () => {
        const { navigator, state } = createHarness();

        navigator.focusProgram(0, 2);
        expect(navigator.handlePage('down')).toBe(true);

        expect(state.focusedCell?.channelIndex).toBe(2);
        expect(state.focusTimeMs).toBe(anchor + 2 * 60 * 60 * 1000);
    });

    it('clamps direct time scroll requests to the configured guide window', () => {
        const { config, navigator, state, timeHeader, renderGrid } = createHarness();
        const maxOffsetMinutes = (config.totalHours - config.visibleHours) * 60;

        navigator.scrollToTime(anchor + (config.totalHours + 2) * 60 * 60 * 1000);

        expect(state.scrollPosition.timeOffset).toBe(maxOffsetMinutes);
        expect(state.focusTimeMs).toBe(anchor + (config.totalHours + 2) * 60 * 60 * 1000);
        expect(timeHeader.updateScrollPosition).toHaveBeenCalledWith(maxOffsetMinutes);
        expect(renderGrid).toHaveBeenCalled();
    });

    it('clamps right-edge remote scrolling to the configured guide window', () => {
        const { config, navigator, state, timeHeader, renderGrid } = createHarness();
        const maxOffsetMinutes = (config.totalHours - config.visibleHours) * 60;
        const channel = state.channels[0];
        const schedule = channel ? state.schedules.get(channel.id) : undefined;
        const program = schedule?.programs[2];
        expect(program).toBeDefined();
        state.focusedCell = {
            kind: 'program',
            channelIndex: 0,
            programIndex: 2,
            program: program as ScheduledProgram,
            focusTimeMs: (program as ScheduledProgram).scheduledStartTime,
            cellElement: null,
        };
        state.scrollPosition.timeOffset = maxOffsetMinutes - 10;

        expect(navigator.handleNavigation('right')).toBe(true);

        expect(state.scrollPosition.timeOffset).toBe(maxOffsetMinutes);
        expect(timeHeader.updateScrollPosition).toHaveBeenCalledWith(maxOffsetMinutes);
        expect(renderGrid).toHaveBeenCalled();
    });

    it('routes library tabs focus, picker movement, selection, and back behavior', () => {
        const { navigator, libraryTabs, setLibraryTabsFocused, getLibraryTabsFocused } = createHarness();

        navigator.focusProgram(0, 0);
        expect(navigator.handleNavigation('up')).toBe(true);
        expect(getLibraryTabsFocused()).toBe(true);
        expect(libraryTabs.setPillFocused).toHaveBeenCalledWith(true);

        libraryTabs.pickerOpen = true;
        expect(navigator.handleNavigation('down')).toBe(true);
        expect(libraryTabs.moveFocus).toHaveBeenCalledWith(1);
        expect(navigator.handleBack()).toBe(true);
        expect(libraryTabs.closePicker).toHaveBeenCalled();

        libraryTabs.pickerOpen = false;
        setLibraryTabsFocused(true);
        expect(navigator.handleSelect()).toBe(true);
        expect(libraryTabs.selectFocused).toHaveBeenCalled();
    });
});
