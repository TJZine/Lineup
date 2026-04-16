import type { ChannelSetupWorkflowPort } from '../../../core/channel-setup/ChannelSetupWorkflowPort';
import type {
    ChannelSetupPreview,
    ChannelSetupContext,
} from '../../../core/channel-setup/types';
import { isAbortLikeError } from '../../../utils/errors';
import { CHANNEL_SETUP_PREVIEW_DEBOUNCE_MS } from './constants';
import type {
    ChannelSetupBuildHandlers,
    ChannelSetupBuildOutcome,
    EstimateKey,
} from './ChannelSetupSessionContracts';
import type { ChannelSetupSessionState } from './ChannelSetupSessionState';

export class ChannelSetupSessionRuntime {
    private static readonly PREVIEW_TIMEOUT_MS = 15000;

    private _buildAbortController: AbortController | null = null;
    private _loadAbortController: AbortController | null = null;
    private _previewAbortController: AbortController | null = null;
    private _reviewAbortController: AbortController | null = null;
    private _previewTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _previewRequestTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _previewDeltaTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly _deps: {
            workflowPort: ChannelSetupWorkflowPort;
            getSelectedServerId: () => string | null;
            state: ChannelSetupSessionState;
        }
    ) {}

    beginSession(): void {
        this._deps.state.sessionToken += 1;
        this._resetState();
        this._deps.workflowPort.invalidateFacetSnapshot();
    }

    endSession(): void {
        this._deps.state.sessionToken += 1;
        this._cleanupPlanningAsyncState();
        this._loadAbortController?.abort();
        this._loadAbortController = null;
        this._buildAbortController?.abort();
        this._buildAbortController = null;
        this._deps.state.isLoading = false;
        this._deps.state.isBuilding = false;
    }

    async loadLibraries(): Promise<void> {
        const state = this._deps.state;
        const token = state.sessionToken;
        if (state.isLoading) {
            return;
        }
        state.isLoading = true;
        state.loadError = null;
        this._loadAbortController?.abort();
        const loadAbortController = new AbortController();
        this._loadAbortController = loadAbortController;

        try {
            const libraries = await this._deps.workflowPort.getLibrariesForSetup(loadAbortController.signal);
            if (token !== state.sessionToken) {
                return;
            }

            state.libraries = libraries;
            this._cleanupPlanningAsyncState();
            state.clearDerivedPlanningState();
            this._deps.workflowPort.invalidateFacetSnapshot();
            const serverId = this._deps.getSelectedServerId();
            const record = serverId ? this._deps.workflowPort.getChannelSetupRecord(serverId) : null;
            if (record) {
                state.applySetupRecord(record);
            } else {
                state.selectedLibraryIds = new Set(state.libraries.map((lib) => lib.id));
            }
            state.recordApplied = true;
        } catch (error) {
            if (token !== state.sessionToken) {
                return;
            }
            if (isAbortLikeError(error, loadAbortController.signal)) {
                return;
            }
            state.libraries = [];
            state.selectedLibraryIds = new Set();
            state.recordApplied = false;
            state.loadError = error instanceof Error ? error.message : 'Unable to load libraries.';
        } finally {
            if (this._loadAbortController === loadAbortController) {
                this._loadAbortController = null;
            }
            if (token === state.sessionToken) {
                state.isLoading = false;
            }
        }
    }

    syncSetupContext(): void {
        const state = this._deps.state;
        try {
            const context = this._deps.workflowPort.getSetupContextForSelectedServer();
            if (context === 'first-time' || context === 'existing' || context === 'unknown') {
                state.setupContext = context as ChannelSetupContext;
                return;
            }
        } catch {
            // Ignore and fall back to unknown.
        }
        state.setupContext = 'unknown';
    }

    setStep(step: 1 | 2 | 3): void {
        const state = this._deps.state;
        state.step = step;
        if (step !== 2) {
            this._cleanupPlanningAsyncState();
        }
        if (step === 3) {
            state.isBuilding = state.setupContext === 'first-time';
        } else {
            state.isBuilding = false;
        }
    }

    beginConfirmedBuild(): void {
        const state = this._deps.state;
        state.step = 3;
        state.isBuilding = true;
    }

    clearReviewAndReturnToStep2(): void {
        this._reviewAbortController?.abort();
        const state = this._deps.state;
        state.review = null;
        state.reviewError = null;
        state.replaceConfirm = false;
        state.step = 2;
    }

    schedulePreview(onStateChange: () => void): void {
        const state = this._deps.state;
        if (state.step !== 2) {
            return;
        }
        const serverId = this._deps.getSelectedServerId();
        if (!serverId) {
            state.previewError = 'No server selected.';
            state.previewStatus = 'error';
            return;
        }

        const key = state.buildPreviewKey(state.buildConfig(serverId));
        if (state.hasSettledPreviewForKey(key)) {
            return;
        }
        if (state.isPreviewLoading && key === state.pendingPreviewKey) {
            return;
        }

        state.pendingPreviewKey = key;
        if (this._previewTimeoutId !== null) {
            clearTimeout(this._previewTimeoutId);
        }
        this._previewTimeoutId = setTimeout(() => {
            void this._refreshPreview(onStateChange);
        }, CHANNEL_SETUP_PREVIEW_DEBOUNCE_MS);
    }

    async ensureReviewLoaded(onStateChange: () => void): Promise<void> {
        const state = this._deps.state;
        const token = state.sessionToken;
        const serverId = this._deps.getSelectedServerId();
        if (!serverId) {
            state.reviewError = 'No server selected.';
            onStateChange();
            return;
        }
        if (state.isReviewLoading || state.review) {
            return;
        }

        this._reviewAbortController?.abort();
        const reviewAbortController = new AbortController();
        this._reviewAbortController = reviewAbortController;
        state.isReviewLoading = true;
        state.reviewError = null;
        let stateChangeError: unknown = null;
        const shouldFetchReview = (): boolean => stateChangeError === null;
        const emitStateChange = (): void => {
            try {
                onStateChange();
            } catch (error) {
                if (stateChangeError === null) {
                    stateChangeError = error;
                }
            }
        };
        emitStateChange();

        try {
            if (shouldFetchReview()) {
                const review = await this._deps.workflowPort.getSetupReview(state.buildConfig(serverId), {
                    signal: reviewAbortController.signal,
                });
                if (token !== state.sessionToken) return;
                state.review = review;
            }
        } catch (error) {
            if (token !== state.sessionToken) return;
            if (isAbortLikeError(error, reviewAbortController.signal)) {
                return;
            }
            state.reviewError = error instanceof Error ? error.message : 'Unable to load review.';
            state.review = null;
        } finally {
            if (token === state.sessionToken) {
                state.isReviewLoading = false;
                if (this._reviewAbortController === reviewAbortController) {
                    this._reviewAbortController = null;
                }
                emitStateChange();
            }
        }
        if (stateChangeError !== null) {
            throw stateChangeError;
        }
    }

    async beginBuild(
        options: ChannelSetupBuildHandlers
    ): Promise<ChannelSetupBuildOutcome> {
        const state = this._deps.state;
        if (this._buildAbortController) {
            return { kind: 'canceled' };
        }

        const token = state.sessionToken;
        const serverId = this._deps.getSelectedServerId();
        if (!serverId) {
            state.isBuilding = false;
            return { kind: 'missing-server' };
        }

        state.isBuilding = true;
        const buildAbortController = new AbortController();
        this._buildAbortController = buildAbortController;
        options.onStateChange();

        const config = state.buildConfig(serverId);

        try {
            const result = await this._deps.workflowPort.createChannelsFromSetup(config, {
                signal: buildAbortController.signal,
                onProgress: options.onProgress,
            });

            if (token !== state.sessionToken) {
                return { kind: 'canceled' };
            }

            if (result.blockedMessage !== undefined) {
                return { kind: 'blocked', message: result.blockedMessage };
            }

            if (result.canceled) {
                return { kind: 'canceled' };
            }

            let bookkeepingError: string | undefined;
            try {
                this._deps.workflowPort.markSetupComplete(serverId, config);
            } catch (error) {
                if (isAbortLikeError(error, buildAbortController.signal)) {
                    return { kind: 'canceled' };
                }
                bookkeepingError = error instanceof Error ? error.message : 'Unable to save setup completion.';
            }
            return {
                kind: 'success',
                serverId,
                config,
                result,
                ...(bookkeepingError !== undefined ? { bookkeepingError } : {}),
            };
        } catch (error) {
            if (token !== state.sessionToken) {
                return { kind: 'canceled' };
            }
            if (isAbortLikeError(error, buildAbortController.signal)) {
                return { kind: 'canceled' };
            }
            const message = error instanceof Error ? error.message : 'Build failed.';
            return { kind: 'error', message };
        } finally {
            if (token === state.sessionToken) {
                state.isBuilding = false;
                if (this._buildAbortController === buildAbortController) {
                    this._buildAbortController = null;
                }
                options.onStateChange();
            }
        }
    }

    cancelBuild(): boolean {
        if (!this._buildAbortController) {
            return false;
        }
        this._buildAbortController.abort();
        return true;
    }

    private async _refreshPreview(onStateChange: () => void): Promise<void> {
        const state = this._deps.state;
        if (state.step !== 2) return;

        const token = state.sessionToken;
        const serverId = this._deps.getSelectedServerId();
        if (!serverId) {
            state.previewError = 'No server selected.';
            state.preview = null;
            this._clearPreviewDeltas();
            state.isPreviewLoading = false;
            state.pendingPreviewKey = null;
            onStateChange();
            return;
        }

        const config = state.buildConfig(serverId);
        const key = state.buildPreviewKey(config);
        if (state.hasSettledPreviewForKey(key)) {
            return;
        }
        if (state.pendingPreviewKey === key) {
            state.pendingPreviewKey = null;
        }

        this._previewAbortController?.abort();
        const previewAbortController = new AbortController();
        this._previewAbortController = previewAbortController;
        state.isPreviewLoading = true;
        state.previewError = null;
        state.previewStatus = 'loading';
        if (this._previewRequestTimeoutId !== null) {
            clearTimeout(this._previewRequestTimeoutId);
            this._previewRequestTimeoutId = null;
        }
        this._previewRequestTimeoutId = setTimeout(() => {
            if (token !== state.sessionToken) return;
            if (this._previewAbortController !== previewAbortController) return;
            this._previewAbortController = null;
            state.isPreviewLoading = false;
            state.lastPreviewKey = key;
            state.preview = null;
            state.previewError = 'Estimating channels is taking too long. Try again in a moment or reduce the selected libraries.';
            state.previewStatus = 'slow';
            this._clearPreviewDeltas();
            previewAbortController.abort();
            if (state.step === 2) {
                onStateChange();
            }
        }, ChannelSetupSessionRuntime.PREVIEW_TIMEOUT_MS);
        onStateChange();

        try {
            const preview = await this._deps.workflowPort.getSetupPreview(config, {
                signal: previewAbortController.signal,
            });
            if (token !== state.sessionToken) return;
            if (this._previewAbortController !== previewAbortController) return;
            if (this._previewRequestTimeoutId !== null) {
                clearTimeout(this._previewRequestTimeoutId);
                this._previewRequestTimeoutId = null;
            }
            if (preview.status === 'blocked' || preview.status === 'slow') {
                state.preview = null;
                state.previewError = preview.message ?? 'Unable to estimate channels.';
                state.previewStatus = preview.status;
                state.lastPreviewKey = key;
                this._clearPreviewDeltas();
                return;
            }
            const prevEstimates = state.preview?.estimates ?? null;
            state.preview = preview;
            state.lastPreviewKey = key;
            state.previewStatus = 'ready';
            if (prevEstimates) {
                this._setPreviewDeltas(prevEstimates, preview.estimates, onStateChange);
            } else {
                this._clearPreviewDeltas();
            }
        } catch (error) {
            if (token !== state.sessionToken) return;
            if (this._previewAbortController !== previewAbortController) return;
            if (isAbortLikeError(error, previewAbortController.signal)) {
                return;
            }
            if (this._previewRequestTimeoutId !== null) {
                clearTimeout(this._previewRequestTimeoutId);
                this._previewRequestTimeoutId = null;
            }
            state.previewError = error instanceof Error ? error.message : 'Unable to estimate channels.';
            state.lastPreviewKey = key;
            state.preview = null;
            state.previewStatus = 'error';
            this._clearPreviewDeltas();
        } finally {
            if (token === state.sessionToken && this._previewAbortController === previewAbortController) {
                if (this._previewRequestTimeoutId !== null) {
                    clearTimeout(this._previewRequestTimeoutId);
                    this._previewRequestTimeoutId = null;
                }
                state.isPreviewLoading = false;
                if (state.step === 2) {
                    onStateChange();
                }
            }
        }
    }

    private _resetState(): void {
        const state = this._deps.state;
        this._loadAbortController?.abort();
        this._buildAbortController?.abort();
        this._previewAbortController?.abort();
        this._reviewAbortController?.abort();
        this._loadAbortController = null;
        this._buildAbortController = null;
        this._previewAbortController = null;
        this._reviewAbortController = null;
        if (this._previewTimeoutId !== null) {
            clearTimeout(this._previewTimeoutId);
            this._previewTimeoutId = null;
        }
        if (this._previewRequestTimeoutId !== null) {
            clearTimeout(this._previewRequestTimeoutId);
            this._previewRequestTimeoutId = null;
        }
        this._clearPreviewDeltas();
        state.resetForNewSession();
    }

    private _cleanupPlanningAsyncState(): void {
        const state = this._deps.state;
        this._previewAbortController?.abort();
        this._reviewAbortController?.abort();
        this._previewAbortController = null;
        this._reviewAbortController = null;
        if (this._previewTimeoutId !== null) {
            clearTimeout(this._previewTimeoutId);
            this._previewTimeoutId = null;
        }
        if (this._previewRequestTimeoutId !== null) {
            clearTimeout(this._previewRequestTimeoutId);
            this._previewRequestTimeoutId = null;
        }
        state.pendingPreviewKey = null;
        state.isPreviewLoading = false;
        state.previewStatus = 'idle';
        state.isReviewLoading = false;
        this._clearPreviewDeltas();
    }

    private _clearPreviewDeltas(): void {
        const state = this._deps.state;
        if (this._previewDeltaTimeoutId !== null) {
            clearTimeout(this._previewDeltaTimeoutId);
            this._previewDeltaTimeoutId = null;
        }
        state.clearPreviewDeltas();
    }

    private _setPreviewDeltas(
        prev: ChannelSetupPreview['estimates'],
        next: ChannelSetupPreview['estimates'],
        onStateChange: () => void
    ): void {
        const state = this._deps.state;
        const keys = Object.keys(next) as EstimateKey[];
        const deltas: Partial<Record<EstimateKey, number>> = {};
        for (const key of keys) {
            const a = prev[key];
            const b = next[key];
            if (typeof a === 'number' && typeof b === 'number') {
                const delta = b - a;
                if (delta !== 0) {
                    deltas[key] = delta;
                }
            }
        }

        state.previewDeltas = deltas;
        state.previewDeltaExpiresAtMs = Date.now() + 3000;
        if (this._previewDeltaTimeoutId !== null) {
            clearTimeout(this._previewDeltaTimeoutId);
            this._previewDeltaTimeoutId = null;
        }

        if (Object.keys(deltas).length > 0) {
            const token = state.sessionToken;
            this._previewDeltaTimeoutId = setTimeout(() => {
                if (token !== state.sessionToken) return;
                this._clearPreviewDeltas();
                if (state.step === 2) {
                    onStateChange();
                }
            }, 3000);
        }
    }
}
