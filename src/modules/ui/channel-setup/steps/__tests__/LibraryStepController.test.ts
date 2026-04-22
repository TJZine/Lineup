/**
 * @jest-environment jsdom
 */

jest.mock('../../../../../utils/inlineSvg', () => ({
    setTrustedInlineSvg: jest.fn(),
}));

import { makeLibrary } from '../../__tests__/channel-setup-test-helpers';
import { LibraryStepController } from '../LibraryStepController';
import type { LibraryStepDeps, StepRenderContext } from '../types';

const createContext = (): StepRenderContext => ({
    contentEl: document.createElement('div'),
    stepEl: document.createElement('div'),
    statusEl: document.createElement('div'),
    detailEl: document.createElement('div'),
    errorEl: document.createElement('div'),
});

const createDeps = (overrides: Partial<LibraryStepDeps> = {}): LibraryStepDeps => ({
    libraries: [],
    selectedLibraryIds: new Set(),
    formatCount: (value: number) => value.toLocaleString(),
    movieSvg: '<svg></svg>',
    showSvg: '<svg></svg>',
    toDomId: (raw: string) => raw.replace(/[^a-z0-9]+/gi, '-'),
    onToggleLibrary: jest.fn(),
    onSelectAll: jest.fn(),
    onClearAll: jest.fn(),
    onBack: jest.fn(),
    onNext: jest.fn(),
    registerSpatialFocusables: jest.fn(),
    registerBulkActionNeighbors: jest.fn(),
    ...overrides,
});

describe('LibraryStepController', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('renders the empty-library state and disables the next action', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps();
        const controller = new LibraryStepController();

        controller.render(ctx, deps);

        expect(ctx.contentEl.querySelector('.setup-empty')?.textContent).toContain('No movie or show libraries found');
        expect((ctx.contentEl.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(true);
    });

    it('routes select-all and clear-all callbacks toward the first library focus target', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            libraries: [makeLibrary({ id: 'movies' }), makeLibrary({ id: 'shows', type: 'show' })],
            selectedLibraryIds: new Set(['movies']),
        });
        const controller = new LibraryStepController();

        controller.render(ctx, deps);

        (ctx.contentEl.querySelector('#setup-select-all') as HTMLButtonElement).click();
        (ctx.contentEl.querySelector('#setup-clear-all') as HTMLButtonElement).click();

        expect(deps.onSelectAll).toHaveBeenCalledWith('setup-lib-movies');
        expect(deps.onClearAll).toHaveBeenCalledWith('setup-lib-movies');
        expect((ctx.contentEl.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(false);
    });

    it('updateLibraryToggle mutates aria state, classes, and text in place', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            libraries: [makeLibrary({ id: 'movies' })],
            selectedLibraryIds: new Set(),
        });
        const controller = new LibraryStepController();
        controller.render(ctx, deps);

        const button = controller.updateLibraryToggle(ctx.contentEl, 'movies', true, deps.toDomId);

        expect(button).not.toBeNull();
        expect(button?.classList.contains('selected')).toBe(true);
        expect(button?.getAttribute('aria-pressed')).toBe('true');
        expect(button?.querySelector('.setup-toggle-state')?.textContent).toContain('Selected');

        controller.updateLibraryToggle(ctx.contentEl, 'movies', false, deps.toDomId);
        expect(button?.classList.contains('selected')).toBe(false);
        expect(button?.getAttribute('aria-pressed')).toBe('false');
        expect(button?.querySelector('.setup-toggle-state')?.textContent).toBe('Off');
    });

    it('routes individual library toggles through the generated control id', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            libraries: [makeLibrary({ id: 'Movies & More' })],
            selectedLibraryIds: new Set(),
        });
        const controller = new LibraryStepController();

        controller.render(ctx, deps);

        (ctx.contentEl.querySelector('#setup-lib-Movies-More') as HTMLButtonElement).click();

        expect(deps.onToggleLibrary).toHaveBeenCalledWith('Movies & More', 'setup-lib-Movies-More');
    });
});
