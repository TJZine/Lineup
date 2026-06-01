/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Channel List unit tests
 * @module modules/ui/epg/__tests__/EPGChannelList.test
 */

import { EPGChannelList } from '../view/EPGChannelList';
import type { ChannelConfig, EPGConfig } from '../types';
import type { BuildStrategy } from '../../../scheduler/channel-manager/contracts/types';

describe('EPGChannelList', () => {
    const expandedAttribute = 'data-channel-name-expanded';

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
        startTimeAnchor: Date.now(),
    });

    const createConfig = (overrides?: Partial<EPGConfig>): EPGConfig => ({
        containerId: 'epg-container',
        visibleChannels: 4,
        timeSlotMinutes: 30,
        visibleHours: 3,
        totalHours: 24,
        pixelsPerMinute: 4,
        autoFitPixelsPerMinute: false,
        rowHeight: 80,
        showCurrentTimeIndicator: true,
        autoScrollToNow: false,
        ...overrides,
    });

    const mockPrimaryLabelMeasurement = ({
        clientWidth,
        scrollWidth,
    }: {
        clientWidth: number | ((element: HTMLElement) => number);
        scrollWidth: number | ((element: HTMLElement) => number);
    }): jest.SpyInstance[] => {
        const resolve = (
            value: number | ((element: HTMLElement) => number),
            element: HTMLElement
        ): number => typeof value === 'function' ? value(element) : value;

        return [
            jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get')
                .mockImplementation(function (this: HTMLElement): number {
                    if (this.classList.contains('epg-channel-name-primary')) {
                        return resolve(clientWidth, this);
                    }
                    return 0;
                }),
            jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
                .mockImplementation(function (this: HTMLElement): number {
                    if (this.classList.contains('epg-channel-name-primary')) {
                        return resolve(scrollWidth, this);
                    }
                    return 0;
                }),
        ];
    };

    let parent: HTMLElement;

    beforeEach(() => {
        parent = document.createElement('div');
        document.body.appendChild(parent);
    });

    afterEach(() => {
        parent.remove();
    });

    it('updates the inner wrapper transform without touching the container transform', () => {
        const list = new EPGChannelList();
        const config = createConfig({ rowHeight: 72, visibleChannels: 5 });

        list.initialize(parent, config);
        list.updateChannels(Array.from({ length: 20 }, (_, i) => createMockChannel(i)));
        list.updateScrollPosition(5);

        const container = parent.querySelector('.epg-channel-list') as HTMLElement;
        const content = container.firstElementChild as HTMLElement;

        expect(container.style.transform).toBe('');
        expect(content.style.transform).toBe('translateY(-360px)');
    });

    it('virtualizes rows and maps names for a scrolled offset', () => {
        const list = new EPGChannelList();
        const config = createConfig({ rowHeight: 50, visibleChannels: 4 });

        list.initialize(parent, config);
        list.updateChannels(Array.from({ length: 20 }, (_, i) => createMockChannel(i)));
        list.updateScrollPosition(12);

        const rows = parent.querySelectorAll('.epg-channel-row');
        expect(rows.length).toBeLessThan(20);

        const row = parent.querySelector('[data-channel-index="12"]') as HTMLElement;
        expect(row).not.toBeNull();
        const name = row.querySelector('.epg-channel-name');
        expect(name?.textContent).toBe('Channel 13');
    });

    it('renders generated channel identity with primary, category, and source spans', () => {
        const list = new EPGChannelList();
        const config = createConfig({ visibleChannels: 1 });

        list.initialize(parent, config);
        list.updateChannels([
            {
                ...createMockChannel(0),
                name: 'Gary Oldman - Movies Home',
                sourceLibraryName: 'Movies Home',
                buildStrategy: 'actors' as BuildStrategy,
            },
        ]);

        const row = parent.querySelector('.epg-channel-row') as HTMLElement;
        const nameStack = row.querySelector('.epg-channel-name') as HTMLElement;
        const primary = nameStack.querySelector('.epg-channel-name-primary') as HTMLElement;
        const provenance = nameStack.querySelector('.epg-channel-name-provenance') as HTMLElement;
        const source = provenance.querySelector('.epg-channel-name-source') as HTMLElement;
        const category = provenance.querySelector('.epg-channel-name-category') as HTMLElement;
        const separator = provenance.querySelector('.epg-channel-name-separator') as HTMLElement;

        expect(row.querySelector('.epg-channel-number')?.textContent).toBe('1');
        expect(primary.textContent).toBe('Gary Oldman');
        expect(category.textContent).toBe('Actor');
        expect(separator.textContent).toBe('·');
        expect(source.textContent).toBe('Movies Home');
        expect(Array.from(provenance.children)).toEqual([category, separator, source]);
        expect(provenance.hidden).toBe(false);
        expect(category.hidden).toBe(false);
        expect(separator.hidden).toBe(false);
        expect(source.hidden).toBe(false);
        expect(nameStack.getAttribute('aria-label')).toBe('Gary Oldman, Actor, Movies Home');
    });

    it('clears stale provenance when virtualized rows are recycled', () => {
        const list = new EPGChannelList();
        const config = createConfig({ rowHeight: 50, visibleChannels: 1 });
        const channels = Array.from({ length: 8 }, (_, i) => createMockChannel(i));
        channels[0] = {
            ...channels[0]!,
            name: 'Gary Oldman - Movies Home',
            sourceLibraryName: 'Movies Home',
            buildStrategy: 'actors' as BuildStrategy,
        };

        list.initialize(parent, config);
        list.updateChannels(channels);

        const firstRenderedRow = parent.querySelector('.epg-channel-row') as HTMLElement;
        const provenance = firstRenderedRow.querySelector('.epg-channel-name-provenance') as HTMLElement;
        const source = provenance.querySelector('.epg-channel-name-source') as HTMLElement;
        const category = provenance.querySelector('.epg-channel-name-category') as HTMLElement;
        const separator = provenance.querySelector('.epg-channel-name-separator') as HTMLElement;
        const nameStack = firstRenderedRow.querySelector('.epg-channel-name') as HTMLElement;
        expect(source.textContent).toBe('Movies Home');
        expect(category.textContent).toBe('Actor');
        expect(separator.hidden).toBe(false);
        expect(provenance.hidden).toBe(false);

        list.updateScrollPosition(5);

        const remappedPrimaryName = firstRenderedRow.querySelector('.epg-channel-name-primary')?.textContent;
        expect(firstRenderedRow.dataset.channelIndex).toMatch(/^\d+$/);
        expect(remappedPrimaryName).toMatch(/^Channel \d+$/);
        expect(remappedPrimaryName).not.toBe('Gary Oldman');
        expect(source.textContent).toBe('');
        expect(category.textContent).toBe('');
        expect(source.hidden).toBe(true);
        expect(category.hidden).toBe(true);
        expect(separator.hidden).toBe(true);
        expect(provenance.hidden).toBe(true);
        expect(nameStack.hasAttribute('aria-label')).toBe(false);
    });

    it('reuses existing row child nodes when virtualized rows are remapped', () => {
        const list = new EPGChannelList();
        const config = createConfig({ rowHeight: 50, visibleChannels: 4 });

        list.initialize(parent, config);
        list.updateChannels(Array.from({ length: 20 }, (_, i) => createMockChannel(i)));

        const firstRenderedRow = parent.querySelector('.epg-channel-row') as HTMLElement;
        const firstNumberNode = firstRenderedRow.querySelector('.epg-channel-number');
        const firstNameNode = firstRenderedRow.querySelector('.epg-channel-name');
        expect(firstNumberNode).not.toBeNull();
        expect(firstNameNode).not.toBeNull();

        list.updateScrollPosition(8);

        const remappedFirstRow = parent.querySelector('.epg-channel-row') as HTMLElement;
        const remappedNumberNode = remappedFirstRow.querySelector('.epg-channel-number');
        const remappedNameNode = remappedFirstRow.querySelector('.epg-channel-name');

        expect(remappedFirstRow).toBe(firstRenderedRow);
        expect(remappedNumberNode).toBe(firstNumberNode);
        expect(remappedNameNode).toBe(firstNameNode);
    });

    it('does not set color datasets or inline border styles for generated channels', () => {
        const list = new EPGChannelList();
        const config = createConfig({ visibleChannels: 1 });

        list.initialize(parent, config);

        const channels = [
            {
                ...createMockChannel(0),
                buildStrategy: 'actors' as BuildStrategy,
                color: 'red',
            },
        ] as unknown as ChannelConfig[];
        list.updateChannels(channels);

        const row = parent.querySelector('.epg-channel-row') as HTMLElement;
        expect(row.dataset.buildStrategy).toBeUndefined();
        expect(row.style.borderLeftColor).toBe('');
        expect(row.style.borderLeftWidth).toBe('');
        expect(row.style.borderLeftStyle).toBe('');
    });

    it('does not render branding art in the channel row when no custom icon exists', () => {
        const list = new EPGChannelList();
        list.initialize(parent, createConfig({ visibleChannels: 1 }));
        list.updateChannels([
            { ...createMockChannel(0), buildStrategy: 'genres' as BuildStrategy },
        ]);

        const row = parent.querySelector('.epg-channel-row') as HTMLElement;
        expect(row.querySelector('.channel-branding-icon')).toBeNull();
        expect(row.querySelector('.epg-channel-icon')).toBeNull();
        expect(row.querySelector('.epg-channel-number')?.textContent).toBe('1');
        expect(row.querySelector('.epg-channel-name-primary')?.textContent).toBe('Channel 1');
        expect(row.querySelector('.epg-channel-name-source')?.textContent).toBe('');
        expect(row.querySelector('.epg-channel-name-category')?.textContent).toBe('Genre');
        expect((row.querySelector('.epg-channel-name-separator') as HTMLElement | null)?.hidden).toBe(true);
    });

    it('expands materially truncated generated channel names while preserving full aria labels', () => {
        const spies = mockPrimaryLabelMeasurement({
            clientWidth: 164,
            scrollWidth: (element) => (element.textContent?.length ?? 0) * 8,
        });
        const list = new EPGChannelList();

        try {
            list.initialize(parent, createConfig({ visibleChannels: 2 }));
            list.updateChannels([
                {
                    ...createMockChannel(0),
                    name: 'Recently Added Unwatched Movies - Movies Home',
                    sourceLibraryName: 'Movies Home',
                    buildStrategy: 'collections' as BuildStrategy,
                },
                {
                    ...createMockChannel(1),
                    name: 'Recently Added Unwatched Movies (2) - Movies Home',
                    sourceLibraryName: 'Movies Home',
                    buildStrategy: 'collections' as BuildStrategy,
                },
            ]);

            const rows = Array.from(parent.querySelectorAll('.epg-channel-row')) as HTMLElement[];
            expect(rows).toHaveLength(2);

            const [firstRow, secondRow] = rows;
            const firstName = firstRow?.querySelector('.epg-channel-name') as HTMLElement;
            const secondName = secondRow?.querySelector('.epg-channel-name') as HTMLElement;
            const firstPrimary = firstRow?.querySelector('.epg-channel-name-primary') as HTMLElement;
            const secondPrimary = secondRow?.querySelector('.epg-channel-name-primary') as HTMLElement;

            expect(firstRow?.getAttribute(expandedAttribute)).toBe('true');
            expect(secondRow?.getAttribute(expandedAttribute)).toBe('true');
            expect(firstPrimary.textContent).toBe('Recently Added Unwatched Movies');
            expect(secondPrimary.textContent).toBe('Recently Added Unwatched Movies (2)');
            expect(firstPrimary.textContent).not.toBe(secondPrimary.textContent);
            expect(firstName.getAttribute('aria-label'))
                .toBe('Recently Added Unwatched Movies, Collection, Movies Home');
            expect(secondName.getAttribute('aria-label'))
                .toBe('Recently Added Unwatched Movies (2), Collection, Movies Home');
        } finally {
            list.destroy();
            for (const spy of spies) {
                spy.mockRestore();
            }
        }
    });

    it('clears expanded channel-name markers when a virtual row is recycled to a fitting channel', () => {
        const spies = mockPrimaryLabelMeasurement({
            clientWidth: 140,
            scrollWidth: (element) => (element.textContent?.length ?? 0) * 8,
        });
        const list = new EPGChannelList();

        try {
            const channels = Array.from({ length: 12 }, (_, i) => createMockChannel(i));
            channels[0] = {
                ...channels[0]!,
                name: 'Recently Added Unwatched Movies - Movies Home',
                sourceLibraryName: 'Movies Home',
                buildStrategy: 'collections' as BuildStrategy,
            };

            list.initialize(parent, createConfig({ rowHeight: 50, visibleChannels: 1 }));
            list.updateChannels(channels);

            const firstRenderedRow = parent.querySelector('.epg-channel-row') as HTMLElement;
            expect(firstRenderedRow.getAttribute(expandedAttribute)).toBe('true');
            expect(firstRenderedRow.querySelector('.epg-channel-name-primary')?.textContent)
                .toBe('Recently Added Unwatched Movies');

            list.updateScrollPosition(7);

            expect(firstRenderedRow.dataset.channelIndex).toMatch(/^\d+$/);
            expect(firstRenderedRow.querySelector('.epg-channel-name-primary')?.textContent)
                .toMatch(/^Channel \d+$/);
            expect(firstRenderedRow.hasAttribute(expandedAttribute)).toBe(false);
        } finally {
            list.destroy();
            for (const spy of spies) {
                spy.mockRestore();
            }
        }
    });

    it('defers channel-name expansion when the rail has zero width and refreshes after it becomes visible', () => {
        jest.useFakeTimers();

        let measuredWidth = 0;
        const spies = mockPrimaryLabelMeasurement({
            clientWidth: () => measuredWidth,
            scrollWidth: 280,
        });
        const list = new EPGChannelList();

        try {
            list.initialize(parent, createConfig({ visibleChannels: 1 }));
            list.updateChannels([
                {
                    ...createMockChannel(0),
                    name: 'Recently Added Unwatched Movies - Movies Home',
                    sourceLibraryName: 'Movies Home',
                    buildStrategy: 'collections' as BuildStrategy,
                },
            ]);

            const row = parent.querySelector('.epg-channel-row') as HTMLElement;
            expect(row.hasAttribute(expandedAttribute)).toBe(false);

            jest.runOnlyPendingTimers();
            expect(row.hasAttribute(expandedAttribute)).toBe(false);

            measuredWidth = 160;
            list.refreshChannelNameLayouts();

            expect(row.getAttribute(expandedAttribute)).toBe('true');
        } finally {
            list.destroy();
            for (const spy of spies) {
                spy.mockRestore();
            }
            jest.useRealTimers();
        }
    });
});
