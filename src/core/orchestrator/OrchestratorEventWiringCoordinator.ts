import type { IAppLifecycle } from '../../modules/lifecycle';
import type { INavigationManager } from '../../modules/navigation';
import type {
    IPlexLibrary,
} from '../../modules/plex/library';
import type {
    IPlexStreamResolver,
    StreamResolverError,
} from '../../modules/plex/stream';
import type {
    IVideoPlayer,
    PlaybackError,
    PlaybackState,
    TimeRange,
} from '../../modules/player';
import type {
    IChannelScheduler,
    ScheduledProgram,
} from '../../modules/scheduler/scheduler';
import { summarizeErrorForLog } from '../../utils/errors';

export interface OrchestratorEventWiringDeps {
    getScheduler: () => IChannelScheduler | null;
    getVideoPlayer: () => IVideoPlayer | null;
    getPlexLibrary: () => IPlexLibrary | null;
    getPlexStreamResolver: () => IPlexStreamResolver | null;
    getNavigation: () => INavigationManager | null;
    getLifecycle: () => IAppLifecycle | null;
    wireNavigationEvents: () => Array<() => void>;
    wireEpgEvents: () => Array<() => void>;
    onProgramStart: (program: ScheduledProgram) => Promise<void>;
    onScheduleSync: () => Promise<void>;
    onPlayerEnded: () => void;
    onPlayerTrackChange: (event: { type: 'audio' | 'subtitle'; trackId: string | null }) => void;
    onPlaybackError: (error: PlaybackError) => void;
    onPlayerStateChange: (state: PlaybackState) => void;
    onPlayerTimeUpdate: (payload: { currentTimeMs: number; durationMs: number }) => void;
    onPlayerBufferUpdate: (payload: { percent: number; bufferedRanges: TimeRange[] }) => void;
    onPlexLibraryAuthExpired: () => void;
    onPlexStreamError: (error: StreamResolverError) => void;
    onScreenChange: (payload: { from: string; to: string }) => void;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
}

export class OrchestratorEventWiringCoordinator {
    constructor(private readonly _deps: OrchestratorEventWiringDeps) {}

    setupCoreEvents(): Array<() => void> {
        const cleanups: Array<() => void> = [];
        this._wireSchedulerEvents(cleanups);
        this._wirePlayerEvents(cleanups);
        this._wirePlexEvents(cleanups);
        this._wireNavigationEvents(cleanups);
        this._wireEpgEvents(cleanups);
        this._wireLifecycleEvents(cleanups);
        return cleanups;
    }

    private _wireSchedulerEvents(cleanups: Array<() => void>): void {
        const scheduler = this._deps.getScheduler();
        if (!scheduler) return;

        const programStartHandler = (program: ScheduledProgram): void => {
            this._deps.onProgramStart(program).catch((error) => {
                console.error('[Orchestrator] Unhandled error in program start:', summarizeErrorForLog(error));
            });
        };
        scheduler.on('programStart', programStartHandler);

        const scheduleSyncHandler = (): void => {
            this._deps.onScheduleSync().catch((error) => {
                console.error('[Orchestrator] Unhandled error in scheduleSync handler:', summarizeErrorForLog(error));
            });
        };
        scheduler.on('scheduleSync', scheduleSyncHandler);

        cleanups.push(() => {
            scheduler.off('programStart', programStartHandler);
            scheduler.off('scheduleSync', scheduleSyncHandler);
        });
    }

    private _wirePlayerEvents(cleanups: Array<() => void>): void {
        const videoPlayer = this._deps.getVideoPlayer();
        if (!videoPlayer) return;

        const endedHandler = (): void => {
            this._deps.onPlayerEnded();
        };
        const trackChangeHandler = (event: { type: 'audio' | 'subtitle'; trackId: string | null }): void => {
            this._deps.onPlayerTrackChange(event);
        };

        const errorHandler = (error: PlaybackError): void => {
            this._deps.onPlaybackError(error);
        };

        const stateChangeHandler = (state: PlaybackState): void => {
            this._deps.onPlayerStateChange(state);
        };

        const timeUpdateHandler = (payload: { currentTimeMs: number; durationMs: number }): void => {
            this._deps.onPlayerTimeUpdate(payload);
        };

        const bufferUpdateHandler = (payload: { percent: number; bufferedRanges: TimeRange[] }): void => {
            this._deps.onPlayerBufferUpdate(payload);
        };

        videoPlayer.on('ended', endedHandler);
        videoPlayer.on('trackChange', trackChangeHandler);
        videoPlayer.on('error', errorHandler);
        videoPlayer.on('stateChange', stateChangeHandler);
        videoPlayer.on('timeUpdate', timeUpdateHandler);
        videoPlayer.on('bufferUpdate', bufferUpdateHandler);

        cleanups.push(() => {
            videoPlayer.off('ended', endedHandler);
            videoPlayer.off('trackChange', trackChangeHandler);
            videoPlayer.off('error', errorHandler);
            videoPlayer.off('stateChange', stateChangeHandler);
            videoPlayer.off('timeUpdate', timeUpdateHandler);
            videoPlayer.off('bufferUpdate', bufferUpdateHandler);
        });
    }

    private _wirePlexEvents(cleanups: Array<() => void>): void {
        const plexLibrary = this._deps.getPlexLibrary();
        if (plexLibrary) {
            const authExpiredHandler = (): void => {
                this._deps.onPlexLibraryAuthExpired();
            };
            plexLibrary.on('authExpired', authExpiredHandler);
            cleanups.push(() => {
                plexLibrary.off('authExpired', authExpiredHandler);
            });
        }

        const plexStreamResolver = this._deps.getPlexStreamResolver();
        if (plexStreamResolver) {
            const plexStreamErrorHandler = (error: StreamResolverError): void => {
                this._deps.onPlexStreamError(error);
            };
            plexStreamResolver.on('error', plexStreamErrorHandler);
            cleanups.push(() => {
                plexStreamResolver.off('error', plexStreamErrorHandler);
            });
        }
    }

    private _wireNavigationEvents(cleanups: Array<() => void>): void {
        cleanups.push(...this._deps.wireNavigationEvents());
        const navigation = this._deps.getNavigation();
        if (!navigation) {
            return;
        }

        const screenChangeHandler = (payload: { from: string; to: string }): void => {
            this._deps.onScreenChange(payload);
        };
        navigation.on('screenChange', screenChangeHandler);
        cleanups.push(() => {
            navigation.off('screenChange', screenChangeHandler);
        });
    }

    private _wireEpgEvents(cleanups: Array<() => void>): void {
        cleanups.push(...this._deps.wireEpgEvents());
    }

    private _wireLifecycleEvents(cleanups: Array<() => void>): void {
        const lifecycle = this._deps.getLifecycle();
        if (!lifecycle) return;

        const pauseSub = lifecycle.onPause(() => {
            return this._deps.onPause().catch((error) => {
                console.error('[Orchestrator] Unhandled error in lifecycle pause handler:', summarizeErrorForLog(error));
            });
        });

        const resumeSub = lifecycle.onResume(() => {
            return this._deps.onResume().catch((error) => {
                console.error('[Orchestrator] Unhandled error in lifecycle resume handler:', summarizeErrorForLog(error));
            });
        });

        cleanups.push(() => pauseSub.dispose());
        cleanups.push(() => resumeSub.dispose());
    }
}
