import type { BuildReviewDeps, StepRenderContext } from './types';

export class BuildReviewStepController {
    render(ctx: StepRenderContext, deps: BuildReviewDeps): void {
        const state = deps.state;
        ctx.stepEl.textContent = 'Step 3 of 3';
        ctx.statusEl.textContent = 'Review changes before building.';
        ctx.detailEl.textContent = '';
        ctx.errorEl.textContent = state.reviewError ?? '';

        const scroll = document.createElement('div');
        scroll.className = 'setup-scroll';

        const reviewContainer = document.createElement('div');
        reviewContainer.className = 'setup-review';

        let showLoadingState = false;
        if (!state.recordApplied) {
            showLoadingState = true;
        } else if (!state.review && !state.isReviewLoading && !state.reviewError) {
            showLoadingState = true;
        } else if (state.isReviewLoading) {
            showLoadingState = true;
        }

        if (showLoadingState) {
            const loading = document.createElement('div');
            loading.className = 'setup-preview-loading';
            loading.classList.add('panel-spinner');
            loading.textContent = 'Preparing your review...';
            reviewContainer.appendChild(loading);
        } else if (state.review) {
            const modeLine = document.createElement('div');
            modeLine.className = 'setup-summary';
            modeLine.textContent = `Build mode: ${state.buildMode.charAt(0).toUpperCase()}${state.buildMode.slice(1)}`;
            reviewContainer.appendChild(modeLine);

            const diffSummary = document.createElement('div');
            diffSummary.className = 'setup-summary';
            diffSummary.textContent = `Create ${state.review.diff.summary.created}, remove ${state.review.diff.summary.removed}, unchanged ${state.review.diff.summary.unchanged}.`;
            reviewContainer.appendChild(diffSummary);

            const sampleList = document.createElement('div');
            sampleList.className = 'setup-preview-rows';
            sampleList.appendChild(deps.buildPreviewRow('Sample creates', state.review.diff.samples.created.join(', ') || 'None'));
            sampleList.appendChild(deps.buildPreviewRow('Sample removes', state.review.diff.samples.removed.join(', ') || 'None'));
            sampleList.appendChild(deps.buildPreviewRow('Sample unchanged', state.review.diff.samples.unchanged.join(', ') || 'None'));
            reviewContainer.appendChild(sampleList);

            if (state.review.preview.warnings.length > 0) {
                const warningList = document.createElement('div');
                warningList.className = 'setup-preview-warnings';
                deps.renderCappedWarnings(state.review.preview.warnings, warningList);
                reviewContainer.appendChild(warningList);
            }

            if (state.buildMode === 'replace') {
                const warning = document.createElement('div');
                warning.className = 'setup-preview-warning';
                warning.textContent = 'This will replace your current lineup.';
                reviewContainer.appendChild(warning);

                const replaceConfirmButton = document.createElement('button');
                replaceConfirmButton.id = 'setup-replace-confirm';
                replaceConfirmButton.className = `setup-toggle${state.replaceConfirm ? ' selected' : ''}`;
                replaceConfirmButton.addEventListener('click', () => {
                    deps.onToggleReplaceConfirm(replaceConfirmButton.id);
                });

                const confirmLabel = document.createElement('span');
                confirmLabel.className = 'setup-toggle-label';
                confirmLabel.textContent = 'Confirm replace';
                const confirmMeta = document.createElement('span');
                confirmMeta.className = 'setup-toggle-meta';
                confirmMeta.textContent = 'Required before replacing channels.';
                const confirmState = document.createElement('span');
                confirmState.className = 'setup-toggle-state';
                confirmState.textContent = state.replaceConfirm ? 'Confirmed' : 'Required';

                replaceConfirmButton.appendChild(confirmLabel);
                replaceConfirmButton.appendChild(confirmMeta);
                replaceConfirmButton.appendChild(confirmState);

                reviewContainer.appendChild(replaceConfirmButton);
            }
        }

        scroll.appendChild(reviewContainer);
        ctx.contentEl.appendChild(scroll);

        const actions = document.createElement('div');
        actions.className = 'button-row';

        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        backButton.className = 'screen-button secondary';
        backButton.textContent = 'Back';
        backButton.addEventListener('click', () => {
            deps.onBackToStrategy();
        });
        actions.appendChild(backButton);

        const confirmButton = document.createElement('button');
        confirmButton.id = 'setup-confirm';
        confirmButton.className = 'screen-button';
        confirmButton.textContent = state.buildMode === 'replace' ? 'Confirm & Replace' : 'Confirm & Build';
        confirmButton.disabled = state.isReviewLoading || !state.review || (state.buildMode === 'replace' && !state.replaceConfirm);
        confirmButton.addEventListener('click', () => {
            if (confirmButton.disabled) {
                return;
            }
            deps.onConfirmBuild();
        });
        actions.appendChild(confirmButton);

        ctx.contentEl.appendChild(actions);

        const listButtons = Array.from(reviewContainer.querySelectorAll<HTMLButtonElement>('button'));
        deps.registerLinearFocusables([...listButtons, backButton, confirmButton]);
    }
}
