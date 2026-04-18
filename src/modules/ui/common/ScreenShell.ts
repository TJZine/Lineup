import type {
    ScreenAction,
    ScreenActionVariant,
    ScreenError,
    ScreenShellProps,
    ScreenStatus,
    ScreenTone,
} from '../types/screen-shell';

type ScreenShellHandles = {
    panelEl: HTMLElement;
    heroEl: HTMLElement;
    contentEl: HTMLElement;
    actionsEl: HTMLElement;
    statusEl: HTMLElement;
    detailEl: HTMLElement;
    errorEl: HTMLElement;
    setStatus: (status: ScreenStatus | null) => void;
    setError: (error: ScreenError | null) => void;
    setActions: (actions: ScreenAction[]) => void;
    destroy: () => void;
};

const ACTION_CLASS_BY_VARIANT: Record<ScreenActionVariant, string> = {
    primary: 'screen-button',
    secondary: 'screen-button secondary',
    ghost: 'screen-button ghost',
    destructive: 'screen-button destructive',
};

const TONE_CLASS_BY_TONE: Record<ScreenTone, string> = {
    neutral: 'screen-status--neutral',
    loading: 'screen-status--loading',
    success: 'screen-status--success',
    warning: 'screen-status--warning',
    error: 'screen-status--error',
};

type ScreenShellElements = {
    panelEl: HTMLElement;
    heroEl: HTMLElement;
    contentEl: HTMLElement;
    actionsEl: HTMLElement;
    statusEl: HTMLElement;
    detailEl: HTMLElement;
    errorEl: HTMLElement;
};

function createActionButton(action: ScreenAction): { button: HTMLButtonElement; cleanup: () => void } {
    const button = document.createElement('button');
    button.id = action.id;
    button.type = 'button';
    button.className = ACTION_CLASS_BY_VARIANT[action.variant];
    button.textContent = action.label;
    button.disabled = action.disabled === true;

    const handler = (): void => {
        if (!button.disabled) {
            action.onSelect();
        }
    };
    button.addEventListener('click', handler);
    return {
        button,
        cleanup: (): void => {
            button.removeEventListener('click', handler);
        },
    };
}

function setStatusContent(statusEl: HTMLElement, detailEl: HTMLElement, status: ScreenStatus | null): void {
    statusEl.className = `screen-status${status ? ` ${TONE_CLASS_BY_TONE[status.tone]}` : ''}`;
    statusEl.textContent = status?.title ?? '';
    detailEl.textContent = status?.detail ?? '';

    if (status?.ariaLive) {
        statusEl.setAttribute('aria-live', status.ariaLive);
        return;
    }

    statusEl.removeAttribute('aria-live');
}

function setErrorContent(errorEl: HTMLElement, error: ScreenError | null): void {
    errorEl.textContent = '';
    if (!error) {
        return;
    }

    const title = document.createElement('div');
    title.className = 'screen-error-title';
    title.textContent = error.title;
    errorEl.appendChild(title);

    if (error.message) {
        const message = document.createElement('div');
        message.className = 'screen-error-message';
        message.textContent = error.message;
        errorEl.appendChild(message);
    }

    if (error.recoveryHint) {
        const hint = document.createElement('div');
        hint.className = 'screen-error-hint';
        hint.textContent = error.recoveryHint;
        errorEl.appendChild(hint);
    }
}

function appendOptionalTextElement(
    parent: HTMLElement,
    className: string,
    text: string | null | undefined,
    tagName: 'p' | 'div'
): void {
    if (!text) {
        return;
    }

    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    parent.appendChild(element);
}

function createScreenShellElements(props: ScreenShellProps): ScreenShellElements {
    const panelEl = document.createElement('div');
    panelEl.className = 'screen-panel';

    const titleEl = document.createElement('h1');
    titleEl.className = 'screen-title';
    titleEl.textContent = props.title;

    const heroEl = document.createElement('div');
    heroEl.className = 'screen-hero';
    if (props.heroSlot) {
        heroEl.appendChild(props.heroSlot);
    }
    heroEl.hidden = !props.heroSlot;

    panelEl.appendChild(heroEl);
    panelEl.appendChild(titleEl);
    appendOptionalTextElement(panelEl, 'screen-subtitle', props.subtitle, 'p');

    const contentEl = document.createElement('div');
    contentEl.className = 'screen-content';
    panelEl.appendChild(contentEl);

    const statusEl = document.createElement('div');
    statusEl.className = 'screen-status';
    contentEl.appendChild(statusEl);

    const detailEl = document.createElement('div');
    detailEl.className = 'screen-detail';
    contentEl.appendChild(detailEl);

    const errorEl = document.createElement('div');
    errorEl.className = 'screen-error';
    contentEl.appendChild(errorEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'button-row';
    panelEl.appendChild(actionsEl);

    return {
        panelEl,
        heroEl,
        contentEl,
        actionsEl,
        statusEl,
        detailEl,
        errorEl,
    };
}

export function createScreenShell(container: HTMLElement, props: ScreenShellProps): ScreenShellHandles {
    const elements = createScreenShellElements(props);
    let actionCleanupFns: Array<() => void> = [];

    const setStatus = (status: ScreenStatus | null): void => {
        setStatusContent(elements.statusEl, elements.detailEl, status);
    };

    const setError = (error: ScreenError | null): void => {
        setErrorContent(elements.errorEl, error);
    };

    const setActions = (actions: ScreenAction[]): void => {
        for (const cleanup of actionCleanupFns) cleanup();
        actionCleanupFns = [];
        elements.actionsEl.replaceChildren();

        if (actions.length === 0) {
            elements.actionsEl.style.display = 'none';
            return;
        }
        elements.actionsEl.style.display = '';

        for (const action of actions) {
            const { button, cleanup } = createActionButton(action);
            actionCleanupFns.push(cleanup);
            elements.actionsEl.appendChild(button);
        }
    };

    const destroy = (): void => {
        for (const cleanup of actionCleanupFns) cleanup();
        actionCleanupFns = [];
        elements.panelEl.remove();
    };

    appendOptionalTextElement(elements.panelEl, 'screen-footer-hint', props.footerHint, 'div');
    setStatus(props.status ?? null);
    setError(props.error ?? null);
    setActions(props.actions);
    container.appendChild(elements.panelEl);

    return {
        ...elements,
        setStatus,
        setError,
        setActions,
        destroy,
    };
}
