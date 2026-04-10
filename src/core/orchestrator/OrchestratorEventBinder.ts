import type { IAppLifecycle } from '../../modules/lifecycle';
import type { INavigationManager, Screen } from '../../modules/navigation';
import type {
    IVideoPlayer,
    PlaybackError,
    PlaybackState,
    TimeRange,
} from '../../modules/player';
import type { IPlexLibrary } from '../../modules/plex/library';
import type {
    IPlexStreamResolver,
    StreamResolverError,
} from '../../modules/plex/stream';
import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduledProgram,
} from '../../modules/scheduler/scheduler';
import { summarizeErrorForLog } from '../../utils/errors';

export interface OrchestratorEventBinderDeps {
    getScheduler: () => IChannelScheduler | null;
    getVideoPlayer: () => IVideoPlayer | null;
    getPlexLibrary: () => IPlexLibrary | null;
    getPlexStreamResolver: () => IPlexStreamResolver | null;
    getNavigation: () => INavigationManager | null;
    getLifecycle: () => IAppLifecycle | null;
    getChannelManager: () => IChannelManager | null;
    wireNavigationCoordinatorEvents: () => Array<() => void>;
    wireEpgCoordinatorEvents: () => Array<() => void>;
    handleProgramStartTracked: (program: ScheduledProgram) => Promise<void>;
    handleScheduleDayRollover: () => Promise<void>;
    handlePlayerEnded: () => void;
    handlePlayerTrackChange: (event: { type: 'audio' | 'subtitle'; trackId: string | null }) => void;
    handlePlaybackError: (error: PlaybackError) => void;
    handlePlayerStateChange: (state: PlaybackState) => void;
    handlePlayerTimeUpdate: (payload: { currentTimeMs: number; durationMs: number }) => void;
    handlePlayerBufferUpdate: (payload: { percent: number; bufferedRanges: TimeRange[] }) => void;
    handlePlexLibraryAuthExpired: () => void;
    handlePlexStreamError: (error: StreamResolverError) => void;
    handleScreenChange: (payload: { from: Screen; to: Screen }) => void;
    handleLifecyclePause: () => Promise<void>;
    handleLifecycleResume: () => Promise<void>;
    reportPersistenceWarning: (message: string) => void;
}

export class OrchestratorEventBinder {
    private _cleanups: Array<() => void> = [];
    private _wired = false;

    constructor(private readonly _deps: OrchestratorEventBinderDeps) {}

    public bind(): void {
        if (this._wired) {
            return;
        }

        const cleanups: Array<() => void> = [];

        try {
            this._wireSchedulerEvents(cleanups);
            this._wirePlayerEvents(cleanups);
            this._wirePlexEvents(cleanups);
            this._wireNavigationEvents(cleanups);
            this._wireEpgEvents(cleanups);
            this._wireChannelManagerEvents(cleanups);
            this._wireLifecycleEvents(cleanups);
            this._cleanups = cleanups;
            this._wired = true;
        } catch (error) {
            this._runCleanups(cleanups);
            throw error;
        }
    }

    public dispose(onCleanupError?: (error: unknown) => void): void {
        const cleanups = this._cleanups;
        try {
            this._runCleanups(cleanups, onCleanupError);
        } finally {
            this._cleanups = [];
            this._wired = false;
        }
    }

    private _runCleanups(
        cleanups: Array<() => void>,
        onCleanupError?: (error: unknown) => void
    ): void {
        const cleanupFailures: Array<{ step: string; error: unknown }> = [];

        for (let i = cleanups.length - 1; i >= 0; i--) {
            const cleanup = cleanups[i]!;
            try {
                cleanup();
            } catch (cleanupError) {
                if (onCleanupError) {
                    try {
                        onCleanupError(cleanupError);
                    } catch (onCleanupErrorFailure) {
                        cleanupFailures.push({
                            step: 'event-wiring.onCleanupError',
                            error: summarizeErrorForLog(onCleanupErrorFailure),
                        });
                    }
                    continue;
                }

                cleanupFailures.push({
                    step: 'event-wiring.cleanup',
                    error: summarizeErrorForLog(cleanupError),
                });
            }
        }

        const onCleanupErrorFailed = cleanupFailures.some(
            (failure) => failure.step === 'event-wiring.onCleanupError'
        );

        if ((onCleanupErrorFailed || !onCleanupError) && cleanupFailures.length > 0) {
            console.warn('[Orchestrator] Event wiring rollback failures:', cleanupFailures);
        }

    }

    private _wireSchedulerEvents(cleanups: Array<() => void>): void {
        const scheduler = this._deps.getScheduler();
        if (!scheduler) return;

        const programStartHandler = (program: ScheduledProgram): void => {
            this._deps.handleProgramStartTracked(program).catch((error) => {
                console.error('[Orchestrator] Unhandled error in program start:', summarizeErrorForLog(error));
            });
        };
        scheduler.on('programStart', programStartHandler);
        cleanups.push(() => {
            scheduler.off('programStart', programStartHandler);
        });

        const scheduleSyncHandler = (): void => {
            this._deps.handleScheduleDayRollover().catch((error) => {
                console.error('[Orchestrator] Unhandled error in scheduleSync handler:', summarizeErrorForLog(error));
            });
        };
        scheduler.on('scheduleSync', scheduleSyncHandler);
        cleanups.push(() => {
            scheduler.off('scheduleSync', scheduleSyncHandler);
        });
    }

    private _wirePlayerEvents(cleanups: Array<() => void>): void {
        const videoPlayer = this._deps.getVideoPlayer();
        if (!videoPlayer) return;

        const endedHandler = (): void => {
            this._deps.handlePlayerEnded();
        };
        const trackChangeHandler = (event: { type: 'audio' | 'subtitle'; trackId: string | null }): void => {
            this._deps.handlePlayerTrackChange(event);
        };
        const errorHandler = (error: PlaybackError): void => {
            this._deps.handlePlaybackError(error);
        };
        const stateChangeHandler = (state: PlaybackState): void => {
            this._deps.handlePlayerStateChange(state);
        };
        const timeUpdateHandler = (payload: { currentTimeMs: number; durationMs: number }): void => {
            this._deps.handlePlayerTimeUpdate(payload);
        };
        const bufferUpdateHandler = (payload: { percent: number; bufferedRanges: TimeRange[] }): void => {
            this._deps.handlePlayerBufferUpdate(payload);
        };

        videoPlayer.on('ended', endedHandler);
        cleanups.push(() => {
            videoPlayer.off('ended', endedHandler);
        });
        videoPlayer.on('trackChange', trackChangeHandler);
        cleanups.push(() => {
            videoPlayer.off('trackChange', trackChangeHandler);
        });
        videoPlayer.on('error', errorHandler);
        cleanups.push(() => {
            videoPlayer.off('error', errorHandler);
        });
        videoPlayer.on('stateChange', stateChangeHandler);
        cleanups.push(() => {
            videoPlayer.off('stateChange', stateChangeHandler);
        });
        videoPlayer.on('timeUpdate', timeUpdateHandler);
        cleanups.push(() => {
            videoPlayer.off('timeUpdate', timeUpdateHandler);
        });
        videoPlayer.on('bufferUpdate', bufferUpdateHandler);
        cleanups.push(() => {
            videoPlayer.off('bufferUpdate', bufferUpdateHandler);
        });
    }

    private _wirePlexEvents(cleanups: Array<() => void>): void {
        const plexLibrary = this._deps.getPlexLibrary();
        if (plexLibrary) {
            const authExpiredHandler = (): void => {
                this._deps.handlePlexLibraryAuthExpired();
            };
            plexLibrary.on('authExpired', authExpiredHandler);
            cleanups.push(() => {
                plexLibrary.off('authExpired', authExpiredHandler);
            });
        }

        const plexStreamResolver = this._deps.getPlexStreamResolver();
        if (plexStreamResolver) {
            const plexStreamErrorHandler = (error: StreamResolverError): void => {
                this._deps.handlePlexStreamError(error);
            };
            plexStreamResolver.on('error', plexStreamErrorHandler);
            cleanups.push(() => {
                plexStreamResolver.off('error', plexStreamErrorHandler);
            });
        }
    }

    private _wireNavigationEvents(cleanups: Array<() => void>): void {
        cleanups.push(...this._deps.wireNavigationCoordinatorEvents());
        const navigation = this._deps.getNavigation();
        if (!navigation) {
            return;
        }

        const screenChangeHandler = (payload: { from: Screen; to: Screen }): void => {
            this._deps.handleScreenChange(payload);
        };
        navigation.on('screenChange', screenChangeHandler);
        cleanups.push(() => {
            navigation.off('screenChange', screenChangeHandler);
        });
    }

    private _wireEpgEvents(cleanups: Array<() => void>): void {
        cleanups.push(...this._deps.wireEpgCoordinatorEvents());
    }

    private _wireChannelManagerEvents(cleanups: Array<() => void>): void {
        const channelManager = this._deps.getChannelManager();
        if (!channelManager) {
            return;
        }
        const sub = channelManager.on('persistenceWarning', ({ message }) => {
            this._deps.reportPersistenceWarning(message);
        });
        cleanups.push(() => {
            if (sub && typeof (sub as { dispose?: unknown }).dispose === 'function') {
                (sub as { dispose: () => void }).dispose();
            }
        });
    }

    private _wireLifecycleEvents(cleanups: Array<() => void>): void {
        const lifecycle = this._deps.getLifecycle();
        if (!lifecycle) return;

        const pauseSub = lifecycle.onPause(() => {
            return this._deps.handleLifecyclePause().catch((error) => {
                console.error('[Orchestrator] Unhandled error in lifecycle pause handler:', summarizeErrorForLog(error));
            });
        });
        cleanups.push(() => pauseSub.dispose());

        const resumeSub = lifecycle.onResume(() => {
            return this._deps.handleLifecycleResume().catch((error) => {
                console.error('[Orchestrator] Unhandled error in lifecycle resume handler:', summarizeErrorForLog(error));
            });
        });
        cleanups.push(() => resumeSub.dispose());
    }
}
