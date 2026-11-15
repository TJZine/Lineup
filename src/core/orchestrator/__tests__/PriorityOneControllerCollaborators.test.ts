import type { PreparedPlaybackStream, PlayerStatus, StreamDescriptor } from '../../../modules/player';
import { makePreparedPlaybackStream } from '../../../__tests__/fixtures/preparedPlaybackStream';
import { createDeferred } from '../../../__tests__/helpers';
import type {
    ScheduledProgram,
    SchedulerState,
} from '../../../modules/scheduler/scheduler';
import { buildScheduledProgramIdentity } from '../../../modules/scheduler/scheduler';
import {
    createEventBinder,
    createOverlayRuntimePolicyController,
    createPlaybackRuntimeController,
    createPlaybackStartController,
    createProfileSwitchCleanupController,
} from '../priority-one/PriorityOneControllerCollaborators';
import type { PriorityOneAssemblyInput } from '../priority-one/PriorityOneAssemblyInput';
import type { OrchestratorPlaybackStateAccessors } from '../runtime/OrchestratorPlaybackStateAccessors';
import { createTestEventSurface } from './eventSurfaceTestUtils';

const makeProgram = (overrides: Partial<ScheduledProgram> = {}): ScheduledProgram =>
    ({
        item: {
            ratingKey: 'item-1',
            title: 'Program',
            durationMs: 60_000,
            type: 'movie',
        },
        elapsedMs: 0,
        scheduledStartTime: 0,
        scheduledEndTime: 60_000,
        remainingMs: 60_000,
        scheduleIndex: 0,
        loopNumber: 0,
        isCurrent: true,
        ...overrides,
    } as unknown as ScheduledProgram);

const makePrepared = (id = 'stream-1'): PreparedPlaybackStream =>
    makePreparedPlaybackStream(`https://example.invalid/${id}.m3u8`);

const makeSchedulerState = (
    currentProgram: ScheduledProgram | null,
    overrides: Partial<SchedulerState> = {}
): SchedulerState =>
    ({
        channelId: 'channel-7',
        isActive: false,
        currentProgram,
        nextProgram: null,
        schedulePosition: {
            loopNumber: currentProgram?.loopNumber ?? 0,
            itemIndex: currentProgram?.scheduleIndex ?? 0,
            offsetMs: currentProgram?.elapsedMs ?? 0,
        },
        lastSyncTime: 0,
        ...overrides,
    } as SchedulerState);

const makeInput = (
    playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors>
): PriorityOneAssemblyInput => {
    const videoPlayer = {
        loadStream: jest.fn().mockResolvedValue(undefined),
        play: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        off: jest.fn(),
    };
    const scheduler = createTestEventSurface();
    const schedulerState = makeSchedulerState(null);
    const playerEmitter = createTestEventSurface();
    const navigation = {
        getCurrentScreen: jest.fn().mockReturnValue('player'),
        isModalOpen: jest.fn().mockReturnValue(false),
        openModal: jest.fn(),
        closeModal: jest.fn(),
        on: playerEmitter.on,
        off: playerEmitter.off,
    };

    return {
        modules: {
            scheduler: {
                getState: jest.fn().mockImplementation(() => schedulerState),
                on: scheduler.on,
                off: scheduler.off,
            } as unknown as PriorityOneAssemblyInput['modules']['scheduler'],
            videoPlayer: videoPlayer as unknown as PriorityOneAssemblyInput['modules']['videoPlayer'],
            lifecycle: {
                saveState: jest.fn().mockResolvedValue(undefined),
                onPause: jest.fn(),
                onResume: jest.fn(),
            } as unknown as PriorityOneAssemblyInput['modules']['lifecycle'],
        },
        surfaces: {
            channelBadgeOverlay: {
                show: jest.fn(),
                hide: jest.fn(),
            },
            playerOsd: {
                isVisible: jest.fn().mockReturnValue(true),
            },
            epg: {
                isVisible: jest.fn().mockReturnValue(false),
            },
            channelTransitionActivity: {
                isActive: jest.fn().mockReturnValue(false),
            },
            channelManager: {
                getCurrentChannel: jest.fn().mockReturnValue({ number: 7, name: 'Movies' }),
                getStructuralBase: jest.fn().mockReturnValue({ generation: 1, revision: 1 }),
                on: jest.fn(),
                off: jest.fn(),
            } as unknown as PriorityOneAssemblyInput['surfaces']['channelManager'],
            navigation: navigation as unknown as PriorityOneAssemblyInput['surfaces']['navigation'],
            plexLibrary: null,
            plexStreamResolver: null,
        },
        playback: {
            playbackState,
            reconcileSleepExpiration: jest.fn().mockReturnValue(false),
            playbackRecovery: {
                resolveStreamForProgram: jest.fn().mockResolvedValue(makePrepared()),
                discardPreparedStream: jest.fn().mockResolvedValue(undefined),
                resetPlaybackFailureGuard: jest.fn(),
                tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
                tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
                attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
                handlePlaybackFailure: jest.fn(),
                isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
            },
            stopPlayback: jest.fn(),
            unloadCurrentChannel: jest.fn(),
            stopTranscodeSessionById: jest.fn(),
            skipToNextProgram: jest.fn(),
            pausePlayer: jest.fn(),
            playPlayer: jest.fn().mockResolvedValue(undefined),
        },
        schedulerRuntime: {
            cancelPendingDayRollover: jest.fn(),
            pauseSchedulerSync: jest.fn(),
            resumeSchedulerSync: jest.fn(),
            syncSchedulerToCurrentTime: jest.fn(),
        },
        playerEvents: {
            onPlayerStateChange: jest.fn(),
            onPlayerTimeUpdate: jest.fn(),
            onPlayerBufferUpdate: jest.fn(),
        },
        uiRuntime: {
            handleGlobalError: jest.fn(),
            onProgramStartUiSideEffects: jest.fn(),
            onStreamResolved: jest.fn(),
            onPlaybackStartFailure: jest.fn(),
        },
        events: {
            wireNavigationCoordinatorEvents: jest.fn().mockReturnValue([]),
            wireEpgCoordinatorEvents: jest.fn().mockReturnValue([]),
            handleScheduleDayRollover: jest.fn().mockResolvedValue(undefined),
            handlePlayerTrackChange: jest.fn(),
            handlePlexLibraryAuthorizationFailure: jest.fn(),
            handlePlexStreamError: jest.fn(),
            handleScreenChange: jest.fn(),
            reportPersistenceWarning: jest.fn(),
            cleanupReporter: jest.fn(),
            reportRecoverableAsyncFailure: jest.fn(),
        },
    };
};

describe('PriorityOneControllerCollaborators', () => {
    it.each(['paused', 'held'] as const)(
        'rejects a retained %s session after the scheduler crosses a program boundary',
        async (boundary) => {
            const firstProgram = makeProgram();
            let scheduledProgram = firstProgram;
            let committedDescriptor: StreamDescriptor | null = null;
            let nativeDescriptor: StreamDescriptor | null = null;
            let nativeStatus: PlayerStatus = 'paused';
            const playbackState = {
                getCurrentProgramForPlayback: jest.fn(() => scheduledProgram),
                setCurrentProgramForPlayback: jest.fn(),
                getCurrentStreamDescriptor: jest.fn(() => committedDescriptor),
                setCurrentStreamDescriptor: jest.fn((descriptor: StreamDescriptor | null) => {
                    committedDescriptor = descriptor;
                }),
                getCurrentStreamDecision: jest.fn().mockReturnValue(null),
                setCurrentStreamDecision: jest.fn(),
                getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
                setPendingNowPlayingChannelId: jest.fn(),
            } as unknown as jest.Mocked<OrchestratorPlaybackStateAccessors>;
            const input = makeInput(playbackState);
            (input.modules.scheduler.getState as jest.Mock).mockImplementation(() =>
                makeSchedulerState(scheduledProgram, { isActive: true })
            );
            (input.modules.videoPlayer.loadStream as jest.Mock).mockImplementation(
                async (descriptor: StreamDescriptor) => { nativeDescriptor = descriptor; }
            );
            (input.modules.videoPlayer.play as jest.Mock).mockImplementation(async () => {
                nativeStatus = 'playing';
            });
            input.modules.videoPlayer.getCurrentDescriptor = jest.fn(() => nativeDescriptor);
            input.modules.videoPlayer.getState = jest.fn(() => ({ status: nativeStatus } as ReturnType<typeof input.modules.videoPlayer.getState>));
            const requestStart = jest.fn().mockResolvedValue({ kind: 'started' });
            const runtime = createPlaybackRuntimeController(input, requestStart);
            const tune = runtime.beginIntentionalTune('channel-7');
            const start = createPlaybackStartController(input, runtime);
            expect(await start.handleProgramStart(firstProgram)).toEqual({ kind: 'started' });
            runtime.finishIntentionalTune(tune);
            nativeStatus = 'paused';
            expect(runtime.canActivateRetainedSession()).toBe(true);
            const acceptedDescriptor = committedDescriptor;
            const metadataDescriptor = { url: 'metadata-only' } as StreamDescriptor;
            committedDescriptor = metadataDescriptor;
            nativeDescriptor = metadataDescriptor;
            expect(runtime.canActivateRetainedSession()).toBe(false);
            committedDescriptor = acceptedDescriptor;
            nativeDescriptor = acceptedDescriptor;
            expect(runtime.canActivateRetainedSession()).toBe(true);
            for (const unusable of ['idle', 'ended', 'error'] as const) {
                nativeStatus = unusable;
                expect(runtime.canActivateRetainedSession()).toBe(false);
            }
            nativeStatus = 'paused';

            if (boundary === 'paused') runtime.setIntent('paused');
            else runtime.acquireHold('route');
            scheduledProgram = makeProgram({
                item: { ...firstProgram.item, ratingKey: 'item-2' } as ScheduledProgram['item'],
                scheduledStartTime: 60_000,
                scheduledEndTime: 120_000,
                scheduleIndex: 1,
            });
            expect(runtime.canActivateRetainedSession()).toBe(false);
            if (boundary === 'paused') runtime.setIntent('playing');
            else runtime.setRouteBlocking(false);

            expect(requestStart).toHaveBeenCalledTimes(1);
            expect(input.playback.playPlayer).not.toHaveBeenCalled();
        }
    );
    it('creates an overlay runtime controller that delegates badge policy through the assembly input', () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(makeProgram()),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);

        createOverlayRuntimePolicyController(input).syncChannelBadgeOverlay();

        expect(input.surfaces.channelBadgeOverlay?.show).toHaveBeenCalledWith({
            channelNumber: 7,
            channelName: 'Movies',
        });
    });

    it('creates an overlay runtime controller that suppresses the badge while transition activity is active', () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(makeProgram()),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);
        (
            input.surfaces as PriorityOneAssemblyInput['surfaces'] & {
                channelTransitionActivity: { isActive: jest.Mock<boolean, []> };
            }
        ).channelTransitionActivity = {
            isActive: jest.fn().mockReturnValue(true),
        };

        createOverlayRuntimePolicyController(input).syncChannelBadgeOverlay();

        expect(input.surfaces.channelBadgeOverlay?.hide).toHaveBeenCalledTimes(1);
        expect(input.surfaces.channelBadgeOverlay?.show).not.toHaveBeenCalled();
    });

    it('creates playback collaborators that drive program-start and runtime state through the assembly input', async () => {
        const program = makeProgram();
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue('channel-42'),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);

        const runtime = createPlaybackRuntimeController(input, () => null);
        runtime.beginIntentionalTune();
        await createPlaybackStartController(input, runtime).handleProgramStart(program);
        runtime.handlePlayerStateChange({
            status: 'playing',
        } as never);

        expect(playbackState.setCurrentProgramForPlayback).toHaveBeenCalledWith(program);
        expect(playbackState.setCurrentStreamDecision).toHaveBeenCalledWith(
            expect.objectContaining({ sessionId: 'test-session' })
        );
        expect(playbackState.setCurrentStreamDescriptor).toHaveBeenCalled();
        expect(input.uiRuntime.onProgramStartUiSideEffects).toHaveBeenCalledWith(program);
        expect(input.playerEvents.onPlayerStateChange).toHaveBeenCalled();
        expect(
            playbackState.setCurrentStreamDecision.mock.invocationCallOrder[0]
        ).toBeLessThan(playbackState.setCurrentStreamDescriptor.mock.invocationCallOrder[0] ?? 0);
        expect(
            playbackState.setCurrentStreamDescriptor.mock.invocationCallOrder[0]
        ).toBeLessThan(
            (input.uiRuntime.onStreamResolved as jest.Mock).mock.invocationCallOrder[0] ?? 0
        );
        expect(
            (input.uiRuntime.onStreamResolved as jest.Mock).mock.invocationCallOrder[0]
        ).toBeLessThan(
            (input.playback.playbackRecovery.resetPlaybackFailureGuard as jest.Mock)
                .mock.invocationCallOrder[0] ?? 0
        );
    });

    it('keeps the committed pair and reports a post-activation debug callback failure', async () => {
        const program = makeProgram();
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);
        const debugError = new Error('debug callback failed');
        (input.uiRuntime.onStreamResolved as jest.Mock).mockImplementationOnce(() => {
            throw debugError;
        });

        const runtime = createPlaybackRuntimeController(input, () => null);
        runtime.beginIntentionalTune();
        await createPlaybackStartController(input, runtime).handleProgramStart(program);

        expect(playbackState.setCurrentStreamDecision).toHaveBeenCalledTimes(1);
        expect(playbackState.setCurrentStreamDescriptor).toHaveBeenCalledTimes(1);
        expect(input.events.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'orchestrator.playbackStart.onStreamResolved',
            'Playback stream-resolved callback failed after activation',
            debugError
        );
        expect(input.playback.playbackRecovery.resetPlaybackFailureGuard).toHaveBeenCalledTimes(1);
        expect(
            (input.events.reportRecoverableAsyncFailure as jest.Mock).mock.invocationCallOrder[0]
        ).toBeLessThan(
            (input.playback.playbackRecovery.resetPlaybackFailureGuard as jest.Mock)
                .mock.invocationCallOrder[0] ?? 0
        );
        expect(input.playback.playbackRecovery.attemptTranscodeFallbackForCurrentProgram).not.toHaveBeenCalled();
        expect(input.playback.playbackRecovery.discardPreparedStream).not.toHaveBeenCalled();
        expect(input.playback.playbackRecovery.handlePlaybackFailure).not.toHaveBeenCalled();
    });

    it('keeps playback start current across same-occurrence scheduler rematerialization', async () => {
        const program = makeProgram({
            scheduledStartTime: 1_000,
            scheduledEndTime: 61_000,
        });
        const rematerializedProgram = makeProgram({
            scheduledStartTime: program.scheduledStartTime,
            scheduledEndTime: program.scheduledEndTime,
            scheduleIndex: program.scheduleIndex,
            loopNumber: program.loopNumber,
            elapsedMs: 5_000,
            remainingMs: 55_000,
            isCurrent: true,
        });
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);
        let schedulerState = makeSchedulerState(program, {
            isActive: true,
        });
        (
            input.modules.scheduler as PriorityOneAssemblyInput['modules']['scheduler'] & {
                getState: jest.Mock<ReturnType<PriorityOneAssemblyInput['modules']['scheduler']['getState']>, []>;
            }
        ).getState.mockImplementation(() => schedulerState);
        (
            input.playback.playbackRecovery.resolveStreamForProgram as jest.Mock
        ).mockImplementation(async () => {
            schedulerState = makeSchedulerState(rematerializedProgram, {
                isActive: true,
            });
            return makePrepared();
        });

        const runtime = createPlaybackRuntimeController(input, () => null);
        runtime.beginIntentionalTune();
        await createPlaybackStartController(input, runtime).handleProgramStart(program);

        expect(input.uiRuntime.onStreamResolved).toHaveBeenCalled();
        expect(input.modules.videoPlayer.loadStream).toHaveBeenCalled();
        expect(input.modules.videoPlayer.play).toHaveBeenCalled();
    });

    it('aborts playback start when the scheduler advances to a different occurrence', async () => {
        const program = makeProgram({
            scheduledStartTime: 1_000,
            scheduledEndTime: 61_000,
        });
        const nextOccurrence = makeProgram({
            scheduledStartTime: 61_000,
            scheduledEndTime: 121_000,
            scheduleIndex: 1,
            loopNumber: 0,
        });
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);
        let schedulerState = makeSchedulerState(program, {
            isActive: true,
        });
        (
            input.modules.scheduler as PriorityOneAssemblyInput['modules']['scheduler'] & {
                getState: jest.Mock<ReturnType<PriorityOneAssemblyInput['modules']['scheduler']['getState']>, []>;
            }
        ).getState.mockImplementation(() => schedulerState);
        (
            input.playback.playbackRecovery.resolveStreamForProgram as jest.Mock
        ).mockImplementation(async () => {
            schedulerState = makeSchedulerState(nextOccurrence, {
                isActive: true,
            });
            return makePrepared();
        });

        const runtime = createPlaybackRuntimeController(input, () => null);
        runtime.beginIntentionalTune();
        await createPlaybackStartController(input, runtime).handleProgramStart(program);

        expect(input.uiRuntime.onStreamResolved).not.toHaveBeenCalled();
        expect(input.modules.videoPlayer.loadStream).not.toHaveBeenCalled();
        expect(input.modules.videoPlayer.play).not.toHaveBeenCalled();
    });

    it('creates a profile-switch cleanup controller that clears playback state through the assembly input', () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(null),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);

        createProfileSwitchCleanupController(input).prepareForProfileSwitch();

        expect(input.schedulerRuntime.cancelPendingDayRollover).toHaveBeenCalled();
        expect(input.playback.stopPlayback).toHaveBeenCalled();
        expect(input.playback.unloadCurrentChannel).toHaveBeenCalled();
        expect(playbackState.setCurrentProgramForPlayback).toHaveBeenCalledWith(null);
        expect(playbackState.setCurrentStreamDescriptor).toHaveBeenCalledWith(null);
        expect(playbackState.setCurrentStreamDecision).toHaveBeenCalledWith(null);
    });

    it('creates an event binder that routes scheduler and player events through the extracted collaborators', async () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(makeProgram()),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);
        const playbackRuntimeController = createPlaybackRuntimeController(input, () => null);
        playbackRuntimeController.beginIntentionalTune();
        const playbackStartController = createPlaybackStartController(input, playbackRuntimeController);
        const binder = createEventBinder(
            input,
            playbackStartController,
            playbackRuntimeController
        );

        binder.bind();
        (input.modules.scheduler as unknown as { on: jest.Mock }).on.mock.calls[0]?.[1](makeProgram());
        await Promise.resolve();

        expect(input.events.handleScheduleDayRollover).not.toHaveBeenCalled();
        expect(input.uiRuntime.onProgramStartUiSideEffects).toHaveBeenCalled();
        binder.dispose();
    });

    it('observes only the exact scheduler occurrence through the real start producer', async () => {
        const selected = makeProgram();
        const other = makeProgram({
            item: { ...selected.item, ratingKey: 'other-item' } as ScheduledProgram['item'],
        });
        let currentProgram = selected;
        let committedDescriptor: StreamDescriptor | null = null;
        let nativeDescriptor: StreamDescriptor | null = null;
        let nativeStatus: PlayerStatus = 'idle';
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn(() => currentProgram),
            setCurrentProgramForPlayback: jest.fn((program) => { currentProgram = program ?? selected; }),
            getCurrentStreamDescriptor: jest.fn(() => committedDescriptor),
            setCurrentStreamDescriptor: jest.fn((descriptor) => { committedDescriptor = descriptor; }),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
        };
        const input = makeInput(playbackState);
        (input.modules.scheduler.getState as jest.Mock).mockImplementation(() =>
            makeSchedulerState(currentProgram, { isActive: true })
        );
        const prepared = createDeferred<PreparedPlaybackStream>();
        (input.playback.playbackRecovery.resolveStreamForProgram as jest.Mock)
            .mockImplementation((program: ScheduledProgram) =>
                program.item.ratingKey === selected.item.ratingKey
                    ? prepared.promise
                    : Promise.resolve(makePrepared('other'))
            );
        (input.modules.videoPlayer.loadStream as jest.Mock).mockImplementation(
            async (descriptor: StreamDescriptor) => { nativeDescriptor = descriptor; }
        );
        (input.modules.videoPlayer.play as jest.Mock).mockImplementation(async () => {
            nativeStatus = 'playing';
        });
        input.modules.videoPlayer.getCurrentDescriptor = jest.fn(() => nativeDescriptor);
        input.modules.videoPlayer.getState = jest.fn(() => ({ status: nativeStatus } as ReturnType<typeof input.modules.videoPlayer.getState>));

        const runtime = createPlaybackRuntimeController(input, () => null);
        const tune = runtime.beginIntentionalTune('channel-7');
        const binder = createEventBinder(input, createPlaybackStartController(input, runtime), runtime);
        const identity = buildScheduledProgramIdentity('channel-7', selected);
        expect(identity).not.toBeNull();
        if (!identity) throw new Error('Selected program has no schedule identity');
        const observed = runtime.observeProgramStart(identity, new AbortController().signal);
        let settled = false;
        void observed.then(() => { settled = true; });
        binder.bind();

        const programStartHandler = (input.modules.scheduler.on as jest.Mock).mock.calls
            .find(([name]) => name === 'programStart')?.[1] as ((program: ScheduledProgram) => void) | undefined;
        expect(programStartHandler).toBeDefined();
        programStartHandler?.(other);
        await Promise.resolve();
        expect(settled).toBe(false);

        programStartHandler?.(selected);
        await Promise.resolve();
        expect(settled).toBe(false);
        runtime.finishIntentionalTune(tune);
        prepared.resolve(makePrepared('selected'));
        await expect(observed).resolves.toEqual({ kind: 'started' });
        expect(runtime.canActivateRetainedSession()).toBe(true);
        binder.dispose();
    });
});
