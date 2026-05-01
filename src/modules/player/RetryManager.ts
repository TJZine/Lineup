import type { StreamDescriptor, PlaybackError } from './types';
import { MAX_RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS, SYNTHETIC_MEDIA_ERROR_CODE_KEY } from './constants';
import { mapMediaErrorCodeToPlaybackError } from './ErrorHandler';

export class RetryManager {
    private _retryCount = 0;
    private _retryTimer: ReturnType<typeof setTimeout> | null = null;

    private _metadataTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _retryLoadCleanup: (() => void) | null = null;
    private _retryLoadGeneration = 0;

    private _videoElement: HTMLVideoElement | null = null;
    private _descriptor: StreamDescriptor | null = null;
    private _configRetryDelayMs: number = RETRY_BASE_DELAY_MS;
    private _configRetryAttempts: number = MAX_RETRY_ATTEMPTS;

    public initialize(
        videoElement: HTMLVideoElement,
        configRetryAttempts?: number,
        configRetryDelayMs?: number
    ): void {
        this._videoElement = videoElement;
        this._configRetryAttempts = configRetryAttempts ?? MAX_RETRY_ATTEMPTS;
        this._configRetryDelayMs = configRetryDelayMs ?? RETRY_BASE_DELAY_MS;
    }

    public setDescriptor(descriptor: StreamDescriptor | null): void {
        this._descriptor = descriptor;
    }

    public getRetryCount(): number {
        return this._retryCount;
    }

    /**
     * Handle a media error - determine if recoverable and schedule retry.
     * @returns The PlaybackError created from the media error
     */
    public handleMediaError(mediaErrorCode: number): PlaybackError {
        // Cap retry attempts to MAX_RETRY_ATTEMPTS (3) per spec
        const retryAttempts = Math.min(this._configRetryAttempts, MAX_RETRY_ATTEMPTS);

        const playbackError = mapMediaErrorCodeToPlaybackError(
            mediaErrorCode,
            this._retryCount,
            retryAttempts,
            this._configRetryDelayMs
        );

        if (playbackError.recoverable) {
            this._scheduleRetry(playbackError.retryAfterMs || this._configRetryDelayMs);
        }

        return playbackError;
    }

    public reset(): void {
        this._retryCount = 0;
        this.clear();
    }

    public clear(): void {
        if (this._retryTimer) {
            clearTimeout(this._retryTimer);
            this._retryTimer = null;
        }
        this._clearActiveRetryLoad();
    }

    private _clearActiveRetryLoad(): void {
        this._retryLoadGeneration++;
        const retryLoadCleanup = this._retryLoadCleanup;
        this._retryLoadCleanup = null;
        retryLoadCleanup?.();

        if (this._metadataTimeoutId) {
            clearTimeout(this._metadataTimeoutId);
            this._metadataTimeoutId = null;
        }
    }

    public destroy(): void {
        this.clear();
        this._videoElement = null;
        this._descriptor = null;
        this._retryCount = 0;
    }

    private _scheduleRetry(delayMs: number): void {
        this.clear();
        this._retryCount++;

        this._retryTimer = setTimeout(() => {
            this._retryTimer = null;
            this._retryPlayback();
        }, delayMs);
    }

    /**
     * Retry loading the current stream.
     * Mirrors VideoPlayer.loadStream logic for protocol-specific source handling.
     */
    private _retryPlayback(): void {
        if (!this._videoElement || !this._descriptor) {
            return;
        }

        // Capture current time BEFORE calling load() which resets it
        const savedTime = this._videoElement.currentTime;
        const video = this._videoElement;
        const retryLoadGeneration = this._retryLoadGeneration;

        // Clear existing sources
        while (video.firstChild) {
            video.removeChild(video.firstChild);
        }
        video.removeAttribute('src');

        // Set source based on protocol (mirror loadStream logic)
        if (this._descriptor.protocol === 'hls') {
            // Native HLS - set src directly
            video.src = this._descriptor.url;
        } else {
            // Direct play - use source element with type hint for webOS
            const source = document.createElement('source');
            source.src = this._descriptor.url;
            source.type = this._descriptor.mimeType;
            video.appendChild(source);
        }

        video.load();

        // Timeout to prevent indefinite hang if loadedmetadata/error never fires
        const METADATA_TIMEOUT_MS = 10000;

        const cleanup = (): void => {
            if (this._metadataTimeoutId) {
                clearTimeout(this._metadataTimeoutId);
                this._metadataTimeoutId = null;
            }
            if (this._retryLoadCleanup === cleanup) {
                this._retryLoadCleanup = null;
            }
            video.removeEventListener('loadedmetadata', onMetadata);
            video.removeEventListener('error', onError);
        };
        this._retryLoadCleanup = cleanup;

        const isCurrentRetryLoad = (): boolean =>
            this._retryLoadGeneration === retryLoadGeneration && this._retryLoadCleanup === cleanup;

        // Wait for loadedmetadata before seeking, as load() resets currentTime
        // (VideoPlayer.loadStream uses canplay, but loadedmetadata is sufficient for seeking)
        const onMetadata = (): void => {
            if (!isCurrentRetryLoad()) {
                return;
            }
            cleanup();
            video.currentTime = savedTime;
            video.play().catch(() => {
                // Error will be handled by error event
            });
        };

        const onError = (): void => {
            if (!isCurrentRetryLoad()) {
                return;
            }
            cleanup();
            // Error propagates through VideoPlayerEvents error handler
        };

        const onTimeout = (): void => {
            if (!isCurrentRetryLoad()) {
                return;
            }
            cleanup();
            // Trigger error path - the video element may be in a zombie state.
            // Emit a synthetic error event with a recoverable MediaError code hint (NETWORK)
            // so VideoPlayerEvents can schedule retries and emit errors consistently.
            (video as unknown as Record<string, unknown>)[SYNTHETIC_MEDIA_ERROR_CODE_KEY] = 2;
            video.dispatchEvent(new Event('error'));
        };

        this._metadataTimeoutId = setTimeout(onTimeout, METADATA_TIMEOUT_MS);
        video.addEventListener('loadedmetadata', onMetadata);
        video.addEventListener('error', onError);
    }
}
