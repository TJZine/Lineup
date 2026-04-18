import type {
    ScreenAction,
    ScreenActionVariant,
    ScreenError,
    ScreenShellProps,
    ScreenStatus,
    ScreenTone,
} from '../types/screen-shell';

export type ScreenShellView = {
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

type ScreenShellElements = Omit<
    ScreenShellView,
    'setStatus' | 'setError' | 'setActions' | 'destroy'
>;

type ScreenShellControllerState = ScreenShellElements & {
    actionCleanupFns: Array<() => void>;
};

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

function clearActionButtons(state: ScreenShellControllerState): void {
    for (const cleanup of state.actionCleanupFns) {
        cleanup();
    }

    state.actionCleanupFns = [];
    state.actionsEl.replaceChildren();
}

function setActionsContent(state: ScreenShellControllerState, actions: ScreenAction[]): void {
    clearActionButtons(state);

    if (actions.length === 0) {
        state.actionsEl.style.display = 'none';
        return;
    }

    state.actionsEl.style.display = '';
    for (const action of actions) {
        const { button, cleanup } = createActionButton(action);
        state.actionCleanupFns.push(cleanup);
        state.actionsEl.appendChild(button);
    }
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

    appendOptionalTextElement(panelEl, 'screen-footer-hint', props.footerHint, 'div');

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

class ScreenShellController implements ScreenShellView {
    readonly panelEl: HTMLElement;
    readonly heroEl: HTMLElement;
    readonly contentEl: HTMLElement;
    readonly actionsEl: HTMLElement;
    readonly statusEl: HTMLElement;
    readonly detailEl: HTMLElement;
    readonly errorEl: HTMLElement;

    private _state: ScreenShellControllerState;

    constructor(elements: ScreenShellElements) {
        this.panelEl = elements.panelEl;
        this.heroEl = elements.heroEl;
        this.contentEl = elements.contentEl;
        this.actionsEl = elements.actionsEl;
        this.statusEl = elements.statusEl;
        this.detailEl = elements.detailEl;
        this.errorEl = elements.errorEl;
        this._state = {
            ...elements,
            actionCleanupFns: [],
        };
    }

    readonly setStatus = (status: ScreenStatus | null): void => {
        setStatusContent(this.statusEl, this.detailEl, status);
    };

    readonly setError = (error: ScreenError | null): void => {
        setErrorContent(this.errorEl, error);
    };

    readonly setActions = (actions: ScreenAction[]): void => {
        setActionsContent(this._state, actions);
    };

    readonly destroy = (): void => {
        clearActionButtons(this._state);
        this.panelEl.remove();
    };
}

export function createScreenShellView(props: ScreenShellProps): ScreenShellView {
    const controller = new ScreenShellController(createScreenShellElements(props));
    controller.setStatus(props.status ?? null);
    controller.setError(props.error ?? null);
    controller.setActions(props.actions);
    return controller;
}
