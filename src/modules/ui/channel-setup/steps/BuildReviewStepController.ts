import {
    formatChannelSetupUserCopy,
    formatChannelSetupWarningCopy,
} from '../ChannelSetupUserCopy';
import type { ChannelSetupReview } from '../../../../core/channel-setup/types';
import type { StepRenderContext } from '../stepContracts';
import type { BuildReviewDeps } from './types';

type ReviewEstimateKey = Exclude<keyof ChannelSetupReview['preview']['estimates'], 'total'>;

const STRATEGY_DISPLAY_LABELS: Record<ReviewEstimateKey, string> = {
    genres: 'Genres',
    collections: 'Collections',
    decades: 'Decades',
    directors: 'Directors',
    recentlyAdded: 'Recently Added',
    playlists: 'Playlists',
    studios: 'Studios',
    actors: 'Actors',
};

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
        const reviewStatus = state.review?.preview.status;
        const reviewStatusMessage = state.review?.preview.message ?? null;

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
            if (reviewStatusMessage) {
                const reviewStatusError = document.createElement('div');
                reviewStatusError.className = 'setup-preview-error';
                if (reviewStatus === 'blocked') {
                    reviewStatusError.textContent = formatChannelSetupUserCopy(reviewStatusMessage, 'review');
                } else if (reviewStatus === 'slow') {
                    reviewStatusError.textContent = `Review timed out: ${formatChannelSetupUserCopy(reviewStatusMessage, 'review')}`;
                } else {
                    reviewStatusError.textContent = formatChannelSetupUserCopy(reviewStatusMessage, 'review');
                }
                reviewContainer.appendChild(reviewStatusError);
            }

            const modeLine = document.createElement('div');
            modeLine.className = 'setup-summary';
            modeLine.textContent = `Build mode: ${state.buildMode.charAt(0).toUpperCase()}${state.buildMode.slice(1)}`;
            reviewContainer.appendChild(modeLine);

            const { created, removed, unchanged } = state.review.diff.summary;
            const currentTotal = removed + unchanged;
            const afterTotal = created + unchanged;
            const barTotal = Math.max(created + removed + unchanged, 1);

            const impactPanel = document.createElement('div');
            impactPanel.className = 'setup-impact-panel';

            const headline = document.createElement('div');
            headline.className = 'setup-impact-headline';

            const currentEl = document.createElement('span');
            currentEl.className = 'setup-impact-count setup-impact-current';
            currentEl.textContent = String(currentTotal);

            const arrow = document.createElement('span');
            arrow.className = 'setup-impact-arrow';
            arrow.textContent = '\u2192';

            const afterEl = document.createElement('span');
            afterEl.className = 'setup-impact-count setup-impact-after';
            afterEl.textContent = String(afterTotal);

            const unitEl = document.createElement('span');
            unitEl.className = 'setup-impact-unit';
            unitEl.textContent = 'channels';

            headline.append(currentEl, arrow, afterEl, unitEl);
            impactPanel.appendChild(headline);

            const compositionLabel = document.createElement('div');
            compositionLabel.className = 'setup-impact-section-label';
            compositionLabel.textContent = 'Channel composition';
            impactPanel.appendChild(compositionLabel);

            const bar = document.createElement('div');
            bar.className = 'setup-impact-bar';
            bar.setAttribute('role', 'img');
            bar.setAttribute('aria-label', `${unchanged} channels staying, ${removed} leaving, ${created} new`);

            const segments = [
                { cls: 'setup-impact-stay', value: unchanged, label: 'Stay' },
                { cls: 'setup-impact-leave', value: removed, label: 'Leave' },
                { cls: 'setup-impact-new', value: created, label: 'New' },
            ];
            for (const segment of segments) {
                if (segment.value === 0) continue;
                const width = (segment.value / barTotal) * 100;
                const segmentEl = document.createElement('div');
                segmentEl.className = `setup-impact-segment ${segment.cls}${width < 14 ? ' setup-impact-segment--compact' : ''}`;
                segmentEl.style.width = `${width}%`;
                segmentEl.textContent = segment.label;
                bar.appendChild(segmentEl);
            }
            impactPanel.appendChild(bar);

            const summaryChips = document.createElement('div');
            summaryChips.className = 'setup-impact-summary';
            const summaryItems = [
                { cls: 'setup-impact-stay-chip', count: unchanged, label: 'stay' },
                { cls: 'setup-impact-leave-chip', count: removed, label: 'leave' },
                { cls: 'setup-impact-new-chip', count: created, label: 'new' },
            ];
            for (const item of summaryItems) {
                if (item.count === 0) continue;
                const chip = document.createElement('span');
                chip.className = `setup-impact-chip ${item.cls}`;
                const count = document.createElement('span');
                count.className = 'setup-impact-chip-count';
                count.textContent = String(item.count);
                chip.append(count, ` ${item.label}`);
                summaryChips.appendChild(chip);
            }
            impactPanel.appendChild(summaryChips);

            const estimateEntries = Object.entries(state.review.preview.estimates) as Array<
                [keyof ChannelSetupReview['preview']['estimates'], number]
            >;
            const categories = estimateEntries
                .flatMap(([key, count]) => {
                    const label = key === 'total' ? undefined : STRATEGY_DISPLAY_LABELS[key];
                    return label && count > 0 ? [{ label, count }] : [];
                })
                .sort((a, b) => b.count - a.count);
            if (categories.length > 0) {
                const categoryRow = document.createElement('div');
                categoryRow.className = 'setup-impact-categories';
                for (const category of categories) {
                    const chip = document.createElement('span');
                    chip.className = 'setup-impact-category';
                    const label = document.createElement('span');
                    label.className = 'setup-impact-category-label';
                    label.textContent = category.label;
                    const value = document.createElement('span');
                    value.className = 'setup-impact-category-count';
                    value.textContent = String(category.count);
                    chip.append(label, ' · ', value);
                    categoryRow.appendChild(chip);
                }
                impactPanel.appendChild(categoryRow);
            }

            reviewContainer.appendChild(impactPanel);

            if (state.review.preview.warnings.length > 0) {
                const warningList = document.createElement('div');
                warningList.className = 'setup-preview-warnings';
                deps.renderCappedWarnings(state.review.preview.warnings.map(formatChannelSetupWarningCopy), warningList);
                reviewContainer.appendChild(warningList);
            }

            if (state.buildMode === 'replace') {
                const warning = document.createElement('div');
                warning.className = 'setup-preview-warning';
                warning.textContent = 'This will replace your current lineup.';
                reviewContainer.appendChild(warning);

                const replaceConfirmButton = document.createElement('button');
                replaceConfirmButton.id = 'setup-replace-confirm';
                replaceConfirmButton.type = 'button';
                replaceConfirmButton.className = `setup-replace-confirm${state.replaceConfirm ? ' selected' : ''}`;
                replaceConfirmButton.setAttribute('aria-pressed', state.replaceConfirm ? 'true' : 'false');
                replaceConfirmButton.addEventListener('click', () => {
                    deps.onToggleReplaceConfirm(replaceConfirmButton.id);
                });

                const confirmMark = document.createElement('span');
                confirmMark.className = 'setup-replace-confirm-mark';
                confirmMark.setAttribute('aria-hidden', 'true');

                const confirmCopy = document.createElement('span');
                confirmCopy.className = 'setup-replace-confirm-copy';
                const confirmLabel = document.createElement('span');
                confirmLabel.className = 'setup-replace-confirm-label';
                confirmLabel.textContent = state.replaceConfirm ? 'Replacement confirmed' : 'Confirm replacement';
                const confirmMeta = document.createElement('span');
                confirmMeta.className = 'setup-replace-confirm-meta';
                confirmMeta.textContent = 'Required before replacing the current lineup.';
                confirmCopy.append(confirmLabel, confirmMeta);

                const confirmState = document.createElement('span');
                confirmState.className = 'setup-replace-confirm-state';
                confirmState.textContent = state.replaceConfirm ? 'Confirmed' : 'Required';

                replaceConfirmButton.append(confirmMark, confirmCopy, confirmState);

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
        confirmButton.disabled = state.isReviewLoading
            || !state.review
            || reviewStatus === 'blocked'
            || reviewStatus === 'slow'
            || (state.buildMode === 'replace' && !state.replaceConfirm);
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
