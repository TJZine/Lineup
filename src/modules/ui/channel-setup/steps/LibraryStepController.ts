import { setTrustedInlineSvg } from '../../../../utils/inlineSvg';
import type { StepRenderContext } from '../stepContracts';
import type { LibraryStepDeps } from './types';

export class LibraryStepController {
    render(ctx: StepRenderContext, deps: LibraryStepDeps): void {
        ctx.stepEl.textContent = 'Step 1 of 3';
        ctx.statusEl.textContent = 'Select the libraries to include.';
        ctx.detailEl.textContent = '';

        const scroll = document.createElement('div');
        scroll.className = 'setup-scroll';

        const bulkActions = document.createElement('div');
        bulkActions.className = 'setup-bulk-actions';

        const firstLibraryId = deps.libraries[0] ? `setup-lib-${deps.toDomId(deps.libraries[0].id)}` : null;

        const selectAllButton = document.createElement('button');
        selectAllButton.id = 'setup-select-all';
        selectAllButton.className = 'screen-button secondary';
        selectAllButton.textContent = 'Select All';
        selectAllButton.disabled = deps.libraries.length === 0;
        selectAllButton.addEventListener('click', () => {
            deps.onSelectAll(firstLibraryId ?? selectAllButton.id);
        });
        bulkActions.appendChild(selectAllButton);

        const clearAllButton = document.createElement('button');
        clearAllButton.id = 'setup-clear-all';
        clearAllButton.className = 'screen-button secondary';
        clearAllButton.textContent = 'Clear All';
        clearAllButton.disabled = deps.libraries.length === 0;
        clearAllButton.addEventListener('click', () => {
            deps.onClearAll(firstLibraryId ?? clearAllButton.id);
        });
        bulkActions.appendChild(clearAllButton);

        scroll.appendChild(bulkActions);

        const list = document.createElement('div');
        list.className = 'setup-grid-2col';

        if (deps.libraries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'setup-empty';
            empty.textContent = 'No movie or show libraries found on this server. Switch server to try another.';
            list.appendChild(empty);
        }

        deps.libraries.forEach((library, index) => {
            const isSelected = deps.selectedLibraryIds.has(library.id);

            const button = document.createElement('button');
            button.id = `setup-lib-${deps.toDomId(library.id)}`;
            button.className = `setup-toggle${isSelected ? ' selected' : ''}`;
            button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            button.classList.add('library-toggle');
            button.classList.add('setup-stagger-in');
            button.style.animationDelay = `${index * 50}ms`;

            const icon = document.createElement('span');
            icon.className = 'setup-toggle-icon';
            icon.classList.add(library.type === 'movie' ? 'setup-toggle-icon--movie' : 'setup-toggle-icon--show');
            icon.dataset.libraryMarker = library.type === 'movie' ? 'MOV' : 'TV';
            icon.setAttribute('aria-hidden', 'true');
            setTrustedInlineSvg(icon, library.type === 'movie' ? deps.movieSvg : deps.showSvg);

            const label = document.createElement('span');
            label.className = 'setup-toggle-label';
            label.textContent = library.title;

            const meta = document.createElement('span');
            meta.className = 'setup-toggle-meta';
            const typeLabel = library.type === 'movie' ? 'Movies' : 'Shows';
            if (typeof library.contentCount === 'number' && Number.isFinite(library.contentCount)) {
                meta.appendChild(document.createTextNode(`${typeLabel} • `));
                const countSpan = document.createElement('span');
                countSpan.className = 'setup-toggle-count';
                countSpan.textContent = deps.formatCount(library.contentCount);
                meta.appendChild(countSpan);
                meta.appendChild(document.createTextNode(library.type === 'movie' ? ' movies' : ' series'));

                if (
                    library.type === 'show' &&
                    typeof library.episodeCount === 'number' &&
                    Number.isFinite(library.episodeCount)
                ) {
                    meta.appendChild(document.createTextNode(' • '));
                    const epCountSpan = document.createElement('span');
                    epCountSpan.className = 'setup-toggle-count';
                    epCountSpan.textContent = deps.formatCount(library.episodeCount);
                    meta.appendChild(epCountSpan);
                    meta.appendChild(document.createTextNode(' episodes'));
                }
            } else {
                meta.textContent = typeLabel;
            }

            const state = document.createElement('span');
            state.className = 'setup-toggle-state';
            if (isSelected) {
                const stateIcon = document.createElement('span');
                stateIcon.className = 'setup-toggle-state-icon';
                stateIcon.setAttribute('aria-hidden', 'true');
                stateIcon.textContent = '✓';

                const srOnly = document.createElement('span');
                srOnly.className = 'sr-only';
                srOnly.textContent = 'Selected';

                state.appendChild(stateIcon);
                state.appendChild(srOnly);
            } else {
                state.textContent = 'Off';
            }

            button.appendChild(icon);
            button.appendChild(label);
            button.appendChild(meta);
            button.appendChild(state);
            button.addEventListener('click', () => {
                deps.onToggleLibrary(library.id, button.id);
            });

            list.appendChild(button);
        });

        scroll.appendChild(list);
        const deselectedReady = deps.libraries.filter((library) =>
            !deps.selectedLibraryIds.has(library.id) && deps.knownReadyLibraryIds.has(library.id));
        if (deselectedReady.length > 0) {
            const heading = document.createElement('p');
            heading.textContent = 'Complete libraries you removed from selection keep their existing channels unless you confirm removal below.';
            scroll.appendChild(heading);
            for (const library of deselectedReady) {
                const consent = document.createElement('button');
                consent.id = `setup-deselected-${deps.toDomId(library.id)}`;
                consent.type = 'button';
                consent.className = `setup-toggle${deps.confirmedDeselectedLibraryIds.has(library.id) ? ' selected' : ''}`;
                consent.setAttribute('aria-pressed', String(deps.confirmedDeselectedLibraryIds.has(library.id)));
                consent.textContent = `${library.title} · ${deps.confirmedDeselectedLibraryIds.has(library.id)
                    ? 'Removal allowed for this selection' : 'Keep existing channels'}`;
                consent.addEventListener('click', () => deps.onToggleDeselectedConsent(library.id, consent.id));
                scroll.appendChild(consent);
            }
        }
        if (deps.inventoryError) {
            const error = document.createElement('p');
            error.className = 'setup-preview-error';
            error.textContent = deps.inventoryError;
            scroll.appendChild(error);
        }
        const scanFacts = deps.inventory?.libraries ?? [];
        if (scanFacts.length > 0) {
            const scanList = document.createElement('div');
            scanList.className = 'setup-inventory-list';
            for (const fact of scanFacts) {
                const line = document.createElement('div');
                line.className = 'setup-inventory-line';
                const ready = fact.status === 'ready';
                const partial = scanFacts.some((item) => item.status !== 'ready');
                const accepted = ready && (deps.acceptedReadyLibraryIds.size === 0
                    ? !partial && Boolean(deps.inventory?.acceptedReadyLibraryIds.includes(fact.libraryId))
                    : deps.acceptedReadyLibraryIds.has(fact.libraryId));
                const label = document.createElement(ready ? 'button' : 'div');
                if (ready) {
                    const button = label as HTMLButtonElement;
                    button.id = `setup-ready-${deps.toDomId(fact.libraryId)}`;
                    button.type = 'button';
                    button.className = `setup-toggle${accepted ? ' selected' : ''}`;
                    button.setAttribute('aria-pressed', String(accepted));
                    button.disabled = accepted && deps.acceptedReadyLibraryIds.size === 1;
                    button.addEventListener('click', () => deps.onToggleReady(fact.libraryId, button.id));
                }
                label.textContent = `${fact.libraryName} · ${fact.status}${fact.requiredFamilies.length > 0
                    ? ` · ${fact.requiredFamilies.join(', ')}` : ''}${fact.reason ? ` · ${fact.reason}` : ''}
                    ${fact.progress ? ` · ${fact.progress.label} ${fact.progress.current}${fact.progress.total === null ? '' : `/${fact.progress.total}`}` : ''}`;
                line.appendChild(label);
                if (['failed', 'unsupported', 'canceled', 'empty'].includes(fact.status)) {
                    const retry = document.createElement('button');
                    retry.id = `setup-retry-${deps.toDomId(fact.libraryId)}`;
                    retry.className = 'screen-button secondary';
                    retry.textContent = 'Retry';
                    retry.disabled = deps.isInventoryLoading;
                    retry.addEventListener('click', () => deps.onRetry(fact.libraryId, retry.id));
                    line.appendChild(retry);
                }
                scanList.appendChild(line);
            }
            scroll.appendChild(scanList);
        }
        ctx.contentEl.appendChild(scroll);

        const actions = document.createElement('div');
        actions.className = 'button-row';

        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        backButton.className = 'screen-button secondary';
        backButton.textContent = deps.libraries.length === 0 ? 'Switch server' : 'Back';
        backButton.addEventListener('click', () => {
            deps.onBack();
        });
        actions.appendChild(backButton);

        const scanButton = document.createElement('button');
        scanButton.id = 'setup-scan';
        scanButton.className = 'screen-button secondary';
        scanButton.textContent = deps.isInventoryLoading ? 'Cancel scan' : 'Scan selected libraries';
        scanButton.disabled = deps.selectedLibraryIds.size === 0;
        scanButton.addEventListener('click', () => {
            if (deps.isInventoryLoading) deps.onCancelScan();
            else deps.onScan();
        });
        actions.appendChild(scanButton);

        const nextButton = document.createElement('button');
        nextButton.id = 'setup-next';
        nextButton.className = 'screen-button';
        nextButton.textContent = 'Continue to Configure';
        const partial = scanFacts.some((fact) => fact.status !== 'ready');
        const accepted = deps.acceptedReadyLibraryIds.size > 0 ? [...deps.acceptedReadyLibraryIds]
            : partial ? [] : deps.inventory?.acceptedReadyLibraryIds ?? [];
        nextButton.disabled = deps.isInventoryLoading || deps.selectedLibraryIds.size === 0;
        nextButton.addEventListener('click', () => {
            if (nextButton.disabled) {
                return;
            }
            deps.onNext();
        });
        actions.appendChild(nextButton);

        ctx.contentEl.appendChild(actions);

        const listButtons = Array.from(list.querySelectorAll<HTMLButtonElement>('button'));
        deps.registerStepFocusables(selectAllButton, clearAllButton, [...listButtons, ...Array.from(scroll.querySelectorAll<HTMLButtonElement>('.setup-inventory-line button, [id^=setup-deselected-]'))], [backButton, scanButton, nextButton]);

        const acceptedCount = accepted.length;
        const excluded = scanFacts.filter((fact) => fact.status !== 'ready').map((fact) => fact.libraryName);
        ctx.detailEl.textContent = `Selected ${deps.selectedLibraryIds.size} of ${deps.libraries.length}. ${acceptedCount} ready for Review.${excluded.length ? ` Excluded until ready: ${excluded.join(', ')}.` : ''}`;
    }

    /**
     * Update a single library toggle button in-place (no DOM rebuild).
     * Returns the updated button element, or null if not found.
     */
    updateLibraryToggle(
        container: HTMLElement,
        libraryId: string,
        isSelected: boolean,
        toDomId: (raw: string) => string
    ): HTMLButtonElement | null {
        const buttonId = `setup-lib-${toDomId(libraryId)}`;
        const button = container.querySelector(`#${buttonId}`) as HTMLButtonElement | null;
        if (!button) return null;

        button.classList.toggle('selected', isSelected);
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

        const stateEl = button.querySelector('.setup-toggle-state');
        if (stateEl) {
            stateEl.textContent = '';
            if (isSelected) {
                const stateIcon = document.createElement('span');
                stateIcon.className = 'setup-toggle-state-icon';
                stateIcon.setAttribute('aria-hidden', 'true');
                stateIcon.textContent = '✓';

                const srOnly = document.createElement('span');
                srOnly.className = 'sr-only';
                srOnly.textContent = 'Selected';

                stateEl.appendChild(stateIcon);
                stateEl.appendChild(srOnly);
            } else {
                stateEl.textContent = 'Off';
            }
        }
        return button;
    }
}
