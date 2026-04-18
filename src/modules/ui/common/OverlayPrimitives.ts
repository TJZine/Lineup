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

    const headerEl = createOptionalPanelSection(panelEl, classNames.header);

    const titleText = typeof props.title === 'string' ? props.title.trim() : '';
    const titleEl = classNames.title && titleText ? document.createElement('h1') : null;
    if (titleEl && classNames.title) {
        titleEl.className = classNames.title;
        titleEl.textContent = titleText;
        (headerEl ?? panelEl).appendChild(titleEl);
    }

    const contentEl = createOptionalPanelSection(panelEl, classNames.content);
    const metaEl = createOptionalPanelSection(panelEl, classNames.meta, props.metaSlot);
    const hintsEl = createOptionalPanelSection(panelEl, classNames.hints, props.hintsSlot);
    const actionsEl = createOptionalPanelSection(panelEl, classNames.actions, props.actionsSlot);

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

function createOptionalPanelSection(
    panelEl: HTMLElement,
    className: string | undefined,
    slot?: HTMLElement | null
): HTMLElement | null {
    if (!className) {
        return null;
    }

    const sectionEl = document.createElement('div');
    sectionEl.className = className;
    if (slot) {
        sectionEl.appendChild(slot);
    }
    panelEl.appendChild(sectionEl);

    return sectionEl;
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
