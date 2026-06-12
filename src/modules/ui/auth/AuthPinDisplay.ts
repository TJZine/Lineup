export interface AuthPinLayoutElements {
    qrWrapEl: HTMLElement;
    qrCardEl: HTMLElement;
    pinLiveEl: HTMLElement;
    pinBoxesEl: HTMLElement;
}

export const createAuthPinLayout = (
    contentEl: HTMLElement,
    beforeEl: HTMLElement
): AuthPinLayoutElements => {
    const composition = document.createElement('div');
    composition.className = 'auth-composition';
    contentEl.insertBefore(composition, beforeEl);

    const qrWrapEl = document.createElement('div');
    qrWrapEl.className = 'auth-qr';
    qrWrapEl.style.display = 'none';

    const qrCardEl = document.createElement('div');
    qrCardEl.className = 'auth-qr-card';
    qrWrapEl.appendChild(qrCardEl);
    composition.appendChild(qrWrapEl);

    const pinLiveEl = document.createElement('div');
    pinLiveEl.className = 'sr-only';
    pinLiveEl.setAttribute('aria-live', 'polite');
    pinLiveEl.setAttribute('aria-atomic', 'true');
    composition.appendChild(pinLiveEl);

    const pinBoxesEl = document.createElement('div');
    pinBoxesEl.className = 'auth-pin-container';
    pinBoxesEl.setAttribute('aria-hidden', 'true');
    composition.appendChild(pinBoxesEl);

    return { qrWrapEl, qrCardEl, pinLiveEl, pinBoxesEl };
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
