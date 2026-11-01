/** @jest-environment jsdom */
import { flushPromises } from '../../../../../__tests__/helpers';
import { ChannelSetupBuildStepPresenter } from '../ChannelSetupBuildStepPresenter';
import { ChannelSetupSessionState } from '../../ChannelSetupSessionState';
import type { StepRenderContext } from '../../stepContracts';
import type { ChannelSetupSessionController } from '../../ChannelSetupSessionController';
import type { ChannelSetupFocusCoordinator } from '../../focus/ChannelSetupFocusCoordinator';
import type { ChannelSetupScreenPorts } from '../../ChannelSetupScreenPorts';
import type { ChannelSetupBuildOutcome } from '../../ChannelSetupSessionContracts';
import { DEFAULT_BUILD_RESULT, DEFAULT_REVIEW } from '../../__tests__/channel-setup-test-helpers';

const savedConfig = new ChannelSetupSessionState().buildConfig('server-1');

const context = (): StepRenderContext => ({ contentEl: document.createElement('div'),
    stepEl: document.createElement('div'), statusEl: document.createElement('div'),
    detailEl: document.createElement('div'), errorEl: document.createElement('div') });
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(outcome: ChannelSetupBuildOutcome, building = true) {
    const state = new ChannelSetupSessionState();
    state.step = 3; state.isBuilding = building; state.recordApplied = true;
    state.review = DEFAULT_REVIEW;
    const session = {
        getSnapshot: jest.fn(() => state.getSnapshot()), beginBuild: jest.fn().mockResolvedValue(outcome),
        cancelBuild: jest.fn(() => false), setStep: jest.fn((step: 1 | 2 | 3) => { state.step = step; state.isBuilding = false; }),
        beginConfirmedBuild: jest.fn(), clearReviewAndReturnToStep2: jest.fn(),
        refreshReview: jest.fn(), ensureReviewLoaded: jest.fn(), toggleReplaceConfirm: jest.fn(),
        toggleWholeLineupReplacementConfirm: jest.fn(),
    };
    const navigation = { replaceScreen: jest.fn(), setFocus: jest.fn(), getFocusedElement: jest.fn(() => null) };
    const ports = { getNavigation: (): typeof navigation => navigation, openCustomChannelStudio: jest.fn() };
    const focus = { registerLinear: jest.fn(), unregisterAll: jest.fn() };
    const deps = { session: session as unknown as ChannelSetupSessionController,
        focus: focus as unknown as ChannelSetupFocusCoordinator,
        screenPorts: ports as unknown as ChannelSetupScreenPorts,
        getPreferredFocusId: (): null => null, setPreferredFocusId: jest.fn(),
        getVisibilityToken: (): number => 1, renderStep: jest.fn() };
    const ctx = context(); document.body.appendChild(ctx.contentEl);
    const presenter = new ChannelSetupBuildStepPresenter();
    presenter.render(ctx, deps);
    return { state, session, navigation, ports, focus, ctx, presenter, deps };
}

describe('ChannelSetupBuildStepPresenter', () => {
    afterEach(() => { document.body.innerHTML = ''; jest.clearAllMocks(); });
    it('routes completed Open Guide directly to Guide once without tuning', async () => {
        const savedResult = { ...DEFAULT_BUILD_RESULT };
        const h = harness({ kind: 'success', serverId: 'server-1', config: savedConfig,
            result: savedResult });
        await flushPromises();
        expect(h.ctx.statusEl.textContent).toBe('Channels saved');
        (h.ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        (h.ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        expect(h.navigation.replaceScreen).toHaveBeenCalledTimes(1);
        expect(h.navigation.replaceScreen).toHaveBeenCalledWith('guide');
        expect(h.ctx.contentEl.textContent).not.toContain('playback');
    });
    it('routes completed Back directly to Guide once without tuning', async () => {
        const h = harness({ kind: 'success', serverId: 'server-1', config: savedConfig,
            result: DEFAULT_BUILD_RESULT });
        await flushPromises();
        (h.ctx.contentEl.querySelector('#setup-back') as HTMLButtonElement).click();
        const event = { button: 'back', handled: false } as Parameters<typeof h.presenter.handleKeyPress>[0];
        h.presenter.handleKeyPress(event, h.navigation as unknown as Parameters<typeof h.presenter.handleKeyPress>[1]);
        expect(event.handled).toBe(true);
        expect(h.navigation.replaceScreen).toHaveBeenCalledTimes(1);
        expect(h.navigation.replaceScreen).toHaveBeenCalledWith('guide');
    });
    it('opens the full custom Studio route only after a saved result', async () => {
        const saved = harness({ kind: 'success', serverId: 'server-1', config: savedConfig,
            result: DEFAULT_BUILD_RESULT });
        await flushPromises();
        const add = saved.ctx.contentEl.querySelector<HTMLButtonElement>('#setup-add-custom');
        expect(add?.disabled).toBe(false);
        add?.click();
        expect(saved.ports.openCustomChannelStudio).toHaveBeenCalledTimes(1);
        expect(saved.navigation.replaceScreen).not.toHaveBeenCalled();

        const unsaved = harness({ kind: 'blocked', message: 'Review changed.', reason: 'stale' });
        await flushPromises();
        const unavailable = unsaved.ctx.contentEl.querySelector<HTMLButtonElement>('#setup-add-custom');
        expect(unavailable?.disabled).toBe(true);
        unavailable?.click();
        expect(unsaved.ports.openCustomChannelStudio).not.toHaveBeenCalled();
    });
    it('labels postcommit Guide interruption, pointer, and bookkeeping warnings as saved', async () => {
        const h = harness({ kind: 'committed-with-guide-interrupted', serverId: 'server-1', config: savedConfig,
            result: { ...DEFAULT_BUILD_RESULT, pointerWarning: true,
                guideRefresh: { kind: 'interrupted', interruption: { kind: 'aborted', stage: 'refresh_schedules' } } },
            bookkeepingError: 'storage quota' });
        await flushPromises();
        expect(h.ctx.statusEl.textContent).toBe('Channels saved');
        expect(h.ctx.errorEl.textContent).toContain('Guide refresh needs retry');
        expect(h.ctx.errorEl.textContent).toContain('pointer');
        expect(h.ctx.errorEl.textContent).toContain('storage quota');
        expect((h.ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).disabled).toBe(false);
    });
    it('keeps a stale precommit result unsaved and returns to Review', async () => {
        const h = harness({ kind: 'blocked', message: 'Base changed. Refresh Review.', reason: 'stale' });
        await flushPromises();
        expect(h.ctx.statusEl.textContent).toBe('Review is out of date');
        expect(h.ctx.errorEl.textContent).toContain('Nothing was saved');
        expect((h.ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).disabled).toBe(true);
        (h.ctx.contentEl.querySelector('#setup-back') as HTMLButtonElement).click();
        expect(h.session.setStep).toHaveBeenCalledWith(3);
        expect(h.deps.renderStep).toHaveBeenCalledTimes(1);
    });
    it('keeps canceled Apply choices and offers Back to Review', async () => {
        const h = harness({ kind: 'canceled' });
        await flushPromises();
        expect(h.ctx.statusEl.textContent).toBe('Canceled');
        expect(h.ctx.detailEl.textContent).toContain('Review choices are retained');
        expect(h.navigation.replaceScreen).not.toHaveBeenCalled();
    });
    it('starts first-time and existing setup in authoritative Review', () => {
        for (const setupContext of ['first-time', 'existing'] as const) {
            const h = harness({ kind: 'canceled' }, false);
            h.state.setupContext = setupContext;
            h.presenter.render(h.ctx, h.deps);
            expect(h.ctx.statusEl.textContent).toBe('Review your lineup');
            expect(h.session.beginBuild).not.toHaveBeenCalled();
            h.presenter.dispose();
        }
    });
});
