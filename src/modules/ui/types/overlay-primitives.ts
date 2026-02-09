export interface OverlayPanelConfig {
    maxWidth?: string;
    safeMarginPct?: number;
}

export interface OverlayProps {
    panel: OverlayPanelConfig;
    title?: string;
    metaSlot?: HTMLElement | null;
    hintsSlot?: HTMLElement | null;
    actionsSlot?: HTMLElement | null;
}
