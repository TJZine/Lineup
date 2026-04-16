import { isAbortLikeError } from '../../../../utils/errors';
import type { BuildProgressDeps, StepRenderContext } from './types';

export class BuildProgressStepController {
    render(ctx: StepRenderContext, deps: BuildProgressDeps): void {
        ctx.stepEl.textContent = 'Step 3 of 3';
        ctx.statusEl.textContent = 'Building channels...';
        ctx.detailEl.textContent = '';
        ctx.errorEl.textContent = '';

        const progressContainer = document.createElement('div');
        progressContainer.className = 'setup-progress-container';

        const barContainer = document.createElement('div');
        barContainer.className = 'setup-progress-bar-bg';
        const barFill = document.createElement('div');
        barFill.className = 'setup-progress-bar-fill';
        barContainer.appendChild(barFill);
        progressContainer.appendChild(barContainer);

        const taskLabel = document.createElement('div');
        taskLabel.className = 'setup-progress-task';
        taskLabel.textContent = 'Initializing...';
        progressContainer.appendChild(taskLabel);

        const detailLabel = document.createElement('div');
        detailLabel.className = 'setup-progress-detail';
        detailLabel.textContent = 'Please wait';
        progressContainer.appendChild(detailLabel);

        ctx.contentEl.appendChild(progressContainer);

        const actions = document.createElement('div');
        actions.className = 'button-row';

        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        backButton.className = 'screen-button secondary';
        backButton.textContent = 'Cancel';
        backButton.addEventListener('click', () => {
            deps.onCancelOrBack(backButton);
        });
        actions.appendChild(backButton);

        const doneButton = document.createElement('button');
        doneButton.id = 'setup-done';
        doneButton.className = 'screen-button';
        doneButton.textContent = 'Done';
        doneButton.disabled = true;
        doneButton.addEventListener('click', () => {
            deps.onDone();
        });
        actions.appendChild(doneButton);

        ctx.contentEl.appendChild(actions);
        // Note: Focus registration filters out disabled buttons (Done starts disabled until build completes).
        deps.registerLinearFocusables([backButton, doneButton]);

        void deps.startBuild({
            cancelButton: backButton,
            doneButton,
            barFill,
            taskLabel,
            detailLabel,
        }).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            ctx.statusEl.textContent = 'Error';
            ctx.errorEl.textContent = 'Build failed. Please go back and try again.';
            taskLabel.textContent = 'Build failed';
            detailLabel.textContent = 'Press Back to adjust settings and retry.';
            backButton.disabled = false;
            backButton.textContent = 'Back';
            doneButton.disabled = true;
        });
    }
}
