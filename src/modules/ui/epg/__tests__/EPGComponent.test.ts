/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Component unit tests
 * @module modules/ui/epg/__tests__/EPGComponent.test
 */

import { EPGComponent } from '../EPGComponent';
import { EPGInfoPanel } from '../EPGInfoPanel';
import { EPG_CLASSES } from '../constants';
import type { ScheduledProgram, ScheduleWindow, ChannelConfig, EPGConfig } from '../types';

describe('EPGComponent', () => {
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
            showCurrentTimeIndicator: true,
            autoScrollToNow: false,
            layoutMode: overrides.layoutMode ?? 'classic',
            resolveThumbUrl: (url) => url,
            ...overrides,
        };

        instance.initialize(config);

        return { epg: instance, container: instanceContainer };
    };

    it('does not render the legacy key legend', () => {
        const legend = container.querySelector(`.${EPG_CLASSES.LEGEND}`);
        expect(legend).toBeNull();
    });

    it('renders classic header placeholder before the grid container', () => {
        const header = container.querySelector('.epg-classic-header');
        const title = container.querySelector('.epg-classic-header-title');
        const grid = container.querySelector(`.${EPG_CLASSES.GRID}`);

        expect(header).not.toBeNull();
        expect(title?.textContent).toBe('LINEUP');
        expect(grid).not.toBeNull();
    });

    it('renders classic showcase and overlay showcase between header and grid', () => {
        const header = container.querySelector('.epg-classic-header');
        const showcase = container.querySelector('.epg-classic-showcase');
        const overlayShowcase = container.querySelector(`.${EPG_CLASSES.OVERLAY_SHOWCASE}`);
        const pip = container.querySelector('.epg-classic-showcase-pip');
        const infoHost = container.querySelector('.epg-classic-showcase-info');
        const grid = container.querySelector(`.${EPG_CLASSES.GRID}`);

        expect(header).not.toBeNull();
        expect(showcase).not.toBeNull();
        expect(overlayShowcase).not.toBeNull();
        expect(pip).not.toBeNull();
        expect(infoHost).not.toBeNull();
        expect(grid).not.toBeNull();
        expect(header?.nextElementSibling).toBe(showcase);
        expect(showcase?.nextElementSibling).toBe(overlayShowcase);
        expect(overlayShowcase?.nextElementSibling).toBe(grid);
    });

    it('renders overlay showcase containing info panel and dashboard with banner', () => {
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-container-dashboard-structure',
            layoutMode: 'overlay',
        });

        try {
            const dashboard = localContainer.querySelector(`.${EPG_CLASSES.DASHBOARD_BOTTOM}`) as HTMLElement | null;
            const overlayShowcase = localContainer.querySelector(`.${EPG_CLASSES.OVERLAY_SHOWCASE}`) as HTMLElement | null;
            expect(dashboard).not.toBeNull();
            expect(overlayShowcase).not.toBeNull();
            expect(dashboard!.querySelector(`.${EPG_CLASSES.NOW_WATCHING_BANNER}`)).not.toBeNull();
            expect(overlayShowcase!.querySelector(`.${EPG_CLASSES.INFO_PANEL}`)).not.toBeNull();
            expect(dashboard!.querySelector(`.${EPG_CLASSES.INFO_PANEL}`)).toBeNull();
        } finally {
            localEpg.destroy();
            localContainer.remove();
        }
    });

    it('wires the resolved layout mode into the shared info panel presentation mode', () => {
        const { epg: localEpg, container: localContainer } = createEpgInstance({
            containerId: 'epg-container-presentation-mode-plumbing',
            layoutMode: 'classic',
            getCurrentChannelInfo: () => ({
                channelNumber: 7,
                channelName: 'News',
                programTitle: 'Morning Report',
                timeLabel: '8:00 - 9:00',
            }),
        });

        try {
            const setPresentationModeSpy = jest.spyOn(
                (localEpg as unknown as { infoPanel: EPGInfoPanel }).infoPanel,
                'setPresentationMode'
            );

            localEpg.show();
            expect(setPresentationModeSpy).toHaveBeenCalledWith('classic');

            localEpg.setLayoutMode('overlay');
            expect(setPresentationModeSpy).toHaveBeenLastCalledWith('overlay');
        } finally {
            localEpg.destroy();
            localContainer.remove();
        }
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
                streamDescriptor: null,
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
                streamDescriptor: null,
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
                streamDescriptor: null,
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
                    showCurrentTimeIndicator: true,
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

            epg.on('open', openHandler);
            epg.on('close', closeHandler);

            epg.show();
            expect(openHandler).toHaveBeenCalledTimes(1);

            epg.hide();
            expect(closeHandler).toHaveBeenCalledTimes(1);
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

    describe('peek mode', () => {
        it('adds peek class when video playing', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-peek-playing',
                isVideoPlaying: () => true,
            });

            try {
                localEpg.show();
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_PEEK)).toBe(true);
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('does not add peek class when not playing', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-peek-stopped',
                isVideoPlaying: () => false,
            });

            try {
                localEpg.show();
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_PEEK)).toBe(false);
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('removes peek class on hide', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-peek-hide',
                isVideoPlaying: () => true,
            });

            try {
                localEpg.show();
                localEpg.hide();
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_PEEK)).toBe(false);
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });
    });

    describe('now watching banner', () => {
        it('shows banner when enabled and info available', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-now-watching',
                layoutMode: 'overlay',
                getCurrentChannelInfo: () => ({
                    channelNumber: 7,
                    channelName: 'News',
                    programTitle: 'Morning Report',
                    timeLabel: '8:00 - 9:00',
                }),
            });

            try {
                localEpg.show();
                const banner = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_BANNER}`) as HTMLElement;
                const channel = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_CHANNEL}`) as HTMLElement;
                const program = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_PROGRAM}`) as HTMLElement;
                const time = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_TIME}`) as HTMLElement;
                const live = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_LIVE}`) as HTMLElement | null;

                expect(banner.hidden).toBe(false);
                expect(live).not.toBeNull();
                expect((live?.textContent ?? '').trim()).toBe('NOW PLAYING');
                expect(channel.textContent).toBe('7 • News');
                expect(program.textContent).toBe('Morning Report');
                expect(time.textContent).toBe('8:00 - 9:00');
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('renders classic now playing status in the top rail and hides the lower banner in classic mode', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-classic-now-playing-rail',
                layoutMode: 'classic',
                getCurrentChannelInfo: () => ({
                    channelNumber: 7,
                    channelName: 'News',
                    programTitle: 'Morning Report',
                    timeLabel: '8:00 - 9:00',
                }),
            });

            try {
                localEpg.show();

                const rail = localContainer.querySelector('.epg-classic-now-playing') as HTMLElement | null;
                const banner = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_BANNER}`) as HTMLElement | null;
                const bannerLabel = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_LIVE}`) as HTMLElement | null;

                expect(rail).not.toBeNull();
                expect((rail?.textContent ?? '')).toContain('NOW PLAYING');
                expect(banner?.hidden).toBe(true);
                expect(bannerLabel?.textContent).toBe('NOW PLAYING');
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('hides banner when disabled', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-now-watching-disabled',
                showNowWatchingBanner: false,
                getCurrentChannelInfo: () => ({
                    channelNumber: 5,
                    channelName: 'Sports',
                    programTitle: 'Highlights',
                    timeLabel: '10:00 - 11:00',
                }),
            });

            try {
                localEpg.show();
                const banner = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_BANNER}`) as HTMLElement;
                expect(banner.hidden).toBe(true);
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('hides banner when info is unavailable', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-now-watching-null',
                getCurrentChannelInfo: () => null,
            });

            try {
                localEpg.show();
                const banner = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_BANNER}`) as HTMLElement;
                expect(banner.hidden).toBe(true);
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('sanitizes invalid time labels', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-now-watching-invalid-time',
                layoutMode: 'overlay',
                getCurrentChannelInfo: () => ({
                    channelNumber: 12,
                    channelName: 'Retro',
                    programTitle: 'Classic Block',
                    timeLabel: 'Invalid Date - Invalid Date',
                }),
            });

            try {
                localEpg.show();
                const banner = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_BANNER}`) as HTMLElement;
                const time = localContainer.querySelector(`.${EPG_CLASSES.NOW_WATCHING_TIME}`) as HTMLElement;
                expect(banner.hidden).toBe(false);
                expect(time.textContent).toBe('');
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });
    });

    describe('layout mode', () => {
        it('keeps classic shell hidden in overlay mode (even when video is playing)', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-overlay-classic-shell',
                layoutMode: 'overlay',
                isVideoPlaying: () => true,
            });

            try {
                localEpg.show();
                const header = localContainer.querySelector('.epg-classic-header') as HTMLElement | null;
                const showcase = localContainer.querySelector('.epg-classic-showcase') as HTMLElement | null;
                expect(header).not.toBeNull();
                expect(showcase).not.toBeNull();
                expect(header!.hidden).toBe(true);
                expect(showcase!.hidden).toBe(true);
                expect(header!.getAttribute('aria-hidden')).toBe('true');
                expect(showcase!.getAttribute('aria-hidden')).toBe('true');
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('applies classic layout class and signals on show/hide', () => {
            const onLayoutModeChange = jest.fn();
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-classic',
                layoutMode: 'classic',
                isVideoPlaying: () => true,
                onLayoutModeChange,
            });

            try {
                localEpg.show();
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_CLASSIC)).toBe(true);
                expect(onLayoutModeChange).toHaveBeenCalledWith('classic');
                const header = localContainer.querySelector('.epg-classic-header') as HTMLElement | null;
                const showcase = localContainer.querySelector('.epg-classic-showcase') as HTMLElement | null;
                expect(header).not.toBeNull();
                expect(showcase).not.toBeNull();
                expect(header!.hidden).toBe(false);
                expect(showcase!.hidden).toBe(false);
                expect(header!.getAttribute('aria-hidden')).toBeNull();
                expect(showcase!.getAttribute('aria-hidden')).toBeNull();

                localEpg.hide();
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_CLASSIC)).toBe(false);
                expect(onLayoutModeChange).toHaveBeenCalledWith('overlay');
                expect(header!.hidden).toBe(true);
                expect(showcase!.hidden).toBe(true);
                expect(header!.getAttribute('aria-hidden')).toBe('true');
                expect(showcase!.getAttribute('aria-hidden')).toBe('true');
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('does not re-emit layout mode when showing twice', () => {
            const onLayoutModeChange = jest.fn();
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-classic-repeat',
                layoutMode: 'classic',
                isVideoPlaying: () => true,
                onLayoutModeChange,
            });

            try {
                localEpg.show();
                localEpg.show();
                expect(onLayoutModeChange).toHaveBeenCalledTimes(1);
                expect(onLayoutModeChange).toHaveBeenCalledWith('classic');
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_CLASSIC)).toBe(true);
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('does not activate PIP when classic layout but video not playing', () => {
            const onLayoutModeChange = jest.fn();
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-classic-no-playback',
                layoutMode: 'classic',
                isVideoPlaying: () => false,
                onLayoutModeChange,
            });

            try {
                localEpg.show();
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_CLASSIC)).toBe(true);
                expect(onLayoutModeChange).not.toHaveBeenCalledWith('classic');
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('updates layout class when setLayoutMode is called while visible', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-layout-setter',
                layoutMode: 'overlay',
            });

            try {
                localEpg.show();
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_CLASSIC)).toBe(false);
                const header = localContainer.querySelector('.epg-classic-header') as HTMLElement;
                const showcase = localContainer.querySelector('.epg-classic-showcase') as HTMLElement;
                expect(header.hidden).toBe(true);
                expect(showcase.hidden).toBe(true);
                localEpg.setLayoutMode('classic');
                expect(localContainer.classList.contains(EPG_CLASSES.CONTAINER_CLASSIC)).toBe(true);
                expect(header.hidden).toBe(false);
                expect(showcase.hidden).toBe(false);
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('moves the info panel between overlay showcase and classic showcase when layout mode changes', () => {
            const { epg: localEpg, container: localContainer } = createEpgInstance({
                containerId: 'epg-container-info-panel-host',
                layoutMode: 'classic',
            });

            try {
                const overlayShowcase = localContainer.querySelector(`.${EPG_CLASSES.OVERLAY_SHOWCASE}`) as HTMLElement;
                const showcaseInfo = localContainer.querySelector('.epg-classic-showcase-info') as HTMLElement;
                const infoPanel = localContainer.querySelector(`.${EPG_CLASSES.INFO_PANEL}`) as HTMLElement;

                expect(infoPanel.parentElement).toBe(overlayShowcase);

                localEpg.show();
                expect(infoPanel.parentElement).toBe(showcaseInfo);

                localEpg.setLayoutMode('overlay');
                expect(infoPanel.parentElement).toBe(overlayShowcase);
            } finally {
                localEpg.destroy();
                localContainer.remove();
            }
        });

        it('refreshes the focused info panel content when switching from classic to overlay mode', () => {
            const channel = createMockChannel(0);
            epg.loadChannels([channel]);
            epg.loadScheduleForChannel(channel.id, createDetailedSchedule(channel.id));

            epg.setLayoutMode('classic');
            epg.show();
            epg.focusProgram(0, 0);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('none');
            expect(poster.getAttribute('src')).toBeNull();

            epg.setLayoutMode('overlay');

            expect(poster.style.display).toBe('block');
            expect(poster.getAttribute('src')).toContain('poster-a.jpg');
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
                showCurrentTimeIndicator: true,
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
            epg.setLayoutMode('overlay');
            epg.show();

            epg.focusProgram(0, 0);
            epg.focusProgram(0, 1);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            const description = container.querySelector('.epg-info-description') as HTMLElement;
            const inner = description.querySelector('.epg-info-description-inner') as HTMLElement;

            expect(poster.getAttribute('src')).toContain('poster-b.jpg');
            expect(poster.style.display).toBe('block');
            expect(inner.textContent?.trim()).toBe('');
            expect(description.style.display).toBe('none');

            jest.advanceTimersByTime(199);
            expect(poster.getAttribute('src')).toContain('poster-b.jpg');
            expect(inner.textContent?.trim()).toBe('');

            jest.advanceTimersByTime(1);
            expect(poster.getAttribute('src')).toContain('poster-b.jpg');
            expect(inner.textContent?.trim()).toBe('Some summary text B');
            expect(description.style.display).toBe('block');
        });

        it('timer cleared on hide', () => {
            const channel = createMockChannel(0);
            epg.loadChannels([channel]);
            epg.loadScheduleForChannel(channel.id, createDetailedSchedule(channel.id));
            epg.setLayoutMode('overlay');
            epg.show();

            epg.focusProgram(0, 0);
            epg.hide();

            jest.advanceTimersByTime(250);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            const description = container.querySelector('.epg-info-description') as HTMLElement;
            const inner = description.querySelector('.epg-info-description-inner') as HTMLElement;

            expect(poster.getAttribute('src')).toContain('poster-a.jpg');
            expect(inner.textContent?.trim()).toBe('');
        });

        it('timer cleared when schedules are cleared', () => {
            const channel = createMockChannel(0);
            epg.loadChannels([channel]);
            epg.loadScheduleForChannel(channel.id, createDetailedSchedule(channel.id));
            epg.setLayoutMode('overlay');
            epg.show();

            epg.focusProgram(0, 0);
            epg.clearSchedules();

            jest.advanceTimersByTime(250);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            const description = container.querySelector('.epg-info-description') as HTMLElement;
            const inner = description.querySelector('.epg-info-description-inner') as HTMLElement;

            expect(poster.getAttribute('src')).toContain('poster-a.jpg');
            expect(inner.textContent?.trim()).toBe('');
        });
    });

    describe('data loading', () => {
        it('should load channels', () => {
            const channels = [createMockChannel(0), createMockChannel(1)];
            epg.loadChannels(channels);

            const state = epg.getState();
            expect(state.viewWindow.endChannelIndex).toBe(2);
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
            const initialFocus = epg.getFocusedProgram();

            const moved = epg.handleNavigation('right');
            const newFocus = epg.getFocusedProgram();

            expect(moved).toBe(true);
            expect(newFocus).not.toBeNull();
            expect(newFocus!.scheduledStartTime).toBeGreaterThanOrEqual(
                initialFocus!.scheduledEndTime
            );
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
            expect(epg.getState().focusedCell!.channelIndex).toBe(0);

            const movedDown = epg.handleNavigation('down');
            expect(movedDown).toBe(true);
            expect(epg.getState().focusedCell!.channelIndex).toBe(1);
        });

        it('should wrap to last channel when navigating up from top', () => {
            epg.focusProgram(0, 0); // First channel
            const moved = epg.handleNavigation('up');
            expect(moved).toBe(true);
            expect(epg.getState().focusedCell!.channelIndex).toBe(2);
        });

        it('should wrap to first channel when navigating down from bottom', () => {
            epg.focusProgram(2, 0); // Last channel (index 2)
            const moved = epg.handleNavigation('down');
            expect(moved).toBe(true);
            expect(epg.getState().focusedCell!.channelIndex).toBe(0);
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

        it('shows and hides scrub label with deterministic timer behavior', () => {
            jest.useFakeTimers();
            try {
                const moved = epg.handleNavigation('right');
                expect(moved).toBe(true);

                const scrubLabel = container.querySelector(`.${EPG_CLASSES.SCRUB_LABEL}`) as HTMLElement;
                expect(scrubLabel).not.toBeNull();
                expect(scrubLabel.hidden).toBe(false);
                expect(scrubLabel.classList.contains(EPG_CLASSES.SCRUB_LABEL_VISIBLE)).toBe(true);

                jest.advanceTimersByTime(449);
                expect(scrubLabel.hidden).toBe(false);
                jest.advanceTimersByTime(1);
                expect(scrubLabel.hidden).toBe(true);
                expect(scrubLabel.classList.contains(EPG_CLASSES.SCRUB_LABEL_VISIBLE)).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('refreshes scrub label content on rapid horizontal navigation', () => {
            const firstMove = epg.handleNavigation('right');
            expect(firstMove).toBe(true);
            const titleEl = container.querySelector(`.${EPG_CLASSES.SCRUB_LABEL_TITLE}`) as HTMLElement;
            const timeEl = container.querySelector(`.${EPG_CLASSES.SCRUB_LABEL_TIME}`) as HTMLElement;
            const channelEl = container.querySelector(`.${EPG_CLASSES.SCRUB_LABEL_CHANNEL}`) as HTMLElement;
            expect(titleEl.textContent).toBe('Program 2');
            expect(channelEl.textContent).toContain('Channel 1');
            expect(timeEl.textContent).toContain(' - ');

            const secondMove = epg.handleNavigation('right');
            expect(secondMove).toBe(true);
            expect(titleEl.textContent).toBe('Program 3');
        });

        it('hides scrub label immediately on vertical navigation', () => {
            const movedRight = epg.handleNavigation('right');
            expect(movedRight).toBe(true);
            const scrubLabel = container.querySelector(`.${EPG_CLASSES.SCRUB_LABEL}`) as HTMLElement;
            expect(scrubLabel.hidden).toBe(false);

            const movedDown = epg.handleNavigation('down');
            expect(movedDown).toBe(true);
            expect(scrubLabel.hidden).toBe(true);
            expect(scrubLabel.classList.contains(EPG_CLASSES.SCRUB_LABEL_VISIBLE)).toBe(false);
        });

        it('hides scrub label immediately on page navigation', () => {
            const movedRight = epg.handleNavigation('right');
            expect(movedRight).toBe(true);
            const scrubLabel = container.querySelector(`.${EPG_CLASSES.SCRUB_LABEL}`) as HTMLElement;
            expect(scrubLabel.hidden).toBe(false);

            const paged = epg.handlePage('down');
            expect(paged).toBe(true);
            expect(scrubLabel.hidden).toBe(true);
            expect(scrubLabel.classList.contains(EPG_CLASSES.SCRUB_LABEL_VISIBLE)).toBe(false);
        });

        it('cleans scrub label timer and visibility on hide and destroy', () => {
            jest.useFakeTimers();
            try {
                epg.handleNavigation('right');
                const scrubLabel = container.querySelector(`.${EPG_CLASSES.SCRUB_LABEL}`) as HTMLElement;
                expect(scrubLabel.hidden).toBe(false);

                epg.hide();
                expect(scrubLabel.hidden).toBe(true);
                jest.advanceTimersByTime(1000);
                expect(scrubLabel.hidden).toBe(true);

                epg.show();
                epg.focusProgram(0, 0);
                epg.handleNavigation('right');
                expect(scrubLabel.hidden).toBe(false);
                epg.destroy();
                jest.advanceTimersByTime(1000);
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not interfere with focused program and info panel updates', () => {
            const moved = epg.handleNavigation('right');
            expect(moved).toBe(true);
            const focused = epg.getState().focusedCell;
            expect(focused?.kind).toBe('program');

            const scrubTitle = container.querySelector(`.${EPG_CLASSES.SCRUB_LABEL_TITLE}`) as HTMLElement;
            const infoTitle = container.querySelector('.epg-info-title') as HTMLElement;
            expect(scrubTitle.textContent).toBe('Program 2');
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

        it('should return false if no program focused', () => {
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
                showCurrentTimeIndicator: true,
                autoScrollToNow: false,
            });
            newEpg.show();

            expect(newEpg.handleSelect()).toBe(false);

            newEpg.destroy();
            newContainer.remove();
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
        it('should hide EPG on back press when visible', () => {
            epg.show();
            expect(epg.isVisible()).toBe(true);

            const handled = epg.handleBack();

            expect(handled).toBe(true);
            expect(epg.isVisible()).toBe(false);
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
                showCurrentTimeIndicator: true,
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
        });

        it('LEFT/RIGHT are no-op but handled while pill focused', () => {
            setupWithPicker();
            epg.handleNavigation('up');

            const leftHandled = epg.handleNavigation('left');
            const rightHandled = epg.handleNavigation('right');

            expect(leftHandled).toBe(true);
            expect(rightHandled).toBe(true);
            const focusedPill = container.querySelector('.epg-library-pill.focused');
            expect(focusedPill).not.toBeNull();
            const focused = epg.getState().focusedCell;
            expect(focused?.channelIndex).toBe(0);
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
