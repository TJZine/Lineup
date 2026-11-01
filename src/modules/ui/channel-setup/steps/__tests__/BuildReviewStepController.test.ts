/** @jest-environment jsdom */
import { BuildReviewStepController } from '../BuildReviewStepController';
import type { BuildReviewDeps } from '../types';
import type { StepRenderContext } from '../../stepContracts';
import type { ChannelSetupReview } from '../../../../../core/channel-setup/types';
import type { ChannelSetupCandidateRow } from '../../../../../core/channel-setup/build/ChannelSetupPreparedCandidate';
import type { KeyEvent, INavigationManager } from '../../../../navigation';

const context = (): StepRenderContext => ({
    contentEl: document.createElement('div'), stepEl: document.createElement('div'),
    statusEl: document.createElement('div'), detailEl: document.createElement('div'), errorEl: document.createElement('div'),
});
const row = (index: number, action: ChannelSetupCandidateRow['action'] = 'created'): ChannelSetupCandidateRow => ({
    action, channelId: `channel-${index}`, number: index + 1,
    name: `Channel ${index} ${index === 3 ? 'A very long channel name that should wrap across the roster row' : ''}`,
    sourceLibraryId: 'movies', sourceLibraryIds: ['movies'], sourceKind: 'library', playbackMode: 'shuffle',
    shuffleSeed: 40 + index, startTimeAnchor: 1000, scheduleAnchorMode: 'daily', blockSize: null, includeSpecials: true,
    buildStrategy: null, reason: action === 'removed' ? 'Complete selected library replaced' : 'Generated source',
});
const review = (rows: ChannelSetupCandidateRow[], preparedId = 'review-1'): ChannelSetupReview => ({
    preparedId, rows,
    inventory: { scopeKey: 'scope', generation: 1, libraries: [
        { libraryId: 'movies', libraryName: 'Movies', requiredFamilies: [], status: 'ready' as const, generation: 1 },
    ], acceptedReadyLibraryIds: ['movies'], sharedPlaylistsStatus: 'unused' as const },
    preview: { estimates: { total: rows.length, collections: 0, playlists: 0, genres: 0, directors: 0,
        decades: 0, recentlyAdded: 0, studios: 0, actors: 0 }, warnings: [], reachedMaxChannels: false },
    diff: { summary: { created: rows.filter((item) => item.action === 'created').length,
        removed: rows.filter((item) => item.action === 'removed').length,
        unchanged: rows.filter((item) => item.action === 'retained').length },
    samples: { created: [], removed: [], unchanged: [] } },
});
const deps = (rows: ChannelSetupCandidateRow[], overrides: Partial<BuildReviewDeps> = {}): BuildReviewDeps => ({
    state: { buildMode: 'replace', review: review(rows), reviewError: null, isReviewLoading: false,
        replaceConfirm: false, wholeLineupReplacementConfirm: false, isStale: false, isBuilding: false, recordApplied: true },
    onBackToStrategy: jest.fn(), onConfirmBuild: jest.fn(), onToggleReplaceConfirm: jest.fn(),
    onToggleWholeLineupReplacementConfirm: jest.fn(), onRefreshReview: jest.fn(),
    renderStep: jest.fn(), setPreferredFocusId: jest.fn(), renderCappedWarnings: jest.fn(),
    registerLinearFocusables: jest.fn(), ...overrides,
});
const render = (controller: BuildReviewStepController, ctx: StepRenderContext, args: BuildReviewDeps): void => {
    ctx.contentEl.replaceChildren();
    controller.render(ctx, args);
};

describe('BuildReviewStepController', () => {
    afterEach(() => { document.body.innerHTML = ''; jest.clearAllMocks(); });

    it('projects search and filters without altering full-removal consent or prepared identity', () => {
        const ctx = context(); document.body.appendChild(ctx.contentEl);
        const controller = new BuildReviewStepController();
        const args = deps([row(0, 'retained'), row(1, 'created'), row(2, 'removed')]);
        render(controller, ctx, args);
        expect(ctx.contentEl.querySelectorAll('.setup-review-row')).toHaveLength(3);
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
        (ctx.contentEl.querySelector('#setup-filter-created') as HTMLButtonElement).click();
        render(controller, ctx, args);
        expect(ctx.contentEl.querySelectorAll('.setup-review-row')).toHaveLength(1);
        expect(ctx.contentEl.querySelector('#setup-replace-confirm')).not.toBeNull();
        (ctx.contentEl.querySelector('#setup-replace-confirm') as HTMLButtonElement).click();
        expect(args.onToggleReplaceConfirm).toHaveBeenCalledWith('setup-replace-confirm');
        args.state.replaceConfirm = true;
        render(controller, ctx, args);
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(false);
    });

    it('requires separate protected-replacement consent and displays unknown old count', () => {
        const ctx = context(); document.body.appendChild(ctx.contentEl);
        const controller = new BuildReviewStepController();
        const args = deps([row(0)], { state: { ...deps([row(0)]).state, review: {
            ...review([row(0)]), requiresWholeLineupReplacement: true, oldChannelCount: null,
        } } });
        render(controller, ctx, args);
        expect(ctx.contentEl.textContent).toContain('unknown existing channels');
        expect(ctx.contentEl.textContent).toContain('Previous lineup details unavailable');
        const apply = ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement;
        expect(apply.textContent).toBe('Replace saved lineup');
        expect(apply.classList.contains('destructive')).toBe(true);
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
        (ctx.contentEl.querySelector('#setup-whole-lineup-confirm') as HTMLButtonElement).click();
        expect(args.onToggleWholeLineupReplacementConfirm).toHaveBeenCalledWith('setup-whole-lineup-confirm');
        args.state.wholeLineupReplacementConfirm = true;
        render(controller, ctx, args);
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(false);
    });

    it('keeps removal and unreadable-lineup consents separate and tied to a current Review', () => {
        const ctx = context(); document.body.appendChild(ctx.contentEl);
        const controller = new BuildReviewStepController();
        const rows = [row(0, 'removed')];
        const protectedReview = { ...review(rows),
            requiresWholeLineupReplacement: true, oldChannelCount: null };
        const args = deps(rows, { state: { ...deps(rows).state,
            review: protectedReview } });
        render(controller, ctx, args);
        args.state.wholeLineupReplacementConfirm = true;
        render(controller, ctx, args);
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
        args.state.replaceConfirm = true;
        render(controller, ctx, args);
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(false);
        args.state.isStale = true;
        render(controller, ctx, args);
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
    });

    it('disables Apply on stale Review and restores focus only to Refresh Review', () => {
        const ctx = context(); document.body.appendChild(ctx.contentEl);
        const controller = new BuildReviewStepController();
        const args = deps([row(0)], { state: { ...deps([row(0)]).state, isStale: true } });
        render(controller, ctx, args);
        expect(ctx.contentEl.textContent).toContain('Review is out of date');
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
        (ctx.contentEl.querySelector('#setup-refresh-review') as HTMLButtonElement).click();
        expect(args.onRefreshReview).toHaveBeenCalledTimes(1);
    });

    it('bounds a 184-row roster and keeps ID focus across D-pad navigation and footer jump', () => {
        const ctx = context(); document.body.appendChild(ctx.contentEl);
        const controller = new BuildReviewStepController();
        const args = deps(Array.from({ length: 184 }, (_, index) => row(index)));
        args.renderStep = jest.fn(() => render(controller, ctx, args));
        render(controller, ctx, args);
        expect(ctx.contentEl.querySelectorAll('.setup-review-row').length).toBeLessThanOrEqual(24);
        let focused = 'setup-review-row-channel-0-created';
        const nav = { getFocusedElement: () => ({ id: focused }), setFocus: (id: string) => { focused = id; } } as INavigationManager;
        const key = (button: KeyEvent['button'], isRepeat = false): KeyEvent => ({
            button, isRepeat, isLongPress: false, timestamp: 0, originalEvent: new KeyboardEvent('keydown'), handled: false,
        });
        for (let index = 0; index < 45; index++) controller.handleKeyPress(key('down'), nav);
        expect(focused).toBe('setup-review-row-channel-45-created');
        expect(ctx.contentEl.querySelectorAll('.setup-review-row').length).toBeLessThanOrEqual(24);
        controller.handleKeyPress(key('right'), nav);
        expect(focused).toBe('setup-confirm');
        controller.handleKeyPress(key('up'), nav);
        expect(focused).toBe('setup-review-row-channel-45-created');
        controller.handleKeyPress(key('right', true), nav);
        expect(focused).toBe('setup-review-row-channel-45-created');
    });

    it('measures wrapped rows beyond the window and keeps scroll anchor through window replacement', () => {
        const originalRect = HTMLElement.prototype.getBoundingClientRect;
        let wrappedHeight = 180;
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('setup-review-roster-heading')) return { height: 48 } as DOMRect;
            if (this.classList.contains('setup-review-entry')) {
                const number = this.querySelector('.setup-review-row span')?.textContent;
                return { height: number === '4' ? wrappedHeight : 64 } as DOMRect;
            }
            return originalRect.call(this);
        });
        try {
            const ctx = context(); document.body.appendChild(ctx.contentEl);
            const controller = new BuildReviewStepController();
            const args = deps(Array.from({ length: 184 }, (_, index) => row(index)));
            args.renderStep = jest.fn(() => render(controller, ctx, args));
            render(controller, ctx, args);
            let roster = ctx.contentEl.querySelector('.setup-review-roster') as HTMLElement;
            let spaces = roster.querySelectorAll<HTMLElement>('.setup-review-virtual-space');
            expect(spaces[1]?.style.height).toBe(`${160 * 64}px`);
            expect(roster.querySelectorAll('.setup-review-row')).toHaveLength(24);

            wrappedHeight = 240;
            window.dispatchEvent(new Event('resize'));
            spaces = roster.querySelectorAll<HTMLElement>('.setup-review-virtual-space');
            expect(spaces[1]?.style.height).toBe(`${160 * 64}px`);
            roster.scrollTop = 48 + 100 * 64 + 176;
            roster.dispatchEvent(new Event('scroll'));
            roster = ctx.contentEl.querySelector('.setup-review-roster') as HTMLElement;
            spaces = roster.querySelectorAll<HTMLElement>('.setup-review-virtual-space');
            expect(spaces[0]?.style.height).toBe(`${96 * 64 + 176}px`);
            expect(roster.scrollTop).toBe(48 + 100 * 64 + 176);
            expect(roster.querySelectorAll('.setup-review-row')).toHaveLength(24);
        } finally {
            jest.restoreAllMocks();
        }
    });

    it('remeasures cached offscreen rows after a font swap at unchanged width', () => {
        const originalRect = HTMLElement.prototype.getBoundingClientRect;
        const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
        const fontEvents = new EventTarget();
        Object.defineProperty(fontEvents, 'status', { value: 'loaded' });
        Object.defineProperty(document, 'fonts', { configurable: true, value: fontEvents });
        let wrappedHeight = 180;
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('setup-review-roster-heading')) return { height: 48 } as DOMRect;
            if (this.classList.contains('setup-review-entry')) {
                const number = this.querySelector('.setup-review-row span')?.textContent;
                return { height: number === '4' ? wrappedHeight : 64 } as DOMRect;
            }
            return originalRect.call(this);
        });
        try {
            const ctx = context(); document.body.appendChild(ctx.contentEl);
            const controller = new BuildReviewStepController();
            const args = deps(Array.from({ length: 184 }, (_, index) => row(index)));
            args.renderStep = jest.fn(() => render(controller, ctx, args));
            render(controller, ctx, args);
            let roster = ctx.contentEl.querySelector('.setup-review-roster') as HTMLElement;
            roster.scrollTop = 48 + 100 * 64 + 116 + 12;
            roster.dispatchEvent(new Event('scroll'));
            roster = ctx.contentEl.querySelector('.setup-review-roster') as HTMLElement;
            expect(roster.querySelector('#setup-review-row-channel-3-created')).toBeNull();
            expect(roster.querySelector<HTMLElement>('.setup-review-virtual-space')?.style.height)
                .toBe(`${96 * 64 + 116}px`);

            wrappedHeight = 240;
            fontEvents.dispatchEvent(new Event('loadingdone'));
            expect(roster.querySelector<HTMLElement>('.setup-review-virtual-space')?.style.height)
                .toBe(`${96 * 64 + 176}px`);
            expect(roster.scrollTop).toBe(48 + 100 * 64 + 176 + 12);
            expect(roster.querySelectorAll('.setup-review-row')).toHaveLength(24);
        } finally {
            jest.restoreAllMocks();
            if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
            else Reflect.deleteProperty(document, 'fonts');
        }
    });

    it('remeasures offscreen rows when a mounted row changes text metrics', () => {
        const originalRect = HTMLElement.prototype.getBoundingClientRect;
        const originalResizeObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
        let notifyResize: (() => void) | null = null;
        class TestResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                notifyResize = (): void => callback([], this as unknown as ResizeObserver);
            }
            observe(): void { /* The test invokes the callback explicitly. */ }
            disconnect(): void { /* No native observer state in jsdom. */ }
        }
        Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: TestResizeObserver });
        let metricChanged = false;
        let offscreenMeasures = 0;
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('setup-review-roster-heading')) return { height: 48 } as DOMRect;
            if (this.classList.contains('setup-review-entry')) {
                const number = this.querySelector('.setup-review-row span')?.textContent;
                if (number === '4') offscreenMeasures += 1;
                return { height: number === '4' ? metricChanged ? 240 : 180
                    : number === '101' && metricChanged ? 80 : 64 } as DOMRect;
            }
            return originalRect.call(this);
        });
        try {
            const ctx = context(); document.body.appendChild(ctx.contentEl);
            const controller = new BuildReviewStepController();
            const args = deps(Array.from({ length: 184 }, (_, index) => row(index)));
            args.renderStep = jest.fn(() => render(controller, ctx, args));
            render(controller, ctx, args);
            let roster = ctx.contentEl.querySelector('.setup-review-roster') as HTMLElement;
            roster.scrollTop = 48 + 100 * 64 + 116 + 12;
            roster.dispatchEvent(new Event('scroll'));
            roster = ctx.contentEl.querySelector('.setup-review-roster') as HTMLElement;
            expect(roster.querySelector('#setup-review-row-channel-3-created')).toBeNull();
            metricChanged = true;
            const trigger = notifyResize as (() => void) | null;
            if (!trigger) throw new Error('Resize observer not registered');
            trigger();
            expect(roster.querySelector<HTMLElement>('.setup-review-virtual-space')?.style.height)
                .toBe(`${96 * 64 + 176}px`);
            expect(roster.scrollTop).toBe(48 + 100 * 64 + 176 + 12);
            expect(roster.querySelectorAll('.setup-review-row')).toHaveLength(24);
            const measuredAfterChange = offscreenMeasures;
            trigger();
            expect(offscreenMeasures).toBe(measuredAfterChange);
        } finally {
            jest.restoreAllMocks();
            if (originalResizeObserver) Object.defineProperty(globalThis, 'ResizeObserver', originalResizeObserver);
            else Reflect.deleteProperty(globalThis, 'ResizeObserver');
        }
    });

    it('includes expanded disclosure height in offscreen spacer and scroll lookup', () => {
        const originalRect = HTMLElement.prototype.getBoundingClientRect;
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('setup-review-roster-heading')) return { height: 48 } as DOMRect;
            if (this.classList.contains('setup-review-entry')) {
                return { height: this.querySelector('.setup-review-row-detail') ? 220 : 64 } as DOMRect;
            }
            return originalRect.call(this);
        });
        try {
            const ctx = context(); document.body.appendChild(ctx.contentEl);
            const controller = new BuildReviewStepController();
            const args = deps(Array.from({ length: 50 }, (_, index) => row(index)));
            args.renderStep = jest.fn(() => render(controller, ctx, args));
            render(controller, ctx, args);
            (ctx.contentEl.querySelector('#setup-review-row-channel-0-created') as HTMLButtonElement).click();
            let roster = ctx.contentEl.querySelector('.setup-review-roster') as HTMLElement;
            expect(roster.querySelector('.setup-review-row-detail')).not.toBeNull();
            roster.scrollTop = 48 + 25 * 64 + 156;
            roster.dispatchEvent(new Event('scroll'));
            roster = ctx.contentEl.querySelector('.setup-review-roster') as HTMLElement;
            expect(roster.querySelector<HTMLElement>('.setup-review-virtual-space')?.style.height)
                .toBe(`${21 * 64 + 156}px`);
            expect(roster.querySelectorAll('.setup-review-row')).toHaveLength(24);
        } finally {
            jest.restoreAllMocks();
        }
    });

    it('consumes Search Select and local Back before leaving Review', () => {
        const ctx = context(); document.body.appendChild(ctx.contentEl);
        const controller = new BuildReviewStepController();
        const args = deps([row(0)]);
        render(controller, ctx, args);
        let focused = 'setup-review-search';
        const nav = { getFocusedElement: () => ({ id: focused }), setFocus: (id: string) => { focused = id; } } as INavigationManager;
        const key = (button: KeyEvent['button']): KeyEvent => ({ button, isRepeat: false,
            isLongPress: false, timestamp: 0, originalEvent: new KeyboardEvent('keydown'), handled: false });
        const select = key('ok'); controller.handleKeyPress(select, nav);
        expect(select.handled).toBe(true);
        expect(document.activeElement?.id).toBe('setup-review-search');
        const back = key('back'); controller.handleKeyPress(back, nav);
        expect(back.handled).toBe(true);
        expect(focused).toBe('setup-review-search');
    });

    it('shows a no-match recovery and clears presentation search only', () => {
        const ctx = context(); document.body.appendChild(ctx.contentEl);
        const controller = new BuildReviewStepController();
        const args = deps([row(0)]);
        render(controller, ctx, args);
        const search = ctx.contentEl.querySelector<HTMLInputElement>('#setup-review-search');
        if (!search) throw new Error('search missing');
        search.value = 'missing'; search.dispatchEvent(new Event('input', { bubbles: true }));
        render(controller, ctx, args);
        expect(ctx.contentEl.textContent).toContain('No matching channels');
        (ctx.contentEl.querySelector('#setup-clear-search') as HTMLButtonElement).click();
        render(controller, ctx, args);
        expect(ctx.contentEl.querySelectorAll('.setup-review-row')).toHaveLength(1);
        expect(args.state.review?.preparedId).toBe('review-1');
    });
});
