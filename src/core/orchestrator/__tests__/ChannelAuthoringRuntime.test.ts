import { AppOrchestrator } from '../AppOrchestrator';
import { PlaybackRuntimeController, type PlaybackRuntimeControllerDeps } from '../priority-one/PlaybackRuntimeController';
import { ChannelScheduler, buildScheduledProgramIdentityFromState, type ResolvedContentItem } from '../../../modules/scheduler/scheduler';
import type { ChannelConfig, ResolvedChannelContent } from '../../../modules/scheduler/channel-manager';
import type { OrchestratorConfig } from '../contracts/OrchestratorTypes';
import type { PriorityOneRuntimeAssemblyInput } from '../priority-one/PriorityOneAssemblyBuilder';
import * as priorityOneAssembly from '../priority-one/PriorityOneAssemblyBuilder';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';
import { installMockLocalStorage, resetMockLocalStorage, restoreOriginalLocalStorage } from '../../../__tests__/mocks/localStorage';

const item = (ratingKey: string, durationMs: number): ResolvedContentItem => ({
    ratingKey, durationMs, type: 'movie' as const, title: ratingKey, fullTitle: ratingKey,
    thumb: null, year: 2026, scheduledIndex: 0,
});

const saved = { id: 'channel-1', playbackMode: 'sequential', scheduleAnchorMode: 'fixed',
    startTimeAnchor: 1_000_000, shuffleSeed: 1, phaseSeed: 0 } as ChannelConfig;

interface Harness {
    orchestrator: AppOrchestrator;
    scheduler: ChannelScheduler;
    runtime: PlaybackRuntimeController;
    manager: {
        getStructuralBase: jest.Mock;
        getChannel: jest.Mock;
        resolveChannelContent: jest.Mock;
    };
    stopPlayback: jest.Mock;
    notice: jest.Mock;
}

function setup(resolvedItems: ResolvedContentItem[]): Harness {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
    const scheduler = new ChannelScheduler();
    scheduler.loadChannel({ channelId: saved.id, anchorTime: 1_000_000,
        content: [item('a', 10_000), item('b', 20_000)], playbackMode: 'sequential', shuffleSeed: 1 });
    const descriptor = { url: 'native' };
    const stopPlayback = jest.fn();
    const manager = {
        getStructuralBase: jest.fn(() => ({ generation: 1, revision: 2 })),
        getChannel: jest.fn(() => saved),
        resolveChannelContent: jest.fn(async (): Promise<ResolvedChannelContent> => ({
            channelId: saved.id, channelSnapshot: saved, items: resolvedItems,
            orderedItems: resolvedItems, totalDurationMs: resolvedItems.reduce((sum, current) => sum + current.durationMs, 0),
            resolvedAt: Date.now(),
        })),
    };
    const deps = {
        getScheduledProgramIdentity: () => buildScheduledProgramIdentityFromState(scheduler.getState()),
        getDirectoryScopeKey: () => 'scope-1',
        getCommittedDescriptor: () => descriptor,
        getCurrentDescriptor: () => descriptor,
        getPlayerStatus: () => 'paused',
        hasSelectedChannel: () => true,
        stopPlayback,
        unloadCurrentChannel: () => scheduler.unloadChannel(),
        cancelChannelReplacement: () => scheduler.cancelChannelReplacement(),
    } as unknown as PlaybackRuntimeControllerDeps;
    const runtime = new PlaybackRuntimeController(deps);
    runtime.acceptCommittedSession(descriptor);
    const orchestrator = new AppOrchestrator();
    const notice = jest.fn();
    Object.assign(orchestrator, { _channelManager: manager, _scheduler: scheduler,
        _playbackRuntimeController: runtime, _nowPlayingHandler: notice });
    return { orchestrator, scheduler, runtime, manager, stopPlayback, notice };
}

beforeEach(() => {
    installMockLocalStorage();
    resetMockLocalStorage();
});
afterEach(() => { jest.useRealTimers(); });
afterAll(() => { restoreOriginalLocalStorage(); });

describe('authored channel runtime effects', () => {
    it.each(['stop', 'sleep'] as const)('uses the real reentrant native stop for %s then Retry and deletion', async (kind) => {
        jest.useFakeTimers();
        jest.setSystemTime(1_000_000);
        const scheduler = new ChannelScheduler();
        scheduler.loadChannel({ channelId: saved.id, anchorTime: 1_000_000,
            content: [item('a', 10_000)], playbackMode: 'sequential', shuffleSeed: 1 });
        const orchestrator = new AppOrchestrator();
        const originalAssembly = priorityOneAssembly.createPriorityOneRuntimeAssembly;
        let stopComposedPlayback: PriorityOneRuntimeAssemblyInput['orchestratorCallbacks']['stopPlayback'] | null = null;
        const assemblySpy = jest.spyOn(priorityOneAssembly, 'createPriorityOneRuntimeAssembly')
            .mockImplementation(input => {
                stopComposedPlayback = input.orchestratorCallbacks.stopPlayback;
                return originalAssembly(input);
            });
        const config = {
            plexConfig: { clientIdentifier: 'test-client', product: 'Lineup', version: '1.0.0',
                platform: 'webOS', platformVersion: '6.0', device: 'LG Smart TV', deviceName: 'Test TV' },
            navConfig: { enablePointerMode: false, keyRepeatDelayMs: 500, keyRepeatIntervalMs: 100,
                focusMemoryEnabled: true, debugMode: false },
            playerConfig: { containerId: APP_SHELL_CONTAINER_IDS.VIDEO, defaultVolume: 1,
                bufferAheadMs: 30_000, seekIncrementSec: 10, hideControlsAfterMs: 3_000,
                retryAttempts: 3, retryDelayMs: 1_000 },
            epgConfig: { containerId: 'epg-container', visibleChannels: 5, timeSlotMinutes: 30,
                visibleHours: 3, totalHours: 24, pixelsPerMinute: 4, rowHeight: 80,
                autoScrollToNow: true },
            playerOsdConfig: { containerId: 'player-osd-container' },
            channelNumberOverlayConfig: { containerId: 'channel-number-overlay-container' },
            channelBadgeConfig: { containerId: 'channel-badge-container' },
            miniGuideConfig: { containerId: 'mini-guide-container' },
            channelTransitionConfig: { containerId: 'channel-transition-container' },
        } satisfies OrchestratorConfig;
        try {
            await orchestrator.initialize(config);
        } finally {
            assemblySpy.mockRestore();
        }
        if (!stopComposedPlayback) throw new Error('Playback stop was not composed');
        let descriptor: object | null = { url: 'old-native' };
        const stopNative = jest.fn(() => { descriptor = null; });
        const stopTranscode = jest.fn();
        const deps = {
            getScheduledProgramIdentity: () => buildScheduledProgramIdentityFromState(scheduler.getState()),
            getDirectoryScopeKey: () => 'scope-1',
            getCommittedDescriptor: () => descriptor,
            getCurrentDescriptor: () => descriptor,
            getPlayerStatus: () => 'paused',
            getScheduledChannelId: () => saved.id,
            hasSelectedChannel: () => true,
            reconcileSleepExpiration: () => false,
            schedulerRuntime: { syncSchedulerToCurrentTime: () => scheduler.syncToCurrentTime() },
            playback: { playbackState: { getCurrentStreamDecision: () => ({ isTranscoding: true, sessionId: 'tc' }) },
                stopTranscodeSessionById: stopTranscode },
            stopPlayback: stopComposedPlayback,
            unloadCurrentChannel: () => scheduler.unloadChannel(),
            cancelChannelReplacement: () => scheduler.cancelChannelReplacement(),
            requestCurrentProgramStart: () => Promise.resolve({ kind: 'started' as const }),
        } as unknown as PlaybackRuntimeControllerDeps;
        const runtime = new PlaybackRuntimeController(deps);
        Object.assign(orchestrator, { _scheduler: scheduler, _playbackRuntimeController: runtime,
            _videoPlayer: { stop: stopNative } });
        runtime.beginIntentionalTune(saved.id);
        runtime.acceptCommittedSession(descriptor!);
        runtime.finishIntentionalTune(saved.id);
        if (kind === 'stop') runtime.setIntent('stopped');
        else runtime.expireSleep();
        expect(stopNative).toHaveBeenCalledTimes(1);
        expect(stopTranscode).toHaveBeenCalledWith('tc');
        expect(runtime.getActiveMediaIdentity()).toBeNull();
        if (kind === 'stop') expect(runtime.setIntent('playing')).toBe(true);
        else await expect(runtime.retryCurrentProgram()).resolves.toEqual({ kind: 'started' });
        descriptor = { url: 'new-native' };
        runtime.acceptCommittedSession(descriptor);
        const identity = orchestrator.getActiveMediaIdentity()!;
        expect(identity.channelId).toBe(saved.id);
        await expect(orchestrator.stopDeletedMediaIfCurrent(identity)).resolves.toBe('stopped');
        expect(stopNative).toHaveBeenCalledTimes(2);
        expect(stopTranscode).toHaveBeenCalledTimes(2);
        expect(scheduler.getState().isActive).toBe(false);
    });
    it('keeps valid native media until the old boundary and starts the saved schedule once', async () => {
        const f = setup([item('a', 10_000), item('new', 20_000)]);
        const starts = jest.fn();
        f.scheduler.on('programStart', starts);
        await f.orchestrator.refreshAfterSave({ previous: saved, saved, programmingChanged: true });
        expect(f.scheduler.getState().currentProgram?.item.ratingKey).toBe('a');
        expect(f.scheduler.hasPendingChannelReplacement()).toBe(true);
        expect(f.stopPlayback).not.toHaveBeenCalled();
        expect(starts).not.toHaveBeenCalled();
        jest.setSystemTime(1_010_000);
        f.scheduler.syncToCurrentTime();
        expect(f.scheduler.getState().currentProgram?.item.ratingKey).toBe('new');
        expect(starts).toHaveBeenCalledTimes(1);
        f.scheduler.unloadChannel();
    });

    it('stops an invalid in-flight item with a visible reason after Save', async () => {
        const f = setup([item('new', 20_000)]);
        await f.orchestrator.refreshAfterSave({ previous: saved, saved, programmingChanged: true });
        expect(f.stopPlayback).toHaveBeenCalledTimes(1);
        expect(f.scheduler.getState().isActive).toBe(false);
        expect(f.notice).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning', message: expect.stringContaining('Playback stopped') }));
    });

    it('does not reload native media for a metadata-only Save', async () => {
        const f = setup([item('a', 10_000)]);
        await f.orchestrator.refreshAfterSave({ previous: saved, saved, programmingChanged: false });
        expect(f.manager.resolveChannelContent).not.toHaveBeenCalled();
        expect(f.scheduler.hasPendingChannelReplacement()).toBe(false);
        expect(f.stopPlayback).not.toHaveBeenCalled();
        f.scheduler.unloadChannel();
    });

    it('does not install an older resolution after a newer Save', async () => {
        const f = setup([item('a', 10_000), item('latest', 20_000)]);
        let resolveOld!: (content: ResolvedChannelContent) => void;
        const old = new Promise<ResolvedChannelContent>(resolve => { resolveOld = resolve; });
        f.manager.resolveChannelContent.mockReturnValueOnce(old);
        const first = f.orchestrator.refreshAfterSave({ previous: saved, saved, programmingChanged: true });
        await f.orchestrator.refreshAfterSave({ previous: saved, saved, programmingChanged: true });
        resolveOld({ channelId: saved.id, channelSnapshot: saved,
            items: [item('a', 10_000), item('old', 20_000)], orderedItems: [], totalDurationMs: 30_000,
            resolvedAt: Date.now() });
        await first;
        jest.setSystemTime(1_010_000);
        f.scheduler.syncToCurrentTime();
        expect(f.scheduler.getState().currentProgram?.item.ratingKey).toBe('latest');
        f.scheduler.unloadChannel();
    });

    it('reports stale resolution as a post-commit effect failure without replacing playback', async () => {
        const f = setup([item('a', 10_000)]);
        f.manager.resolveChannelContent.mockResolvedValueOnce({ channelId: saved.id, channelSnapshot: saved,
            items: [item('a', 10_000)], orderedItems: [], totalDurationMs: 10_000,
            resolvedAt: Date.now(), isStale: true });
        await expect(f.orchestrator.refreshAfterSave({ previous: saved, saved, programmingChanged: true }))
            .rejects.toThrow('could not be confirmed');
        expect(f.scheduler.hasPendingChannelReplacement()).toBe(false);
        expect(f.stopPlayback).not.toHaveBeenCalled();
        f.scheduler.unloadChannel();
    });
});
