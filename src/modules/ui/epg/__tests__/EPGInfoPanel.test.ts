/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Info Panel unit tests
 * @module modules/ui/epg/__tests__/EPGInfoPanel.test
 */

import { EPGInfoPanel } from '../EPGInfoPanel';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import { extractDominantColor } from '../../../../utils/color/extractDominantColor';
import type { ScheduledProgram } from '../types';

jest.mock('../../../../utils/color/extractDominantColor');

describe('EPGInfoPanel', () => {
    let panel: EPGInfoPanel;
    let container: HTMLElement;
    const RealImage = globalThis.Image;

    const createMockProgram = (
        thumbPath: string | null,
        itemOverrides: Partial<ScheduledProgram['item']> = {}
    ): ScheduledProgram => ({
        item: {
            ratingKey: 'test-1',
            type: 'movie',
            title: 'Test Movie',
            fullTitle: 'Test Movie',
            durationMs: 7200000,
            thumb: thumbPath,
            year: 2024,
            scheduledIndex: 0,
            ...itemOverrides,
        },
        scheduledStartTime: Date.now(),
        scheduledEndTime: Date.now() + 7200000,
        elapsedMs: 0,
        remainingMs: 7200000,
        scheduleIndex: 0,
        loopNumber: 0,
        streamDescriptor: null,
        isCurrent: true,
    });

    beforeEach(() => {
        class MockImage {
            crossOrigin: string | null = null;
            onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
            onerror: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
            private _src: string = '';

            get src(): string {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                this.onload?.call(this as unknown as GlobalEventHandlers, new Event('load'));
            }
        }
        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            writable: true,
            value: MockImage as unknown as typeof Image,
        });

        container = document.createElement('div');
        document.body.appendChild(container);

        panel = new EPGInfoPanel();
        panel.initialize(container);
    });

    afterEach(() => {
        panel.destroy();
        container.remove();
        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            writable: true,
            value: RealImage,
        });
    });

    describe('thumb resolver', () => {
        it('should call resolver callback for relative Plex paths', () => {
            const resolver = jest.fn().mockReturnValue('https://server/library/thumb?token=xxx');
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/thumb');
            panel.show(program);

            expect(resolver).toHaveBeenCalledWith('/library/metadata/123/thumb', 320, 480);
            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.src).toBe('https://server/library/thumb?token=xxx');
            expect(poster.style.display).toBe('block');
        });

        it('should hide poster when resolver returns null', () => {
            const resolver = jest.fn().mockReturnValue(null);
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/thumb');
            panel.show(program);

            expect(resolver).toHaveBeenCalled();
            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('none');
        });

        it('should hide poster when thumb is null', () => {
            const resolver = jest.fn();
            panel.setThumbResolver(resolver);

            const program = createMockProgram(null);
            panel.show(program);

            expect(resolver).toHaveBeenCalledWith(null, 320, 480);
            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('none');
        });

        it('should hide poster for episodes when show thumb is empty', () => {
            const resolver = jest.fn((path: string | null) => {
                if (!path) return null;
                return 'https://server/library/thumb?token=xxx';
            });
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/thumb', {
                type: 'episode',
                showThumb: '',
                showTitle: '',
                title: 'Episode Title',
            });
            panel.show(program);

            expect(resolver).toHaveBeenCalledWith(null, 320, 480);
            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('none');
        });

        it('shows poster for episodes when showThumb is empty but details provide grandparentThumb', async () => {
            jest.useFakeTimers();
            const resolver = jest.fn((path: string | null) => (path ? 'https://server/library/thumb?token=xxx' : null));
            panel.setThumbResolver(resolver);

            const fetchItemDetails = jest.fn().mockResolvedValue({
                ratingKey: 'test-1',
                key: '/library/metadata/1',
                type: 'episode',
                title: 'Episode Title',
                sortTitle: 'Episode Title',
                summary: '',
                year: 2024,
                durationMs: 7200000,
                addedAt: new Date(),
                updatedAt: new Date(),
                thumb: null,
                art: null,
                grandparentThumb: '/library/metadata/999/thumb',
                media: [],
            });
            panel.setFetchItemDetails(fetchItemDetails);

            const program = createMockProgram('/library/metadata/123/thumb', {
                type: 'episode',
                showThumb: '',
                showTitle: '',
                title: 'Episode Title',
                fullTitle: 'Some Show - S01E01 - Episode Title',
            });
            panel.show(program);

            expect(fetchItemDetails).not.toHaveBeenCalled();
            expect(resolver).toHaveBeenCalledWith(null, 320, 480);

            jest.advanceTimersByTime(220);
            await Promise.resolve();
            await Promise.resolve();

            expect(fetchItemDetails).toHaveBeenCalledWith('test-1', { signal: expect.any(AbortSignal) });
            expect(resolver).toHaveBeenCalledWith('/library/metadata/999/thumb', 320, 480);
            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('block');

            jest.useRealTimers();
        });

        it('should hide poster when resolver returns empty string', () => {
            const resolver = jest.fn().mockReturnValue('');
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/thumb');
            panel.show(program);

            expect(resolver).toHaveBeenCalled();
            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('none');
        });

        it('clears poster when resolver returns null after prior image', () => {
            const resolver = jest.fn((path: string | null) => {
                if (!path) return null;
                return 'https://server/library/thumb?token=xxx';
            });
            panel.setThumbResolver(resolver);

            const programWithThumb = createMockProgram('/library/metadata/123/thumb');
            panel.show(programWithThumb);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.src).toBe('https://server/library/thumb?token=xxx');
            expect(poster.style.display).toBe('block');

            const programWithoutThumb = createMockProgram(null);
            panel.show(programWithoutThumb);

            expect(poster.getAttribute('src')).toBeNull();
            expect(poster.style.display).toBe('none');
        });

        it('should hide poster when no resolver is set', () => {
            // No resolver set - should hide poster rather than assign raw path
            const program = createMockProgram('/library/metadata/123/thumb');
            panel.show(program);

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('none');
        });

        it('should pass through absolute URLs via resolver', () => {
            const resolver = jest.fn().mockImplementation((url: string | null) => url);
            panel.setThumbResolver(resolver);

            const program = createMockProgram('https://plex.tv/photo/abc123');
            panel.show(program);

            expect(resolver).toHaveBeenCalledWith('https://plex.tv/photo/abc123', 320, 480);
            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.src).toBe('https://plex.tv/photo/abc123');
            expect(poster.style.display).toBe('block');
        });

        it('renders backdrop when art path is provided', () => {
            const resolver = jest.fn().mockImplementation((path: string | null) => {
                if (path === '/library/metadata/123/thumb') return 'https://server/library/thumb-123';
                if (path === '/library/metadata/123/art') return 'https://server/library/art-123';
                return null;
            });
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/thumb', {
                art: '/library/metadata/123/art',
            });
            panel.show(program);

            expect(resolver).toHaveBeenCalledWith('/library/metadata/123/art', 960, 540);

            const backdrop = container.querySelector('.epg-info-backdrop-img') as HTMLImageElement | null;
            expect(backdrop).not.toBeNull();
            expect(backdrop?.style.display).not.toBe('none');
            expect(backdrop?.src).toBe('https://server/library/art-123');
        });

        it('updates backdrop when program changes', () => {
            const resolver = jest.fn().mockImplementation((path: string | null) => {
                if (path === '/library/metadata/123/thumb') return 'https://server/library/thumb-123';
                if (path === '/library/metadata/456/thumb') return 'https://server/library/thumb-456';
                if (path === '/library/metadata/123/art') return 'https://server/library/art-123';
                if (path === '/library/metadata/456/art') return 'https://server/library/art-456';
                return null;
            });
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/thumb', {
                art: '/library/metadata/123/art',
            });
            panel.show(program);

            const backdrop = container.querySelector('.epg-info-backdrop-img') as HTMLImageElement | null;
            expect(backdrop?.src).toBe('https://server/library/art-123');

            const program2 = createMockProgram('/library/metadata/456/thumb', {
                art: '/library/metadata/456/art',
            });
            panel.show(program2);
            expect(resolver).toHaveBeenCalledWith('/library/metadata/456/art', 960, 540);
            expect(backdrop?.src).toBe('https://server/library/art-456');
        });

        it('hides backdrop when art is null', () => {
            const resolver = jest.fn().mockImplementation((path: string | null) => {
                if (path === '/library/metadata/123/thumb') return 'https://server/library/thumb-123';
                if (path === '/library/metadata/789/thumb') return 'https://server/library/thumb-789';
                if (path === '/library/metadata/123/art') return 'https://server/library/art-123';
                return null;
            });
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/thumb', {
                art: '/library/metadata/123/art',
            });
            panel.show(program);

            const backdrop = container.querySelector('.epg-info-backdrop-img') as HTMLImageElement | null;
            expect(backdrop?.style.display).not.toBe('none');

            // When art is missing, backdrop stays hidden and resolver is not called for backdrop.
            const callsBefore = resolver.mock.calls.length;
            const programWithoutArt = createMockProgram('/library/metadata/789/thumb', { art: null });
            panel.show(programWithoutArt);
            expect(backdrop?.style.display).toBe('none');
            expect(resolver).not.toHaveBeenCalledWith(null, 960, 540);
            expect(resolver).not.toHaveBeenCalledWith('/library/metadata/789/art', 960, 540);
            expect(resolver.mock.calls.length).toBe(callsBefore + 1);
            expect(resolver).toHaveBeenLastCalledWith('/library/metadata/789/thumb', 320, 480);
        });

        it('renders three meta pills', () => {
            const program = createMockProgram('/library/metadata/123/thumb', {
                art: '/library/metadata/123/art',
            });
            panel.show(program);

            const pills = Array.from(container.querySelectorAll('.epg-info-tags .epg-info-pill')) as HTMLElement[];
            expect(pills.length).toBe(3);
            for (const pill of pills) {
                expect((pill.textContent ?? '').trim().length).toBeGreaterThan(0);
            }
        });
    });

    describe('lifecycle', () => {
        it('should initialize without errors', () => {
            expect(panel.getIsVisible()).toBe(false);
        });

        it('should show and hide correctly', () => {
            const program = createMockProgram(null);
            panel.show(program);
            expect(panel.getIsVisible()).toBe(true);

            panel.hide();
            expect(panel.getIsVisible()).toBe(false);
        });

        it('should display program title', () => {
            const program = createMockProgram(null);
            panel.show(program);

            const title = container.querySelector('.epg-info-title');
            expect(title?.textContent).toBe('Test Movie');
        });

        it('applies extracted color to the inactive gradient layer when artwork bleed is enabled', () => {
            jest.useFakeTimers();

            try {
                (extractDominantColor as jest.Mock).mockReturnValue('rgba(100, 50, 50, 0.32)');
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');

                const resolver = jest.fn((path: string | null) => (path ? 'https://img.example/thumb.jpg' : null));
                panel.setThumbResolver(resolver);

                const program = createMockProgram('/library/metadata/1/thumb');
                panel.show(program);

                jest.runAllTimers();

                const layerB = container.querySelector('.epg-info-gradient-b') as HTMLElement | null;
                if (!layerB) {
                    throw new Error('Gradient layer B not found');
                }

                expect(layerB.style.getPropertyValue('--dynamic-info-bg')).toBe('rgba(100, 50, 50, 0.32)');
                expect(layerB.classList.contains('epg-info-gradient-active')).toBe(true);
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
            }
        });

        it('clears dynamic tint state when hidden', () => {
            jest.useFakeTimers();

            try {
                (extractDominantColor as jest.Mock).mockReturnValue('rgba(100, 50, 50, 0.32)');
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');

                const resolver = jest.fn((path: string | null) => (path ? 'https://img.example/thumb.jpg' : null));
                panel.setThumbResolver(resolver);

                const program = createMockProgram('/library/metadata/1/thumb');
                panel.show(program);

                jest.runAllTimers();

                const layerA = container.querySelector('.epg-info-gradient-a') as HTMLElement | null;
                const layerB = container.querySelector('.epg-info-gradient-b') as HTMLElement | null;
                if (!layerA || !layerB) {
                    throw new Error('Gradient layers not found');
                }
                expect(layerB.classList.contains('epg-info-gradient-active')).toBe(true);

                panel.hide();

                expect(layerA.style.getPropertyValue('--dynamic-info-bg')).toBe('');
                expect(layerB.style.getPropertyValue('--dynamic-info-bg')).toBe('');
                expect(layerA.classList.contains('epg-info-gradient-active')).toBe(true);
                expect(layerB.classList.contains('epg-info-gradient-active')).toBe(false);
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
            }
        });

        it('caps the dynamic color cache to avoid unbounded growth', () => {
            jest.useFakeTimers();

            try {
                (extractDominantColor as jest.Mock).mockReturnValue('rgba(100, 50, 50, 0.32)');
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');

                const resolver = jest.fn((path: string | null) => (path ? 'https://img.example/thumb.jpg' : null));
                panel.setThumbResolver(resolver);

                for (let index = 0; index < 130; index += 1) {
                    const program = createMockProgram('/library/metadata/1/thumb', {
                        ratingKey: `cache-${index}`,
                    });
                    panel.show(program);
                    jest.runAllTimers();
                }

                const cache = (panel as unknown as { colorCache: Map<string, string> }).colorCache;
                expect(cache.size).toBe(128);
                expect(cache.has('cache-0')).toBe(false);
                expect(cache.has('cache-1')).toBe(false);
                expect(cache.has('cache-129')).toBe(true);
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
            }
        });

        it('should hide series title for non-episode programs', () => {
            const program = createMockProgram(null, {
                type: 'movie',
                fullTitle: 'Full Title',
                title: 'Title',
            });
            panel.show(program);

            const showTitle = container.querySelector('.epg-info-show') as HTMLElement;
            const title = container.querySelector('.epg-info-title') as HTMLElement;
            expect(showTitle.textContent).toBe('');
            expect(showTitle.style.display).toBe('none');
            expect(title.textContent).toBe('Full Title');
        });

        it('should show series title and episode title for episodes', () => {
            const program = createMockProgram(null, {
                type: 'episode',
                showTitle: 'Show Name',
                title: 'Episode Name',
                fullTitle: 'Show Name - S01E01 - Episode Name',
            });
            panel.show(program);

            const showTitle = container.querySelector('.epg-info-show') as HTMLElement;
            const title = container.querySelector('.epg-info-title') as HTMLElement;
            expect(showTitle.textContent).toBe('Show Name');
            expect(showTitle.style.display).toBe('block');
            expect(title.textContent).toBe('Episode Name');
        });

        it('derives series title from fullTitle when showTitle is empty', () => {
            const resolver = jest.fn((path: string | null) => (path ? 'https://server/thumb?token=xxx' : null));
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/showThumb', {
                type: 'episode',
                showTitle: '',
                title: 'Episode Name',
                fullTitle: 'Great Show - S01E01 - Episode Name',
                showThumb: '/library/metadata/123/showThumb',
            });
            panel.show(program);

            const showTitle = container.querySelector('.epg-info-show') as HTMLElement;
            expect(showTitle.textContent).toBe('Great Show');
            expect(showTitle.style.display).toBe('block');

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('block');
            expect(poster.alt).toBe('Great Show');
        });

        it('renders clear logo in place of title when enabled', () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, '1');
            try {
                const resolver = jest.fn((path: string | null) => (path ? `https://img${path}` : null));
                panel.setThumbResolver(resolver);

                const program = createMockProgram(null, { clearLogo: '/clearlogo.png' });
                panel.show(program);

                const logo = container.querySelector('.epg-info-clear-logo') as HTMLImageElement | null;
                const title = container.querySelector('.epg-info-title') as HTMLElement | null;
                expect(logo?.style.display).toBe('block');
                expect(logo?.src).toBe('https://img/clearlogo.png');
                expect(title?.style.display).toBe('none');
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS);
            }
        });

        it('keeps episode show title hidden when clear logo fails and show title text is empty', () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, '1');
            try {
                const resolver = jest.fn((path: string | null) => (path ? `https://img${path}` : null));
                panel.setThumbResolver(resolver);

                const program = createMockProgram(null, {
                    type: 'episode',
                    title: 'Episode Title',
                    fullTitle: 'Episode Title',
                    showTitle: '',
                    clearLogo: '/broken-logo.png',
                });
                panel.show(program);

                const logo = container.querySelector('.epg-info-clear-logo') as HTMLImageElement | null;
                const showTitle = container.querySelector('.epg-info-show') as HTMLElement | null;
                expect(logo?.style.display).toBe('block');
                expect(showTitle?.style.display).toBe('none');

                (logo?.onerror as unknown as (() => void))?.();

                expect(logo?.style.display).toBe('none');
                expect(showTitle?.style.display).toBe('none');
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS);
            }
        });
    });

    describe('metadata rendering', () => {
        it('renders schedule/duration/year pills inside top-right meta cluster', () => {
            const program = createMockProgram('/library/metadata/123/thumb');
            panel.show(program);

            const cluster = container.querySelector('.epg-info-meta-cluster') as HTMLElement | null;
            const pills = Array.from(container.querySelectorAll('.epg-info-meta-cluster .epg-info-pill')) as HTMLElement[];

            expect(cluster).not.toBeNull();
            expect(pills.length).toBeGreaterThanOrEqual(2);
        });

        it('activates description auto-scroll only when summary overflows', () => {
            const program = createMockProgram('/library/metadata/123/thumb', {
                summary: 'Long summary text that should overflow once dimensions are mocked.',
            });

            panel.show(program);

            const description = container.querySelector('.epg-info-description') as HTMLElement;
            const inner = container.querySelector('.epg-info-description-inner') as HTMLElement;

            Object.defineProperty(description, 'clientHeight', { value: 40, configurable: true });
            Object.defineProperty(inner, 'scrollHeight', { value: 180, configurable: true });

            panel.update(program);

            expect(description.dataset.scrollActive).toBe('true');
            expect(description.style.getPropertyValue('--scroll-distance')).toBe('-140px');
        });

        it('does not activate description auto-scroll when summary fits', () => {
            const program = createMockProgram('/library/metadata/123/thumb', {
                summary: 'Short summary.',
            });

            panel.show(program);

            const description = container.querySelector('.epg-info-description') as HTMLElement;
            const inner = container.querySelector('.epg-info-description-inner') as HTMLElement;

            Object.defineProperty(description, 'clientHeight', { value: 100, configurable: true });
            Object.defineProperty(inner, 'scrollHeight', { value: 50, configurable: true });

            panel.update(program);

            expect(description.dataset.scrollActive).toBe('false');
            expect(description.style.getPropertyValue('--scroll-distance')).toBe('');
        });

        it('renders genres and hides when empty', () => {
            const program = createMockProgram(null, { genres: ['Drama', 'Comedy'] });
            panel.show(program);

            const genres = container.querySelector('.epg-info-genres') as HTMLElement;
            expect(genres.textContent).toBe('Drama • Comedy');
            expect(genres.style.display).toBe('block');

            const noGenres = createMockProgram(null, { genres: [] });
            panel.show(noGenres);
            const refreshedGenres = container.querySelector('.epg-info-genres') as HTMLElement;
            expect(refreshedGenres.style.display).toBe('none');
        });

        it('renders summary when available', () => {
            const program = createMockProgram(null, { summary: 'A concise summary.' });
            panel.show(program);

            const description = container.querySelector('.epg-info-description') as HTMLElement;
            expect(description.textContent?.trim()).toBe('A concise summary.');
            expect(description.style.display).toBe('block');
        });

        it('renders quality badges from mediaInfo', () => {
            const program = createMockProgram(null, {
                mediaInfo: {
                    resolution: '4K',
                    hdr: 'HDR10+',
                    audioCodec: 'eac3',
                    audioChannels: 6,
                },
            });
            panel.show(program);

            const badges = Array.from(
                container.querySelectorAll('.epg-info-quality-badge')
            ) as HTMLElement[];
            const visibleBadges = badges.filter((badge) => badge.style.display !== 'none');
            const texts = visibleBadges.map((badge) => badge.textContent);

            expect(texts).toEqual(['4K', 'HDR10+', 'DD+', '5.1']);
        });

        it('renders content rating as the first badge when available', () => {
            const program = createMockProgram(null, {
                contentRating: 'PG-13',
                mediaInfo: {
                    resolution: '4K',
                    hdr: 'HDR10+',
                    audioCodec: 'eac3',
                    audioChannels: 6,
                },
            });
            panel.show(program);

            const badges = Array.from(
                container.querySelectorAll('.epg-info-quality-badge')
            ) as HTMLElement[];
            const visibleBadges = badges.filter((badge) => badge.style.display !== 'none');
            const texts = visibleBadges.map((badge) => badge.textContent);

            expect(texts).toEqual(['PG-13', '4K', 'HDR10+', 'DD+', '5.1']);
        });

        it('normalizes region-prefixed ratings for badge display', () => {
            const program = createMockProgram(null, {
                contentRating: 'GB/12A',
                mediaInfo: { resolution: '1080p' },
            });
            panel.show(program);

            const badges = Array.from(
                container.querySelectorAll('.epg-info-quality-badge')
            ) as HTMLElement[];
            const visibleBadges = badges.filter((badge) => badge.style.display !== 'none');
            const texts = visibleBadges.map((badge) => badge.textContent);

            expect(texts).toEqual(['12A', '1080p']);
        });

        it('lazy-fetches HDR when mediaInfo is missing it', async () => {
            jest.useFakeTimers();
            const fetchItemDetails = jest.fn().mockResolvedValue({
                ratingKey: 'test-1',
                key: '/library/metadata/1',
                type: 'movie',
                title: 'Test Movie',
                sortTitle: 'Test Movie',
                summary: '',
                year: 2024,
                durationMs: 7200000,
                addedAt: new Date(),
                updatedAt: new Date(),
                thumb: null,
                art: null,
                media: [
                    {
                        id: 'media-1',
                        duration: 7200000,
                        bitrate: 12000,
                        width: 3840,
                        height: 2160,
                        aspectRatio: 1.78,
                        videoCodec: 'hevc',
                        audioCodec: 'eac3',
                        audioChannels: 6,
                        container: 'mkv',
                        videoResolution: '4K',
                        parts: [
                            {
                                id: 'part-1',
                                key: '/library/parts/1/file.mkv',
                                duration: 7200000,
                                file: 'file.mkv',
                                size: 123,
                                container: 'mkv',
                                streams: [
                                    {
                                        id: 'stream-1',
                                        streamType: 1,
                                        codec: 'hevc',
                                        hdr: 'Dolby Vision',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });
            panel.setFetchItemDetails(fetchItemDetails);

            const program = createMockProgram(null, {
                mediaInfo: {
                    resolution: '4K',
                    audioCodec: 'eac3',
                    audioChannels: 6,
                },
            });
            panel.show(program);

            expect(fetchItemDetails).not.toHaveBeenCalled();
            jest.advanceTimersByTime(220);
            await Promise.resolve();
            await Promise.resolve();

            expect(fetchItemDetails).toHaveBeenCalledWith('test-1', { signal: expect.any(AbortSignal) });
            const badges = Array.from(
                container.querySelectorAll('.epg-info-quality-badge')
            ) as HTMLElement[];
            const visibleBadges = badges.filter((badge) => badge.style.display !== 'none');
            const texts = visibleBadges.map((badge) => badge.textContent);
            expect(texts).toEqual(['4K', 'Dolby Vision', 'DD+', '5.1']);

            jest.useRealTimers();
        });
    });
});
