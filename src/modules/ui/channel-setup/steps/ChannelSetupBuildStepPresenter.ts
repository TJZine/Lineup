import type { ChannelBuildProgress } from '../../../../core/channel-setup/types';
import { isAbortLikeError, summarizeErrorForLog } from '../../../../utils/errors';
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
import type { BuildReviewStateSnapshot, StepRenderContext } from './types';

export class ChannelSetupBuildStepPresenter {
    private readonly _buildReviewStep = new BuildReviewStepController();
    private readonly _buildProgressStep = new BuildProgressStepController();
    private readonly _maxPreviewWarnings = 5;

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
                return deps.session.ensureReviewLoaded(deps.renderStep);
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
            onDone: () => {
                const nav = deps.screenPorts.getNavigation();
                if (nav) {
                    nav.replaceScreen('player');
                }
                deps.screenPorts.switchToChannelByNumber(1)
                    .then(() => deps.screenPorts.openEPG())
                    .catch((error: unknown) => {
                        if (isAbortLikeError(error)) return;
                        console.warn('Switch to channel 1 failed:', summarizeErrorForLog(error));
                    });
            },
            startBuild: async (ui) => {
                await this._startBuild(ctx, deps, ui);
            },
        });
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
            this._applyBuildBlockedUI(ctx, cancelButton, doneButton, barFill, taskLabel, detailLabel, outcome.message);
            return;
        }

        if (outcome.kind === 'canceled') {
            this._applyBuildCanceledUI(ctx, cancelButton, doneButton, barFill, taskLabel, detailLabel, {
                disableDone: true,
            });
            return;
        }

        if (outcome.kind === 'error') {
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

        ctx.statusEl.textContent = 'Channels ready.';
        taskLabel.textContent = 'Complete';
        detailLabel.textContent = `Created ${outcome.result.created} channels. Skipped ${outcome.result.skipped}.`;
        barFill.style.width = '100%';
        barFill.classList.remove('indeterminate');
        ctx.errorEl.textContent = outcome.bookkeepingError
            ? `Channels were created, but setup completion could not be saved: ${outcome.bookkeepingError}`
            : '';

        cancelButton.disabled = false;
        doneButton.disabled = outcome.result.created === 0;
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
}
