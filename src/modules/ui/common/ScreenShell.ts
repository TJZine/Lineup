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

export function createScreenShell(container: HTMLElement, props: ScreenShellProps): ScreenShellHandles {
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

    if (props.subtitle) {
        const subtitleEl = document.createElement('p');
        subtitleEl.className = 'screen-subtitle';
        subtitleEl.textContent = props.subtitle;
        panelEl.appendChild(subtitleEl);
    }

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

    let actionCleanupFns: Array<() => void> = [];

    const setStatus = (status: ScreenStatus | null): void => {
        statusEl.className = `screen-status${status ? ` ${TONE_CLASS_BY_TONE[status.tone]}` : ''}`;
        statusEl.textContent = status?.title ?? '';
        if (status?.ariaLive) {
            statusEl.setAttribute('aria-live', status.ariaLive);
        } else {
            statusEl.removeAttribute('aria-live');
        }
        detailEl.textContent = status?.detail ?? '';
    };

    const setError = (error: ScreenError | null): void => {
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
    };

    const setActions = (actions: ScreenAction[]): void => {
        for (const cleanup of actionCleanupFns) cleanup();
        actionCleanupFns = [];
        actionsEl.replaceChildren();

        if (actions.length === 0) {
            actionsEl.style.display = 'none';
            return;
        }
        actionsEl.style.display = '';

        for (const action of actions) {
            const button = document.createElement('button');
            button.id = action.id;
            button.type = 'button';
            button.className = ACTION_CLASS_BY_VARIANT[action.variant];
            button.textContent = action.label;
            button.disabled = action.disabled === true;

            const handler = (): void => {
                if (button.disabled) {
                    return;
                }
                action.onSelect();
            };
            button.addEventListener('click', handler);
            actionCleanupFns.push(() => {
                button.removeEventListener('click', handler);
            });

            actionsEl.appendChild(button);
        }
    };

    const destroy = (): void => {
        for (const cleanup of actionCleanupFns) cleanup();
        actionCleanupFns = [];
        panelEl.remove();
    };

    if (props.footerHint) {
        const footerHintEl = document.createElement('div');
        footerHintEl.className = 'screen-footer-hint';
        footerHintEl.textContent = props.footerHint;
        panelEl.appendChild(footerHintEl);
    }

    setStatus(props.status ?? null);
    setError(props.error ?? null);
    setActions(props.actions);

    container.appendChild(panelEl);

    return {
        panelEl,
        heroEl,
        contentEl,
        actionsEl,
        statusEl,
        detailEl,
        errorEl,
        setStatus,
        setError,
        setActions,
        destroy,
    };
}
