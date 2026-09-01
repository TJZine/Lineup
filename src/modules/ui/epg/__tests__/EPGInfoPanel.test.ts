/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Info Panel unit tests
 * @module modules/ui/epg/__tests__/EPGInfoPanel.test
 */

import { EPGInfoPanel } from '../view/info-panel/EPGInfoPanel';
import { EPGInfoPanelDynamicBackground } from '../view/info-panel/EPGInfoPanelDynamicBackground';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import { extractDominantColor } from '../../../../utils/color/extractDominantColor';
import type { ScheduledProgram } from '../types';
import type { EpgItemDetails } from '../model/domainTypes';

jest.mock('../../../../utils/color/extractDominantColor');

describe('EPGInfoPanel', () => {
    const settlePanel = async (panel: EPGInfoPanel): Promise<void> => {
        const idle = panel.whenIdle();
        await jest.runAllTimersAsync();
        await idle;
    };
    const settlePanelAfterTimerDrain = async (panel: EPGInfoPanel): Promise<void> => {
        await jest.runAllTimersAsync();
        await panel.whenIdle();
    };

    let panel: EPGInfoPanel;
    let container: HTMLElement;
    const RealImage = globalThis.Image;
    const RealFetch = globalThis.fetch;
    const OriginalCreateObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const OriginalRevokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

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
        isCurrent: true,
    });
    const createMockHdrItemDetails = (hdr: string): EpgItemDetails => ({
        ratingKey: 'test-1',
        media: [
            {
                parts: [
                    {
                        streams: [
                            {
                                streamType: 1,
                                hdr,
                            },
                        ],
                    },
                ],
            },
        ],
    });
    const markImageLoaded = (image: HTMLImageElement): void => {
        Object.defineProperties(image, {
            complete: { configurable: true, value: true },
            naturalWidth: { configurable: true, value: 1 },
        });
    };

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
        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            writable: true,
            value: jest.fn().mockResolvedValue({
                ok: true,
                blob: async () => new Blob(['sample'], { type: 'image/jpeg' }),
            } as Response),
        });
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            writable: true,
            value: jest.fn().mockReturnValue('blob:epg-sample'),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            writable: true,
            value: jest.fn(),
        });

        container = document.createElement('div');
        document.body.appendChild(container);

        panel = new EPGInfoPanel();
        panel.initialize(container);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.mocked(extractDominantColor).mockReset();
        localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        localStorage.removeItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS);
        panel.destroy();
        container.remove();
        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            writable: true,
            value: RealImage,
        });
        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            writable: true,
            value: RealFetch,
        });
        if (OriginalCreateObjectUrlDescriptor) {
            Object.defineProperty(URL, 'createObjectURL', OriginalCreateObjectUrlDescriptor);
        } else {
            delete (URL as { createObjectURL?: unknown }).createObjectURL;
        }
        if (OriginalRevokeObjectUrlDescriptor) {
            Object.defineProperty(URL, 'revokeObjectURL', OriginalRevokeObjectUrlDescriptor);
        } else {
            delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
        }
    });

    it('tracks presentation mode explicitly', () => {
        panel.setPresentationMode('classic');
        expect(panel.getPresentationMode()).toBe('classic');

        panel.setPresentationMode('overlay');
        expect(panel.getPresentationMode()).toBe('overlay');
    });

    it('preallocates hidden quality badge slots during initialization', () => {
        const badges = Array.from(container.querySelectorAll('.epg-info-quality-badge')) as HTMLElement[];

        expect(badges).toHaveLength(5);
        expect(badges.every((badge) => badge.style.display === 'none')).toBe(true);
    });

    it('keeps transient focus updates text-only and loads latest artwork only on the full update', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '2');
        localStorage.setItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, '1');
        const resolver = jest.fn((path: string | null, width?: number, height?: number) =>
            path ? `https://img.example${path}?${width}x${height}` : null
        );
        panel.setThumbResolver(resolver);

        const first = createMockProgram('/first-thumb.jpg', {
            ratingKey: 'first',
            title: 'First',
            fullTitle: 'First Program',
            art: '/first-art.jpg',
            clearLogo: '/first-logo.png',
        });
        const latest = createMockProgram('/latest-thumb.jpg', {
            ratingKey: 'latest',
            title: 'Latest',
            fullTitle: 'Latest Program',
            art: '/latest-art.jpg',
            clearLogo: '/latest-logo.png',
        });
        panel.updateFull(first);

        const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
        const backdrop = container.querySelector('.epg-info-backdrop-img') as HTMLImageElement;
        const clearLogo = container.querySelector('.epg-info-clear-logo') as HTMLImageElement;
        const title = container.querySelector('.epg-info-title') as HTMLElement;
        const firstPosterUrl = poster.getAttribute('src');
        const firstBackdropUrl = backdrop.getAttribute('src');
        const firstClearLogoUrl = clearLogo.getAttribute('src');
        resolver.mockClear();

        panel.updateFast(latest);

        expect(title.textContent).toBe('Latest Program');
        expect(title.style.display).toBe('');
        expect(resolver).not.toHaveBeenCalled();
        expect(poster.getAttribute('src')).toBe(firstPosterUrl);
        expect(backdrop.getAttribute('src')).toBe(firstBackdropUrl);
        expect(clearLogo.getAttribute('src')).toBe(firstClearLogoUrl);
        expect(poster.style.display).toBe('none');
        expect(backdrop.style.display).toBe('none');
        expect(clearLogo.style.display).toBe('none');
        expect(poster.alt).toBe('');
        expect(clearLogo.alt).toBe('');

        panel.updateFull(latest);

        expect(resolver).toHaveBeenCalledWith('/latest-thumb.jpg', 320, 480);
        expect(resolver).toHaveBeenCalledWith('/latest-art.jpg', 960, 540);
        expect(resolver).toHaveBeenCalledWith('/latest-logo.png', 520, 84);
        expect(poster.getAttribute('src')).toContain('/latest-thumb.jpg');
        expect(backdrop.getAttribute('src')).toContain('/latest-art.jpg');
        expect(clearLogo.getAttribute('src')).toContain('/latest-logo.png');
        markImageLoaded(clearLogo);

        const sourceAssignments = jest.fn();
        for (const image of [poster, backdrop, clearLogo]) {
            Object.defineProperty(image, 'src', {
                configurable: true,
                get: (): string => image.getAttribute('src') ?? '',
                set: sourceAssignments,
            });
        }
        panel.updateFull(latest);
        expect(sourceAssignments).not.toHaveBeenCalled();
    });

    it('hides and reuses same-program artwork across a fast-to-full update', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '2');
        localStorage.setItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, '1');
        panel.setThumbResolver((path, width, height) =>
            path ? `https://img.example${path}?${width}x${height}` : null
        );
        const program = createMockProgram('/same-thumb.jpg', {
            ratingKey: 'same',
            title: 'Same',
            fullTitle: 'Same Program',
            art: '/same-art.jpg',
            clearLogo: '/same-logo.png',
        });
        panel.updateFull(program);

        const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
        const backdrop = container.querySelector('.epg-info-backdrop-img') as HTMLImageElement;
        const clearLogo = container.querySelector('.epg-info-clear-logo') as HTMLImageElement;
        markImageLoaded(clearLogo);
        const sourceAssignments = jest.fn();
        for (const image of [poster, backdrop, clearLogo]) {
            Object.defineProperty(image, 'src', {
                configurable: true,
                get: (): string => image.getAttribute('src') ?? '',
                set: sourceAssignments,
            });
        }

        panel.updateFast(program);
        expect(sourceAssignments).not.toHaveBeenCalled();
        expect(poster.style.display).toBe('none');
        expect(backdrop.style.display).toBe('none');
        expect(clearLogo.style.display).toBe('none');
        expect(poster.alt).toBe('');
        expect(clearLogo.alt).toBe('');

        panel.updateFull(program);
        expect(sourceAssignments).not.toHaveBeenCalled();
        expect(poster.style.display).toBe('block');
        expect(backdrop.style.display).toBe('block');
        expect(clearLogo.style.display).toBe('block');
        expect(poster.alt).toBe('Same');
        expect(clearLogo.alt).toBe('Same Program');
    });

    it('retries a clear logo that fails while hidden by a fast update and preserves text fallback', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, '1');
        panel.setThumbResolver((path) => path ? `https://img.example${path}` : null);
        const program = createMockProgram(null, {
            title: 'Retry Logo',
            fullTitle: 'Retry Logo',
            clearLogo: '/retry-logo.png',
        });
        panel.updateFull(program);

        const clearLogo = container.querySelector('.epg-info-clear-logo') as HTMLImageElement;
        const title = container.querySelector('.epg-info-title') as HTMLElement;
        panel.updateFast(program);
        Object.defineProperties(clearLogo, {
            complete: { configurable: true, value: true },
            naturalWidth: { configurable: true, value: 0 },
        });
        const sourceAssignments = jest.fn((value: string) => clearLogo.setAttribute('src', value));
        Object.defineProperty(clearLogo, 'src', {
            configurable: true,
            get: (): string => clearLogo.getAttribute('src') ?? '',
            set: sourceAssignments,
        });

        panel.updateFull(program);

        expect(sourceAssignments).toHaveBeenCalledWith('https://img.example/retry-logo.png');
        expect(clearLogo.style.display).toBe('block');
        expect(title.style.display).toBe('none');
        clearLogo.onerror?.(new Event('error'));
        expect(clearLogo.style.display).toBe('none');
        expect(title.style.display).toBe('');
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
            await settlePanel(panel);

            expect(fetchItemDetails).toHaveBeenCalledWith('test-1', { signal: expect.any(AbortSignal) });
            expect(resolver).toHaveBeenCalledWith('/library/metadata/999/thumb', 320, 480);
            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('block');

            jest.useRealTimers();
        });

        it('settles idle when episode poster details throw synchronously', async () => {
            jest.useFakeTimers();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const resolver = jest.fn((path: string | null) => (path ? 'https://server/library/thumb?token=xxx' : null));
            const fetchItemDetails = jest.fn(() => {
                throw new Error('details failed X-Plex-Token=poster-secret');
            });
            panel.setThumbResolver(resolver);
            panel.setFetchItemDetails(fetchItemDetails);

            try {
                const program = createMockProgram('/library/metadata/123/thumb', {
                    type: 'episode',
                    showThumb: '',
                    showTitle: '',
                    title: 'Episode Title',
                    fullTitle: 'Some Show - S01E01 - Episode Title',
                });
                panel.show(program);

                jest.advanceTimersByTime(220);
                await settlePanel(panel);

                expect(fetchItemDetails).toHaveBeenCalledWith('test-1', { signal: expect.any(AbortSignal) });
                expect(warnSpy).toHaveBeenCalledWith(
                    'EPG info panel details fetch failed',
                    expect.objectContaining({
                        kind: 'poster',
                        error: expect.objectContaining({
                            message: 'details failed X-Plex-Token=REDACTED',
                        }),
                    })
                );
            } finally {
                warnSpy.mockRestore();
                jest.useRealTimers();
            }
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
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '2');

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
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '2');

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

        it('does not render a visible poster in classic artwork bleed mode', () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');
            panel.setPresentationMode('classic');

            const resolver = jest.fn((path: string | null, width?: number, height?: number) => {
                if (!path) return null;
                if (width === 32 && height === 32) return 'https://img.example/poster-sample.jpg';
                return 'https://img.example/poster-full.jpg';
            });
            panel.setThumbResolver(resolver);

            panel.show(createMockProgram('/library/metadata/123/thumb'));

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement | null;
            expect(poster?.style.display).toBe('none');
        });

        it('does not resolve a visible poster asset in classic artwork bleed mode', () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');
            panel.setPresentationMode('classic');

            const resolver = jest.fn((path: string | null, width?: number, height?: number) => {
                if (!path) return null;
                if (width === 32 && height === 32) return 'https://img.example/poster-sample.jpg';
                if (width === 320 && height === 480) return 'https://img.example/poster-full.jpg';
                return null;
            });
            panel.setThumbResolver(resolver);

            panel.show(createMockProgram('/library/metadata/123/thumb'));

            expect(resolver).toHaveBeenCalledWith('/library/metadata/123/thumb', 32, 32);
            expect(resolver).not.toHaveBeenCalledWith('/library/metadata/123/thumb', 320, 480);
        });

        it('does not display backdrop art in artwork bleed mode', () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');
            panel.setPresentationMode('overlay');
            panel.show(createMockProgram('/library/metadata/123/thumb', { art: '/library/metadata/123/art' }));

            const backdrop = container.querySelector('.epg-info-backdrop-img') as HTMLImageElement | null;
            expect(backdrop?.style.display).toBe('none');
        });

        it('does not fall back to the visible poster asset when the bleed sample is unavailable', () => {
            jest.useFakeTimers();

            try {
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');
                panel.setPresentationMode('overlay');

                const resolver = jest.fn((path: string | null, width?: number, height?: number) => {
                    if (!path) return null;
                    if (width === 32 && height === 32) return null;
                    return 'https://img.example/poster-full.jpg';
                });
                panel.setThumbResolver(resolver);
                jest.mocked(extractDominantColor).mockReturnValue('rgba(10, 20, 30, 0.7)');

                panel.show(createMockProgram('/library/metadata/123/thumb'));
                jest.runAllTimers();

                expect(extractDominantColor).not.toHaveBeenCalled();
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
            }
        });

        it('hides backdrop when art is null', () => {
            const resolver = jest.fn().mockImplementation((path: string | null) => {
                if (path === '/library/metadata/123/thumb') return 'https://server/library/thumb-123';
                if (path === '/library/metadata/789/thumb') return 'https://server/library/thumb-789';
                if (path === '/library/metadata/123/art') return 'https://server/library/art-123';
                return null;
            });
            panel.setThumbResolver(resolver);
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '2');

            try {
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
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
            }
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
        it('marks the panel as borderless in artwork bleed mode', () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');
            panel.setPresentationMode('classic');

            panel.show(createMockProgram('/library/metadata/123/thumb'));

            const infoPanel = container.querySelector('.epg-info-panel') as HTMLElement | null;
            expect(infoPanel?.classList.contains('epg-info-mode-bleed')).toBe(true);
        });

        it('marks the panel as theme-default in default mode', () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '1');

            panel.show(createMockProgram('/library/metadata/123/thumb'));

            const infoPanel = container.querySelector('.epg-info-panel') as HTMLElement | null;
            expect(infoPanel?.classList.contains('epg-info-mode-theme-default')).toBe(true);
        });

        it('should initialize without errors', () => {
            expect(panel.isShowing()).toBe(false);
        });

        it('should show and hide correctly', () => {
            const program = createMockProgram(null);
            panel.show(program);
            expect(panel.isShowing()).toBe(true);

            panel.hide();
            expect(panel.isShowing()).toBe(false);
        });

        it('should display program title', () => {
            const program = createMockProgram(null);
            panel.show(program);

            const title = container.querySelector('.epg-info-title');
            expect(title?.textContent).toBe('Test Movie');
        });

        it('applies extracted color to the inactive gradient layer when artwork bleed is enabled', async () => {
            jest.useFakeTimers();

            try {
                (extractDominantColor as jest.Mock).mockReturnValue('rgba(100, 50, 50, 0.32)');
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');

                const resolver = jest.fn((path: string | null) => (path ? 'https://img.example/thumb.jpg' : null));
                panel.setThumbResolver(resolver);

                const program = createMockProgram('/library/metadata/1/thumb');
                panel.show(program);

                jest.runAllTimers();
                await settlePanel(panel);

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

        it('aborts stale bleed sample fetches when focus moves to a new program', async () => {
            jest.useFakeTimers();

            const realFetch = globalThis.fetch;
            const realCreateObjectURL = URL.createObjectURL;
            const realRevokeObjectURL = URL.revokeObjectURL;
            const sampleBlob = new Blob(['sample'], { type: 'image/jpeg' });
            const observedSignals: Array<AbortSignal | undefined> = [];

            try {
                const fetchMock = jest
                    .fn()
                    .mockImplementationOnce((_url: string, init?: RequestInit) => {
                        const signal = init?.signal as AbortSignal | undefined;
                        observedSignals.push(signal);

                        return new Promise<Response>((_resolve, reject) => {
                            if (!signal) {
                                reject(new Error('Missing abort signal'));
                                return;
                            }
                            signal.addEventListener(
                                'abort',
                                () => reject(new DOMException('Aborted', 'AbortError')),
                                { once: true }
                            );
                        });
                    })
                    .mockImplementationOnce((_url: string, init?: RequestInit) => {
                        observedSignals.push(init?.signal as AbortSignal | undefined);
                        return Promise.resolve({
                            ok: true,
                            blob: async () => sampleBlob,
                        } as Response);
                    });
                const createObjectURLMock = jest.fn().mockReturnValue('blob:epg-sample-2');
                const revokeObjectURLMock = jest.fn();

                Object.defineProperty(globalThis, 'fetch', {
                    configurable: true,
                    writable: true,
                    value: fetchMock,
                });
                Object.defineProperty(URL, 'createObjectURL', {
                    configurable: true,
                    writable: true,
                    value: createObjectURLMock,
                });
                Object.defineProperty(URL, 'revokeObjectURL', {
                    configurable: true,
                    writable: true,
                    value: revokeObjectURLMock,
                });

                (extractDominantColor as jest.Mock).mockReturnValue('rgba(100, 50, 50, 0.32)');
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');

                const resolver = jest.fn((path: string | null, width?: number, height?: number) => {
                    if (!path) return null;
                    if (width === 32 && height === 32) return `https://img.example${path}-32.jpg`;
                    return `https://img.example${path}.jpg`;
                });
                panel.setThumbResolver(resolver);

                panel.show(createMockProgram('/library/metadata/1/thumb', { ratingKey: 'first' }));
                await jest.advanceTimersByTimeAsync(150);
                await Promise.resolve();

                expect(fetchMock).toHaveBeenCalledTimes(1);
                expect(observedSignals[0]?.aborted).toBe(false);

                panel.show(createMockProgram('/library/metadata/2/thumb', { ratingKey: 'second' }));
                await jest.advanceTimersByTimeAsync(150);
                await settlePanel(panel);

                expect(fetchMock).toHaveBeenCalledTimes(2);
                expect(observedSignals[0]?.aborted).toBe(true);
                expect(extractDominantColor).toHaveBeenCalledTimes(1);
                expect(createObjectURLMock).toHaveBeenCalledWith(sampleBlob);
                expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:epg-sample-2');
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
                Object.defineProperty(globalThis, 'fetch', {
                    configurable: true,
                    writable: true,
                    value: realFetch,
                });
                Object.defineProperty(URL, 'createObjectURL', {
                    configurable: true,
                    writable: true,
                    value: realCreateObjectURL,
                });
                Object.defineProperty(URL, 'revokeObjectURL', {
                    configurable: true,
                    writable: true,
                    value: realRevokeObjectURL,
                });
            }
        });

        it('does not apply extracted color after the panel is hidden', async () => {
            jest.useFakeTimers();

            const createdImages: {
                onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null;
                src: string;
            }[] = [];

            class DelayedMockImage {
                crossOrigin: string | null = null;
                onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
                onerror: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
                private _src: string = '';

                get src(): string {
                    return this._src;
                }

                set src(value: string) {
                    this._src = value;
                    createdImages.push(this);
                }
            }

            Object.defineProperty(globalThis, 'Image', {
                configurable: true,
                writable: true,
                value: DelayedMockImage as unknown as typeof Image,
            });

            try {
                (extractDominantColor as jest.Mock).mockReturnValue('rgba(100, 50, 50, 0.32)');
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');

                const resolver = jest.fn((path: string | null, width?: number, height?: number) => {
                    if (!path) return null;
                    if (width === 32 && height === 32) return 'https://img.example/thumb-32.jpg';
                    return 'https://img.example/thumb.jpg';
                });
                panel.setThumbResolver(resolver);

                const program = createMockProgram('/library/metadata/1/thumb');
                panel.show(program);

                await jest.advanceTimersByTimeAsync(150);
                await Promise.resolve();

                expect(createdImages.length).toBe(1);

                panel.hide();

                const layerA = container.querySelector('.epg-info-gradient-a') as HTMLElement | null;
                const layerB = container.querySelector('.epg-info-gradient-b') as HTMLElement | null;
                if (!layerA || !layerB) {
                    throw new Error('Gradient layers not found');
                }

                expect(layerA.classList.contains('epg-info-gradient-active')).toBe(true);
                expect(layerB.classList.contains('epg-info-gradient-active')).toBe(false);

                createdImages[0]?.onload?.call(createdImages[0] as unknown as GlobalEventHandlers, new Event('load'));

                expect(layerA.classList.contains('epg-info-gradient-active')).toBe(true);
                expect(layerB.classList.contains('epg-info-gradient-active')).toBe(false);
                expect(layerA.style.getPropertyValue('--dynamic-info-bg')).toBe('');
                expect(layerB.style.getPropertyValue('--dynamic-info-bg')).toBe('');
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
                Object.defineProperty(globalThis, 'Image', {
                    configurable: true,
                    writable: true,
                    value: RealImage,
                });
            }
        });

        it('clears dynamic tint state when hidden', async () => {
            jest.useFakeTimers();

            try {
                (extractDominantColor as jest.Mock).mockReturnValue('rgba(100, 50, 50, 0.32)');
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');

                const resolver = jest.fn((path: string | null) => (path ? 'https://img.example/thumb.jpg' : null));
                panel.setThumbResolver(resolver);

                const program = createMockProgram('/library/metadata/1/thumb');
                panel.show(program);

                jest.runAllTimers();
                await settlePanel(panel);

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

        it('preserves dynamic tint state and skips new sampling on fast updates in artwork bleed mode', async () => {
            jest.useFakeTimers();

            try {
                (extractDominantColor as jest.Mock).mockReturnValue('rgba(100, 50, 50, 0.32)');
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');
                panel.setPresentationMode('classic');

                const resolver = jest.fn((path: string | null) => (path ? 'https://img.example/thumb.jpg' : null));
                panel.setThumbResolver(resolver);

                const program = createMockProgram('/library/metadata/1/thumb');
                panel.show(program);
                jest.runAllTimers();
                await settlePanel(panel);

                const layerA = container.querySelector('.epg-info-gradient-a') as HTMLElement | null;
                const layerB = container.querySelector('.epg-info-gradient-b') as HTMLElement | null;
                if (!layerA || !layerB) {
                    throw new Error('Gradient layers not found');
                }
                expect(layerB.classList.contains('epg-info-gradient-active')).toBe(true);
                expect(layerB.style.getPropertyValue('--dynamic-info-bg')).toBe('rgba(100, 50, 50, 0.32)');
                expect(extractDominantColor).toHaveBeenCalledTimes(1);

                const nextProgram = createMockProgram('/library/metadata/2/thumb', { ratingKey: 'test-2', title: 'Next' });
                panel.updateFast(nextProgram);
                jest.runAllTimers();
                await settlePanel(panel);

                expect(extractDominantColor).toHaveBeenCalledTimes(1);
                expect(layerA.style.getPropertyValue('--dynamic-info-bg')).toBe('');
                expect(layerB.style.getPropertyValue('--dynamic-info-bg')).toBe('rgba(100, 50, 50, 0.32)');
                expect(layerA.classList.contains('epg-info-gradient-active')).toBe(false);
                expect(layerB.classList.contains('epg-info-gradient-active')).toBe(true);
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
            }
        });

        it('clears dynamic color caches on destroy', async () => {
            jest.useFakeTimers();

            try {
                (extractDominantColor as jest.Mock).mockReturnValue(null);
                localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '0');

                const resolver = jest.fn((path: string | null) => (path ? 'https://img.example/thumb.jpg' : null));
                panel.setThumbResolver(resolver);

                const program = createMockProgram('/library/metadata/1/thumb');
                panel.show(program);
                jest.runAllTimers();
                await settlePanel(panel);

                expect(panel.getDynamicBackgroundCacheStats().colorFailureCacheSize).toBeGreaterThan(0);

                panel.destroy();

                expect(panel.getDynamicBackgroundCacheStats()).toEqual(expect.objectContaining({
                    colorCacheSize: 0,
                    colorFailureCacheSize: 0,
                }));
            } finally {
                localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
            }
        });

        it('settles stale dynamic color fetches after the sample blob resolves', async () => {
            jest.useFakeTimers();

            try {
                let isCurrentRequest = true;
                let resolveBlob: (blob: Blob) => void = () => undefined;
                const blobPromise = new Promise<Blob>((resolve) => {
                    resolveBlob = resolve;
                });
                const onSettled = jest.fn();
                const dynamicBackground = new EPGInfoPanelDynamicBackground({
                    onPendingWork: jest.fn(),
                    onSettled,
                    isCurrentRequest: (): boolean => isCurrentRequest,
                });
                Object.defineProperty(globalThis, 'fetch', {
                    configurable: true,
                    writable: true,
                    value: jest.fn().mockResolvedValue({
                        ok: true,
                        blob: jest.fn(() => blobPromise),
                    } as unknown as Response),
                });

                dynamicBackground.scheduleDynamicColor(createMockProgram('/thumb'), 'https://img.example/thumb.jpg');
                jest.advanceTimersByTime(120);
                await Promise.resolve();
                expect(dynamicBackground.hasPendingAsyncWork()).toBe(true);

                isCurrentRequest = false;
                resolveBlob(new Blob(['sample'], { type: 'image/jpeg' }));
                await Promise.resolve();

                expect(dynamicBackground.hasPendingAsyncWork()).toBe(false);
                expect(onSettled).toHaveBeenCalled();
            } finally {
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
            }
        });

        it('caps the dynamic color cache to avoid unbounded growth', async () => {
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
                    await settlePanelAfterTimerDrain(panel);
                }

                const cacheStats = panel.getDynamicBackgroundCacheStats();
                expect(cacheStats.colorCacheSize).toBe(128);
                expect(cacheStats.hasColorCacheKey('cache-0')).toBe(false);
                expect(cacheStats.hasColorCacheKey('cache-1')).toBe(false);
                expect(cacheStats.hasColorCacheKey('cache-129')).toBe(true);
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

        it('derives series title from fullTitle without a season code', () => {
            const resolver = jest.fn((path: string | null) => (path ? 'https://server/thumb?token=xxx' : null));
            panel.setThumbResolver(resolver);

            const program = createMockProgram('/library/metadata/123/showThumb', {
                type: 'episode',
                showTitle: '',
                title: 'Scavengers',
                fullTitle: 'Scavengers Reign - Scavengers',
                showThumb: '/library/metadata/123/showThumb',
            });
            panel.show(program);

            const showTitle = container.querySelector('.epg-info-show') as HTMLElement;
            expect(showTitle.textContent).toBe('Scavengers Reign');
            expect(showTitle.style.display).toBe('block');

            const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;
            expect(poster.style.display).toBe('block');
            expect(poster.alt).toBe('Scavengers Reign');
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
        it('renders genres directly below the title block and above the time pills', () => {
            panel.show(createMockProgram('/library/metadata/123/thumb'));

            const heading = container.querySelector('.epg-info-heading') as HTMLElement | null;
            const genres = container.querySelector('.epg-info-genres') as HTMLElement | null;
            const tags = container.querySelector('.epg-info-tags') as HTMLElement | null;

            expect(heading).not.toBeNull();
            expect(genres).not.toBeNull();
            expect(tags).not.toBeNull();
            expect(heading?.contains(genres as Node)).toBe(true);
            expect(heading?.contains(tags as Node)).toBe(false);
        });

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
            const fetchItemDetails = jest.fn().mockResolvedValue(createMockHdrItemDetails('Dolby Vision'));
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
            await settlePanel(panel);

            expect(fetchItemDetails).toHaveBeenCalledWith('test-1', { signal: expect.any(AbortSignal) });
            const badges = Array.from(
                container.querySelectorAll('.epg-info-quality-badge')
            ) as HTMLElement[];
            const visibleBadges = badges.filter((badge) => badge.style.display !== 'none');
            const texts = visibleBadges.map((badge) => badge.textContent);
            expect(texts).toEqual(['4K', 'Dolby Vision', 'DD+', '5.1']);

            jest.useRealTimers();
        });

        it('ignores stale HDR fetch results after clearing the in-flight request', async () => {
            jest.useFakeTimers();
            let resolveDetails: (value: unknown) => void = () => undefined;
            const detailsPromise = new Promise((resolve) => {
                resolveDetails = resolve;
            });
            const fetchItemDetails = jest.fn().mockReturnValue(detailsPromise);
            panel.setFetchItemDetails(fetchItemDetails);

            const fetchingProgram = createMockProgram(null, {
                mediaInfo: {
                    resolution: '4K',
                    audioCodec: 'eac3',
                    audioChannels: 6,
                },
            });
            panel.show(fetchingProgram);

            await jest.advanceTimersByTimeAsync(220);
            expect(fetchItemDetails).toHaveBeenCalledWith('test-1', { signal: expect.any(AbortSignal) });

            const explicitHdrProgram = createMockProgram(null, {
                mediaInfo: {
                    resolution: '4K',
                    hdr: 'HDR10',
                    audioCodec: 'eac3',
                    audioChannels: 6,
                },
            });
            panel.show(explicitHdrProgram);

            resolveDetails(createMockHdrItemDetails('Dolby Vision'));
            await Promise.resolve();
            await settlePanel(panel);

            const badges = Array.from(
                container.querySelectorAll('.epg-info-quality-badge')
            ) as HTMLElement[];
            const visibleBadges = badges.filter((badge) => badge.style.display !== 'none');
            const texts = visibleBadges.map((badge) => badge.textContent);
            expect(texts).toEqual(['4K', 'HDR10', 'DD+', '5.1']);

            jest.useRealTimers();
        });

        it('settles idle when HDR details throw synchronously', async () => {
            jest.useFakeTimers();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const fetchItemDetails = jest.fn(() => {
                throw new Error('details failed X-Plex-Token=hdr-secret');
            });
            panel.setFetchItemDetails(fetchItemDetails);

            try {
                const program = createMockProgram(null, {
                    mediaInfo: {
                        resolution: '4K',
                        audioCodec: 'eac3',
                        audioChannels: 6,
                    },
                });
                panel.show(program);

                jest.advanceTimersByTime(220);
                await settlePanel(panel);

                expect(fetchItemDetails).toHaveBeenCalledWith('test-1', { signal: expect.any(AbortSignal) });
                expect(warnSpy).toHaveBeenCalledWith(
                    'EPG info panel details fetch failed',
                    expect.objectContaining({
                        kind: 'hdr',
                        error: expect.objectContaining({
                            message: 'details failed X-Plex-Token=REDACTED',
                        }),
                    })
                );
            } finally {
                warnSpy.mockRestore();
                jest.useRealTimers();
            }
        });
    });
});
