export const createProfilePinDigitButton = (digit: number, onClick: (digit: string) => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.id = `btn-profile-pin-${digit}`;
    button.className = 'profile-numpad-button';
    button.textContent = String(digit);
    button.setAttribute('aria-label', `Digit ${digit}`);
    button.addEventListener('click', () => {
        onClick(String(digit));
    });
    return button;
};

export const createProfilePinBackspaceButton = (onClick: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.id = 'btn-profile-pin-backspace';
    button.className = 'profile-numpad-button numpad-action';
    button.textContent = '\u2190';
    button.setAttribute('aria-label', 'Backspace');
    button.addEventListener('click', onClick);
    return button;
};

export const createProfilePinCancelButton = (onClick: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.id = 'btn-profile-pin-cancel';
    button.className = 'profile-pin-cancel';
    button.textContent = 'Cancel';
    button.addEventListener('click', onClick);
    return button;
};
