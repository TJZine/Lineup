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
        streamDescriptor: null,
        isCurrent: false,
    });

    const createHarness = (): {
        navigator: EPGFocusNavigator;
        state: EPGInternalState;
        events: Array<[keyof EPGEventMap, unknown]>;
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
            showCurrentTimeIndicator: true,
            autoScrollToNow: false,
        };
        const events: Array<[keyof EPGEventMap, unknown]> = [];
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
            getTimeHeader: (): never => ({ updateScrollPosition: jest.fn() }) as never,
            getVirtualizer: (): never => ({
                setFocusedCell: jest.fn(() => document.createElement('button')),
            }) as never,
            getLibraryTabs: (): never => libraryTabs as never,
            getIsLibraryTabsFocused: (): boolean => libraryTabsFocused,
            setIsLibraryTabsFocused: (focused): void => {
                libraryTabsFocused = focused;
            },
            renderGrid: jest.fn(),
            renderGridInternal: jest.fn(),
            hide: jest.fn((): void => {
                state.isVisible = false;
            }),
            syncFocusedProgram: jest.fn(),
            clearInfoPanel: jest.fn(),
            emit: (event, payload): void => {
                events.push([event, payload]);
            },
            appendDebugLog: jest.fn(),
            isDebugEnabled: (): boolean => false,
        });

        return {
            navigator,
            state,
            events,
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

    it('focuses placeholders when schedules are missing and returns false for placeholder selection', () => {
        const { navigator, state } = createHarness();
        state.schedules.delete('ch1');

        navigator.focusChannel(1);

        expect(state.focusedCell?.kind).toBe('placeholder');
        expect(state.focusedCell?.channelIndex).toBe(1);
        expect(navigator.handleSelect()).toBe(false);
    });

    it('pages by visible channel count while preserving the focused time', () => {
        const { navigator, state } = createHarness();

        navigator.focusProgram(0, 2);
        expect(navigator.handlePage('down')).toBe(true);

        expect(state.focusedCell?.channelIndex).toBe(2);
        expect(state.focusTimeMs).toBe(anchor + 2 * 60 * 60 * 1000);
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
