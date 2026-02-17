import type { OverlayPanelConfig, OverlayProps } from '../types/overlay-primitives';

interface OverlayPrimitiveClassNames {
    panel: string;
    header?: string;
    title?: string;
    content?: string;
    meta?: string;
    hints?: string;
    actions?: string;
}

interface OverlayPrimitiveElements {
    panelEl: HTMLElement;
    headerEl: HTMLElement | null;
    titleEl: HTMLElement | null;
    contentEl: HTMLElement | null;
    metaEl: HTMLElement | null;
    hintsEl: HTMLElement | null;
    actionsEl: HTMLElement | null;
}

export function createOverlayPrimitives(
    classNames: OverlayPrimitiveClassNames,
    props: OverlayProps
): OverlayPrimitiveElements {
    const panelEl = document.createElement('div');
    panelEl.className = classNames.panel;
    applyOverlayPanelConfig(panelEl, props.panel);

    const headerEl = classNames.header ? document.createElement('div') : null;
    if (headerEl && classNames.header) {
        headerEl.className = classNames.header;
        panelEl.appendChild(headerEl);
    }

    const titleText = typeof props.title === 'string' ? props.title.trim() : '';
    const titleEl = classNames.title && titleText ? document.createElement('h1') : null;
    if (titleEl && classNames.title) {
        titleEl.className = classNames.title;
        titleEl.textContent = titleText;
        (headerEl ?? panelEl).appendChild(titleEl);
    }

    const contentEl = classNames.content ? document.createElement('div') : null;
    if (contentEl && classNames.content) {
        contentEl.className = classNames.content;
        panelEl.appendChild(contentEl);
    }

    const metaEl = classNames.meta ? document.createElement('div') : null;
    if (metaEl && classNames.meta) {
        metaEl.className = classNames.meta;
        if (props.metaSlot) {
            metaEl.appendChild(props.metaSlot);
        }
        panelEl.appendChild(metaEl);
    }

    const hintsEl = classNames.hints ? document.createElement('div') : null;
    if (hintsEl && classNames.hints) {
        hintsEl.className = classNames.hints;
        if (props.hintsSlot) {
            hintsEl.appendChild(props.hintsSlot);
        }
        panelEl.appendChild(hintsEl);
    }

    const actionsEl = classNames.actions ? document.createElement('div') : null;
    if (actionsEl && classNames.actions) {
        actionsEl.className = classNames.actions;
        if (props.actionsSlot) {
            actionsEl.appendChild(props.actionsSlot);
        }
        panelEl.appendChild(actionsEl);
    }

    return {
        panelEl,
        headerEl,
        titleEl,
        contentEl,
        metaEl,
        hintsEl,
        actionsEl,
    };
}

function applyOverlayPanelConfig(panelEl: HTMLElement, panel: OverlayPanelConfig): void {
    if (panel.maxWidth) {
        panelEl.style.maxWidth = panel.maxWidth;
    } else {
        panelEl.style.removeProperty('max-width');
    }
    if (typeof panel.safeMarginPct === 'number' && Number.isFinite(panel.safeMarginPct)) {
        panelEl.style.setProperty('--overlay-safe-margin-pct', String(panel.safeMarginPct));
    } else {
        panelEl.style.removeProperty('--overlay-safe-margin-pct');
    }
}
