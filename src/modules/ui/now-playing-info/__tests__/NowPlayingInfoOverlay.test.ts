/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview Now Playing Info overlay unit tests
 * @module modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test
 */

import { NowPlayingInfoOverlay } from '../NowPlayingInfoOverlay';
import { NOW_PLAYING_INFO_CLASSES } from '../constants';
import type { NowPlayingInfoConfig, NowPlayingInfoViewModel } from '../types';

describe('NowPlayingInfoOverlay', () => {
    let overlay: NowPlayingInfoOverlay;
    let container: HTMLElement;

    const baseViewModel: NowPlayingInfoViewModel = {
        title: 'Test Movie',
        subtitle: '2h 10m',
        badges: ['PG-13'],
        description: 'A test description of the movie.',
        elapsedMs: 60_000,
        durationMs: 120_000,
        posterUrl: 'https://example.com/poster.jpg',
        backdropUrl: 'https://example.com/backdrop.jpg',
    };

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'now-playing-info-container';
        document.body.appendChild(container);
        overlay = new NowPlayingInfoOverlay();
        const config: NowPlayingInfoConfig = { containerId: 'now-playing-info-container', autoHideMs: 5000 };
        overlay.initialize(config);
    });

    afterEach(() => {
        overlay.destroy();
        container.remove();
    });

    it('should initialize hidden', () => {
        expect(overlay.isVisible()).toBe(false);
        expect(container.classList.contains('visible')).toBe(false);
    });

    it('should show and hide correctly', () => {
        overlay.show(baseViewModel);
        expect(overlay.isVisible()).toBe(true);
        expect(container.classList.contains('visible')).toBe(true);

        overlay.hide();
        expect(overlay.isVisible()).toBe(false);
        expect(container.classList.contains('visible')).toBe(false);
    });

    it('should populate text fields', () => {
        overlay.show(baseViewModel);
        expect(container.querySelector('.now-playing-info-title')?.textContent).toBe('Test Movie');
        expect(container.querySelector('.now-playing-info-subtitle')?.textContent).toBe('2h 10m');
        expect(container.querySelector('.now-playing-info-description')?.textContent).toBe('A test description of the movie.');
        expect(container.querySelector('.now-playing-info-context')).toBeNull();
        expect(container.querySelector('.now-playing-info-up-next')).toBeNull();
    });

    it('sets clear logo alt text when clearLogoUrl is shown', () => {
        overlay.show({ ...baseViewModel, clearLogoUrl: 'https://example.com/logo.png' });
        const clearLogo = container.querySelector(
            `.${NOW_PLAYING_INFO_CLASSES.CLEAR_LOGO}`
        ) as HTMLImageElement;
        expect(clearLogo.getAttribute('src')).toBe('https://example.com/logo.png');
        expect(clearLogo.getAttribute('alt')).toBe(baseViewModel.title);

        overlay.show({ ...baseViewModel, clearLogoUrl: null });
        expect(clearLogo.getAttribute('src')).toBeNull();
        expect(clearLogo.getAttribute('alt')).toBe('');
    });

    it('falls back to title when clear logo renders too small', () => {
        overlay.show({ ...baseViewModel, clearLogoUrl: 'https://example.com/tiny.png' });

        const clearLogo = container.querySelector(
            `.${NOW_PLAYING_INFO_CLASSES.CLEAR_LOGO}`
        ) as HTMLImageElement;
        const title = container.querySelector(`.${NOW_PLAYING_INFO_CLASSES.TITLE}`) as HTMLElement;

        Object.defineProperty(clearLogo, 'getBoundingClientRect', {
            value: () => ({ height: 10 } as unknown as DOMRect),
        });

        (clearLogo.onload as unknown as (() => void))?.();

        expect(clearLogo.style.display).toBe('none');
        expect(title.style.display).toBe('');
    });

    it('should render quality badges when provided', () => {
        overlay.show({ ...baseViewModel, badges: ['4K', 'HDR', 'DD+'] });
        const badges = Array.from(container.querySelectorAll('.now-playing-info-badge'));
        const texts = badges.map((badge) => badge.textContent);
        expect(texts).toEqual(['4K', 'HDR', 'DD+']);
    });

    it('should render actor headshots when provided', () => {
        overlay.show({
            ...baseViewModel,
            actorHeadshots: [
                { name: 'Actor A', url: 'https://example.com/a.jpg' },
                { name: 'Actor B', url: null },
            ],
            actorMoreCount: 2,
        });
        const actorsRow = container.querySelector('.now-playing-info-actors') as HTMLElement;
        const castLine = container.querySelector('.now-playing-info-cast') as HTMLElement;
        const actorItems = Array.from(
            container.querySelectorAll('.now-playing-info-actor')
        ) as HTMLElement[];
        const images = Array.from(
            container.querySelectorAll('.now-playing-info-actor-image')
        ) as HTMLImageElement[];
        expect(actorsRow.style.display).toBe('flex');
        expect(images[0]?.getAttribute('src')).toBe('https://example.com/a.jpg');
        expect(actorItems[1]?.classList.contains('fallback')).toBe(true);
        expect(actorItems[1]?.textContent).toBe('AB');
        expect(castLine.textContent).toBe('Cast: Actor A • Actor B');
    });

    it('should render +N when space is available', () => {
        const actorsRow = container.querySelector('.now-playing-info-actors') as HTMLElement;
        Object.defineProperty(actorsRow, 'clientWidth', { value: 120, configurable: true });
        overlay.show({
            ...baseViewModel,
            actorHeadshots: [{ name: 'Actor A', url: 'https://example.com/a.jpg' }],
            actorMoreCount: 2,
        });
        const more = container.querySelector('.now-playing-info-actor-more') as HTMLElement;
        const castLine = container.querySelector('.now-playing-info-cast') as HTMLElement;
        expect(actorsRow.style.display).toBe('flex');
        expect(more.textContent).toBe('+2');
        expect(castLine.textContent).toBe('Cast: Actor A +2');
    });

    it('reflows actor row after show when ResizeObserver is unavailable', async () => {
        const globalWithResizeObserver = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
        const originalResizeObserver = globalWithResizeObserver.ResizeObserver;
        jest.useFakeTimers();
        delete globalWithResizeObserver.ResizeObserver;
        try {
            overlay.destroy();
            container.innerHTML = '';
            overlay = new NowPlayingInfoOverlay();
            const config: NowPlayingInfoConfig = { containerId: 'now-playing-info-container', autoHideMs: 5000 };
            overlay.initialize(config);

            const actorsRow = container.querySelector('.now-playing-info-actors') as HTMLElement;
            let widthReadCount = 0;
            Object.defineProperty(actorsRow, 'clientWidth', {
                configurable: true,
                get: () => {
                    widthReadCount += 1;
                    return widthReadCount <= 2 ? 0 : 120;
                },
            });

            overlay.show({
                ...baseViewModel,
                actorHeadshots: [{ name: 'Actor A', url: 'https://example.com/a.jpg' }],
                actorMoreCount: 2,
            });

            for (let i = 0; i < 6; i++) {
                jest.advanceTimersByTime(20);
                await Promise.resolve();
            }

            const more = container.querySelector('.now-playing-info-actor-more') as HTMLElement | null;
            expect(more?.textContent).toBe('+2');
        } finally {
            jest.useRealTimers();
            if (originalResizeObserver) {
                globalWithResizeObserver.ResizeObserver = originalResizeObserver;
            } else {
                delete globalWithResizeObserver.ResizeObserver;
            }
        }
    });

    it('should hide actor headshots when missing', () => {
        overlay.show(baseViewModel);
        const actorsRow = container.querySelector('.now-playing-info-actors') as HTMLElement;
        const castLine = container.querySelector('.now-playing-info-cast') as HTMLElement;
        expect(actorsRow.style.display).toBe('none');
        expect(castLine.style.display).toBe('none');
    });

    it('should not render debug or playback detail blocks', () => {
        overlay.show(baseViewModel);
        expect(container.querySelector('.now-playing-info-debug')).toBeNull();
        expect(container.querySelector('.now-playing-info-playback-details')).toBeNull();
    });

    it('should hide poster when no URL is provided', () => {
        overlay.show({ ...baseViewModel, posterUrl: null });
        const poster = container.querySelector('.now-playing-info-poster') as HTMLImageElement;
        expect(poster.style.display).toBe('none');
    });

    it('should hide description when empty', () => {
        overlay.show({ ...baseViewModel, description: '' });
        const description = container.querySelector('.now-playing-info-description') as HTMLElement;
        expect(description.style.display).toBe('none');
    });

    it('should hide progress when duration is missing', () => {
        const viewModel: NowPlayingInfoViewModel = {
            title: baseViewModel.title,
            subtitle: baseViewModel.subtitle ?? 'PG-13 • 2h 10m',
            description: baseViewModel.description ?? 'A test description of the movie.',
            elapsedMs: baseViewModel.elapsedMs ?? 60_000,
            posterUrl: baseViewModel.posterUrl ?? null,
        };
        overlay.show(viewModel);
        const progress = container.querySelector('.now-playing-info-progress') as HTMLElement;
        expect(progress.style.display).toBe('flex');
        expect(container.querySelector('.now-playing-info-progress-meta')?.textContent).toBe('Live');
    });

    it('should auto-hide after configured timeout', () => {
        jest.useFakeTimers();
        overlay.show(baseViewModel);
        expect(overlay.isVisible()).toBe(true);
        jest.advanceTimersByTime(5000);
        expect(overlay.isVisible()).toBe(false);
        jest.useRealTimers();
    });

    it('should call onAutoHide handler when set', () => {
        jest.useFakeTimers();
        const onAutoHide = jest.fn();
        overlay.setOnAutoHide(onAutoHide);
        overlay.show(baseViewModel);
        jest.advanceTimersByTime(5000);
        expect(onAutoHide).toHaveBeenCalledTimes(1);
        expect(overlay.isVisible()).toBe(true);
        overlay.hide();
        jest.useRealTimers();
    });

    it('stays visible in persistent mode (autoHideMs = 0)', () => {
        jest.useFakeTimers();
        overlay.setAutoHideMs(0);
        overlay.show(baseViewModel);

        jest.advanceTimersByTime(120_000);

        expect(overlay.isVisible()).toBe(true);
        overlay.hide();
        jest.useRealTimers();
    });

    it('applies cinematic class when vm.cinematic is true', () => {
        overlay.show({ ...baseViewModel, cinematic: true });
        expect(container.classList.contains(NOW_PLAYING_INFO_CLASSES.CINEMATIC)).toBe(true);

        overlay.show(baseViewModel);
        expect(container.classList.contains(NOW_PLAYING_INFO_CLASSES.CINEMATIC)).toBe(false);
    });

    it('sanitizes cinematic backdrop URLs to a single background image', () => {
        overlay.show({
            ...baseViewModel,
            cinematic: true,
            backdropUrl: 'https://example.com/a") , linear-gradient(red, red), url("https://evil',
            posterUrl: 'https://example.com/poster.jpg',
        });

        const backdrop = container.querySelector('.now-playing-info-backdrop') as HTMLElement;
        expect(backdrop.style.backgroundImage).toBe('');
    });

    it('preserves legitimate backdrop URLs in cinematic backdrop', () => {
        overlay.show({
            ...baseViewModel,
            cinematic: true,
            backdropUrl: 'https://example.com/backdrop.jpg',
        });

        const backdrop = container.querySelector('.now-playing-info-backdrop') as HTMLElement;
        expect(backdrop.style.backgroundImage).toContain('https://example.com/backdrop.jpg');
    });

    it('falls back to posterUrl when backdropUrl is missing in cinematic mode', () => {
        overlay.show({
            ...baseViewModel,
            cinematic: true,
            backdropUrl: null,
            posterUrl: 'https://example.com/poster-fallback.jpg',
        });

        const backdrop = container.querySelector('.now-playing-info-backdrop') as HTMLElement;
        expect(backdrop.style.backgroundImage).toContain('https://example.com/poster-fallback.jpg');
    });
});
