export interface AuthPinLayoutElements {
    codePanelEl: HTMLElement;
    manualHintEl: HTMLElement;
    manualActionsEl: HTMLElement;
    openBrowserButton: HTMLButtonElement;
    copyCodeButton: HTMLButtonElement;
    qrWrapEl: HTMLElement;
    qrCardEl: HTMLElement;
    pinLiveEl: HTMLElement;
    pinBoxesEl: HTMLElement;
}

const createActionButton = (id: string, label: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'auth-link-action';
    button.textContent = label;
    return button;
};

export const createAuthPinLayout = (
    contentEl: HTMLElement,
    beforeEl: HTMLElement
): AuthPinLayoutElements => {
    const composition = document.createElement('div');
    composition.className = 'auth-composition';
    contentEl.insertBefore(composition, beforeEl);

    const codePanelEl = document.createElement('section');
    codePanelEl.className = 'auth-code-card';
    codePanelEl.setAttribute('aria-label', 'Plex sign-in code');
    composition.appendChild(codePanelEl);

    const pinLiveEl = document.createElement('div');
    pinLiveEl.className = 'sr-only';
    pinLiveEl.setAttribute('aria-live', 'polite');
    pinLiveEl.setAttribute('aria-atomic', 'true');
    codePanelEl.appendChild(pinLiveEl);

    const codeLabel = document.createElement('div');
    codeLabel.className = 'auth-code-label';
    codeLabel.textContent = 'Sign-in code';
    codePanelEl.appendChild(codeLabel);

    const pinBoxesEl = document.createElement('div');
    pinBoxesEl.className = 'auth-pin-container';
    pinBoxesEl.setAttribute('aria-hidden', 'true');
    codePanelEl.appendChild(pinBoxesEl);

    const manualHintEl = document.createElement('p');
    manualHintEl.className = 'auth-manual-hint';
    manualHintEl.textContent = 'Visit plex.tv/link and enter this code.';
    codePanelEl.appendChild(manualHintEl);

    const manualActionsEl = document.createElement('div');
    manualActionsEl.className = 'auth-link-actions';
    manualActionsEl.hidden = true;
    const openBrowserButton = createActionButton('btn-auth-open-browser', 'Open browser');
    const copyCodeButton = createActionButton('btn-auth-copy-code', 'Copy code');
    openBrowserButton.disabled = true;
    copyCodeButton.disabled = true;
    manualActionsEl.append(openBrowserButton, copyCodeButton);
    codePanelEl.appendChild(manualActionsEl);

    const qrWrapEl = document.createElement('div');
    qrWrapEl.className = 'auth-qr';
    qrWrapEl.style.display = 'none';

    const qrCardEl = document.createElement('div');
    qrCardEl.className = 'auth-qr-card';
    qrWrapEl.appendChild(qrCardEl);

    const qrLabel = document.createElement('p');
    qrLabel.className = 'auth-qr-label';
    qrLabel.textContent = 'Scan with your phone';
    qrWrapEl.appendChild(qrLabel);
    composition.appendChild(qrWrapEl);

    return {
        codePanelEl,
        manualHintEl,
        manualActionsEl,
        openBrowserButton,
        copyCodeButton,
        qrWrapEl,
        qrCardEl,
        pinLiveEl,
        pinBoxesEl,
    };
};

export const setAuthPinWaiting = (pinContainer: HTMLElement, waiting: boolean): void => {
    pinContainer.classList.toggle('waiting', waiting);
};

export const renderAuthPin = (
    pinLiveEl: HTMLElement,
    pinContainer: HTMLElement,
    code: string,
    options: { idle?: boolean } = {}
): void => {
    const idle = options.idle ?? true;
    pinLiveEl.textContent = `PIN code: ${code}`;
    pinContainer.replaceChildren();

    for (const ch of code) {
        const box = document.createElement('div');
        box.className = idle ? 'auth-pin-character idle' : 'auth-pin-character';
        box.textContent = ch;
        box.setAttribute('aria-hidden', 'true');
        pinContainer.appendChild(box);
    }
};

export const renderAuthCountdownBadge = (
    detailEl: HTMLElement,
    remainingMs: number,
    formatted: string
): void => {
    detailEl.textContent = '';
    const badge = document.createElement('span');
    badge.className = 'auth-countdown-badge';

    if (remainingMs <= 30000) {
        badge.classList.add('countdown-critical');
    } else if (remainingMs <= 120000) {
        badge.classList.add('countdown-warning');
    }

    badge.textContent = `Expires in ${formatted}`;
    detailEl.appendChild(badge);
};
