import type { FocusableElement } from '../../../navigation';
import { scrollToNearest } from '../focus/scrollToNearest';
import type { ChannelSetupFocusCoordinator } from '../focus/ChannelSetupFocusCoordinator';
import type { ChannelSetupScreenPorts } from '../ChannelSetupScreenPorts';
import { ChannelSetupSessionController } from '../ChannelSetupSessionController';
import { LibraryStepController } from './LibraryStepController';
import type { StepRenderContext } from './types';

const MOVIE_SVG = `
<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" aria-hidden="true">
  <rect x="3" y="5" width="18" height="14" rx="2"></rect>
  <path d="M8 3v4"></path>
  <path d="M16 3v4"></path>
  <path d="M8 19v2"></path>
  <path d="M16 19v2"></path>
</svg>
`;

const SHOW_SVG = `
<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" aria-hidden="true">
  <rect x="2" y="3" width="20" height="14" rx="2"></rect>
  <path d="M8 21h8"></path>
  <path d="M12 17v4"></path>
  <path d="M6 7h12"></path>
</svg>
`;

export class LibraryStepPresenter {
    private readonly _libraryStep = new LibraryStepController();

    constructor(
        private readonly _deps: {
            session: ChannelSetupSessionController;
            focus: ChannelSetupFocusCoordinator;
            screenPorts: ChannelSetupScreenPorts;
            contentEl: HTMLElement;
            getPreferredFocusId: () => string | null;
            setPreferredFocusId: (focusId: string | null) => void;
            renderStep: () => void;
        }
    ) {}

    render(ctx: StepRenderContext): void {
        const session = this._deps.session.getSnapshot();
        this._libraryStep.render(ctx, {
            libraries: session.libraries,
            selectedLibraryIds: session.selectedLibraryIds,
            formatCount: (value) => this._formatCount(value),
            movieSvg: MOVIE_SVG,
            showSvg: SHOW_SVG,
            toDomId: (raw) => this._toDomId(raw),
            onToggleLibrary: (libraryId, focusId) => {
                this._handleToggleLibrary(ctx, libraryId, focusId);
            },
            onSelectAll: (focusId) => {
                this._deps.session.selectAllLibraries();
                this._deps.setPreferredFocusId(focusId);
                this._deps.renderStep();
            },
            onClearAll: (focusId) => {
                this._deps.session.clearAllLibraries();
                this._deps.setPreferredFocusId(focusId);
                this._deps.renderStep();
            },
            onBack: () => {
                this._deps.screenPorts.openServerSelect();
            },
            onNext: () => {
                this._deps.session.setStep(2);
                this._deps.renderStep();
            },
            registerSpatialFocusables: (buttons) => {
                const preferredApplied = this._deps.focus.registerSpatial(buttons, this._deps.getPreferredFocusId());
                if (preferredApplied) {
                    this._deps.setPreferredFocusId(null);
                }
            },
            registerBulkActionNeighbors: (selectAllButton, clearAllButton, listButtons) => {
                this._registerBulkActionNeighbors(selectAllButton, clearAllButton, listButtons);
            },
        });
    }

    private _handleToggleLibrary(ctx: StepRenderContext, libraryId: string, focusId: string): void {
        this._deps.setPreferredFocusId(focusId);
        const nextSelected = this._deps.session.toggleLibrary(libraryId);

        const updated = this._libraryStep.updateLibraryToggle(
            this._deps.contentEl,
            libraryId,
            nextSelected,
            (raw) => this._toDomId(raw)
        );
        if (!updated) {
            this._deps.renderStep();
            return;
        }

        const updatedSession = this._deps.session.getSnapshot();
        this._deps.setPreferredFocusId(null);
        const count = updatedSession.selectedLibraryIds.size;
        const total = updatedSession.libraries.length;
        ctx.detailEl.textContent = `Selected ${count} of ${total}.`;
        const nextButton = this._deps.contentEl.querySelector('#setup-next') as HTMLButtonElement | null;
        if (nextButton) {
            nextButton.disabled = updatedSession.libraries.length === 0 || updatedSession.selectedLibraryIds.size === 0;
        }
    }

    private _registerBulkActionNeighbors(
        selectAllButton: HTMLButtonElement,
        clearAllButton: HTMLButtonElement,
        listButtons: HTMLButtonElement[]
    ): void {
        const nav = this._deps.screenPorts.getNavigation();
        if (!nav) {
            return;
        }
        const downNeighbor = listButtons[0]?.id;

        if (!selectAllButton.disabled) {
            const selectAllNeighbors: FocusableElement['neighbors'] = {};
            if (!clearAllButton.disabled) {
                selectAllNeighbors.right = clearAllButton.id;
            }
            if (downNeighbor) {
                selectAllNeighbors.down = downNeighbor;
            }
            nav.registerFocusable({
                id: selectAllButton.id,
                element: selectAllButton,
                neighbors: selectAllNeighbors,
                onFocus: () => {
                    scrollToNearest(selectAllButton);
                },
            });
        }

        if (!clearAllButton.disabled) {
            const clearAllNeighbors: FocusableElement['neighbors'] = {};
            if (!selectAllButton.disabled) {
                clearAllNeighbors.left = selectAllButton.id;
            }
            if (downNeighbor) {
                clearAllNeighbors.down = downNeighbor;
            }
            nav.registerFocusable({
                id: clearAllButton.id,
                element: clearAllButton,
                neighbors: clearAllNeighbors,
                onFocus: () => {
                    scrollToNearest(clearAllButton);
                },
            });
        }
    }

    private _toDomId(raw: string): string {
        return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    private _formatCount(value: number): string {
        try {
            return new Intl.NumberFormat().format(value);
        } catch {
            return String(value);
        }
    }
}
