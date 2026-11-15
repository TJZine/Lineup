/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Component unit tests
 * @module modules/ui/epg/__tests__/EPGComponent.test
 */

import { EPGComponent } from '../component/EPGComponent';
import { DeferredEPGComponent } from '../component/DeferredEPGComponent';
import { RemoteHandler } from '../../../navigation/input/RemoteHandler';
import { EPGDebugRuntime } from '../debug/EPGDebugRuntime';
import { EPG_CLASSES } from '../constants';
import type { ScheduledProgram, ScheduleWindow, ChannelConfig, EPGConfig } from '../types';
import { DebugOverridesStore } from '../../../debug/DebugOverridesStore';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import { readFileSync } from 'node:fs';
import { normalizeLineEndings } from '../../../../styles/__tests__/helpers/css-test-utils';

describe('EPGComponent', () => {
    const expectPresent = <T,>(value: T | null | undefined): T => {
        expect(value).not.toBeNull();
        expect(value).not.toBeUndefined();
        return value as T;
    };

    let epg: EPGComponent;
    let container: HTMLElement;
    let gridAnchorTime = 0;

    const createEpgInstance = (overrides: Partial<EPGConfig> = {}): {
        epg: EPGComponent;
        container: HTMLElement;
    } => {
        const instanceContainer = document.createElement('div');
        instanceContainer.id = overrides.containerId ?? 'epg-container';
        document.body.appendChild(instanceContainer);

        const instance = new EPGComponent();
        const config: EPGConfig = {
            containerId: instanceContainer.id,
            visibleChannels: 5,
            timeSlotMinutes: 30,
            visibleHours: 3,
            totalHours: 24,
            pixelsPerMinute: 4,
            autoFitPixelsPerMinute: false,
            rowHeight: 80,
            autoScrollToNow: false,
            resolveThumbUrl: (url) => url,
            ...overrides,
        };

        instance.initialize(config);

        return { epg: instance, container: instanceContainer };
    };

    it('renders classic header placeholder before the grid container', () => {
        const header = container.querySelector('.epg-classic-header');
        const glyph = container.querySelector('.epg-classic-header-glyph');
        const title = container.querySelector('.epg-classic-header-title');
        const grid = container.querySelector(`.${EPG_CLASSES.GRID}`);

        expect(header).not.toBeNull();
        expect(glyph).not.toBeNull();
        expect(glyph?.querySelector('svg')).not.toBeNull();
        expect(title?.textContent).toBe('LINEUP');
        expect(grid).not.toBeNull();
    });

    const createMockChannel = (index: number): ChannelConfig => ({
        id: `ch${index}`,
        number: index + 1,
        name: `Channel ${index + 1}`,
        contentSource: { type: 'manual', items: [] },
        playbackMode: 'sequential',
        contentFilters: [],
        skipIntros: false,
        skipCredits: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastContentRefresh: Date.now(),
        itemCount: 10,
        totalDurationMs: 36000000,
        startTimeAnchor: gridAnchorTime,
    });

    const createMockSchedule = (channelId: string, programCount: number): ScheduleWindow => {
        const programs: ScheduledProgram[] = [];
        for (let i = 0; i < programCount; i++) {
            programs.push({
                item: {
                    ratingKey: `${channelId}-prog-${i}`,
                    type: 'movie',
                    title: `Program ${i + 1}`,
                    fullTitle: `Program ${i + 1}`,
                    durationMs: 3600000, // 1 hour
                    thumb: null,
                    year: 2020,
                    scheduledIndex: i,
                },
                scheduledStartTime: gridAnchorTime + (i * 3600000),
                scheduledEndTime: gridAnchorTime + ((i + 1) * 3600000),
                elapsedMs: 0,
                remainingMs: 3600000,
                scheduleIndex: i,
                loopNumber: 0,
                isCurrent: i === 0,
            });
        }
        return {
            startTime: gridAnchorTime,
            endTime: gridAnchorTime + (programCount * 3600000),
            programs,
        };
    };

    const createDetailedSchedule = (channelId: string): ScheduleWindow => {
        const programs: ScheduledProgram[] = [
            {
                item: {
                    ratingKey: `${channelId}-prog-0`,
                    type: 'movie',
                    title: 'Program A',
                    fullTitle: 'Program A',
                    durationMs: 3600000,
                    thumb: 'https://example.com/poster-a.jpg',
                    summary: 'Some summary text A',
                    year: 2020,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime,
                scheduledEndTime: gridAnchorTime + 3600000,
                elapsedMs: 0,
                remainingMs: 3600000,
                scheduleIndex: 0,
                loopNumber: 0,
                isCurrent: true,
            },
            {
                item: {
                    ratingKey: `${channelId}-prog-1`,
                    type: 'movie',
                    title: 'Program B',
                    fullTitle: 'Program B',
                    durationMs: 3600000,
                    thumb: 'https://example.com/poster-b.jpg',
                    summary: 'Some summary text B',
                    year: 2020,
                    scheduledIndex: 1,
                },
                scheduledStartTime: gridAnchorTime + 3600000,
                scheduledEndTime: gridAnchorTime + 7200000,
                elapsedMs: 0,
                remainingMs: 3600000,
                scheduleIndex: 1,
                loopNumber: 0,
                isCurrent: false,
            },
        ];

        return {
            startTime: gridAnchorTime,
            endTime: gridAnchorTime + (programs.length * 3600000),
            programs,
        };
    };

    beforeEach(() => {
        const created = createEpgInstance();
        epg = created.epg;
        container = created.container;

        gridAnchorTime = epg.getState().viewWindow.startTime;
    });

    afterEach(() => {
        epg.destroy();
        container.remove();
        jest.useRealTimers();
    });

    it('uses PiP only for a continuing picture and resets it when Guide closes', () => {
        let pictureStatus: 'paused' | 'untuned' | 'error' = 'paused';
        const onPictureOperation = jest.fn();
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-picture-state',
            getPictureStatus: () => pictureStatus,
            onPictureOperation,
        });

        try {
            localEpg.show();
            expect(onPictureOperation).toHaveBeenLastCalledWith('guide-pip');
            expect(localContainer.querySelector('.epg-picture-status')?.textContent).toContain('Paused');

            pictureStatus = 'error';
            localEpg.hide();
            localEpg.show();
            expect(onPictureOperation).toHaveBeenLastCalledWith('fullscreen');
            expect(localContainer.querySelector('.epg-picture-status')?.textContent).toContain('unavailable');

            pictureStatus = 'untuned';
            localEpg.hide();
            localEpg.show();
            expect(localContainer.querySelector('.epg-picture-status')?.textContent).toContain('Choose a program');
        } finally {
            localEpg.destroy();
            localContainer.remove();
        }
    });

    it('cycles 2/3/4-hour windows through the toolbar and keeps the persisted value on failure', () => {
        const onGuideHoursChange = jest.fn().mockReturnValue(true);
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-hours',
            visibleHours: 2,
            onGuideHoursChange,
        });

        try {
            localEpg.show();
            const hours = localContainer.querySelector('[data-action="hours"]') as HTMLButtonElement;
            hours.click();
            expect(onGuideHoursChange).toHaveBeenCalledWith(3);
            expect(localEpg.getState().viewWindow.endTime - localEpg.getState().viewWindow.startTime)
                .toBe(3 * 3_600_000);
            hours.click();
            expect(onGuideHoursChange).toHaveBeenCalledWith(4);
            expect(localEpg.getState().viewWindow.endTime - localEpg.getState().viewWindow.startTime)
                .toBe(4 * 3_600_000);

            onGuideHoursChange.mockReturnValue(false);
            hours.click();
            expect(localEpg.getState().viewWindow.endTime - localEpg.getState().viewWindow.startTime)
                .toBe(4 * 3_600_000);
            expect(localContainer.querySelector('.epg-toolbar-status')?.textContent).toContain('Could not save');
        } finally {
            localEpg.destroy();
            localContainer.remove();
        }
    });

    it('searches loaded channels and restores grid focus after a result is selected', () => {
        epg.loadChannels([createMockChannel(0), createMockChannel(1), createMockChannel(2)]);
        epg.show();

        (container.querySelector('[data-action="search"]') as HTMLButtonElement).click();
        const input = container.querySelector('.epg-search-input') as HTMLInputElement;
        input.value = '3';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(container.querySelectorAll('.epg-search-result')).toHaveLength(1);
        expect(container.querySelector('.epg-search-result')?.textContent).toContain('Channel 3');
        epg.handleSelect();

        expect(container.querySelector('.epg-search-overlay')).toBeNull();
        expect(epg.getState().focusedCell?.channelIndex).toBe(2);
        expect(container.querySelector('.epg-toolbar-button.epg-toolbar-focused')).toBeNull();
    });

    it('scrolls remote search selection into view while preserving typing focus', () => {
        const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
        const scrollIntoView = jest.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: scrollIntoView,
        });

        try {
            epg.loadChannels(Array.from({ length: 20 }, (_, index) => createMockChannel(index)));
            epg.show();
            container.querySelector<HTMLButtonElement>('[data-action="search"]')?.click();
            const input = expectPresent(container.querySelector<HTMLInputElement>('.epg-search-input'));

            for (let step = 0; step < 14; step++) {
                input.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'ArrowDown', bubbles: true, cancelable: true,
                }));
            }

            const selected = container.querySelector('.epg-search-result.epg-toolbar-focused');
            expect(selected?.textContent).toContain('Channel 15');
            expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });
            expect(scrollIntoView.mock.contexts[scrollIntoView.mock.contexts.length - 1]).toBe(selected);
            expect(document.activeElement).toBe(input);

            input.value = 'Channel 20';
            input.dispatchEvent(new Event('input', { bubbles: true }));

            const filtered = container.querySelector('.epg-search-result.epg-toolbar-focused');
            expect(filtered?.textContent).toContain('Channel 20');
            expect(scrollIntoView.mock.contexts[scrollIntoView.mock.contexts.length - 1]).toBe(filtered);
            expect(document.activeElement).toBe(input);
        } finally {
            if (originalScrollIntoView) {
                Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
            } else {
                Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
            }
        }
    });

    it('closes Search on physical Back before the real remote handler sees it', () => {
        const remote = new RemoteHandler();
        const onRemoteKeyDown = jest.fn();
        remote.on('keyDown', onRemoteKeyDown);
        remote.initialize();

        try {
            epg.loadChannels([createMockChannel(0)]);
            epg.show();
            (container.querySelector('[data-action="search"]') as HTMLButtonElement).click();
            const input = container.querySelector('.epg-search-input') as HTMLInputElement;
            expect(document.activeElement).toBe(input);
            input.value = 'Channel';
            input.setSelectionRange(3, 3);

            const editingKey = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
            input.dispatchEvent(editingKey);
            expect(editingKey.defaultPrevented).toBe(false);
            expect(input.selectionStart).toBe(3);
            expect(container.querySelector('.epg-search-overlay')).not.toBeNull();

            const composingEnter = new KeyboardEvent('keydown', {
                key: 'Enter', bubbles: true, cancelable: true, isComposing: true,
            });
            input.dispatchEvent(composingEnter);
            expect(composingEnter.defaultPrevented).toBe(false);
            expect(container.querySelector('.epg-search-overlay')).not.toBeNull();

            const physicalBack = new KeyboardEvent('keydown', { key: 'Unidentified', bubbles: true, cancelable: true });
            Object.defineProperty(physicalBack, 'keyCode', { value: 461 });
            input.dispatchEvent(physicalBack);
            expect(physicalBack.defaultPrevented).toBe(true);
            expect(container.querySelector('.epg-search-overlay')).toBeNull();
            expect(epg.isVisible()).toBe(true);
            expect(onRemoteKeyDown).not.toHaveBeenCalled();
        } finally {
            remote.destroy();
        }
    });

    it('opens the Guide menu by D-pad and emits its selected destination', () => {
        epg.loadChannels([createMockChannel(0)]);
        epg.show();
        epg.focusChannel(0);
        const onRoute = jest.fn();
        epg.on('menuRouteRequested', onRoute);

        epg.handleNavigation('up');
        epg.handleNavigation('up');
        expect(container.querySelector('.epg-classic-header-brand.epg-toolbar-focused')).not.toBeNull();
        epg.handleSelect();
        expect(container.querySelector('.epg-menu-overlay')).not.toBeNull();
        expect((container.querySelector('[data-action="player"]') as HTMLButtonElement).disabled).toBe(true);
        epg.handleSelect();

        expect(onRoute).toHaveBeenCalledWith('settings');
        expect(container.querySelector('.epg-menu-overlay')).toBeNull();
    });

    it('opens the visible Lineup menu and routes Switch server', () => {
        epg.show();
        const onRoute = jest.fn();
        epg.on('menuRouteRequested', onRoute);

        epg.openLineupMenu();
        const switchServer = container.querySelector('[data-action="server-select"]') as HTMLButtonElement;
        expect(switchServer.textContent).toBe('Switch server');
        switchServer.click();

        expect(onRoute).toHaveBeenCalledWith('server-select');
        expect(container.querySelector('.epg-menu-overlay')).toBeNull();
    });

    it('keeps the focused menu action authoritative on an empty Guide', () => {
        epg.show();
        const onSetup = jest.fn();
        epg.on('setupRequested', onSetup);
        epg.openLineupMenu();
        epg.handleBack();
        expect(container.querySelector('.epg-classic-header-brand.epg-toolbar-focused')).not.toBeNull();

        epg.handleSelect();

        expect(container.querySelector('.epg-menu-overlay')).not.toBeNull();
        expect(onSetup).not.toHaveBeenCalled();
    });

    it('reaches the toolbar from an empty Guide and preserves setup only for empty-grid OK', () => {
        epg.show();
        expect((container.querySelector('.epg-empty-state') as HTMLElement).hidden).toBe(false);
        const onSetup = jest.fn();
        epg.on('setupRequested', onSetup);
        expect(epg.getState().focusedCell).toBeNull();
        expect(epg.handleSelect()).toBe(true);
        expect(onSetup).toHaveBeenCalledTimes(1);

        expect(epg.handleNavigation('up')).toBe(true);
        expect(container.querySelector('[data-action="search"].epg-toolbar-focused')).not.toBeNull();
        for (let step = 0; step < 4; step++) epg.handleNavigation('right');
        epg.handleSelect();

        expect(container.querySelector('[data-action="hours"]')?.textContent).toContain('4 hours');
        expect(onSetup).toHaveBeenCalledTimes(1);
        expect(epg.getState().focusedCell).toBeNull();
        epg.handleNavigation('down');
        epg.handleSelect();
        expect(onSetup).toHaveBeenCalledTimes(2);
    });

    it('routes every remote menu action and empty-state setup through the production deferred facade', async () => {
        const deferredContainer = document.createElement('div');
        deferredContainer.id = 'epg-deferred-actions';
        document.body.appendChild(deferredContainer);
        const deferred = new DeferredEPGComponent(async () => ({ EPGComponent }));
        deferred.initialize({
            containerId: deferredContainer.id,
            visibleChannels: 5,
            timeSlotMinutes: 30,
            visibleHours: 2,
            totalHours: 24,
            pixelsPerMinute: 4,
            rowHeight: 80,
            autoScrollToNow: false,
            getPictureStatus: () => 'playing',
        });
        deferred.loadChannels([createMockChannel(0)]);
        const onRoute = jest.fn();
        const onSetup = jest.fn();
        deferred.on('menuRouteRequested', onRoute);
        deferred.on('setupRequested', onSetup);

        try {
            await deferred.ensureReady();
            deferred.show();
            const routes = ['player', 'settings', 'channels', 'channel-setup', 'server-select'] as const;
            routes.forEach((route, index) => {
                deferred.openLineupMenu();
                for (let step = 0; step < index; step++) deferred.handleNavigation('down');
                deferred.handleSelect();
                expect(onRoute).toHaveBeenLastCalledWith(route);
                expect(onRoute).toHaveBeenCalledTimes(index + 1);
                expect(deferredContainer.querySelector('.epg-menu-overlay')).toBeNull();
            });

            deferred.openLineupMenu();
            deferredContainer.querySelector<HTMLButtonElement>('[data-action="settings"]')?.click();
            expect(onRoute).toHaveBeenLastCalledWith('settings');
            expect(onRoute).toHaveBeenCalledTimes(routes.length + 1);

            deferred.loadChannels([]);
            // The route spy leaves the menu invoker focused; return to the empty grid first.
            deferred.handleBack();
            deferredContainer.querySelector<HTMLButtonElement>('.epg-empty-state button')?.click();
            deferred.handleSelect();
            expect(onSetup).toHaveBeenCalledTimes(2);
        } finally {
            deferred.destroy();
            deferredContainer.remove();
        }
    });

    it('restores grid focus presentation after Back leaves the toolbar', () => {
        epg.loadChannels([createMockChannel(0)]);
        epg.show();
        epg.focusChannel(0);
        epg.handleNavigation('up');
        expect(container.classList.contains('epg-focus-in-toolbar')).toBe(true);

        expect(epg.handleBack()).toBe(true);

        expect(container.querySelector('.epg-toolbar-focused')).toBeNull();
        expect(container.classList.contains('epg-focus-in-toolbar')).toBe(false);
        expect(epg.getState().focusedCell?.channelIndex).toBe(0);
        expect(epg.handleBack()).toBe(false);
    });

    it('clears the menu focus treatment when Guide is hidden and reopened', () => {
        epg.loadChannels([createMockChannel(0)]);
        epg.show();
        epg.focusChannel(0);
        epg.openLineupMenu();
        expect(container.querySelector('.epg-classic-header-brand.epg-toolbar-focused')).not.toBeNull();

        epg.hide();
        epg.show({ preserveFocus: true });

        expect(container.querySelector('.epg-menu-overlay')).toBeNull();
        expect(container.querySelector('.epg-toolbar-focused')).toBeNull();
        expect(container.classList.contains('epg-focus-in-toolbar')).toBe(false);
        expect(epg.getState().focusedCell?.channelIndex).toBe(0);
    });

    it('sets --epg-row-height on the container from config.rowHeight', () => {
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-container-row-height',
            rowHeight: 123,
        });

        try {
            expect(localContainer.style.getPropertyValue('--epg-row-height')).toBe('123px');
        } finally {
            localEpg.destroy();
            expect(localContainer.style.getPropertyValue('--epg-row-height')).toBe('');
            localContainer.remove();
        }
    });

    it('dedupes visible range emissions across repeated renders with unchanged range', () => {
        const onVisibleRangeChange = jest.fn();
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-container-visible-range-dedupe',
            onVisibleRangeChange,
        });

        try {
            const channel = createMockChannel(0);
            localEpg.loadChannels([channel]);
            localEpg.loadScheduleForChannel(channel.id, createMockSchedule(channel.id, 3));

            localEpg.show();
            expect(onVisibleRangeChange).toHaveBeenCalledTimes(1);

            localEpg.loadScheduleForChannel(channel.id, createMockSchedule(channel.id, 3));
            expect(onVisibleRangeChange).toHaveBeenCalledTimes(1);
        } finally {
            localEpg.destroy();
            localContainer.remove();
        }
    });

    it('resets visible range dedupe across close/open cycles', () => {
        const onVisibleRangeChange = jest.fn();
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-container-visible-range-reset',
            onVisibleRangeChange,
        });

        try {
            const channel = createMockChannel(0);
            localEpg.loadChannels([channel]);
            localEpg.loadScheduleForChannel(channel.id, createMockSchedule(channel.id, 3));

            localEpg.show();
            localEpg.hide();
            localEpg.show();

            expect(onVisibleRangeChange).toHaveBeenCalledTimes(2);
        } finally {
            localEpg.destroy();
            localContainer.remove();
        }
    });

    it('uses injected debug runtime for debug log gating', () => {
        const debugRuntime = {
            isEnabled: jest.fn().mockReturnValue(true),
            append: jest.fn(),
            destroy: jest.fn(),
        };
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-container-debug-runtime',
            debugRuntime,
        });

        try {
            const channel = createMockChannel(0);
            localEpg.loadChannels([channel]);
            localEpg.loadScheduleForChannel(channel.id, createMockSchedule(channel.id, 2));
            localEpg.show();

            expect(debugRuntime.isEnabled).toHaveBeenCalled();
            expect(debugRuntime.append).toHaveBeenCalledWith('EPG.show', expect.any(Object));
            expect(debugRuntime.append).toHaveBeenCalledWith(
                'EPG.loadScheduleForChannel',
                expect.objectContaining({
                    rowOrdinal: 0,
                    programCount: 2,
                    focusKindBefore: 'absent',
                    focusKindAfter: 'absent',
                })
            );
            const loadPayload = (debugRuntime.append as jest.Mock).mock.calls.find(
                ([event]) => event === 'EPG.loadScheduleForChannel'
            )?.[1];
            expect(loadPayload).not.toHaveProperty('channelId');
            expect(loadPayload).not.toHaveProperty('focusKeyBefore');
            expect(loadPayload).not.toHaveProperty('focusKeyAfter');
            expect(JSON.stringify(loadPayload)).not.toContain(channel.id);
        } finally {
            localEpg.destroy();
            localContainer.remove();
        }
    });

    it('updates debug log gating immediately after cross-tab storage events through injected runtime', () => {
        let debugEnabled = false;
        const readDebugSpy = jest
            .spyOn(DebugOverridesStore.prototype, 'readEpgDebugEnabledAndClean')
            .mockImplementation(() => debugEnabled);
        const debugRuntime = new EPGDebugRuntime();
        const appendSpy = jest.spyOn(debugRuntime, 'append');
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-container-debug-runtime-storage-event',
            debugRuntime,
        });

        try {
            const channel = createMockChannel(0);
            localEpg.loadChannels([channel]);
            localEpg.loadScheduleForChannel(channel.id, createMockSchedule(channel.id, 2));

            localEpg.show();
            expect(appendSpy).not.toHaveBeenCalled();

            window.dispatchEvent(new StorageEvent('storage', {
                key: LINEUP_STORAGE_KEYS.EPG_DEBUG,
                newValue: '1',
            }));

            localEpg.hide();
            localEpg.show();

            expect(appendSpy).toHaveBeenCalledWith('EPG.show', expect.any(Object));
        } finally {
            localEpg.destroy();
            localContainer.remove();
            debugRuntime.destroy();
            readDebugSpy.mockRestore();
        }
    });

    describe('lifecycle', () => {
        it('should initialize without errors', () => {
            expect(epg.isVisible()).toBe(false);
        });

        it('should throw if container not found', () => {
            const newEpg = new EPGComponent();
            expect(() => {
                newEpg.initialize({
                    containerId: 'non-existent',
                    visibleChannels: 5,
                    timeSlotMinutes: 30,
                    visibleHours: 3,
                    totalHours: 24,
                    pixelsPerMinute: 4,
                    autoFitPixelsPerMinute: false,
                    rowHeight: 80,
                    autoScrollToNow: false,
                });
            }).toThrow('EPG container element not found');
        });
    });

    describe('paging', () => {
        it('pages down by visible channels and updates focus', () => {
            const channels = Array.from({ length: 10 }, (_, index) => createMockChannel(index));
            epg.loadChannels(channels);
            channels.forEach((channel) => {
                epg.loadScheduleForChannel(channel.id, createMockSchedule(channel.id, 2));
            });

            epg.show();
            epg.focusProgram(0, 0);

            const handled = epg.handlePage('down');

            expect(handled).toBe(true);
            expect(epg.getState().focusedCell?.channelIndex).toBe(5);
        });

        it('returns false when paging up at the top channel', () => {
            const channels = Array.from({ length: 10 }, (_, index) => createMockChannel(index));
            epg.loadChannels(channels);
            channels.forEach((channel) => {
                epg.loadScheduleForChannel(channel.id, createMockSchedule(channel.id, 2));
            });

            epg.show();
            epg.focusProgram(0, 0);

            const handled = epg.handlePage('up');

            expect(handled).toBe(false);
            expect(epg.getState().focusedCell?.channelIndex).toBe(0);
        });
    });

    describe('visibility', () => {
        it('should show and hide correctly', () => {
            expect(epg.isVisible()).toBe(false);

            epg.show();
            expect(epg.isVisible()).toBe(true);

            epg.hide();
            expect(epg.isVisible()).toBe(false);
        });

        it('toggles the visible class on the container when opening and closing', () => {
            expect(container.classList.contains(EPG_CLASSES.CONTAINER_VISIBLE)).toBe(false);

            epg.show();
            expect(container.classList.contains(EPG_CLASSES.CONTAINER_VISIBLE)).toBe(true);

            epg.hide();
            expect(container.classList.contains(EPG_CLASSES.CONTAINER_VISIBLE)).toBe(false);
        });

        it('should toggle visibility', () => {
            epg.toggle();
            expect(epg.isVisible()).toBe(true);

            epg.toggle();
            expect(epg.isVisible()).toBe(false);
        });

        it('should emit open and close events', () => {
            const openHandler = jest.fn();
            const closeHandler = jest.fn();

            const openDisposable = epg.on('open', openHandler);
            epg.on('close', closeHandler);

            epg.show();
            expect(openHandler).toHaveBeenCalledTimes(1);

            openDisposable.dispose();
            epg.hide();
            epg.show();
            expect(openHandler).toHaveBeenCalledTimes(1);

            epg.hide();
            expect(closeHandler).toHaveBeenCalledTimes(2);
        });

        it('clears focused ticker state when hiding the guide', () => {
            const anyEpg = epg as unknown as {
                virtualizer: {
                    clearFocusedTickerState: () => void;
                };
            };
            const clearFocusedTickerState = jest.spyOn(anyEpg.virtualizer, 'clearFocusedTickerState');

            epg.show();
            epg.hide();

            expect(clearFocusedTickerState).toHaveBeenCalledTimes(1);
        });

        it('refreshes the time indicator on visibilitychange when visible', () => {
            const nowSpy = jest.spyOn(Date, 'now');
            nowSpy.mockReturnValue(1_000_000);

            epg.show();
            epg.refreshCurrentTime();

            const indicator = container.querySelector('.epg-time-indicator') as HTMLElement;
            const initialLeft = indicator.style.left;

            let visibilityState = 'visible';
            const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                get: () => visibilityState,
            });

            nowSpy.mockReturnValue(1_060_000);
            visibilityState = 'visible';
            document.dispatchEvent(new Event('visibilitychange'));

            expect(indicator.style.left).not.toBe(initialLeft);

            nowSpy.mockRestore();
            if (originalDescriptor) {
                Object.defineProperty(document, 'visibilityState', originalDescriptor);
            }
        });

        it('renders placeholders on open when schedules are missing', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.show();

            const titles = Array.from(container.querySelectorAll('.epg-cell-title'))
                .map((el) => el.textContent);
            expect(titles).toContain('Loading...');
        });

        it('restores info panel content on reopen when preserveFocus is enabled', () => {
            const channel = createMockChannel(0);
            epg.loadChannels([channel]);
            epg.loadScheduleForChannel(channel.id, createDetailedSchedule(channel.id));

            epg.show();
            epg.focusProgram(0, 0);
            epg.hide();

            epg.show({ preserveFocus: true });

            const infoPanel = container.querySelector('.epg-info-panel') as HTMLElement | null;
            const infoTitle = container.querySelector('.epg-info-title') as HTMLElement | null;
            expect(infoPanel?.style.visibility).toBe('visible');
            expect(infoTitle?.textContent).toBe('Program A');
        });
    });

    describe('auto-fit pixelsPerMinute', () => {
        it('renders correctly when auto-fit pixelsPerMinute is enabled', () => {
            const autoContainer = document.createElement('div');
            autoContainer.id = 'epg-container-autofit';
            document.body.appendChild(autoContainer);

            const autoEpg = new EPGComponent();
            autoEpg.initialize({
                containerId: 'epg-container-autofit',
                visibleChannels: 5,
                timeSlotMinutes: 30,
                visibleHours: 3,
                totalHours: 24,
                pixelsPerMinute: 4,
                autoFitPixelsPerMinute: true,
                minPixelsPerMinute: 6,
                maxPixelsPerMinute: 12,
                rowHeight: 80,
                autoScrollToNow: false,
            });

            const programArea = autoContainer.querySelector('.epg-program-area') as HTMLElement;
            programArea.getBoundingClientRect = (): DOMRect =>
                ({
                    width: 1080,
                    height: 0,
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    x: 0,
                    y: 0,
                    toJSON: () => ({}),
                }) as DOMRect;

            autoEpg.show();

            expect(autoContainer.querySelector('.epg-time-header')).not.toBeNull();
            expect(autoContainer.querySelectorAll('.epg-time-slot').length).toBeGreaterThan(0);
            autoEpg.destroy();
            autoContainer.remove();
        });
    });

    describe('info panel debounce', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(0);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('poster/summary deferred during rapid focus changes', () => {
            const channel = createMockChannel(0);
            epg.loadChannels([channel]);
            epg.loadScheduleForChannel(channel.id, createDetailedSchedule(channel.id));
            epg.show();

            epg.focusProgram(0, 0);
            epg.focusProgram(0, 1);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            const description = container.querySelector('.epg-info-description') as HTMLElement;
            const inner = description.querySelector('.epg-info-description-inner') as HTMLElement;

            expect(poster.getAttribute('src')).toBeNull();
            expect(poster.style.display).toBe('none');
            expect(inner.textContent?.trim()).toBe('');
            expect(description.style.display).toBe('none');

            jest.advanceTimersByTime(199);
            expect(poster.getAttribute('src')).toBeNull();
            expect(inner.textContent?.trim()).toBe('');

            jest.advanceTimersByTime(1);
            expect(poster.style.display).toBe('none');
            expect(inner.textContent?.trim()).toBe('Some summary text B');
            expect(description.style.display).toBe('block');
        });

        it('timer cleared on hide', () => {
            const channel = createMockChannel(0);
            epg.loadChannels([channel]);
            epg.loadScheduleForChannel(channel.id, createDetailedSchedule(channel.id));
            epg.show();

            epg.focusProgram(0, 0);
            epg.hide();

            jest.advanceTimersByTime(250);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            const description = container.querySelector('.epg-info-description') as HTMLElement;
            const inner = description.querySelector('.epg-info-description-inner') as HTMLElement;

            expect(poster.getAttribute('src')).toBeNull();
            expect(poster.style.display).toBe('none');
            expect(inner.textContent?.trim()).toBe('');
        });

        it('timer cleared when schedules are cleared', () => {
            const channel = createMockChannel(0);
            epg.loadChannels([channel]);
            epg.loadScheduleForChannel(channel.id, createDetailedSchedule(channel.id));
            epg.show();

            epg.focusProgram(0, 0);
            epg.clearSchedules();

            jest.advanceTimersByTime(250);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            const description = container.querySelector('.epg-info-description') as HTMLElement;
            const inner = description.querySelector('.epg-info-description-inner') as HTMLElement;

            expect(poster.getAttribute('src')).toBeNull();
            expect(poster.style.display).toBe('none');
            expect(inner.textContent?.trim()).toBe('');
        });
    });

    describe('data loading', () => {
        it('should load channels', () => {
            const channels = [createMockChannel(0), createMockChannel(1)];
            epg.loadChannels(channels);

            const state = epg.getState();
            expect(state.viewWindow.endChannelIndexExclusive).toBe(2);
        });

        it('should load schedule for channel', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 10));

            // Should be able to focus a program now
            epg.show();
            epg.focusProgram(0, 0);
            expect(epg.getFocusedProgram()).not.toBeNull();
        });

        it('reuses the same channel id array reference across consecutive render passes', () => {
            const channels = [createMockChannel(0), createMockChannel(1), createMockChannel(2)];
            epg.loadChannels(channels);
            channels.forEach((channel) => {
                epg.loadScheduleForChannel(channel.id, createMockSchedule(channel.id, 3));
            });
            epg.show();

            const anyEpg = epg as unknown as {
                renderGridInternal: () => void;
                virtualizer: {
                    renderVisibleCells: (
                        channelIds: string[],
                        schedules: Map<string, ScheduleWindow>,
                        range: unknown,
                        focusedCellKey?: string,
                        currentTime?: number
                    ) => void;
                };
            };

            const renderSpy = jest.spyOn(anyEpg.virtualizer, 'renderVisibleCells');
            renderSpy.mockClear();

            anyEpg.renderGridInternal();
            anyEpg.renderGridInternal();

            expect(renderSpy).toHaveBeenCalledTimes(2);

            const firstChannelIds = renderSpy.mock.calls[0]?.[0] as string[];
            const secondChannelIds = renderSpy.mock.calls[1]?.[0] as string[];

            expect(firstChannelIds).toBe(secondChannelIds);
        });
    });

    describe('row lifecycle', () => {
        it('stores and clears terminal row state without touching schedules', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);

            expect(epg.getRowLifecycle('ch0')).toBeNull();

            epg.setRowLifecycle('ch0', { kind: 'unavailable', rangeKey: 'day' });
            expect(epg.getRowLifecycle('ch0')).toEqual({ kind: 'unavailable', rangeKey: 'day' });

            epg.clearRowLifecycle('ch0', 'other-day');
            expect(epg.getRowLifecycle('ch0')).toEqual({ kind: 'unavailable', rangeKey: 'day' });

            epg.clearRowLifecycle('ch0', 'day');
            expect(epg.getRowLifecycle('ch0')).toBeNull();
        });

        it('clears the terminal row when a matching schedule arrives', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.setRowLifecycle('ch0', { kind: 'retrying', rangeKey: 'day' });

            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 3));

            expect(epg.getRowLifecycle('ch0')).toBeNull();
            epg.show();
            epg.focusProgram(0, 0);
            expect(epg.getFocusedProgram()).not.toBeNull();
        });

        it('reports whether a component-held schedule matches the requested range', () => {
            epg.loadChannels([createMockChannel(0)]);
            epg.loadScheduleForChannel('ch0', {
                startTime: 1_000,
                endTime: 61_000,
                programs: [],
            });

            expect(epg.hasScheduleForChannelRange('ch0', 1_000, 61_000)).toBe(true);
            expect(epg.hasScheduleForChannelRange('ch0', 0, 60_000)).toBe(false);
            expect(epg.hasScheduleForChannelRange('missing', 1_000, 61_000)).toBe(false);
        });

        it('exposes held schedule freshness and clears an old same-ID source before render', () => {
            const original = createMockChannel(0);
            const schedule = createDetailedSchedule(original.id);
            epg.loadChannels([original]);
            epg.loadScheduleForChannel(original.id, schedule);

            expect(epg.getHeldScheduleForChannel(original.id)).toEqual(expect.objectContaining({
                schedule,
                loadedAt: expect.any(Number),
                channelSnapshot: original,
            }));

            const replacement: ChannelConfig = {
                ...original,
                updatedAt: original.updatedAt + 1,
                contentSource: {
                    type: 'collection',
                    collectionKey: 'replacement-source',
                    collectionName: 'Replacement',
                },
            };
            epg.loadChannels([replacement]);

            expect(epg.getHeldScheduleForChannel(original.id)).toBeNull();
            expect(epg.hasScheduleForChannelRange(original.id, schedule.startTime, schedule.endTime)).toBe(false);
            epg.show();
            expect(container.textContent).not.toContain('Program A');
        });

        it('drops terminal rows for removed channels and on full schedule clear', () => {
            epg.loadChannels([createMockChannel(0), createMockChannel(1)]);
            epg.setRowLifecycle('ch0', { kind: 'unavailable', rangeKey: 'day' });
            epg.setRowLifecycle('ch1', { kind: 'unavailable', rangeKey: 'day' });

            epg.loadChannels([createMockChannel(1)]);
            expect(epg.getRowLifecycle('ch0')).toBeNull();
            expect(epg.getRowLifecycle('ch1')).toEqual({ kind: 'unavailable', rangeKey: 'day' });

            epg.clearSchedules();
            expect(epg.getRowLifecycle('ch1')).toBeNull();
        });

        it('renders the unavailable retry action once the row settles', () => {
            epg.loadChannels([createMockChannel(0)]);
            epg.show();
            epg.setRowLifecycle('ch0', { kind: 'unavailable', rangeKey: 'day' });

            const titles = Array.from(container.querySelectorAll('.epg-cell-title')).map(
                (title) => title.textContent
            );
            expect(titles).toContain('Unavailable — OK to retry');
            const action = Array.from(container.querySelectorAll('.epg-cell')).find(
                (cell) => cell.textContent === 'Unavailable — OK to retry' ||
                    cell.querySelector('.epg-cell-title')?.textContent === 'Unavailable — OK to retry'
            ) as HTMLElement | undefined;
            expect(action?.classList.contains(EPG_CLASSES.CELL_UNAVAILABLE)).toBe(true);
            expect(action?.classList.contains(EPG_CLASSES.CELL_LOADING)).toBe(false);
        });

        it('keeps unavailable presentation visible under forced colors without shimmer', () => {
            const css = normalizeLineEndings(readFileSync('src/modules/ui/epg/styles.cells.css', 'utf8'));
            const forcedColors = css.match(/@media\s*\(forced-colors:\s*active\)\s*{([\s\S]*?)}\s*$/);
            expect(forcedColors).not.toBeNull();
            expect(forcedColors?.[1]).toContain('.epg-cell.unavailable');
            expect(css).toContain('.epg-cell.unavailable');
            const unavailableRules = css.match(/\.epg-cell\.unavailable[^{]*{[^}]*}/g) ?? [];
            expect(unavailableRules.length).toBeGreaterThan(0);
            for (const rule of unavailableRules) {
                expect(rule).not.toContain('animation');
            }
        });
    });

    describe('navigation', () => {
        beforeEach(() => {
            const channels = [
                createMockChannel(0),
                createMockChannel(1),
                createMockChannel(2),
            ];
            epg.loadChannels(channels);
            channels.forEach((ch) => {
                epg.loadScheduleForChannel(ch.id, createMockSchedule(ch.id, 10));
            });
            epg.show();
        });

        it('keeps time offset non-negative when navigating left near the start', () => {
            epg.focusProgram(0, 0);
            epg.handleNavigation('left');
            expect(epg.getState().scrollPosition.timeOffset).toBeGreaterThanOrEqual(0);
        });

        it('should focus first visible cell when no focus and navigation pressed', () => {
            const moved = epg.handleNavigation('down');
            expect(moved).toBe(true);
            expect(epg.getFocusedProgram()).not.toBeNull();
        });

        it('should move focus right to next program', () => {
            epg.focusProgram(0, 0);
            const initialFocus = expectPresent(epg.getFocusedProgram());

            const moved = epg.handleNavigation('right');
            const newFocus = expectPresent(epg.getFocusedProgram());

            expect(moved).toBe(true);
            expect(newFocus.scheduledStartTime).toBeGreaterThanOrEqual(initialFocus.scheduledEndTime);
        });

        it('should move focus left to previous program', () => {
            epg.focusProgram(0, 1);

            const moved = epg.handleNavigation('left');

            expect(moved).toBe(true);
            const focused = epg.getState().focusedCell;
            expect(focused?.kind).toBe('program');
            if (focused?.kind === 'program') {
                expect(focused.programIndex).toBe(0);
            }
        });

        it('should move focus up/down between channels', () => {
            epg.focusProgram(1, 0); // Start on channel 1

            const movedUp = epg.handleNavigation('up');
            expect(movedUp).toBe(true);
            expect(expectPresent(epg.getState().focusedCell).channelIndex).toBe(0);

            const movedDown = epg.handleNavigation('down');
            expect(movedDown).toBe(true);
            expect(expectPresent(epg.getState().focusedCell).channelIndex).toBe(1);
        });

        it('moves into the toolbar when navigating up from the first channel', () => {
            epg.focusProgram(0, 0); // First channel
            const moved = epg.handleNavigation('up');
            expect(moved).toBe(true);
            expect(expectPresent(epg.getState().focusedCell).channelIndex).toBe(0);
            expect(container.querySelector('.epg-toolbar-button.epg-toolbar-focused')).not.toBeNull();
        });

        it('should wrap to first channel when navigating down from bottom', () => {
            epg.focusProgram(2, 0); // Last channel (index 2)
            const moved = epg.handleNavigation('down');
            expect(moved).toBe(true);
            expect(expectPresent(epg.getState().focusedCell).channelIndex).toBe(0);
        });

        it('should emit focusChange event', () => {
            const handler = jest.fn();
            epg.on('focusChange', handler);

            epg.focusProgram(0, 0);

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'program',
                    channelIndex: 0,
                    programIndex: 0,
                })
            );
        });

        it('keeps a single focused cell class after repeated left/right scrub', () => {
            epg.focusProgram(0, 2);

            epg.handleNavigation('right');
            epg.handleNavigation('right');
            epg.handleNavigation('left');
            epg.handleNavigation('left');

            const focusedCells = container.querySelectorAll('.epg-cell.focused');
            expect(focusedCells.length).toBe(1);

            const focused = epg.getState().focusedCell;
            expect(focused?.kind).toBe('program');
            if (focused?.kind === 'program') {
                const expectedKey = `ch${focused.channelIndex}-${focused.program.scheduledStartTime}`;
                expect((focusedCells[0] as HTMLElement).getAttribute('data-key')).toBe(expectedKey);
            }
        });
    });

    describe('program-area overlays', () => {
        beforeEach(() => {
            const channels = [
                createMockChannel(0),
                createMockChannel(1),
            ];
            epg.loadChannels(channels);
            channels.forEach((ch) => {
                epg.loadScheduleForChannel(ch.id, createMockSchedule(ch.id, 8));
            });
            epg.show();
            epg.focusProgram(0, 0);
        });

        it('renders left/right edge mask layers that are non-interactive', () => {
            const masks = container.querySelectorAll(`.${EPG_CLASSES.PROGRAM_EDGE_MASK}`);
            expect(masks.length).toBe(2);
            masks.forEach((mask) => {
                expect(mask.getAttribute('aria-hidden')).toBe('true');
                expect(mask.hasAttribute('tabindex')).toBe(false);
            });
            expect(container.querySelector(`.${EPG_CLASSES.PROGRAM_EDGE_MASK_LEFT}`)).not.toBeNull();
            expect(container.querySelector(`.${EPG_CLASSES.PROGRAM_EDGE_MASK_RIGHT}`)).not.toBeNull();
        });

        it('does not render a horizontal scrub overlay during navigation', () => {
            const moved = epg.handleNavigation('right');
            expect(moved).toBe(true);

            const scrubLabel = container.querySelector('.epg-scrub-label');
            expect(scrubLabel).toBeNull();
        });

        it('keeps focused program and info panel updates without scrub overlay', () => {
            const moved = epg.handleNavigation('right');
            expect(moved).toBe(true);
            const focused = epg.getState().focusedCell;
            expect(focused?.kind).toBe('program');

            const infoTitle = container.querySelector('.epg-info-title') as HTMLElement;
            expect(container.querySelector('.epg-scrub-label')).toBeNull();
            expect(infoTitle.textContent).toBe('Program 2');
        });
    });

    describe('selection', () => {
        beforeEach(() => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 5));
            epg.show();
            epg.focusProgram(0, 0);
        });

        it('should emit channelSelected on OK press', () => {
            const handler = jest.fn();
            epg.on('channelSelected', handler);

            epg.handleSelect();

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    channel: expect.any(Object),
                    program: expect.any(Object),
                })
            );
        });

        it('should emit programSelected on OK press', () => {
            const handler = jest.fn();
            epg.on('programSelected', handler);

            epg.handleSelect();

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('schedule focus stability', () => {
        it('keeps focused program when schedule reload preserves the same program', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 3));
            epg.show();
            epg.focusProgram(0, 1);

            const before = epg.getState().focusedCell;
            expect(before?.kind).toBe('program');

            // Reload schedule with same program entries
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 3));

            const after = epg.getState().focusedCell;
            expect(after?.kind).toBe('program');
            if (before?.kind === 'program' && after?.kind === 'program') {
                expect(after.program.item.ratingKey).toBe(before.program.item.ratingKey);
            }
        });

        it('does not auto-shift focus while a selection is in progress', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 3));
            epg.show();
            epg.focusProgram(0, 1);

            const before = epg.getState().focusedCell;
            expect(before?.kind).toBe('program');

            epg.handleSelect();
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 1));

            const after = epg.getState().focusedCell;
            expect(after?.kind).toBe('program');
            if (before?.kind === 'program' && after?.kind === 'program') {
                expect(after.program.item.ratingKey).toBe(before.program.item.ratingKey);
            }
        });

        it('auto-focuses a placeholder when its schedule arrives', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.show();
            epg.focusChannel(0); // placeholder focus because no schedule

            const before = epg.getState().focusedCell;
            expect(before?.kind).toBe('placeholder');

            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 2));

            const after = epg.getState().focusedCell;
            expect(after?.kind).toBe('program');
        });
    });

    describe('back button', () => {
        it('delegates root Back to navigation while visible', () => {
            epg.show();
            expect(epg.isVisible()).toBe(true);

            const handled = epg.handleBack();

            expect(handled).toBe(false);
            expect(epg.isVisible()).toBe(true);
        });

        it('should return false on back press when already hidden', () => {
            expect(epg.isVisible()).toBe(false);
            expect(epg.handleBack()).toBe(false);
        });
    });

    describe('time indicator', () => {
        it('should position indicator at current time', () => {
            epg.show();

            const indicator = container.querySelector('.epg-time-indicator') as HTMLElement;
            expect(indicator).not.toBeNull();
            expect(indicator.style.left).toBeDefined();
        });

        it('should scroll with grid content when timeOffset changes', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 10));
            epg.show();

            const indicator = container.querySelector('.epg-time-indicator') as HTMLElement;
            expect(indicator).not.toBeNull();
            expect(indicator.parentElement).not.toBeNull();

            // Scroll to 2 hours from anchor
            const twoHoursFromAnchor = epg.getState().viewWindow.startTime + (2 * 60 * 60000);
            epg.scrollToTime(twoHoursFromAnchor);

            // Indicator should be attached to the translated content element (virtualizer),
            // not the fixed program area.
            expect((indicator.parentElement as HTMLElement).style.transform).toMatch(/translateX\(-?\d+px\)/);
        });

        it('should update position on refreshCurrentTime', () => {
            epg.show();

            const indicator = container.querySelector('.epg-time-indicator') as HTMLElement;

            // Mock time advancement by directly calling refresh
            epg.refreshCurrentTime();

            // Position should be updated (may or may not change depending on timing)
            expect(indicator.style.left).toBeDefined();
        });
    });

    describe('state', () => {
        it('should return correct state', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.show();

            const state = epg.getState();

            expect(state.isVisible).toBe(true);
            expect(state.scrollPosition).toEqual({ channelOffset: 0, timeOffset: 0 });
            expect(state.currentTime).toBeGreaterThan(0);
        });

        it('updates time header transform when timeOffset changes via scrollToTime', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 10));
            epg.show();

            const header = container.querySelector(`.${EPG_CLASSES.TIME_HEADER}`) as HTMLElement;
            const slots = container.querySelector(`.${EPG_CLASSES.TIME_HEADER_SLOTS}`) as HTMLElement;
            expect(header).not.toBeNull();
            expect(slots).not.toBeNull();

            // Scroll to 2 hours from anchor
            const twoHoursFromAnchor = epg.getState().viewWindow.startTime + (2 * 60 * 60000);
            epg.scrollToTime(twoHoursFromAnchor);

            // Slots transform should be updated (negative translateX)
            expect(slots.style.transform).toMatch(/translateX\(-?\d+px\)/);
            expect(header.style.transform).toBe('');
            expect(epg.getState().scrollPosition.timeOffset).toBeGreaterThan(0);
        });

        it('keeps timeOffset at 0 when autoScrollToNow is enabled (window anchored to now)', () => {
            const now = new Date('2026-01-07T10:00:00Z').getTime();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            const newEpg = new EPGComponent();
            const newContainer = document.createElement('div');
            newContainer.id = 'epg-container-2';
            document.body.appendChild(newContainer);

            newEpg.initialize({
                containerId: 'epg-container-2',
                visibleChannels: 5,
                timeSlotMinutes: 30,
                visibleHours: 3,
                totalHours: 24,
                pixelsPerMinute: 4,
                rowHeight: 80,
                autoScrollToNow: true,
            });

            newEpg.loadChannels([createMockChannel(0)]);
            newEpg.show();

            expect(newEpg.getState().scrollPosition.timeOffset).toBe(0);

            newEpg.destroy();
            newContainer.remove();
            (Date.now as jest.Mock).mockRestore();
        });

        it('should return focused program', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.loadScheduleForChannel('ch0', createMockSchedule('ch0', 5));
            epg.show();

            expect(epg.getFocusedProgram()).toBeNull();

            epg.focusProgram(0, 0);
            expect(epg.getFocusedProgram()).not.toBeNull();
        });

        it('keeps focusTime even when schedule is missing', () => {
            const channels = [createMockChannel(0)];
            epg.loadChannels(channels);
            epg.show();

            epg.handleNavigation('down');

            const focused = epg.getState().focusedCell;
            expect(focused?.kind).toBe('placeholder');
            if (focused?.kind === 'placeholder') {
                expect(focused.focusTimeMs).toBeGreaterThan(0);
            }
        });
    });

    describe('library picker', () => {
        const libraries = [
            { id: 'lib1', name: 'Movies' },
            { id: 'lib2', name: 'TV' },
        ];

        const setupWithPicker = (): ChannelConfig[] => {
            const channels = [createMockChannel(0), createMockChannel(1)];
            epg.loadChannels(channels);
            channels.forEach((ch) => {
                epg.loadScheduleForChannel(ch.id, createMockSchedule(ch.id, 2));
            });
            epg.setLibraryTabs(libraries, 'lib1');
            epg.focusChannel(0);
            epg.show();
            return channels;
        };

        it('UP from top enters library pill focus mode', () => {
            setupWithPicker();
            epg.handleNavigation('up');
            const focusedPill = container.querySelector('.epg-library-pill.focused');
            expect(focusedPill).not.toBeNull();
        });

        it('DOWN exits pill focus mode and focuses channel 0', () => {
            setupWithPicker();
            epg.handleNavigation('up');

            const handled = epg.handleNavigation('down');

            expect(handled).toBe(true);
            const focusedPill = container.querySelector('.epg-library-pill.focused');
            expect(focusedPill).toBeNull();
            expect(container.classList.contains('epg-focus-in-toolbar')).toBe(false);
            const focused = epg.getState().focusedCell;
            expect(focused?.channelIndex).toBe(0);
        });

        it('OK opens picker modal without emitting libraryFilterChanged', () => {
            setupWithPicker();
            const onFilter = jest.fn();
            epg.on('libraryFilterChanged', onFilter);

            epg.handleNavigation('up');
            epg.handleSelect();

            expect(onFilter).not.toHaveBeenCalled();
            const overlay = container.querySelector('.epg-library-picker-overlay');
            expect(overlay).not.toBeNull();
            // The grid supplies the popup's bounds and spacing below the separate video plane.
            expect(overlay?.parentElement).toBe(container.querySelector('.epg-grid'));
        });

        it('moves from the library pill into the toolbar on RIGHT', () => {
            setupWithPicker();
            epg.handleNavigation('up');

            const leftHandled = epg.handleNavigation('left');
            const rightHandled = epg.handleNavigation('right');

            expect(leftHandled).toBe(true);
            expect(rightHandled).toBe(true);
            const focusedPill = container.querySelector('.epg-library-pill.focused');
            expect(focusedPill).toBeNull();
            expect(container.querySelector('.epg-toolbar-button.epg-toolbar-focused')).not.toBeNull();
            const focused = epg.getState().focusedCell;
            expect(focused?.channelIndex).toBe(0);
        });

        it('hands library focus to a pointer-selected toolbar control before returning to the grid', () => {
            setupWithPicker();
            const onChannel = jest.fn();
            epg.on('channelSelected', onChannel);
            epg.handleNavigation('up');

            container.querySelector<HTMLButtonElement>('[data-action="hours"]')?.click();
            expect(container.querySelector('.epg-library-pill.focused')).toBeNull();
            epg.handleNavigation('down');
            epg.handleSelect();

            expect(container.classList.contains('epg-focus-in-toolbar')).toBe(false);
            expect(container.querySelector('.epg-library-picker-overlay')).toBeNull();
            expect(onChannel).toHaveBeenCalledTimes(1);
        });

        it('hands toolbar focus to a pointer-opened library picker for remote selection', () => {
            setupWithPicker();
            const onFilter = jest.fn();
            epg.on('libraryFilterChanged', onFilter);
            epg.handleNavigation('up');
            epg.handleNavigation('right');

            container.querySelector<HTMLButtonElement>('.epg-library-pill')?.click();
            epg.handleNavigation('down');
            expect(container.querySelector('.epg-library-picker-item.focused')?.textContent).toBe('TV');
            epg.handleSelect();

            expect(onFilter).toHaveBeenCalledWith({ libraryId: 'lib2' });
            expect(container.querySelector('.epg-toolbar-button.epg-toolbar-focused')).toBeNull();
            expect(container.querySelector('.epg-search-overlay')).toBeNull();
            expect(container.querySelector('.epg-library-picker-overlay')).toBeNull();
            expect(container.querySelector('.epg-library-pill.focused')).not.toBeNull();
        });

        it('closes a library picker when a pointer-selected toolbar control takes focus', () => {
            setupWithPicker();
            epg.handleNavigation('up');
            epg.handleSelect();

            container.querySelector<HTMLButtonElement>('[data-action="hours"]')?.click();

            expect(container.querySelector('.epg-library-picker-overlay')).toBeNull();
            expect(container.querySelector('.epg-library-pill.focused')).toBeNull();
            expect(container.querySelector('[data-action="hours"].epg-toolbar-focused')).not.toBeNull();
            expect(epg.handleBack()).toBe(true);
            expect(container.classList.contains('epg-focus-in-toolbar')).toBe(false);
        });

        it('keeps one popup owner when the Lineup menu replaces a library picker', () => {
            setupWithPicker();
            epg.handleNavigation('up');
            epg.handleSelect();

            epg.openLineupMenu();

            expect(container.querySelector('.epg-library-picker-overlay')).toBeNull();
            expect(container.querySelector('.epg-library-pill.focused')).toBeNull();
            expect(container.querySelector('.epg-menu-overlay')).not.toBeNull();
            epg.handleBack();
            expect(container.querySelector('.epg-classic-header-brand.epg-toolbar-focused')).not.toBeNull();
            epg.handleNavigation('down');
            expect(container.querySelector('.epg-library-pill.focused')).not.toBeNull();
        });

        it('closes search when the pointer opens the Lineup menu and relinquishes menu focus to the toolbar', () => {
            setupWithPicker();
            container.querySelector<HTMLButtonElement>('[data-action="search"]')?.click();
            expect(document.activeElement).toBe(container.querySelector('.epg-search-input'));

            container.querySelector<HTMLButtonElement>('[data-action="menu"]')?.click();

            expect(container.querySelector('.epg-search-overlay')).toBeNull();
            expect(container.querySelector('.epg-toolbar-button.epg-toolbar-focused')).toBeNull();
            expect(container.querySelector('.epg-menu-overlay')).not.toBeNull();

            container.querySelector<HTMLButtonElement>('[data-action="hours"]')?.click();
            expect(container.querySelector('.epg-menu-overlay')).toBeNull();
            expect(container.querySelector('.epg-classic-header-brand.epg-toolbar-focused')).toBeNull();
            expect(container.querySelector('[data-action="hours"].epg-toolbar-focused')).not.toBeNull();
        });

        it('UP/DOWN moves highlighted item while picker open', () => {
            setupWithPicker();
            epg.handleNavigation('up');
            epg.handleSelect();

            let focusedItem = container.querySelector('.epg-library-picker-item.focused') as HTMLElement | null;
            expect(focusedItem?.textContent).toBe('Movies');

            epg.handleNavigation('down');
            focusedItem = container.querySelector('.epg-library-picker-item.focused') as HTMLElement | null;
            expect(focusedItem?.textContent).toBe('TV');

            epg.handleNavigation('up');
            focusedItem = container.querySelector('.epg-library-picker-item.focused') as HTMLElement | null;
            expect(focusedItem?.textContent).toBe('Movies');

            epg.handleNavigation('up');
            focusedItem = container.querySelector('.epg-library-picker-item.focused') as HTMLElement | null;
            expect(focusedItem?.textContent).toBe('All');
        });

        it('clears retained library focus when Guide is hidden and reopened', () => {
            setupWithPicker();
            epg.handleNavigation('up');
            epg.handleSelect();

            epg.hide();
            epg.show({ preserveFocus: true });

            expect(container.querySelector('.epg-library-picker-overlay')).toBeNull();
            expect(container.querySelector('.epg-library-pill.focused')).toBeNull();
            expect(container.classList.contains('epg-focus-in-toolbar')).toBe(false);
            expect(epg.getState().focusedCell?.channelIndex).toBe(0);
        });

        it('LEFT/RIGHT are no-op but handled while picker open', () => {
            setupWithPicker();
            epg.handleNavigation('up');
            epg.handleSelect();

            const before = container.querySelector('.epg-library-picker-item.focused') as HTMLElement | null;
            const leftHandled = epg.handleNavigation('left');
            const rightHandled = epg.handleNavigation('right');
            const after = container.querySelector('.epg-library-picker-item.focused') as HTMLElement | null;

            expect(leftHandled).toBe(true);
            expect(rightHandled).toBe(true);
            expect(after?.textContent).toBe(before?.textContent);
        });

        it('OK selects highlighted item, emits libraryFilterChanged, closes picker', () => {
            setupWithPicker();
            const onFilter = jest.fn();
            epg.on('libraryFilterChanged', onFilter);

            epg.handleNavigation('up');
            epg.handleSelect();
            epg.handleNavigation('down');
            epg.handleSelect();

            expect(onFilter).toHaveBeenCalledWith({ libraryId: 'lib2' });
            const overlay = container.querySelector('.epg-library-picker-overlay');
            expect(overlay).toBeNull();
        });

        it('Back closes picker without closing EPG', () => {
            setupWithPicker();
            epg.handleNavigation('up');
            epg.handleSelect();

            const handled = epg.handleBack();

            expect(handled).toBe(true);
            expect(epg.isVisible()).toBe(true);
            const overlay = container.querySelector('.epg-library-picker-overlay');
            expect(overlay).toBeNull();
        });
    });

    describe('virtualization', () => {
        it('should render only visible cells plus buffer', () => {
            // Load 50 channels with 48 half-hour programs each = 2400 potential cells
            const channels = Array.from({ length: 50 }, (_, i) => createMockChannel(i));
            epg.loadChannels(channels);

            channels.forEach((ch) => {
                epg.loadScheduleForChannel(ch.id, createMockSchedule(ch.id, 24));
            });

            epg.show();

            // Count DOM elements
            const cellCount = container.querySelectorAll('.epg-cell').length;

            // Should render max ~200 (visible + buffer), not all 2400
            expect(cellCount).toBeLessThan(200);
            expect(cellCount).toBeGreaterThan(0);
        });

        it('should scroll when focus moves outside visible area', () => {
            const channels = Array.from({ length: 20 }, (_, i) => createMockChannel(i));
            epg.loadChannels(channels);
            channels.forEach((ch) => {
                epg.loadScheduleForChannel(ch.id, createMockSchedule(ch.id, 10));
            });
            epg.show();

            const initialOffset = epg.getState().scrollPosition.channelOffset;

            // Focus channel beyond visible area
            epg.focusChannel(15);

            const newOffset = epg.getState().scrollPosition.channelOffset;
            expect(newOffset).toBeGreaterThan(initialOffset);
        });
    });
});
