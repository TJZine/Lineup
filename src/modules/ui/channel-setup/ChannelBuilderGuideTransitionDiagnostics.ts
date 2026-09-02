import { APP_SHELL_CONTAINER_IDS } from '../common/appShellContainerIds';
import { EPG_CONTAINER_ID } from '../epg/constants';
import { CLASSIC_EPG_PIP_CLASS } from '../epg/startup/EPGStartupConfigRuntime';

type AppendTransitionDiagnostic = (event: string, data: unknown) => void;

const MAX_EVENTS_PER_ATTEMPT = 20;
const DIAGNOSTIC_CLEANUP_DEADLINE_MS = 30_000;

const safeRect = (element: Element | null): { x: number; y: number; width: number; height: number } | null => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
};

export class ChannelBuilderGuideTransitionDiagnostics {
    private _attempt = 0;
    private _startedAt = 0;
    private _eventCount = 0;
    private _lastElapsedMs = 0;
    private _video: HTMLVideoElement | null = null;
    private _lastObservedTime = 0;
    private _readyRecorded = false;
    private _playingRecorded = false;
    private _advancingRecorded = false;
    private _guideShown = false;
    private _cleanupTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly _append: AppendTransitionDiagnostic,
        private readonly _onClose: () => void = () => undefined
    ) {}

    begin(): void {
        this.close('superseded');
        this._attempt += 1;
        this._startedAt = Date.now();
        this._eventCount = 0;
        this._lastElapsedMs = 0;
        this._readyRecorded = false;
        this._playingRecorded = false;
        this._advancingRecorded = false;
        this._guideShown = false;
        this._video = document.getElementById('lineup-video-player') instanceof HTMLVideoElement
            ? document.getElementById('lineup-video-player') as HTMLVideoElement
            : null;
        this._lastObservedTime = this._video?.currentTime ?? 0;
        this.record('done-switch-request', {
            readiness: this._video && this._video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 'ready' : 'pending',
            readyState: this._video?.readyState ?? 0,
            videoWidth: this._video?.videoWidth ?? 0,
            videoHeight: this._video?.videoHeight ?? 0,
        });
        this._video?.addEventListener('loadeddata', this._onReadiness);
        this._video?.addEventListener('canplay', this._onReadiness);
        this._video?.addEventListener('playing', this._onPlaying);
        this._video?.addEventListener('timeupdate', this._onTimeUpdate);
        this._video?.addEventListener('error', this._onError);
        this._cleanupTimer = setTimeout(() => {
            this.record('diagnostic-cleanup-deadline');
            this.close('diagnostic-timeout');
        }, DIAGNOSTIC_CLEANUP_DEADLINE_MS);
        if (this._video && this._video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            this._recordReady();
        }
    }

    record(event: string, data: Record<string, boolean | number | string | null> = {}): void {
        if (this._startedAt === 0 || this._eventCount >= MAX_EVENTS_PER_ATTEMPT) return;
        this._eventCount += 1;
        this._lastElapsedMs = Math.max(this._lastElapsedMs, Date.now() - this._startedAt, 0);
        this._append(event, {
            attempt: this._attempt,
            elapsedMs: this._lastElapsedMs,
            ...data,
        });
    }

    recordGuideShown(): void {
        const videoContainer = document.getElementById(APP_SHELL_CONTAINER_IDS.VIDEO);
        const video = this._video;
        const epg = document.getElementById(EPG_CONTAINER_ID);
        this.record('guide-show', {
            visible: epg?.classList.contains('visible') ?? false,
            pipClass: videoContainer?.classList.contains(CLASSIC_EPG_PIP_CLASS) ?? false,
        });
        this.record('pip-presentation', {
            pipClass: videoContainer?.classList.contains(CLASSIC_EPG_PIP_CLASS) ?? false,
            videoRectX: safeRect(video)?.x ?? 0,
            videoRectY: safeRect(video)?.y ?? 0,
            videoRectWidth: safeRect(video)?.width ?? 0,
            videoRectHeight: safeRect(video)?.height ?? 0,
            containerRectX: safeRect(videoContainer)?.x ?? 0,
            containerRectY: safeRect(videoContainer)?.y ?? 0,
            containerRectWidth: safeRect(videoContainer)?.width ?? 0,
            containerRectHeight: safeRect(videoContainer)?.height ?? 0,
        });
        this._guideShown = true;
        if (!video) {
            this.record('media-failure', { reason: 'media-element-missing' });
            this.close('failure');
            return;
        }
        this._closeAfterMediaSignals();
    }

    close(outcome: 'success' | 'failure' | 'canceled' | 'superseded' | 'diagnostic-timeout'): void {
        if (this._startedAt === 0) return;
        this.record('attempt-settled', { outcome });
        this._video?.removeEventListener('loadeddata', this._onReadiness);
        this._video?.removeEventListener('canplay', this._onReadiness);
        this._video?.removeEventListener('playing', this._onPlaying);
        this._video?.removeEventListener('timeupdate', this._onTimeUpdate);
        this._video?.removeEventListener('error', this._onError);
        if (this._cleanupTimer !== null) {
            clearTimeout(this._cleanupTimer);
            this._cleanupTimer = null;
        }
        this._video = null;
        this._startedAt = 0;
        this._onClose();
    }

    private readonly _onReadiness = (): void => this._recordReady();

    private readonly _onPlaying = (): void => {
        if (this._playingRecorded) return;
        this._playingRecorded = true;
        this.record('first-playing', {
            readyState: this._video?.readyState ?? 0,
            paused: this._video?.paused ?? true,
        });
        this._closeAfterMediaSignals();
    };

    private readonly _onTimeUpdate = (): void => {
        if (this._advancingRecorded || !this._video) return;
        if (this._video.currentTime < this._lastObservedTime) {
            this._lastObservedTime = this._video.currentTime;
            return;
        }
        if (this._video.currentTime <= this._lastObservedTime) return;
        this._lastObservedTime = this._video.currentTime;
        this._advancingRecorded = true;
        this.record('first-advancing-time', {
            currentTime: this._video.currentTime,
            readyState: this._video.readyState,
        });
        this._closeAfterMediaSignals();
    };

    private readonly _onError = (): void => {
        this.record('media-failure', { code: this._video?.error?.code ?? 0 });
        this.close('failure');
    };

    private _recordReady(): void {
        if (this._readyRecorded) return;
        this._readyRecorded = true;
        this.record('readiness-ready', {
            readyState: this._video?.readyState ?? 0,
            videoWidth: this._video?.videoWidth ?? 0,
            videoHeight: this._video?.videoHeight ?? 0,
        });
    }

    private _closeAfterMediaSignals(): void {
        if (this._guideShown && this._playingRecorded && this._advancingRecorded) {
            this.close('success');
        }
    }
}
