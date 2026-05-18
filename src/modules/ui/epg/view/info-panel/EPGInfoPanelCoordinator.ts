import type { EpgLayoutMode } from '../../../../settings/EpgPreferencesStore';
import type { IEPGInfoPanel } from '../../interfaces';
import type { ScheduledProgram } from '../../types';

export const INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS = 200;

interface EPGInfoPanelCoordinatorDeps {
    infoPanel: IEPGInfoPanel;
    isEpgVisible: () => boolean;
    getFocusedProgram: () => ScheduledProgram | null;
}

interface EPGInfoPanelHosts {
    infoPanelElement: HTMLElement | null;
    overlayShowcaseElement: HTMLElement | null;
    classicShowcaseInfoElement: HTMLElement | null;
}

export class EPGInfoPanelCoordinator {
    private readonly infoPanel: IEPGInfoPanel;
    private readonly isEpgVisible: () => boolean;
    private readonly getFocusedProgram: () => ScheduledProgram | null;
    private infoPanelElement: HTMLElement | null = null;
    private overlayShowcaseElement: HTMLElement | null = null;
    private classicShowcaseInfoElement: HTMLElement | null = null;
    private layoutMode: EpgLayoutMode = 'overlay';
    private fullUpdateTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingProgramKey: string | null = null;
    private destroyed = false;

    constructor(deps: EPGInfoPanelCoordinatorDeps) {
        this.infoPanel = deps.infoPanel;
        this.isEpgVisible = deps.isEpgVisible;
        this.getFocusedProgram = deps.getFocusedProgram;
    }

    attachHosts(hosts: EPGInfoPanelHosts): void {
        if (this.destroyed) {
            return;
        }
        this.infoPanelElement = hosts.infoPanelElement;
        this.overlayShowcaseElement = hosts.overlayShowcaseElement;
        this.classicShowcaseInfoElement = hosts.classicShowcaseInfoElement;
        this.syncHost();
    }

    setLayoutMode(mode: EpgLayoutMode): void {
        if (this.destroyed) {
            return;
        }
        this.layoutMode = mode;
        this.infoPanel.setPresentationMode(mode);
        this.syncHost();
    }

    syncFocusedProgram(program: ScheduledProgram | null): void {
        if (this.destroyed) {
            return;
        }
        if (program === null) {
            this.clear();
            return;
        }

        if (!this.isEpgVisible()) {
            this.clearFullUpdateTimer();
            this.pendingProgramKey = null;
            return;
        }

        this.infoPanel.updateFast(program);
        this.clearFullUpdateTimer();

        const key = `${program.item.ratingKey}::${program.scheduledStartTime}`;
        this.pendingProgramKey = key;

        this.fullUpdateTimer = setTimeout(() => {
            this.fullUpdateTimer = null;
            if (this.pendingProgramKey !== key) {
                return;
            }
            this.pendingProgramKey = null;

            const focusedProgram = this.getFocusedProgram();
            if (this.destroyed) return;
            if (!this.isEpgVisible()) return;
            if (focusedProgram === null) return;

            const focusedKey = `${focusedProgram.item.ratingKey}::${focusedProgram.scheduledStartTime}`;
            if (focusedKey !== key) return;

            this.infoPanel.updateFull(program);
        }, INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS);
    }

    clear(): void {
        if (this.destroyed) {
            return;
        }
        this.clearFullUpdateTimer();
        this.infoPanel.hide();
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }
        this.clear();
        this.infoPanelElement = null;
        this.overlayShowcaseElement = null;
        this.classicShowcaseInfoElement = null;
        this.layoutMode = 'overlay';
        this.destroyed = true;
    }

    isDestroyed(): boolean {
        return this.destroyed;
    }

    private syncHost(): void {
        const infoPanelElement = this.infoPanelElement;
        const target = this.layoutMode === 'classic'
            ? this.classicShowcaseInfoElement
            : this.overlayShowcaseElement;

        if (!infoPanelElement || !target) {
            return;
        }

        if (infoPanelElement.parentElement !== target) {
            target.appendChild(infoPanelElement);
        }
    }

    private clearFullUpdateTimer(): void {
        if (this.fullUpdateTimer !== null) {
            clearTimeout(this.fullUpdateTimer);
            this.fullUpdateTimer = null;
        }
        this.pendingProgramKey = null;
    }
}
