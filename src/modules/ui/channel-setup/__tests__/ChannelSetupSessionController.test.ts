import { DEFAULT_CHANNEL_SETUP_MAX } from '../../../scheduler/channel-manager/constants';
import { DEFAULT_MIN_ITEMS_PER_CHANNEL } from '../../../../core/channel-setup/constants';
import type { ChannelSetupConfig, ChannelSetupRecord } from '../../../../Orchestrator';
import type { PlexLibrary as PlexLibraryModel } from '../../../plex/library/types';
import {
    ChannelSetupSessionController,
    type ChannelSetupBuildOutcome,
    type ChannelSetupOrchestrator,
} from '../ChannelSetupSessionController';
import { DEFAULT_BUILD_RESULT, DEFAULT_PREVIEW, DEFAULT_REVIEW, makeLibrary } from './channel-setup-test-helpers';

const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

type OrchestratorOverrides = Partial<ChannelSetupOrchestrator>;

const createOrchestrator = (overrides: OrchestratorOverrides = {}): jest.Mocked<ChannelSetupOrchestrator> => ({
    getNavigation: jest.fn(() => null),
    getLibrariesForSetup: jest.fn().mockResolvedValue([]),
    getChannelSetupRecord: jest.fn(() => null),
    getSetupContextForSelectedServer: jest.fn(() => 'unknown'),
    getSelectedServerStorageKey: jest.fn(() => 'selected-server-key'),
    getServerHealthStorageKey: jest.fn(() => 'server-health-key'),
    getSelectedServerId: jest.fn(() => null),
    openServerSelect: jest.fn(),
    switchToChannelByNumber: jest.fn(),
    openEPG: jest.fn(),
    createChannelsFromSetup: jest.fn().mockResolvedValue(DEFAULT_BUILD_RESULT),
    markSetupComplete: jest.fn(),
    getSetupPreview: jest.fn().mockResolvedValue(DEFAULT_PREVIEW),
    getSetupReview: jest.fn().mockResolvedValue(DEFAULT_REVIEW),
    ...overrides,
} as unknown as jest.Mocked<ChannelSetupOrchestrator>);

describe('ChannelSetupSessionController', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('beginSession() resets to Step 1 defaults', async () => {
        const libraries: PlexLibraryModel[] = [makeLibrary({ id: 'movies' }), makeLibrary({ id: 'shows' })];
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue(libraries),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        await controller.loadLibraries();
        controller.setStep(2);
        controller.clearAllLibraries();
        controller.toggleReplaceConfirm();
        controller.updateStrategyState((draft) => {
            draft.maxChannels = 50;
            draft.minItems = 1;
            draft.strategies.playlists.enabled = false;
        });

        controller.beginSession();

        const snapshot = controller.getSnapshot();
        expect(snapshot.step).toBe(1);
        expect(snapshot.maxChannels).toBe(DEFAULT_CHANNEL_SETUP_MAX);
        expect(snapshot.minItems).toBe(DEFAULT_MIN_ITEMS_PER_CHANNEL);
        expect(snapshot.replaceConfirm).toBe(false);
        expect(snapshot.strategies.playlists.enabled).toBe(true);
    });

    it('buildConfig() serializes strategy, expansion, ordering, and min/max settings', async () => {
        const libraries: PlexLibraryModel[] = [makeLibrary({ id: 'movies' }), makeLibrary({ id: 'shows' })];
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue(libraries),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        await controller.loadLibraries();
        controller.updateStrategyState((draft) => {
            draft.strategies.playlists.enabled = false;
            draft.strategies.genres.scope = 'cross-library';
            draft.strategyOrder = [
                'playlists',
                ...draft.strategyOrder.filter((key) => key !== 'playlists'),
            ];
            draft.channelExpansion.addAlternateLineups = true;
            draft.channelExpansion.alternateLineupCopies = 2;
            draft.channelExpansion.variantType = 'block';
            draft.channelExpansion.variantBlockSize = 4;
            draft.seriesOrdering.basePlaybackMode = 'block';
            draft.seriesOrdering.baseBlockSize = 4;
            draft.maxChannels = 300;
            draft.minItems = 5;
        });

        const config = controller.buildConfig('server-1');

        expect(config.maxChannels).toBe(300);
        expect(config.minItemsPerChannel).toBe(5);
        expect(config.channelExpansion).toEqual({
            addAlternateLineups: true,
            alternateLineupCopies: 2,
            variantType: 'block',
            variantBlockSize: 4,
        });
        expect(config.seriesOrdering).toEqual({
            basePlaybackMode: 'block',
            baseBlockSize: 4,
        });
        expect(config.strategyConfig.playlists?.enabled).toBe(false);
        expect(config.strategyConfig.playlists?.priority).toBe(1);
        expect(config.strategyConfig.genres?.scope).toBe('cross-library');
    });

    it('buildPreviewKey() changes when preview-relevant config changes', async () => {
        const libraries: PlexLibraryModel[] = [makeLibrary({ id: 'movies' })];
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue(libraries),
        });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        await controller.loadLibraries();

        const beforeConfig = controller.buildConfig('server-1');
        const beforeKey = controller.buildPreviewKey(beforeConfig);

        controller.updateStrategyState((draft) => {
            draft.maxChannels = 500;
        });

        const afterConfig = controller.buildConfig('server-1');
        const afterKey = controller.buildPreviewKey(afterConfig);
        expect(afterKey).not.toBe(beforeKey);
    });

    it('updateStrategyState() clones nested state before mutation', () => {
        const orchestrator = createOrchestrator();
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        const before = controller.getSnapshot();
        const beforeStrategies = before.strategies;
        const beforeExpansion = before.channelExpansion;
        const beforeOrdering = before.seriesOrdering;

        controller.updateStrategyState((draft) => {
            draft.strategies.playlists.enabled = false;
            draft.channelExpansion.addAlternateLineups = true;
            draft.seriesOrdering.basePlaybackMode = 'block';
        });

        const after = controller.getSnapshot();
        expect(after.strategies).not.toBe(beforeStrategies);
        expect(after.channelExpansion).not.toBe(beforeExpansion);
        expect(after.seriesOrdering).not.toBe(beforeOrdering);
        expect(after.strategies.playlists.enabled).toBe(false);
    });

    it('loadLibraries() applies setup record when present', async () => {
        const libraries: PlexLibraryModel[] = [makeLibrary({ id: 'movies' }), makeLibrary({ id: 'shows' })];
        const record: ChannelSetupRecord = {
            serverId: 'server-1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            selectedLibraryIds: ['shows'],
            maxChannels: 250,
            buildMode: 'append',
            actorStudioCombineMode: 'combined',
            minItemsPerChannel: 3,
            strategyConfig: {
                collections: { enabled: true, priority: 2, scope: 'per-library' },
                playlists: { enabled: false, priority: 1, scope: 'per-library' },
                genres: { enabled: true, priority: 3, scope: 'cross-library' },
                directors: { enabled: true, priority: 4, scope: 'cross-library' },
                decades: { enabled: true, priority: 5, scope: 'per-library' },
                recentlyAdded: { enabled: true, priority: 6, scope: 'per-library' },
                studios: { enabled: true, priority: 7, scope: 'cross-library' },
                actors: { enabled: true, priority: 8, scope: 'cross-library' },
            },
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 2,
                variantType: 'block',
                variantBlockSize: 4,
            },
            seriesOrdering: {
                basePlaybackMode: 'block',
                baseBlockSize: 4,
            },
        };

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue(libraries),
            getChannelSetupRecord: jest.fn(() => record),
        });

        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        await controller.loadLibraries();

        const snapshot = controller.getSnapshot();
        expect(snapshot.selectedLibraryIds).toEqual(new Set(['shows']));
        expect(snapshot.maxChannels).toBe(250);
        expect(snapshot.minItems).toBe(3);
        expect(snapshot.buildMode).toBe('append');
        expect(snapshot.actorStudioCombineMode).toBe('combined');
        expect(snapshot.recordApplied).toBe(true);
    });

    it('loadLibraries() handles failure by clearing loading state', async () => {
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockRejectedValue(new Error('library load failed')),
        });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        await controller.loadLibraries();

        const snapshot = controller.getSnapshot();
        expect(snapshot.isLoading).toBe(false);
        expect(snapshot.recordApplied).toBe(false);
        expect(snapshot.libraries).toEqual([]);
    });

    it('syncSetupContext() preserves first-time/existing/unknown and falls back to unknown', () => {
        const getSetupContextForSelectedServer = jest
            .fn<ReturnType<ChannelSetupOrchestrator['getSetupContextForSelectedServer']>, []>()
            .mockReturnValueOnce('first-time')
            .mockReturnValueOnce('existing')
            .mockReturnValueOnce('unknown')
            .mockReturnValueOnce('invalid' as never);
        const orchestrator = createOrchestrator({ getSetupContextForSelectedServer });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        controller.syncSetupContext();
        expect(controller.getSnapshot().setupContext).toBe('first-time');
        controller.syncSetupContext();
        expect(controller.getSnapshot().setupContext).toBe('existing');
        controller.syncSetupContext();
        expect(controller.getSnapshot().setupContext).toBe('unknown');
        controller.syncSetupContext();
        expect(controller.getSnapshot().setupContext).toBe('unknown');
    });

    it('schedulePreview() debounces calls and suppresses duplicate keys', async () => {
        const getSetupPreview = jest.fn().mockResolvedValue(DEFAULT_PREVIEW);
        const orchestrator = createOrchestrator({
            getSetupPreview,
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        await controller.loadLibraries();
        controller.setStep(2);

        const onStateChange = jest.fn();
        controller.schedulePreview(onStateChange);
        controller.schedulePreview(onStateChange);

        jest.advanceTimersByTime(399);
        expect(getSetupPreview).toHaveBeenCalledTimes(0);

        jest.advanceTimersByTime(1);
        await flushPromises();
        expect(getSetupPreview).toHaveBeenCalledTimes(1);

        controller.schedulePreview(onStateChange);
        jest.advanceTimersByTime(450);
        await flushPromises();
        expect(getSetupPreview).toHaveBeenCalledTimes(1);
    });

    it('schedulePreview() ignores stale results after session restart', async () => {
        let resolvePreview: ((value: typeof DEFAULT_PREVIEW) => void) | undefined;
        const getSetupPreview = jest.fn().mockImplementation(
            () => new Promise<typeof DEFAULT_PREVIEW>((resolve) => {
                resolvePreview = resolve;
            })
        );
        const orchestrator = createOrchestrator({
            getSetupPreview,
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        await controller.loadLibraries();
        controller.setStep(2);

        controller.schedulePreview(jest.fn());
        jest.advanceTimersByTime(450);
        await flushPromises();
        controller.beginSession();

        expect(resolvePreview).toBeTruthy();
        if (!resolvePreview) {
            throw new Error('Expected preview resolver to be set');
        }
        resolvePreview(DEFAULT_PREVIEW);
        await flushPromises();

        const snapshot = controller.getSnapshot();
        expect(snapshot.preview).toBeNull();
    });

    it('preview deltas expire after timeout window', async () => {
        const previews = [
            { ...DEFAULT_PREVIEW, estimates: { ...DEFAULT_PREVIEW.estimates, total: 10 } },
            { ...DEFAULT_PREVIEW, estimates: { ...DEFAULT_PREVIEW.estimates, total: 20 } },
        ];
        const getSetupPreview = jest
            .fn()
            .mockResolvedValueOnce(previews[0])
            .mockResolvedValueOnce(previews[1]);

        const orchestrator = createOrchestrator({
            getSetupPreview,
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        await controller.loadLibraries();
        controller.setStep(2);

        controller.schedulePreview(jest.fn());
        jest.advanceTimersByTime(450);
        await flushPromises();

        controller.updateStrategyState((draft) => {
            draft.maxChannels = 300;
        });
        controller.schedulePreview(jest.fn());
        jest.advanceTimersByTime(450);
        await flushPromises();

        expect(controller.getSnapshot().previewDeltas.total).toBe(10);
        jest.advanceTimersByTime(3000);
        await flushPromises();
        expect(controller.getSnapshot().previewDeltas).toEqual({});
    });

    it('ensureReviewLoaded() handles success, failure, and abort-like interruption', async () => {
        const getSetupReview = jest
            .fn()
            .mockResolvedValueOnce(DEFAULT_REVIEW)
            .mockRejectedValueOnce(new Error('review failed'))
            .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
        const orchestrator = createOrchestrator({ getSetupReview });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();

        await controller.ensureReviewLoaded(jest.fn());
        expect(controller.getSnapshot().review).toEqual(DEFAULT_REVIEW);
        expect(controller.getSnapshot().reviewError).toBeNull();

        controller.clearReviewForEdits();
        await controller.ensureReviewLoaded(jest.fn());
        expect(controller.getSnapshot().review).toBeNull();
        expect(controller.getSnapshot().reviewError).toBe('review failed');

        controller.clearReviewForEdits();
        await controller.ensureReviewLoaded(jest.fn());
        expect(controller.getSnapshot().review).toBeNull();
        expect(controller.getSnapshot().reviewError).toBeNull();
    });

    it('beginBuild() returns missing-server when no server is selected', async () => {
        const orchestrator = createOrchestrator();
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => null,
        });

        controller.beginSession();
        const outcome = await controller.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });

        expect(outcome).toEqual<ChannelSetupBuildOutcome>({ kind: 'missing-server' });
    });

    it('beginBuild() returns canceled after cancelBuild() aborts in-flight build', async () => {
        let capturedSignal: AbortSignal | undefined;
        let resolveBuild: ((result: typeof DEFAULT_BUILD_RESULT) => void) | null = null;
        const createChannelsFromSetup = jest.fn().mockImplementation(
            (_config: ChannelSetupConfig, options?: { signal?: AbortSignal }) => {
                capturedSignal = options?.signal;
                return new Promise<typeof DEFAULT_BUILD_RESULT>((resolve, reject) => {
                    resolveBuild = resolve;
                    capturedSignal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                });
            }
        );
        const orchestrator = createOrchestrator({ createChannelsFromSetup });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        const buildPromise = controller.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });
        expect(controller.cancelBuild()).toBe(true);
        expect(resolveBuild).not.toBeNull();

        const outcome = await buildPromise;
        expect(outcome).toEqual<ChannelSetupBuildOutcome>({ kind: 'canceled' });
    });

    it('beginBuild() returns error outcome for non-abort failures', async () => {
        const orchestrator = createOrchestrator({
            createChannelsFromSetup: jest.fn().mockRejectedValue(new Error('boom')),
        });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        const outcome = await controller.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });

        expect(outcome).toEqual<ChannelSetupBuildOutcome>({ kind: 'error', message: 'boom' });
    });

    it('beginBuild() returns success and marks setup complete only on success', async () => {
        const createChannelsFromSetup = jest.fn().mockResolvedValue(DEFAULT_BUILD_RESULT);
        const markSetupComplete = jest.fn();
        const orchestrator = createOrchestrator({
            createChannelsFromSetup,
            markSetupComplete,
        });
        const controller = new ChannelSetupSessionController({
            orchestrator,
            getSelectedServerId: () => 'server-1',
        });

        controller.beginSession();
        const outcome = await controller.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });

        expect(outcome.kind).toBe('success');
        expect(markSetupComplete).toHaveBeenCalledTimes(1);
    });
});
