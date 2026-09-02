import type {
    ChannelBuildProgress,
    ChannelSetupGuideRefreshSummary,
} from '../../../../core/channel-setup/types';
import { isAbortLikeError, summarizeErrorForLog } from '../../../../utils/errors';
import {
    isChannelSwitchAborted,
    isChannelSwitchFailed,
    isChannelSwitchSuccessful,
} from '../../../../types/channelSwitch';
import type { ChannelSwitchOutcome } from '../../../../types/channelSwitch';
import type { PlaybackStartOutcome } from '../../../../types/playbackStart';
import { renderCappedWarnings } from '../../common/render/renderCappedWarnings';
import { formatChannelSetupUserCopy } from '../ChannelSetupUserCopy';
import type { ChannelSetupFocusCoordinator } from '../focus/ChannelSetupFocusCoordinator';
import type { ChannelSetupScreenPorts } from '../ChannelSetupScreenPorts';
import type {
    ChannelSetupSessionSnapshot,
    EstimateKey,
} from '../ChannelSetupSessionContracts';
import type { ChannelSetupSessionController } from '../ChannelSetupSessionController';
import { BuildProgressStepController } from './BuildProgressStepController';
import { BuildReviewStepController } from './BuildReviewStepController';
import type { StepRenderContext } from '../stepContracts';
import type { BuildReviewStateSnapshot } from './types';
import { ChannelBuilderGuideTransitionDiagnostics } from '../ChannelBuilderGuideTransitionDiagnostics';

interface DoneAttempt {
    controller: AbortController;
    token: number;
    button: HTMLButtonElement;
    provisionalPlayerVisible: boolean;
    diagnostics: ChannelBuilderGuideTransitionDiagnostics;
}

export class ChannelSetupBuildStepPresenter {
    private readonly _buildReviewStep = new BuildReviewStepController();
    private readonly _buildProgressStep = new BuildProgressStepController();
    private readonly _maxPreviewWarnings = 5;
    private _lastInitialChannelNumber: number | null = null;
    private _activeDoneAttempt: DoneAttempt | null = null;
    private _diagnostics: ChannelBuilderGuideTransitionDiagnostics | null = null;

    cancelDoneTransition(): void {
        const attempt = this._activeDoneAttempt;
        if (!attempt) return;
        this._activeDoneAttempt = null;
        attempt.controller.abort();
        attempt.diagnostics.close('canceled');
    }

    dispose(): void {
        this.cancelDoneTransition();
        this._diagnostics?.close('canceled');
        this._diagnostics = null;
    }

    render(
        ctx: StepRenderContext,
        deps: {
            session: ChannelSetupSessionController;
            focus: ChannelSetupFocusCoordinator;
            screenPorts: ChannelSetupScreenPorts;
            getPreferredFocusId: () => string | null;
            setPreferredFocusId: (focusId: string | null) => void;
            getVisibilityToken: () => number;
            renderStep: () => void;
            revealPlayerProvisionally: () => void;
            restoreSetupAfterProvisionalReveal: () => void;
        }
    ): void {
        const session = deps.session.getSnapshot();
        if (session.isBuilding) {
            this._renderBuildProgress(ctx, deps);
        } else {
            this._renderBuildReview(ctx, deps);
        }
    }

    buildPreviewRow(
        session: ChannelSetupSessionSnapshot,
        label: string,
        value: number | string,
        deltaKey?: EstimateKey
    ): HTMLElement {
        const row = document.createElement('div');
        row.className = 'setup-preview-row';
        const labelEl = document.createElement('span');
        labelEl.className = 'setup-preview-label';
        labelEl.textContent = label;
        const valueEl = document.createElement('span');
        valueEl.className = 'setup-preview-value';
        const main = document.createElement('span');
        main.textContent = String(value);
        valueEl.appendChild(main);

        const now = Date.now();
        const delta = deltaKey ? session.previewDeltas[deltaKey] : undefined;
        if (typeof value === 'number' && typeof delta === 'number' && now <= session.previewDeltaExpiresAtMs) {
            const deltaEl = document.createElement('span');
            deltaEl.className = `setup-preview-delta ${delta > 0 ? 'positive' : 'negative'}`;
            deltaEl.textContent = `(${delta > 0 ? '+' : ''}${delta})`;
            valueEl.appendChild(deltaEl);
        }

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        return row;
    }

    renderCappedPreviewWarnings(warnings: string[], container: HTMLElement): void {
        renderCappedWarnings({
            warnings,
            container,
            maxItems: this._maxPreviewWarnings,
            itemClassName: 'setup-preview-warning',
        });
    }

    private _renderBuildReview(
        ctx: StepRenderContext,
        deps: {
            session: ChannelSetupSessionController;
            focus: ChannelSetupFocusCoordinator;
            getPreferredFocusId: () => string | null;
            setPreferredFocusId: (focusId: string | null) => void;
            getVisibilityToken: () => number;
            renderStep: () => void;
            revealPlayerProvisionally: () => void;
            restoreSetupAfterProvisionalReveal: () => void;
        }
    ): void {
        const getReviewState = (): BuildReviewStateSnapshot => {
            const session = deps.session.getSnapshot();
            return {
                buildMode: session.buildMode,
                review: session.review,
                reviewError: session.reviewError,
                isReviewLoading: session.isReviewLoading,
                replaceConfirm: session.replaceConfirm,
                isBuilding: session.isBuilding,
                recordApplied: session.recordApplied,
            };
        };

        this._buildReviewStep.render(ctx, {
            state: getReviewState(),
            onBackToStrategy: () => {
                deps.session.clearReviewAndReturnToStep2();
                deps.renderStep();
            },
            onConfirmBuild: () => {
                deps.session.beginConfirmedBuild();
                deps.renderStep();
            },
            onToggleReplaceConfirm: (focusId) => {
                deps.setPreferredFocusId(focusId);
                deps.session.toggleReplaceConfirm();
                deps.renderStep();
            },
            renderCappedWarnings: (warnings, container) => this.renderCappedPreviewWarnings(warnings, container),
            registerLinearFocusables: (buttons) => {
                const preferredApplied = deps.focus.registerLinear(buttons, deps.getPreferredFocusId());
                if (preferredApplied) {
                    deps.setPreferredFocusId(null);
                }
            },
        });

        this._kickOffReviewLoadPostRender(deps);
    }

    private _kickOffReviewLoadPostRender(
        deps: {
            session: ChannelSetupSessionController;
            getVisibilityToken: () => number;
            renderStep: () => void;
        }
    ): void {
        const session = deps.session.getSnapshot();
        if (
            session.step !== 3 ||
            !session.recordApplied ||
            session.isBuilding ||
            session.review ||
            session.isReviewLoading ||
            session.reviewError
        ) {
            return;
        }

        const token = deps.getVisibilityToken();
        void Promise.resolve()
            .then(() => {
                const current = deps.session.getSnapshot();
                if (
                    token !== deps.getVisibilityToken() ||
                    current.step !== 3 ||
                    current.isBuilding ||
                    current.review ||
                    current.isReviewLoading ||
                    current.reviewError
                ) {
                    return;
                }
                return deps.session.ensureReviewLoaded(() => {
                    const latest = deps.session.getSnapshot();
                    if (
                        token !== deps.getVisibilityToken() ||
                        latest.step !== 3 ||
                        latest.isBuilding
                    ) {
                        return;
                    }
                    deps.renderStep();
                });
            })
            .catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                console.warn('Load review failed:', summarizeErrorForLog(error));
            });
    }

    private _renderBuildProgress(
        ctx: StepRenderContext,
        deps: {
            session: ChannelSetupSessionController;
            focus: ChannelSetupFocusCoordinator;
            screenPorts: ChannelSetupScreenPorts;
            getPreferredFocusId: () => string | null;
            setPreferredFocusId: (focusId: string | null) => void;
            getVisibilityToken: () => number;
            renderStep: () => void;
            revealPlayerProvisionally: () => void;
            restoreSetupAfterProvisionalReveal: () => void;
        }
    ): void {
        const session = deps.session.getSnapshot();
        this._buildProgressStep.render(ctx, {
            state: { isBuilding: session.isBuilding },
            registerLinearFocusables: (buttons) => {
                const preferredApplied = deps.focus.registerLinear(buttons, deps.getPreferredFocusId());
                if (preferredApplied) {
                    deps.setPreferredFocusId(null);
                }
            },
            onCancelOrBack: (button) => {
                if (deps.session.cancelBuild()) {
                    button.disabled = true;
                    button.textContent = 'Canceling...';
                    return;
                }
                deps.session.setStep(2);
                deps.renderStep();
            },
            onDone: (doneButton) => {
                const initialChannelNumber = this._lastInitialChannelNumber;
                if (initialChannelNumber === null) {
                    ctx.errorEl.textContent = 'Channels were created, but no starting channel is available.';
                    return;
                }

                void this._startDoneTransition(ctx, initialChannelNumber, doneButton, deps);
            },
            startBuild: async (ui) => {
                await this._startBuild(ctx, deps, ui);
            },
        });
    }

    private async _startDoneTransition(
        ctx: StepRenderContext,
        initialChannelNumber: number,
        doneButton: HTMLButtonElement,
        deps: {
            screenPorts: ChannelSetupScreenPorts;
            getVisibilityToken: () => number;
            revealPlayerProvisionally: () => void;
            restoreSetupAfterProvisionalReveal: () => void;
        }
    ): Promise<void> {
        this._cancelActiveDoneAttempt(deps, true, 'superseded');
        const diagnostics = this._diagnostics ??= new ChannelBuilderGuideTransitionDiagnostics(
            (event, data) => deps.screenPorts.appendBuilderGuideDiagnostic(event, data)
        );
        diagnostics.begin();
        const attempt: DoneAttempt = {
            controller: new AbortController(),
            token: deps.getVisibilityToken(),
            button: doneButton,
            provisionalPlayerVisible: false,
            diagnostics,
        };
        this._activeDoneAttempt = attempt;
        doneButton.disabled = true;
        const playbackStartCapture: { promise: Promise<PlaybackStartOutcome> | null } = { promise: null };

        try {
            const outcome = await deps.screenPorts.switchToChannelByNumberWithOutcome(initialChannelNumber, {
                signal: attempt.controller.signal,
                beforeProgramStart: () => {
                    if (!this._isCurrentDoneAttempt(attempt, deps)) {
                        attempt.controller.abort();
                        return;
                    }
                    attempt.diagnostics.record('setup-provisional-hide', { provisional: true });
                    deps.revealPlayerProvisionally();
                    attempt.provisionalPlayerVisible = true;
                    attempt.diagnostics.record('player-show', { provisional: true });
                    attempt.diagnostics.record('scheduler-program-start-request');
                    playbackStartCapture.promise = deps.screenPorts.waitForNextPlaybackStart(attempt.controller.signal);
                },
            });
            if (!this._isCurrentDoneAttempt(attempt, deps)) return;
            attempt.diagnostics.record('channel-switch-settlement', { outcome: outcome.kind });

            if (isChannelSwitchSuccessful(outcome)) {
                const playbackStart = playbackStartCapture.promise;
                if (!playbackStart) {
                    this._restoreFailedDoneAttempt(attempt, deps);
                    ctx.errorEl.textContent = 'Channels were created, but playback could not start.';
                    attempt.diagnostics.record('playback-start-settlement', { outcome: 'missing' });
                    attempt.diagnostics.close('failure');
                    return;
                }
                const playbackOutcome = await playbackStart;
                if (!this._isCurrentDoneAttempt(attempt, deps)) return;
                attempt.diagnostics.record('playback-start-settlement', { outcome: playbackOutcome.kind });
                if (playbackOutcome.kind === 'failed') {
                    this._restoreFailedDoneAttempt(attempt, deps);
                    ctx.errorEl.textContent = 'Channels were created, but playback could not start.';
                    attempt.diagnostics.close('failure');
                    return;
                }
                if (playbackOutcome.kind === 'superseded') {
                    this._restoreFailedDoneAttempt(attempt, deps);
                    attempt.diagnostics.close('superseded');
                    return;
                }
                this._activeDoneAttempt = null;
                deps.screenPorts.getNavigation()?.replaceScreen('player');
                attempt.diagnostics.record('guide-open');
                deps.screenPorts.openEPG();
                attempt.diagnostics.recordGuideShown();
                return;
            }

            attempt.controller.abort();
            this._restoreFailedDoneAttempt(attempt, deps);
            this._handleDoneChannelSwitchOutcome(ctx, outcome, initialChannelNumber);
            attempt.diagnostics.close(isChannelSwitchAborted(outcome) ? 'canceled' : 'failure');
        } catch (error: unknown) {
            if (!this._isCurrentDoneAttempt(attempt, deps)) return;
            const aborted = isAbortLikeError(error, attempt.controller.signal);
            attempt.controller.abort();
            this._restoreFailedDoneAttempt(attempt, deps);
            if (aborted) {
                this._handleDoneChannelSwitchOutcome(ctx, { kind: 'aborted' }, initialChannelNumber);
                attempt.diagnostics.close('canceled');
                return;
            }
            ctx.errorEl.textContent = 'Channels were created, but playback could not start.';
            attempt.diagnostics.close('failure');
            console.warn(`Switch to channel ${initialChannelNumber} failed:`, summarizeErrorForLog(error));
        }
    }

    private _isCurrentDoneAttempt(attempt: DoneAttempt, deps: { getVisibilityToken: () => number }): boolean {
        return this._activeDoneAttempt === attempt
            && !attempt.controller.signal.aborted
            && attempt.token === deps.getVisibilityToken();
    }

    private _restoreFailedDoneAttempt(
        attempt: DoneAttempt,
        deps: { restoreSetupAfterProvisionalReveal: () => void }
    ): void {
        this._activeDoneAttempt = null;
        if (attempt.provisionalPlayerVisible) {
            deps.restoreSetupAfterProvisionalReveal();
            attempt.provisionalPlayerVisible = false;
        }
        attempt.button.disabled = false;
    }

    private _cancelActiveDoneAttempt(
        deps: { restoreSetupAfterProvisionalReveal: () => void },
        restoreSetup: boolean,
        outcome: 'canceled' | 'superseded'
    ): void {
        const attempt = this._activeDoneAttempt;
        if (!attempt) return;
        this._activeDoneAttempt = null;
        attempt.controller.abort();
        attempt.diagnostics.close(outcome);
        if (restoreSetup && attempt.provisionalPlayerVisible) {
            deps.restoreSetupAfterProvisionalReveal();
            attempt.button.disabled = false;
        }
    }

    private _applyBuildCanceledUI(
        ctx: StepRenderContext,
        cancelButton: HTMLButtonElement,
        doneButton: HTMLButtonElement,
        barFill: HTMLElement,
        taskLabel: HTMLElement,
        detailLabel: HTMLElement,
        options?: { disableDone?: boolean }
    ): void {
        ctx.statusEl.textContent = 'Canceled.';
        ctx.detailEl.textContent = 'No changes were applied.';
        taskLabel.textContent = 'Canceled';
        detailLabel.textContent = '';
        barFill.style.width = '0%';
        barFill.classList.remove('indeterminate');

        cancelButton.disabled = false;
        cancelButton.textContent = 'Back';
        if (options?.disableDone) {
            doneButton.disabled = true;
        }
        cancelButton.focus();
    }

    private _applyBuildBlockedUI(
        ctx: StepRenderContext,
        cancelButton: HTMLButtonElement,
        doneButton: HTMLButtonElement,
        barFill: HTMLElement,
        taskLabel: HTMLElement,
        detailLabel: HTMLElement,
        message: string
    ): void {
        const userMessage = formatChannelSetupUserCopy(message, 'build');
        ctx.statusEl.textContent = 'Setup needs attention.';
        ctx.detailEl.textContent = 'No changes were applied.';
        ctx.errorEl.textContent = userMessage;
        taskLabel.textContent = 'Build paused';
        detailLabel.textContent = 'Adjust setup, then try building again.';
        barFill.style.width = '0%';
        barFill.classList.remove('indeterminate');

        cancelButton.disabled = false;
        cancelButton.textContent = 'Back';
        doneButton.disabled = true;
        cancelButton.focus();
    }

    private async _startBuild(
        ctx: StepRenderContext,
        deps: {
            session: ChannelSetupSessionController;
            focus: ChannelSetupFocusCoordinator;
            screenPorts: ChannelSetupScreenPorts;
            getPreferredFocusId: () => string | null;
            setPreferredFocusId: (focusId: string | null) => void;
            getVisibilityToken: () => number;
        },
        ui: {
            cancelButton: HTMLButtonElement;
            doneButton: HTMLButtonElement;
            barFill: HTMLElement;
            taskLabel: HTMLElement;
            detailLabel: HTMLElement;
        }
    ): Promise<void> {
        const { cancelButton, doneButton, barFill, taskLabel, detailLabel } = ui;
        const token = deps.getVisibilityToken();
        this._lastInitialChannelNumber = null;
        const outcome = await deps.session.beginBuild({
            onProgress: (p: ChannelBuildProgress): void => {
                if (token !== deps.getVisibilityToken()) {
                    return;
                }
                taskLabel.textContent = p.label;
                detailLabel.textContent = p.detail;

                if (p.total !== null && p.total > 0) {
                    const percent = Math.min(100, (p.current / p.total) * 100);
                    barFill.style.width = `${percent}%`;
                    barFill.classList.remove('indeterminate');
                } else {
                    barFill.style.width = '';
                    barFill.classList.add('indeterminate');
                }
            },
            onStateChange: () => {
                // State changes are reflected through subsequent step renders.
            },
        });

        if (token !== deps.getVisibilityToken()) {
            return;
        }

        if (outcome.kind === 'missing-server') {
            this._lastInitialChannelNumber = null;
            ctx.errorEl.textContent = 'No server selected.';
            ctx.statusEl.textContent = 'Error';
            taskLabel.textContent = 'Select a server';
            detailLabel.textContent = '';
            barFill.style.width = '0%';
            barFill.classList.remove('indeterminate');
            cancelButton.disabled = false;
            cancelButton.textContent = 'Back';
            doneButton.disabled = true;
            return;
        }

        if (outcome.kind === 'blocked') {
            this._lastInitialChannelNumber = null;
            this._applyBuildBlockedUI(ctx, cancelButton, doneButton, barFill, taskLabel, detailLabel, outcome.message);
            return;
        }

        if (outcome.kind === 'canceled') {
            this._lastInitialChannelNumber = null;
            this._applyBuildCanceledUI(ctx, cancelButton, doneButton, barFill, taskLabel, detailLabel, {
                disableDone: true,
            });
            return;
        }

        if (outcome.kind === 'error') {
            this._lastInitialChannelNumber = null;
            ctx.errorEl.textContent = outcome.message;
            ctx.statusEl.textContent = 'Error';
            taskLabel.textContent = 'Error';
            detailLabel.textContent = '';
            barFill.style.width = '0%';
            barFill.classList.remove('indeterminate');
            cancelButton.disabled = false;
            cancelButton.textContent = 'Back';
            return;
        }

        this._lastInitialChannelNumber = outcome.result.initialChannelNumber ?? null;
        const guideRefresh = outcome.result.guideRefresh;
        ctx.statusEl.textContent = this._buildSuccessStatus(outcome.bookkeepingError, guideRefresh);
        taskLabel.textContent = 'Complete';
        detailLabel.textContent = `Created ${outcome.result.created} channels. ${outcome.result.skipped} candidates not created.`;
        barFill.style.width = '100%';
        barFill.classList.remove('indeterminate');
        ctx.errorEl.textContent = this._buildSuccessWarning(outcome.bookkeepingError, guideRefresh);

        cancelButton.disabled = false;
        doneButton.disabled = outcome.result.created === 0 || this._lastInitialChannelNumber === null;
        cancelButton.textContent = 'Back';

        if (outcome.result.created === 0) {
            ctx.detailEl.textContent = 'No channels created.';
        }
        deps.focus.unregisterAll();
        const preferredApplied = deps.focus.registerLinear([doneButton, cancelButton], deps.getPreferredFocusId());
        if (preferredApplied) {
            deps.setPreferredFocusId(null);
        }

        const nav = deps.screenPorts.getNavigation();
        if (nav && !doneButton.disabled) {
            nav.setFocus(doneButton.id);
        } else {
            nav?.setFocus(cancelButton.id);
        }
    }

    private _handleDoneChannelSwitchOutcome(
        ctx: StepRenderContext,
        outcome: ChannelSwitchOutcome,
        initialChannelNumber: number
    ): void {
        if (isChannelSwitchFailed(outcome)) {
            ctx.errorEl.textContent = `Channels were created, but channel ${initialChannelNumber} could not start.`;
            return;
        }
        if (isChannelSwitchAborted(outcome)) {
            ctx.errorEl.textContent = 'Channels were created, but playback start was canceled.';
        }
    }

    private _buildSuccessStatus(
        bookkeepingError: string | undefined,
        guideRefresh: ChannelSetupGuideRefreshSummary | undefined
    ): string {
        if (guideRefresh?.kind === 'interrupted') {
            return 'Channels created; guide refresh interrupted.';
        }
        if (bookkeepingError) {
            return 'Channels created; setup save needed.';
        }
        if (guideRefresh?.kind === 'failed') {
            return 'Channels created; guide refresh failed.';
        }
        const refreshResult = guideRefresh?.result;
        if (refreshResult?.readiness === 'failed') {
            return 'Channels created; guide refresh failed.';
        }
        if (refreshResult?.readiness === 'skipped') {
            return 'Channels created; guide refresh unavailable.';
        }
        if (refreshResult?.readiness === 'partial') {
            return 'Channels created; guide needs attention.';
        }
        return 'Channels ready.';
    }

    private _buildSuccessWarning(
        bookkeepingError: string | undefined,
        guideRefresh: ChannelSetupGuideRefreshSummary | undefined
    ): string {
        const warnings: string[] = [];
        if (bookkeepingError) {
            warnings.push(`Channels were created, but setup completion could not be saved: ${bookkeepingError}`);
        }
        if (guideRefresh?.kind === 'interrupted') {
            warnings.push('Channels were saved, but guide refresh was interrupted. Open the guide again after schedules finish loading.');
            return warnings.join(' ');
        }
        if (guideRefresh?.kind === 'failed') {
            warnings.push('Guide data could not be refreshed. Open the guide again after schedules finish loading.');
            return warnings.join(' ');
        }

        const refreshResult = guideRefresh?.result;
        if (refreshResult?.readiness === 'failed') {
            warnings.push('Guide data could not be refreshed. Open the guide again after schedules finish loading.');
        } else if (refreshResult?.readiness === 'skipped') {
            warnings.push('Guide data was not refreshed. Open the guide again after schedules finish loading.');
        } else if (refreshResult?.readiness === 'partial') {
            warnings.push(`${refreshResult.failedChannelCount} channel schedules could not be refreshed immediately.`);
        }
        return warnings.join(' ');
    }
}
