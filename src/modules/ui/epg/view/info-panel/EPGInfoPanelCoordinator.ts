import type { IEPGInfoPanel } from '../../interfaces';
import type { ScheduledProgram } from '../../types';

export const INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS = 200;

interface EPGInfoPanelCoordinatorDeps {
    infoPanel: IEPGInfoPanel;
    isEpgVisible: () => boolean;
    getFocusedProgram: () => ScheduledProgram | null;
}

export class EPGInfoPanelCoordinator {
    private readonly infoPanel: IEPGInfoPanel;
    private readonly isEpgVisible: () => boolean;
    private readonly getFocusedProgram: () => ScheduledProgram | null;
    private fullUpdateTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingProgramKey: string | null = null;
    private destroyed = false;

    constructor(deps: EPGInfoPanelCoordinatorDeps) {
        this.infoPanel = deps.infoPanel;
        this.isEpgVisible = deps.isEpgVisible;
        this.getFocusedProgram = deps.getFocusedProgram;
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
        this.destroyed = true;
    }

    isDestroyed(): boolean {
        return this.destroyed;
    }

    private clearFullUpdateTimer(): void {
        if (this.fullUpdateTimer !== null) {
            clearTimeout(this.fullUpdateTimer);
            this.fullUpdateTimer = null;
        }
        this.pendingProgramKey = null;
    }
}
