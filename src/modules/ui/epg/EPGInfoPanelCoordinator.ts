import type { IEPGInfoPanel } from './interfaces';
import type { ScheduledProgram } from './types';

const INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS = 200;

interface EPGInfoPanelCoordinatorDeps {
    infoPanel: IEPGInfoPanel;
    getIsVisible: () => boolean;
    getFocusedProgram: () => ScheduledProgram | null;
}

interface EPGInfoPanelHosts {
    infoPanelElement: HTMLElement | null;
    overlayShowcaseElement: HTMLElement | null;
    classicShowcaseInfoElement: HTMLElement | null;
}

export class EPGInfoPanelCoordinator {
    private readonly infoPanel: IEPGInfoPanel;
    private readonly getIsVisible: () => boolean;
    private readonly getFocusedProgram: () => ScheduledProgram | null;
    private infoPanelElement: HTMLElement | null = null;
    private overlayShowcaseElement: HTMLElement | null = null;
    private classicShowcaseInfoElement: HTMLElement | null = null;
    private layoutMode: 'overlay' | 'classic' = 'overlay';
    private fullUpdateTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingProgramKey: string | null = null;

    constructor(deps: EPGInfoPanelCoordinatorDeps) {
        this.infoPanel = deps.infoPanel;
        this.getIsVisible = deps.getIsVisible;
        this.getFocusedProgram = deps.getFocusedProgram;
    }

    attachHosts(hosts: EPGInfoPanelHosts): void {
        this.infoPanelElement = hosts.infoPanelElement;
        this.overlayShowcaseElement = hosts.overlayShowcaseElement;
        this.classicShowcaseInfoElement = hosts.classicShowcaseInfoElement;
        this.syncHost();
    }

    setLayoutMode(mode: 'overlay' | 'classic'): void {
        this.layoutMode = mode;
        this.infoPanel.setPresentationMode(mode);
        this.syncHost();
    }

    syncFocusedProgram(program: ScheduledProgram | null): void {
        if (program === null) {
            this.clear();
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
            if (!this.getIsVisible()) return;
            if (focusedProgram === null) return;

            const focusedKey = `${focusedProgram.item.ratingKey}::${focusedProgram.scheduledStartTime}`;
            if (focusedKey !== key) return;

            this.infoPanel.updateFull(program);
        }, INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS);
    }

    clear(): void {
        this.clearFullUpdateTimer();
        this.infoPanel.hide();
    }

    destroy(): void {
        this.clear();
        this.infoPanelElement = null;
        this.overlayShowcaseElement = null;
        this.classicShowcaseInfoElement = null;
        this.layoutMode = 'overlay';
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
