import type { BuildStrategy } from '../../scheduler/channel-manager/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ICON_PATHS = {
    collections: 'M4 6h16v4H4zM4 14h10v4H4z',
    playlists: 'M4 7h12v2H4zm0 4h12v2H4zm0 4h8v2H4zm12-8 4 2-4 2z',
    genres: 'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
    directors: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-7 14c0-3 3-5 7-5s7 2 7 5',
    decades: 'M4 6h2v12H4zm4 0h2v12H8zm6 0h2v12h-2zm4 0h2v12h-2z',
    recentlyAdded: 'M12 4v8l5 3',
    studios: 'M4 18h16v2H4zm2-2V8l6-4 6 4v8',
    actors: 'M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6 14c0-3 2.5-5 6-5s6 2 6 5',
    libraryFallback: 'M5 5h14v14H5zM8 9h8v2H8zm0 4h8v2H8z',
} satisfies Record<BuildStrategy, string>;

const ICON_SVG_CACHE = new Map<BuildStrategy, SVGElement>();

export function getChannelBrandingIcon(buildStrategy: BuildStrategy): SVGElement | null {
    const cached = ICON_SVG_CACHE.get(buildStrategy);
    if (cached) {
        return cached.cloneNode(true) as SVGElement;
    }
    const pathData = ICON_PATHS[buildStrategy];
    if (!pathData) {
        return null;
    }
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'channel-branding-icon');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    ICON_SVG_CACHE.set(buildStrategy, svg);
    return svg.cloneNode(true) as SVGElement;
}

export function getAvailableStrategies(): BuildStrategy[] {
    return Object.keys(ICON_PATHS) as BuildStrategy[];
}
