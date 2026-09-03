/**
 * @jest-environment jsdom
 */

import { flushPromises } from '../../../../../__tests__/helpers';
import { ChannelSetupBuildStepPresenter } from '../ChannelSetupBuildStepPresenter';
import type { StepRenderContext } from '../../stepContracts';
import type { ChannelSetupSessionSnapshot } from '../../ChannelSetupSessionContracts';
import { DEFAULT_BUILD_RESULT, DEFAULT_REVIEW } from '../../__tests__/channel-setup-test-helpers';

const INTERNAL_SETUP_COPY_PATTERN =
    /\b(?:stop and re-plan|re-plan|planner|execution|cleanup|slice|blocked plan|plan blocked)\b|partial setup plan/i;

const createContext = (): StepRenderContext => ({
    contentEl: document.createElement('div'),
    stepEl: document.createElement('div'),
    statusEl: document.createElement('div'),
    detailEl: document.createElement('div'),
    errorEl: document.createElement('div'),
});

const createSnapshot = (
    overrides: Partial<ChannelSetupSessionSnapshot> = {}
): ChannelSetupSessionSnapshot => ({
    step: 3,
    libraries: [],
    selectedLibraryIds: new Set(),
    strategies: {
        collections: { enabled: true, scope: 'per-library' },
        playlists: { enabled: true, scope: 'per-library' },
        genres: { enabled: true, scope: 'per-library' },
        directors: { enabled: true, scope: 'per-library' },
        decades: { enabled: false, scope: 'per-library' },
        recentlyAdded: { enabled: false, scope: 'per-library' },
        studios: { enabled: false, scope: 'per-library' },
        actors: { enabled: false, scope: 'per-library' },
    },
    strategyOrder: ['collections', 'playlists', 'genres', 'directors', 'decades', 'recentlyAdded', 'studios', 'actors'],
    channelExpansion: {
        addAlternateLineups: false,
        alternateLineupCopies: 1,
        variantType: 'sequential',
        variantBlockSize: 2,
    },
    seriesOrdering: {
        basePlaybackMode: 'shuffle',
        baseBlockSize: 2,
    },
    buildMode: 'replace',
    actorStudioCombineMode: 'combined',
    maxChannels: 200,
    minItems: 5,
    setupContext: 'existing',
    isLoading: false,
    preview: null,
    previewError: null,
    previewStatus: 'idle',
    isPreviewLoading: false,
    previewDeltas: {},
    previewDeltaExpiresAtMs: 0,
    review: null,
    reviewError: null,
    isReviewLoading: false,
    replaceConfirm: false,
    isBuilding: false,
    recordApplied: true,
    loadError: null,
    ...overrides,
});

type BuildStepPresenterTestDeps = {
    session: {
        getSnapshot: jest.Mock;
        ensureReviewLoaded: jest.Mock;
        clearReviewAndReturnToStep2: jest.Mock;
        beginConfirmedBuild: jest.Mock;
        toggleReplaceConfirm: jest.Mock;
        cancelBuild: jest.Mock;
        setStep: jest.Mock;
        beginBuild: jest.Mock;
    };
    focus: {
        registerLinear: jest.Mock;
        unregisterAll: jest.Mock;
    };
    screenPorts: {
        getNavigation: jest.Mock;
        getSelectedServerId: jest.Mock;
        openServerSelect: jest.Mock;
        switchToChannelByNumberWithOutcome: jest.Mock;
        waitForNextPlaybackStart: jest.Mock;
        openEPG: jest.Mock;
        appendBuilderGuideDiagnostic: jest.Mock;
    };
    getPreferredFocusId: jest.Mock;
    setPreferredFocusId: jest.Mock;
    getVisibilityToken: jest.Mock;
    renderStep: jest.Mock;
    revealPlayerProvisionally: jest.Mock;
    restoreSetupAfterProvisionalReveal: jest.Mock;
};

const createDeps = (
    snapshot: ChannelSetupSessionSnapshot,
    overrides: Partial<BuildStepPresenterTestDeps['session']> = {}
): BuildStepPresenterTestDeps => {
    const session = {
        getSnapshot: jest.fn(() => snapshot),
        ensureReviewLoaded: jest.fn(),
        clearReviewAndReturnToStep2: jest.fn(),
        beginConfirmedBuild: jest.fn(),
        toggleReplaceConfirm: jest.fn(),
        cancelBuild: jest.fn(() => false),
        setStep: jest.fn(),
        beginBuild: jest.fn().mockResolvedValue({ kind: 'success', result: DEFAULT_BUILD_RESULT }),
        ...overrides,
    };
    return {
        session,
        focus: {
            registerLinear: jest.fn(() => false),
            unregisterAll: jest.fn(),
        },
        screenPorts: {
            getNavigation: jest.fn(() => null),
            getSelectedServerId: jest.fn(() => 'server-1'),
            openServerSelect: jest.fn(),
            switchToChannelByNumberWithOutcome: jest.fn().mockImplementation((_number, options) => {
                options?.beforeProgramStart?.();
                return Promise.resolve({ kind: 'switched' });
            }),
            waitForNextPlaybackStart: jest.fn().mockResolvedValue({ kind: 'started' }),
            openEPG: jest.fn(),
            appendBuilderGuideDiagnostic: jest.fn(),
        },
        getPreferredFocusId: jest.fn(() => null),
        setPreferredFocusId: jest.fn(),
        getVisibilityToken: jest.fn(() => 1),
        renderStep: jest.fn(),
        revealPlayerProvisionally: jest.fn(),
        restoreSetupAfterProvisionalReveal: jest.fn(),
    };
};

describe('ChannelSetupBuildStepPresenter', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('owns preview-row delta rendering for strategy and review presenters', () => {
        const presenter = new ChannelSetupBuildStepPresenter();
        const row = presenter.buildPreviewRow(createSnapshot({
            previewDeltas: { total: 4 },
            previewDeltaExpiresAtMs: Date.now() + 1000,
        }), 'Total', 12, 'total');

        expect(row.className).toBe('setup-preview-row');
        expect(row.querySelector('.setup-preview-delta')?.textContent).toBe('(+4)');
        expect(row.querySelector('.setup-preview-delta')?.classList.contains('positive')).toBe(true);
    });

    it('kicks off review loading after rendering without owning screen lifecycle', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot();
        const deps = createDeps(snapshot);

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.contentEl.querySelector('.setup-preview-loading')?.textContent).toContain('Preparing');
        expect(deps.session.ensureReviewLoaded).toHaveBeenCalledWith(expect.any(Function));

        const [onStateChange] = deps.session.ensureReviewLoaded.mock.calls[0] ?? [];
        onStateChange?.();
        expect(deps.renderStep).toHaveBeenCalledTimes(1);
    });

    it('skips stale review-load renders after the build step visibility changes', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot();
        const deps = createDeps(snapshot);
        let visibilityToken = 1;
        deps.getVisibilityToken.mockImplementation(() => visibilityToken);

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        const [onStateChange] = deps.session.ensureReviewLoaded.mock.calls[0] ?? [];
        visibilityToken = 2;
        onStateChange?.();

        expect(deps.renderStep).not.toHaveBeenCalled();
    });

    it('applies progress and success UI through the build presenter owner', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const beginBuild = jest.fn(async (options) => {
            options.onProgress({
                task: 'create_channels',
                label: 'Writing channels',
                detail: '1 of 2',
                current: 1,
                total: 2,
            });
            return { kind: 'success', result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 1 } };
        });
        const deps = createDeps(snapshot, { beginBuild });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(beginBuild).toHaveBeenCalled();
        expect(ctx.statusEl.textContent).toBe('Channels ready.');
        expect(ctx.contentEl.querySelector('.setup-progress-task')?.textContent).toBe('Complete');
        expect(ctx.contentEl.querySelector('.setup-progress-detail')?.textContent).toBe('Created 2 channels. 1 candidate not created.');
        expect((ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).disabled).toBe(false);
        expect(deps.focus.unregisterAll).toHaveBeenCalled();
    });

    it('uses singular channel and candidate copy for single counts', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const beginBuild = jest.fn(async () => (
            { kind: 'success', result: { ...DEFAULT_BUILD_RESULT, created: 1, skipped: 1 } }
        ));
        const deps = createDeps(snapshot, { beginBuild });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.contentEl.querySelector('.setup-progress-detail')?.textContent).toBe('Created 1 channel. 1 candidate not created.');
    });

    it('uses singular channel copy in normal success status for single counts', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 1, skipped: 0 },
            }),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.statusEl.textContent).toBe('Channel ready.');
    });

    it('uses singular channel copy in degraded success status for single counts', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 1, skipped: 0 },
                bookkeepingError: 'Device storage is full.',
            }),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.statusEl.textContent).toBe('Channel created; setup save needed.');
    });

    it('uses degraded success copy when setup completion cannot be saved', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
                bookkeepingError: 'Device storage is full.',
            }),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.statusEl.textContent).toBe('Channels created; setup save needed.');
        expect(ctx.errorEl.textContent).toBe(
            'Channels were created, but setup completion could not be saved: Device storage is full.'
        );
    });

    it('presents a committed guide interruption as completed and combines bookkeeping warning', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'committed-with-guide-interrupted',
                result: {
                    ...DEFAULT_BUILD_RESULT,
                    created: 2,
                    skipped: 0,
                    commitState: 'committed',
                    guideRefresh: {
                        kind: 'interrupted',
                        interruption: { kind: 'aborted', stage: 'refresh_schedules' },
                    },
                },
                bookkeepingError: 'Device storage is full.',
            }),
        });
        const setFocus = jest.fn();
        deps.screenPorts.getNavigation.mockReturnValue({ setFocus });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        const doneButton = ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement;
        const backButton = ctx.contentEl.querySelector('#setup-back') as HTMLButtonElement;
        expect(ctx.statusEl.textContent).toBe('Channels created; guide refresh interrupted.');
        expect(ctx.errorEl.textContent).toBe(
            'Channels were created, but setup completion could not be saved: Device storage is full. ' +
            'Channels were saved, but guide refresh was interrupted. Open the guide again after schedules finish loading.'
        );
        expect(doneButton.disabled).toBe(false);
        expect(backButton.textContent).toBe('Back');
        expect(deps.focus.unregisterAll).toHaveBeenCalledTimes(1);
        expect(deps.focus.registerLinear).toHaveBeenCalledWith([doneButton, backButton], null);
        expect(setFocus).toHaveBeenCalledWith(doneButton.id);
    });

    it('uses degraded success copy when guide refresh is partial or failed', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: {
                    ...DEFAULT_BUILD_RESULT,
                    created: 2,
                    skipped: 0,
                    guideRefresh: {
                        kind: 'completed',
                        result: {
                            readiness: 'partial',
                            attemptedChannelCount: 2,
                            immediateReadyChannelCount: 1,
                            backgroundQueuedChannelCount: 1,
                            failedChannelCount: 1,
                            staleCacheChannelCount: 0,
                            firstVisibleScheduleReady: true,
                        },
                    },
                },
            }),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.statusEl.textContent).toBe('Channels created; guide needs attention.');
        expect(ctx.errorEl.textContent).toBe('1 channel schedules could not be refreshed immediately.');

        deps.session.beginBuild.mockResolvedValueOnce({
            kind: 'success',
            result: {
                ...DEFAULT_BUILD_RESULT,
                created: 2,
                skipped: 0,
                guideRefresh: {
                    kind: 'completed',
                    result: {
                        readiness: 'failed',
                        attemptedChannelCount: 2,
                        immediateReadyChannelCount: 0,
                        backgroundQueuedChannelCount: 0,
                        failedChannelCount: 2,
                        staleCacheChannelCount: 0,
                        firstVisibleScheduleReady: false,
                    },
                },
            },
        });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.statusEl.textContent).toBe('Channels created; guide refresh failed.');
        expect(ctx.errorEl.textContent).toBe(
            'Guide data could not be refreshed. Open the guide again after schedules finish loading.'
        );

        deps.session.beginBuild.mockResolvedValueOnce({
            kind: 'success',
            result: {
                ...DEFAULT_BUILD_RESULT,
                created: 2,
                skipped: 0,
                guideRefresh: {
                    kind: 'failed',
                    failure: { kind: 'thrown', stage: 'ensure_initialized' },
                },
            },
        });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.statusEl.textContent).toBe('Channels created; guide refresh failed.');
        expect(ctx.errorEl.textContent).toBe(
            'Guide data could not be refreshed. Open the guide again after schedules finish loading.'
        );

        deps.session.beginBuild.mockResolvedValueOnce({
            kind: 'success',
            result: {
                ...DEFAULT_BUILD_RESULT,
                created: 2,
                skipped: 0,
                guideRefresh: {
                    kind: 'completed',
                    result: {
                        readiness: 'skipped',
                        attemptedChannelCount: 0,
                        immediateReadyChannelCount: 0,
                        backgroundQueuedChannelCount: 0,
                        failedChannelCount: 0,
                        staleCacheChannelCount: 0,
                        firstVisibleScheduleReady: false,
                    },
                },
            },
        });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.statusEl.textContent).toBe('Channels created; guide refresh unavailable.');
        expect(ctx.errorEl.textContent).toBe(
            'Guide data was not refreshed. Open the guide again after schedules finish loading.'
        );
    });

    it('renders blocked build outcomes with user-safe recovery copy', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'blocked',
                message: 'Required genres tag directory (type=2) is unsupported for Shows; stop and re-plan.',
            }),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        const visibleText = [
            ctx.statusEl.textContent,
            ctx.detailEl.textContent,
            ctx.errorEl.textContent,
            ctx.contentEl.textContent,
        ].join('\n');
        expect(visibleText).toContain('Setup needs attention.');
        expect(visibleText).toContain('Build paused');
        expect(visibleText).toContain('Plex does not provide usable genres data for Shows.');
        expect(visibleText).toContain('Try again later, disable that source, or continue with supported channel types.');
        expect(visibleText).not.toMatch(INTERNAL_SETUP_COPY_PATTERN);
        expect((ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).disabled).toBe(true);
    });

    it('renders empty blocked build messages with generic recovery copy', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'blocked',
                message: '',
            }),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        const visibleText = [
            ctx.statusEl.textContent,
            ctx.detailEl.textContent,
            ctx.errorEl.textContent,
            ctx.contentEl.textContent,
        ].join('\n');
        expect(visibleText).toContain('Some channel types could not be built for this library.');
        expect(visibleText).toContain('Try again later, disable that source, or continue with supported channel types.');
        expect(visibleText).not.toMatch(INTERNAL_SETUP_COPY_PATTERN);
    });

    it('opens player playback and EPG from the completed build Done action', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        const replaceScreen = jest.fn();
        (deps.screenPorts.getNavigation as jest.Mock).mockReturnValue({
            replaceScreen,
            setFocus: jest.fn(),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();

        expect(replaceScreen).toHaveBeenCalledWith('player');
        expect(deps.screenPorts.switchToChannelByNumberWithOutcome).toHaveBeenCalledWith(1, {
            signal: expect.any(AbortSignal),
            beforeProgramStart: expect.any(Function),
        });
        expect(deps.revealPlayerProvisionally).toHaveBeenCalledTimes(1);
        expect(deps.screenPorts.openEPG).toHaveBeenCalledTimes(1);
        const switchOrder = deps.screenPorts.switchToChannelByNumberWithOutcome.mock.invocationCallOrder[0];
        const waitOrder = deps.screenPorts.waitForNextPlaybackStart.mock.invocationCallOrder[0];
        const replaceOrder = replaceScreen.mock.invocationCallOrder[0];
        const epgOrder = deps.screenPorts.openEPG.mock.invocationCallOrder[0];
        expect(switchOrder).toBeDefined();
        expect(waitOrder).toBeDefined();
        expect(replaceOrder).toBeDefined();
        expect(epgOrder).toBeDefined();
        if (switchOrder === undefined || waitOrder === undefined || replaceOrder === undefined || epgOrder === undefined) {
            throw new Error('Expected switch, navigation, and EPG calls to be recorded');
        }
        const revealOrder = deps.revealPlayerProvisionally.mock.invocationCallOrder[0];
        expect(switchOrder).toBeLessThan(revealOrder as number);
        expect(revealOrder).toBeLessThan(waitOrder);
        expect(revealOrder).toBeLessThan(replaceOrder);
        expect(replaceOrder).toBeLessThan(epgOrder);
    });

    it('keeps Guide closed until the exact playback start settles', async () => {
        const ctx = createContext();
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        let settlePlayback: ((outcome: { kind: 'started' }) => void) | undefined;
        deps.screenPorts.waitForNextPlaybackStart.mockReturnValueOnce(new Promise((resolve) => {
            settlePlayback = resolve;
        }));
        const replaceScreen = jest.fn();
        deps.screenPorts.getNavigation.mockReturnValue({ replaceScreen, setFocus: jest.fn() });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();
        expect(replaceScreen).not.toHaveBeenCalled();
        expect(deps.screenPorts.openEPG).not.toHaveBeenCalled();

        settlePlayback?.({ kind: 'started' });
        await flushPromises();
        expect(replaceScreen).toHaveBeenCalledWith('player');
        expect(deps.screenPorts.openEPG).toHaveBeenCalledTimes(1);
    });

    it('does not let an unrelated preparation-time start satisfy the intended Builder start', async () => {
        const ctx = createContext();
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        let releasePreparation: (() => void) | undefined;
        const preparation = new Promise<void>((resolve) => {
            releasePreparation = resolve;
        });
        let nextStart: ((outcome: { kind: 'started' } | { kind: 'failed' }) => void) | null = null;
        const emitProgramStart = (outcome: { kind: 'started' } | { kind: 'failed' }): void => {
            nextStart?.(outcome);
            nextStart = null;
        };
        deps.screenPorts.waitForNextPlaybackStart.mockImplementation(() => new Promise((resolve) => {
            nextStart = resolve;
        }));
        deps.screenPorts.switchToChannelByNumberWithOutcome.mockImplementationOnce(async (_number, options) => {
            await preparation;
            options?.beforeProgramStart?.();
            emitProgramStart({ kind: 'failed' });
            return { kind: 'switched' };
        });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        emitProgramStart({ kind: 'started' });
        expect(deps.screenPorts.waitForNextPlaybackStart).not.toHaveBeenCalled();
        releasePreparation?.();
        await flushPromises();

        expect(ctx.errorEl.textContent).toBe('Channels were created, but playback could not start.');
        expect(deps.restoreSetupAfterProvisionalReveal).toHaveBeenCalledTimes(1);
        expect(deps.screenPorts.openEPG).not.toHaveBeenCalled();
    });

    it('keeps Guide closed when a switched outcome did not dispatch program start', async () => {
        const ctx = createContext();
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        deps.screenPorts.switchToChannelByNumberWithOutcome.mockResolvedValueOnce({ kind: 'switched' });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();

        expect(ctx.errorEl.textContent).toBe('Channels were created, but playback could not start.');
        expect(deps.screenPorts.openEPG).not.toHaveBeenCalled();
    });

    it('restores Builder with recoverable copy when playback start fails', async () => {
        const ctx = createContext();
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        deps.screenPorts.waitForNextPlaybackStart.mockResolvedValueOnce({ kind: 'failed' });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();

        expect(deps.restoreSetupAfterProvisionalReveal).toHaveBeenCalledTimes(1);
        expect(ctx.errorEl.textContent).toBe('Channels were created, but playback could not start.');
        expect(deps.screenPorts.openEPG).not.toHaveBeenCalled();
        expect((ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).disabled).toBe(false);
    });

    it('restores Builder without a stale suffix when playback start is superseded', async () => {
        const ctx = createContext();
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        deps.screenPorts.waitForNextPlaybackStart.mockResolvedValueOnce({ kind: 'superseded' });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();

        expect(deps.restoreSetupAfterProvisionalReveal).toHaveBeenCalledTimes(1);
        expect(ctx.errorEl.textContent).toBe('');
        expect(deps.screenPorts.openEPG).not.toHaveBeenCalled();
    });

    it('uses the build-selected initial channel for Done and stays on setup when switch fails', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0, initialChannelNumber: 42 },
            }),
        });
        const replaceScreen = jest.fn();
        (deps.screenPorts.getNavigation as jest.Mock).mockReturnValue({
            replaceScreen,
            setFocus: jest.fn(),
        });

        deps.screenPorts.switchToChannelByNumberWithOutcome.mockImplementationOnce((_number, options) => {
            options?.beforeProgramStart?.();
            return Promise.resolve({
                kind: 'failed',
                reason: 'content_unavailable',
            });
        });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();

        expect(deps.screenPorts.switchToChannelByNumberWithOutcome).toHaveBeenCalledWith(42, expect.objectContaining({
            signal: expect.any(AbortSignal),
        }));
        expect(deps.restoreSetupAfterProvisionalReveal).toHaveBeenCalledTimes(1);
        expect(replaceScreen).not.toHaveBeenCalled();
        expect(deps.screenPorts.openEPG).not.toHaveBeenCalled();
        expect(ctx.errorEl.textContent).toBe('Channels were created, but channel 42 could not start.');
    });

    it('uses the build-selected initial channel for Done and shows canceled copy when switch aborts', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0, initialChannelNumber: 42 },
            }),
        });
        const replaceScreen = jest.fn();
        (deps.screenPorts.getNavigation as jest.Mock).mockReturnValue({
            replaceScreen,
            setFocus: jest.fn(),
        });

        deps.screenPorts.switchToChannelByNumberWithOutcome.mockImplementationOnce((_number, options) => {
            options?.beforeProgramStart?.();
            return Promise.resolve({ kind: 'aborted' });
        });
        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();

        expect(deps.screenPorts.switchToChannelByNumberWithOutcome).toHaveBeenCalledWith(42, expect.objectContaining({
            signal: expect.any(AbortSignal),
        }));
        expect(deps.restoreSetupAfterProvisionalReveal).toHaveBeenCalledTimes(1);
        expect(replaceScreen).not.toHaveBeenCalled();
        expect(deps.screenPorts.openEPG).not.toHaveBeenCalled();
        expect(ctx.errorEl.textContent).toBe('Channels were created, but playback start was canceled.');
    });

    it('cancels a hidden-screen attempt and suppresses its late success suffix', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        let resolveSwitch: ((outcome: { kind: 'switched' }) => void) | undefined;
        deps.screenPorts.switchToChannelByNumberWithOutcome.mockImplementationOnce((_number, options) => {
            options?.beforeProgramStart?.();
            return new Promise((resolve) => {
                resolveSwitch = resolve;
            });
        });
        const replaceScreen = jest.fn();
        deps.screenPorts.getNavigation.mockReturnValue({ replaceScreen, setFocus: jest.fn() });
        const presenter = new ChannelSetupBuildStepPresenter();
        presenter.render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        const signal = deps.screenPorts.switchToChannelByNumberWithOutcome.mock.calls[0]?.[1]?.signal as AbortSignal;
        presenter.cancelDoneTransition();
        resolveSwitch?.({ kind: 'switched' });
        await flushPromises();

        expect(signal.aborted).toBe(true);
        expect(deps.screenPorts.openEPG).not.toHaveBeenCalled();
        expect(replaceScreen).not.toHaveBeenCalled();
    });

    it('lets a newer Done attempt supersede a stale completion', async () => {
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        let resolveFirst: ((outcome: { kind: 'switched' }) => void) | undefined;
        deps.screenPorts.switchToChannelByNumberWithOutcome
            .mockImplementationOnce((_number, options) => {
                options?.beforeProgramStart?.();
                return new Promise((resolve) => {
                    resolveFirst = resolve;
                });
            })
            .mockImplementationOnce((_number, options) => {
                options?.beforeProgramStart?.();
                return Promise.resolve({ kind: 'switched' });
            });
        const replaceScreen = jest.fn();
        deps.screenPorts.getNavigation.mockReturnValue({ replaceScreen, setFocus: jest.fn() });
        const presenter = new ChannelSetupBuildStepPresenter();
        const firstCtx = createContext();
        const secondCtx = createContext();
        presenter.render(firstCtx, deps as never);
        await flushPromises();
        (firstCtx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        const firstSignal = deps.screenPorts.switchToChannelByNumberWithOutcome.mock.calls[0]?.[1]?.signal as AbortSignal;

        presenter.render(secondCtx, deps as never);
        await flushPromises();
        (secondCtx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();
        resolveFirst?.({ kind: 'switched' });
        await flushPromises();

        expect(firstSignal.aborted).toBe(true);
        expect(deps.restoreSetupAfterProvisionalReveal).toHaveBeenCalledTimes(1);
        expect(replaceScreen).toHaveBeenCalledTimes(1);
        expect(deps.screenPorts.openEPG).toHaveBeenCalledTimes(1);
    });
});
