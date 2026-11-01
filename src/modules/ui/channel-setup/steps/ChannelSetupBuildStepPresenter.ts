import type { ChannelBuildProgress, ChannelBuildSummary } from '../../../../core/channel-setup/types';
import { isAbortLikeError, summarizeErrorForLog } from '../../../../utils/errors';
import { renderCappedWarnings } from '../../common/render/renderCappedWarnings';
import type { ChannelSetupFocusCoordinator } from '../focus/ChannelSetupFocusCoordinator';
import type { ChannelSetupScreenPorts } from '../ChannelSetupScreenPorts';
import type { ChannelSetupSessionController } from '../ChannelSetupSessionController';
import type { KeyEvent, INavigationManager } from '../../../navigation';
import { BuildProgressStepController } from './BuildProgressStepController';
import { BuildReviewStepController } from './BuildReviewStepController';
import type { StepRenderContext } from '../stepContracts';

interface Deps {
    session: ChannelSetupSessionController;
    focus: ChannelSetupFocusCoordinator;
    screenPorts: ChannelSetupScreenPorts;
    getPreferredFocusId: () => string | null;
    setPreferredFocusId: (focusId: string | null) => void;
    getVisibilityToken: () => number;
    renderStep: () => void;
}

export class ChannelSetupBuildStepPresenter {
    private readonly _review = new BuildReviewStepController();
    private readonly _progress = new BuildProgressStepController();
    private _stale = false;
    private _saved = false;
    private _guideOpened = false;
    private _canCancel = true;
    private _activeDeps: Deps | null = null;

    handleKeyPress(event: KeyEvent, nav: INavigationManager): void {
        this._review.handleKeyPress(event, nav);
        if (event.handled || event.button !== 'back' || !this._activeDeps) return;
        const deps = this._activeDeps;
        event.handled = true;
        if (this._saved) this._openGuide(deps);
        else if (deps.session.getSnapshot().isBuilding) {
            if (this._canCancel && deps.session.cancelBuild()) {
                const cancel = document.getElementById('setup-back');
                if (cancel instanceof HTMLButtonElement) {
                    cancel.disabled = true;
                    cancel.textContent = 'Canceling…';
                }
            }
        }
        else { deps.session.clearReviewAndReturnToStep2(); this.reset(); deps.renderStep(); }
    }

    reset(): void {
        this._review.reset();
        this._stale = false;
        this._saved = false;
        this._guideOpened = false;
        this._canCancel = true;
        this._activeDeps = null;
    }

    dispose(): void { this.reset(); }

    render(ctx: StepRenderContext, deps: Deps): void {
        this._activeDeps = deps;
        if (deps.session.getSnapshot().isBuilding) this._renderProgress(ctx, deps);
        else this._renderReview(ctx, deps);
    }

    private _renderReview(ctx: StepRenderContext, deps: Deps): void {
        const state = deps.session.getSnapshot();
        this._review.render(ctx, {
            state: {
                buildMode: state.buildMode,
                review: state.review,
                reviewError: state.reviewError,
                isReviewLoading: state.isReviewLoading,
                replaceConfirm: state.replaceConfirm,
                wholeLineupReplacementConfirm: state.wholeLineupReplacementConfirm,
                isStale: this._stale,
                isBuilding: state.isBuilding,
                recordApplied: state.recordApplied,
            },
            renderStep: deps.renderStep,
            setPreferredFocusId: deps.setPreferredFocusId,
            onBackToStrategy: () => {
                deps.session.clearReviewAndReturnToStep2();
                this.reset();
                deps.renderStep();
            },
            onRefreshReview: () => {
                this._stale = false;
                this._review.reset();
                deps.setPreferredFocusId('setup-refresh-review');
                void deps.session.refreshReview(() => deps.renderStep());
            },
            onConfirmBuild: () => {
                if (this._saved) {
                    this._openGuide(deps);
                    return;
                }
                deps.session.beginConfirmedBuild();
                deps.renderStep();
            },
            onToggleReplaceConfirm: (id) => {
                deps.session.toggleReplaceConfirm();
                deps.setPreferredFocusId(id);
                deps.renderStep();
            },
            onToggleWholeLineupReplacementConfirm: (id) => {
                deps.session.toggleWholeLineupReplacementConfirm();
                deps.setPreferredFocusId(id);
                deps.renderStep();
            },
            renderCappedWarnings: (warnings, container) => renderCappedWarnings({
                warnings, container, maxItems: 5, itemClassName: 'setup-preview-warning',
            }),
            registerLinearFocusables: (elements) => {
                const applied = deps.focus.registerLinear(elements, deps.getPreferredFocusId());
                if (applied) deps.setPreferredFocusId(null);
            },
        });
        if (!state.review && !state.reviewError && !state.isReviewLoading && state.recordApplied) {
            const token = deps.getVisibilityToken();
            queueMicrotask(() => {
                if (token !== deps.getVisibilityToken()) return;
                const current = deps.session.getSnapshot();
                if (current.step !== 3 || current.isBuilding || current.review || current.isReviewLoading) return;
                void deps.session.ensureReviewLoaded(() => deps.renderStep()).catch((error: unknown) => {
                    if (!isAbortLikeError(error)) console.warn('Load review failed:', summarizeErrorForLog(error));
                });
            });
        }
    }

    private _renderProgress(ctx: StepRenderContext, deps: Deps): void {
        this._canCancel = true;
        this._progress.render(ctx, {
            state: { isBuilding: true },
            registerLinearFocusables: (elements) => {
                const applied = deps.focus.registerLinear(elements, deps.getPreferredFocusId());
                if (applied) deps.setPreferredFocusId(null);
            },
            onCancelOrBack: (button) => {
                if (this._saved) {
                    this._openGuide(deps);
                    return;
                }
                if (!this._canCancel) return;
                if (deps.session.cancelBuild()) {
                    button.disabled = true;
                    button.textContent = 'Canceling…';
                } else {
                    deps.session.setStep(3);
                    deps.renderStep();
                }
            },
            onDone: () => this._openGuide(deps),
            onAddCustom: () => {
                if (!this._saved) return;
                deps.screenPorts.openCustomChannelStudio();
            },
            startBuild: async (ui) => {
                const token = deps.getVisibilityToken();
                const outcome = await deps.session.beginBuild({
                    onProgress: (progress: ChannelBuildProgress) => {
                        if (token !== deps.getVisibilityToken()) return;
                        ui.taskLabel.textContent = progress.label;
                        ui.detailLabel.textContent = `${progress.detail} · ${progress.current}${progress.total === null ? '' : `/${progress.total}`}`;
                        if (progress.total !== null && progress.total > 0) {
                            ui.barFill.style.width = `${Math.min(100, 100 * progress.current / progress.total)}%`;
                        } else {
                            ui.barFill.classList.add('indeterminate');
                        }
                        if (progress.task === 'apply_channels' || progress.task === 'refresh_epg' || progress.task === 'done') {
                            this._canCancel = false;
                            ui.cancelButton.disabled = true;
                            ui.cancelButton.textContent = 'Saving…';
                        }
                    },
                    onStateChange: () => { /* The progress view owns visible outcome. */ },
                });
                if (token !== deps.getVisibilityToken()) return;
                if (outcome.kind === 'success' || outcome.kind === 'committed-with-guide-interrupted') {
                    this._saved = true;
                    this._showSavedOutcome(ctx, ui, outcome.result, outcome.bookkeepingError);
                    deps.focus.unregisterAll();
                    deps.focus.registerLinear([ui.doneButton, ui.addCustomButton, ui.cancelButton], 'setup-done');
                    deps.screenPorts.getNavigation()?.setFocus('setup-done');
                    return;
                }
                this._saved = false;
                this._canCancel = true;
                ui.barFill.style.width = '0%';
                ui.barFill.classList.remove('indeterminate');
                ui.doneButton.disabled = true;
                ui.addCustomButton.disabled = true;
                ui.cancelButton.disabled = false;
                ui.cancelButton.textContent = 'Back to Review';
                if (outcome.kind === 'blocked') {
                    this._stale = outcome.reason === 'stale' || outcome.reason === 'conflict';
                    ctx.statusEl.textContent = this._stale ? 'Review is out of date' : 'Review needs attention';
                    ctx.errorEl.textContent = `${outcome.message} Nothing was saved.`;
                } else if (outcome.kind === 'canceled') {
                    ctx.statusEl.textContent = 'Canceled';
                    ctx.detailEl.textContent = 'Nothing was saved. Your Review choices are retained.';
                } else {
                    ctx.statusEl.textContent = 'Apply failed';
                    ctx.errorEl.textContent = `${outcome.kind === 'error' ? outcome.message : 'No server selected.'} Nothing was saved.`;
                }
                ui.taskLabel.textContent = 'No changes saved';
                ui.detailLabel.textContent = 'Back returns to Review with your choices.';
                deps.screenPorts.getNavigation()?.setFocus('setup-back');
            },
        });
    }

    private _showSavedOutcome(
        ctx: StepRenderContext,
        ui: { cancelButton: HTMLButtonElement; doneButton: HTMLButtonElement; addCustomButton: HTMLButtonElement; barFill: HTMLElement; taskLabel: HTMLElement; detailLabel: HTMLElement },
        summary: ChannelBuildSummary,
        bookkeepingError?: string
    ): void {
        ctx.statusEl.textContent = summary.noChange ? 'Lineup unchanged' : 'Channels saved';
        ctx.detailEl.textContent = summary.noChange ? 'No structural changes were needed.'
            : `${summary.created} added · ${summary.skipped} candidates excluded. Open Guide to see the lineup.`;
        const warnings = [...(summary.warnings ?? [])];
        if (summary.pointerWarning) warnings.push('Channels were saved, but the selected-channel pointer could not be saved.');
        if (bookkeepingError) warnings.push(`Channels were saved, but setup completion needs retry: ${bookkeepingError}`);
        if (summary.guideRefresh?.kind === 'failed' || summary.guideRefresh?.kind === 'interrupted') {
            warnings.push('Channels were saved; Guide refresh needs retry.');
        } else if (summary.guideRefresh?.kind === 'completed' && summary.guideRefresh.result.readiness !== 'ready') {
            warnings.push(`Channels were saved; Guide readiness is ${summary.guideRefresh.result.readiness}.`);
        }
        ctx.errorEl.textContent = warnings.join(' ');
        ui.taskLabel.textContent = 'Saved';
        ui.detailLabel.textContent = ctx.detailEl.textContent;
        ui.barFill.style.width = '100%';
        ui.barFill.classList.remove('indeterminate');
        ui.cancelButton.disabled = false;
        ui.cancelButton.textContent = 'Back';
        ui.doneButton.disabled = false;
        ui.doneButton.textContent = 'Open Guide';
        ui.addCustomButton.disabled = false;
    }

    private _openGuide(deps: Deps): void {
        if (this._guideOpened) return;
        this._guideOpened = true;
        deps.screenPorts.getNavigation()?.replaceScreen('guide');
    }
}
