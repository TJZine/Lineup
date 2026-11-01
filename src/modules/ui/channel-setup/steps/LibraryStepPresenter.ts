import type { ChannelSetupFocusCoordinator } from '../focus/ChannelSetupFocusCoordinator';
import type { ChannelSetupScreenPorts } from '../ChannelSetupScreenPorts';
import { ChannelSetupSessionController } from '../ChannelSetupSessionController';
import { LibraryStepController } from './LibraryStepController';
import type { StepRenderContext } from '../stepContracts';

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
            inventory: session.inventory,
            isInventoryLoading: session.isInventoryLoading,
            inventoryError: session.inventoryError,
            acceptedReadyLibraryIds: session.acceptedReadyLibraryIds,
            knownReadyLibraryIds: session.knownReadyLibraryIds,
            confirmedDeselectedLibraryIds: session.confirmedDeselectedLibraryIds,
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
                this._deps.screenPorts.goBackFromLibraries();
            },
            onScan: () => {
                void this._deps.session.scanInventory(() => this._deps.renderStep());
            },
            onCancelScan: () => {
                this._deps.session.cancelInventory();
                this._deps.renderStep();
            },
            onRetry: (libraryId, _focusId) => {
                this._deps.setPreferredFocusId(`setup-lib-${this._toDomId(libraryId)}`);
                void this._deps.session.retryInventory(libraryId, () => this._deps.renderStep());
            },
            onToggleReady: (libraryId, focusId) => {
                const latest = this._deps.session.getSnapshot();
                const partial = latest.inventory?.libraries.some((fact) => fact.status !== 'ready') ?? false;
                const ids = new Set(latest.acceptedReadyLibraryIds.size > 0
                    ? latest.acceptedReadyLibraryIds : partial ? [] : latest.inventory?.acceptedReadyLibraryIds ?? []);
                if (ids.has(libraryId)) ids.delete(libraryId);
                else ids.add(libraryId);
                if (ids.size > 0) this._deps.session.acceptReadySubset([...ids]);
                this._deps.setPreferredFocusId(focusId);
                this._deps.renderStep();
            },
            onToggleDeselectedConsent: (libraryId, focusId) => {
                const confirmed = new Set(this._deps.session.getSnapshot().confirmedDeselectedLibraryIds);
                if (confirmed.has(libraryId)) confirmed.delete(libraryId);
                else confirmed.add(libraryId);
                this._deps.session.confirmDeselectedLibraries([...confirmed]);
                this._deps.setPreferredFocusId(focusId);
                this._deps.renderStep();
            },
            onNext: () => {
                this._deps.session.setStep(2);
                this._deps.renderStep();
            },
            registerStepFocusables: (selectAllButton, clearAllButton, listButtons, footerButtons) => {
                const preferredApplied = this._deps.focus.registerLibraryStep({
                    selectAllButton,
                    clearAllButton,
                    listButtons,
                    footerButtons,
                    preferredFocusId: this._deps.getPreferredFocusId(),
                });
                if (preferredApplied) {
                    this._deps.setPreferredFocusId(null);
                }
            },
        });
    }

    private _handleToggleLibrary(ctx: StepRenderContext, libraryId: string, focusId: string): void {
        const hadInventory = this._deps.session.getSnapshot().inventory !== null;
        this._deps.setPreferredFocusId(focusId);
        const selected = this._deps.session.toggleLibrary(libraryId);
        if (hadInventory) {
            this._deps.renderStep();
            return;
        }
        const button = this._libraryStep.updateLibraryToggle(this._deps.contentEl, libraryId, selected,
            (raw) => this._toDomId(raw));
        if (!button) { this._deps.renderStep(); return; }
        const latest = this._deps.session.getSnapshot();
        ctx.detailEl.textContent = `Selected ${latest.selectedLibraryIds.size} of ${latest.libraries.length}. 0 ready for Configure.`;
        const scan = this._deps.contentEl.querySelector<HTMLButtonElement>('#setup-scan');
        if (scan) scan.disabled = latest.selectedLibraryIds.size === 0;
        this._deps.setPreferredFocusId(null);
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
