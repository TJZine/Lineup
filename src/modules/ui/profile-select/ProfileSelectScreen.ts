/**
 * @fileoverview Plex Home profile selection screen.
 * @module modules/ui/profile-select/ProfileSelectScreen
 * @version 1.0.0
 */

import { AppOrchestrator } from '../../../Orchestrator';
import type { PlexHomeUser } from '../../plex/auth';
import type { FocusableElement, KeyEvent } from '../../navigation';
import { PlexApiError } from '../../plex/auth';

const FOCUS_RESTORE_DELAY_MS = 50;
const PIN_LENGTH = 4;
const PIN_MODAL_ID = 'profile-pin';

export class ProfileSelectScreen {
    private _container: HTMLElement;
    private _orchestrator: AppOrchestrator;
    private _statusEl: HTMLElement;
    private _errorEl: HTMLElement;
    private _listEl: HTMLElement;
    private _mainButton: HTMLButtonElement;
    private _signOutButton: HTMLButtonElement;
    private _focusableIds: string[] = [];
    private _userButtonIds: string[] = [];
    private _restoreFocusTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _isLoading: boolean = false;

    private _pinModal: HTMLElement;
    private _pinPromptEl: HTMLElement;
    private _pinErrorEl: HTMLElement;
    private _pinSlotsWrapEl: HTMLElement;
    private _pinSlots: HTMLElement[] = [];
    private _pinCancelButton: HTMLButtonElement;
    private _pinDigits: string = '';
    private _pinTargetUser: PlexHomeUser | null = null;
    private _isPinOpen: boolean = false;
    private _isSwitching: boolean = false;
    private _pinJustFilledTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _pinErrorTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(container: HTMLElement, orchestrator: AppOrchestrator) {
        this._container = container;
        this._orchestrator = orchestrator;
        this._container.classList.add('screen', 'profile-select');
        this._container.style.position = 'absolute';
        this._container.style.inset = '0';
        this._container.style.display = 'none';
        this._container.style.alignItems = 'center';
        this._container.style.justifyContent = 'center';

        const panel = document.createElement('div');
        panel.className = 'screen-panel profile-panel';

        const title = document.createElement('h1');
        title.className = 'screen-title';
        title.textContent = "Who's watching?";
        panel.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.className = 'screen-subtitle';
        subtitle.textContent = 'Choose a Plex Home profile to continue.';
        panel.appendChild(subtitle);

        const status = document.createElement('div');
        status.className = 'screen-status';
        status.textContent = 'Loading profiles...';
        panel.appendChild(status);
        this._statusEl = status;

        const error = document.createElement('div');
        error.className = 'screen-error';
        error.textContent = '';
        error.setAttribute('role', 'alert');
        error.setAttribute('aria-live', 'assertive');
        panel.appendChild(error);
        this._errorEl = error;

        const list = document.createElement('div');
        list.className = 'profile-list';
        panel.appendChild(list);
        this._listEl = list;

        const tip = document.createElement('div');
        tip.className = 'profile-tip';
        tip.textContent = 'Tip: Set a PIN on the admin profile to prevent unwanted access.';
        panel.appendChild(tip);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'button-row';

        const mainButton = document.createElement('button');
        mainButton.id = 'btn-profile-main';
        mainButton.className = 'screen-button';
        mainButton.textContent = 'Use Main Account';
        mainButton.addEventListener('click', () => {
            void this._handleUseMainAccount();
        });
        buttonRow.appendChild(mainButton);
        this._mainButton = mainButton;

        const signOutButton = document.createElement('button');
        signOutButton.id = 'btn-profile-signout';
        signOutButton.className = 'screen-button secondary';
        signOutButton.textContent = 'Sign out';
        signOutButton.addEventListener('click', () => {
            void this._handleSignOut();
        });
        buttonRow.appendChild(signOutButton);
        this._signOutButton = signOutButton;

        panel.appendChild(buttonRow);
        this._container.appendChild(panel);

        // PIN modal (hidden by default)
        const modal = document.createElement('div');
        modal.className = 'profile-pin-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'profile-pin-title');
        modal.setAttribute('aria-describedby', 'profile-pin-desc');
        modal.style.display = 'none';

        const modalCard = document.createElement('div');
        modalCard.className = 'profile-pin-card';

        const prompt = document.createElement('div');
        prompt.className = 'profile-pin-title';
        prompt.id = 'profile-pin-title';
        prompt.textContent = 'Enter PIN';
        modalCard.appendChild(prompt);
        this._pinPromptEl = prompt;

        const slots = document.createElement('div');
        slots.className = 'profile-pin-slots';
        this._pinSlotsWrapEl = slots;
        for (let i = 0; i < PIN_LENGTH; i++) {
            const slot = document.createElement('span');
            slot.className = 'profile-pin-slot';
            slot.setAttribute('aria-hidden', 'true');
            slots.appendChild(slot);
            this._pinSlots.push(slot);
        }
        modalCard.appendChild(slots);

        const numpad = document.createElement('div');
        numpad.className = 'profile-numpad';
        numpad.setAttribute('role', 'group');
        numpad.setAttribute('aria-label', 'PIN entry numpad');

        for (let digit = 1; digit <= 9; digit++) {
            const button = document.createElement('button');
            button.id = `btn-profile-pin-${digit}`;
            button.className = 'profile-numpad-button';
            button.textContent = String(digit);
            button.setAttribute('aria-label', `Digit ${digit}`);
            button.addEventListener('click', () => {
                this._handlePinInput(String(digit));
            });
            numpad.appendChild(button);
        }

        const backspaceButton = document.createElement('button');
        backspaceButton.id = 'btn-profile-pin-backspace';
        backspaceButton.className = 'profile-numpad-button';
        backspaceButton.textContent = 'Back';
        backspaceButton.setAttribute('aria-label', 'Backspace');
        backspaceButton.addEventListener('click', () => {
            this._handlePinBackspace();
        });
        numpad.appendChild(backspaceButton);

        const zeroButton = document.createElement('button');
        zeroButton.id = 'btn-profile-pin-0';
        zeroButton.className = 'profile-numpad-button';
        zeroButton.textContent = '0';
        zeroButton.setAttribute('aria-label', 'Digit 0');
        zeroButton.addEventListener('click', () => {
            this._handlePinInput('0');
        });
        numpad.appendChild(zeroButton);

        const okButton = document.createElement('button');
        okButton.id = 'btn-profile-pin-ok';
        okButton.className = 'profile-numpad-button';
        okButton.textContent = 'OK';
        okButton.setAttribute('aria-label', 'Submit');
        okButton.disabled = true;
        okButton.tabIndex = -1;
        numpad.appendChild(okButton);

        modalCard.appendChild(numpad);

        const pinError = document.createElement('div');
        pinError.className = 'profile-pin-error';
        pinError.id = 'profile-pin-desc';
        pinError.textContent = '';
        pinError.setAttribute('role', 'alert');
        pinError.setAttribute('aria-live', 'assertive');
        modalCard.appendChild(pinError);
        this._pinErrorEl = pinError;

        const cancelButton = document.createElement('button');
        cancelButton.id = 'btn-profile-pin-cancel';
        cancelButton.className = 'screen-button secondary';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            this._closePinModal();
        });
        modalCard.appendChild(cancelButton);
        this._pinCancelButton = cancelButton;

        modal.appendChild(modalCard);
        this._container.appendChild(modal);
        this._pinModal = modal;
    }

    show(): void {
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        this._setStatus('Loading profiles...');
        this._clearError();
        this._registerKeyHandler();
        void this._loadProfiles();
    }

    hide(): void {
        this._unregisterFocusables();
        this._unregisterKeyHandler();
        this._closePinModal();
        if (this._restoreFocusTimeoutId !== null) {
            clearTimeout(this._restoreFocusTimeoutId);
            this._restoreFocusTimeoutId = null;
        }
        if (this._pinJustFilledTimeoutId !== null) {
            clearTimeout(this._pinJustFilledTimeoutId);
            this._pinJustFilledTimeoutId = null;
        }
        if (this._pinErrorTimeoutId !== null) {
            clearTimeout(this._pinErrorTimeoutId);
            this._pinErrorTimeoutId = null;
        }
        this._container.style.display = 'none';
        this._container.classList.remove('visible');
    }

    private async _loadProfiles(): Promise<void> {
        if (this._isLoading) return;
        this._isLoading = true;
        this._listEl.replaceChildren();
        this._userButtonIds = [];
        this._setStatus('Loading profiles...');

        try {
            const users = await this._orchestrator.getHomeUsers();
            if (users.length <= 1) {
                const nav = this._orchestrator.getNavigation();
                if (nav?.getCurrentScreen() === 'profile-select') {
                    nav.goTo('server-select', { allowAutoConnect: true });
                }
                return;
            }
            this._renderUsers(users);
            this._setStatus('Select a profile to continue.');
        } catch (error) {
            this._handleError(error, 'Unable to load profiles.');
            this._setStatus('Profile list unavailable.');
        } finally {
            this._isLoading = false;
            const nav = this._orchestrator.getNavigation();
            if (nav?.getCurrentScreen() === 'profile-select') {
                this._registerFocusables();
                this._restoreFocus();
            }
        }
    }

    private _renderUsers(users: PlexHomeUser[]): void {
        this._listEl.replaceChildren();
        this._userButtonIds = [];

        users.forEach((user, index) => {
            const button = document.createElement('button');
            button.id = `btn-profile-${index}`;
            button.className = 'profile-row';
            button.addEventListener('click', () => {
                void this._handleUserSelect(user);
            });

            const avatar = document.createElement('div');
            avatar.className = 'profile-avatar';
            if (user.thumb) {
                const img = document.createElement('img');
                img.src = user.thumb;
                img.alt = `${user.title} avatar`;
                img.loading = 'lazy';
                img.addEventListener('error', () => {
                    img.remove();
                    avatar.classList.add('profile-avatar-fallback');
                    avatar.textContent = user.title.slice(0, 1).toUpperCase();
                });
                avatar.appendChild(img);
            } else {
                avatar.classList.add('profile-avatar-fallback');
                avatar.textContent = user.title.slice(0, 1).toUpperCase();
            }

            const details = document.createElement('div');
            details.className = 'profile-details';

            const nameRow = document.createElement('div');
            nameRow.className = 'profile-name-row';

            const name = document.createElement('span');
            name.className = 'profile-name';
            name.textContent = user.title;
            nameRow.appendChild(name);

            if (user.protected) {
                const lock = document.createElement('span');
                lock.className = 'profile-lock';
                lock.textContent = 'PIN';
                lock.setAttribute('aria-label', 'PIN required');
                nameRow.appendChild(lock);
            }

            if (user.admin) {
                const admin = document.createElement('span');
                admin.className = 'profile-admin';
                admin.textContent = 'Admin';
                nameRow.appendChild(admin);
            }

            details.appendChild(nameRow);

            const meta = document.createElement('div');
            meta.className = 'profile-meta';
            meta.textContent = user.restricted ? 'Restricted' : 'Standard access';
            details.appendChild(meta);

            button.appendChild(avatar);
            button.appendChild(details);

            this._listEl.appendChild(button);
            this._userButtonIds.push(button.id);
        });
    }

    private async _handleUserSelect(user: PlexHomeUser): Promise<void> {
        this._clearError();
        if (this._isSwitching) return;
        if (user.protected) {
            this._openPinModal(user);
            return;
        }
        await this._switchUser(user.id);
    }

    private async _handleUseMainAccount(): Promise<void> {
        if (this._isSwitching) return;
        this._clearError();
        this._setStatus('Switching to main account...');
        this._isSwitching = true;
        try {
            await this._orchestrator.useMainAccountProfile();
            this._navigateToServerSelect();
        } catch (error) {
            this._handleError(error, 'Unable to switch profile.');
        } finally {
            this._isSwitching = false;
        }
    }

    private async _handleSignOut(): Promise<void> {
        if (this._isSwitching) return;
        this._isSwitching = true;
        try {
            await this._orchestrator.signOutPlex();
        } catch (error) {
            this._handleError(error, 'Unable to sign out.');
        } finally {
            this._isSwitching = false;
        }
    }

    private async _switchUser(userId: string, pin?: string): Promise<boolean> {
        this._setStatus('Switching profile...');
        this._isSwitching = true;
        try {
            await this._orchestrator.switchHomeUser(userId, pin);
            this._navigateToServerSelect();
            return true;
        } catch (error) {
            if (error instanceof PlexApiError) {
                if (pin && error.code === 'AUTH_FAILED') {
                    this._handlePinError('Wrong PIN. Try again.');
                    return false;
                }
                if (
                    error.code === 'AUTH_REQUIRED' ||
                    error.code === 'AUTH_INVALID'
                ) {
                    // Account token is no longer valid; force re-link.
                    await this._orchestrator.signOutPlex();
                    return false;
                }
            }
            this._handleError(error, 'Unable to switch profile.');
            return false;
        } finally {
            this._isSwitching = false;
        }
    }

    private _navigateToServerSelect(): void {
        const nav = this._orchestrator.getNavigation();
        nav?.goTo('server-select', { allowAutoConnect: true });
    }

    private _openPinModal(user: PlexHomeUser): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav || this._isPinOpen) return;

        this._pinTargetUser = user;
        this._pinDigits = '';
        this._renderPinSlots();
        this._pinErrorEl.textContent = '';
        this._pinPromptEl.textContent = `Enter PIN for ${user.title}`;

        this._pinModal.style.display = 'flex';
        this._pinModal.classList.add('visible');
        this._isPinOpen = true;

        const focusableIds = this._registerPinModalFocusables(nav);
        nav.openModal(PIN_MODAL_ID, focusableIds);
        nav.setFocus('btn-profile-pin-5');
    }

    private _closePinModal(): void {
        if (!this._isPinOpen) return;
        const nav = this._orchestrator.getNavigation();
        if (nav) {
            nav.closeModal(PIN_MODAL_ID);
            this._unregisterPinModalFocusables(nav);
        }
        this._pinModal.style.display = 'none';
        this._pinModal.classList.remove('visible');
        this._pinDigits = '';
        this._pinTargetUser = null;
        this._isPinOpen = false;
        this._pinErrorEl.textContent = '';
        this._pinSlotsWrapEl.classList.remove('error');
        this._renderPinSlots();
    }

    private _renderPinSlots(): void {
        for (let i = 0; i < this._pinSlots.length; i++) {
            const slot = this._pinSlots[i];
            if (!slot) {
                continue;
            }
            slot.classList.toggle('filled', i < this._pinDigits.length);
        }
    }

    private _handlePinInput(digit: string): void {
        if (!this._isPinOpen || this._isSwitching) return;
        if (this._pinDigits.length >= PIN_LENGTH) return;
        this._pinDigits += digit;
        this._renderPinSlots();
        const filledIndex = this._pinDigits.length - 1;
        const slot = this._pinSlots[filledIndex];
        if (slot) {
            slot.classList.add('just-filled');
            if (this._pinJustFilledTimeoutId !== null) {
                clearTimeout(this._pinJustFilledTimeoutId);
            }
            this._pinJustFilledTimeoutId = setTimeout(() => {
                slot.classList.remove('just-filled');
                this._pinJustFilledTimeoutId = null;
            }, 200);
        }
        if (this._pinDigits.length >= PIN_LENGTH) {
            void this._submitPin();
        }
    }

    private _handlePinBackspace(): void {
        if (!this._isPinOpen || this._isSwitching) return;
        if (this._pinDigits.length === 0) return;
        this._pinDigits = this._pinDigits.slice(0, -1);
        this._renderPinSlots();
    }

    private async _submitPin(): Promise<void> {
        if (!this._pinTargetUser) return;
        const pinToSubmit = this._pinDigits;
        this._pinDigits = '';
        this._renderPinSlots();
        this._pinErrorEl.textContent = '';
        const ok = await this._switchUser(this._pinTargetUser.id, pinToSubmit);
        if (ok) {
            this._closePinModal();
        }
    }

    private _handlePinError(message: string): void {
        this._pinErrorEl.textContent = message;
        this._pinDigits = '';
        this._renderPinSlots();
        this._pinSlotsWrapEl.classList.add('error');
        if (this._pinErrorTimeoutId !== null) {
            clearTimeout(this._pinErrorTimeoutId);
        }
        this._pinErrorTimeoutId = setTimeout(() => {
            this._pinSlotsWrapEl.classList.remove('error');
            this._pinErrorTimeoutId = null;
        }, 350);
        const nav = this._orchestrator.getNavigation();
        nav?.setFocus('btn-profile-pin-5');
    }

    private _registerPinModalFocusables(nav: ReturnType<AppOrchestrator['getNavigation']>): string[] {
        if (!nav) {
            return [];
        }
        const focusableIds = [
            'btn-profile-pin-1',
            'btn-profile-pin-2',
            'btn-profile-pin-3',
            'btn-profile-pin-4',
            'btn-profile-pin-5',
            'btn-profile-pin-6',
            'btn-profile-pin-7',
            'btn-profile-pin-8',
            'btn-profile-pin-9',
            'btn-profile-pin-backspace',
            'btn-profile-pin-0',
            this._pinCancelButton.id,
        ];

        const neighbors: Record<string, FocusableElement['neighbors']> = {
            'btn-profile-pin-1': { right: 'btn-profile-pin-2', down: 'btn-profile-pin-4' },
            'btn-profile-pin-2': {
                left: 'btn-profile-pin-1',
                right: 'btn-profile-pin-3',
                down: 'btn-profile-pin-5',
            },
            'btn-profile-pin-3': { left: 'btn-profile-pin-2', down: 'btn-profile-pin-6' },
            'btn-profile-pin-4': {
                up: 'btn-profile-pin-1',
                right: 'btn-profile-pin-5',
                down: 'btn-profile-pin-7',
            },
            'btn-profile-pin-5': {
                up: 'btn-profile-pin-2',
                left: 'btn-profile-pin-4',
                right: 'btn-profile-pin-6',
                down: 'btn-profile-pin-8',
            },
            'btn-profile-pin-6': { up: 'btn-profile-pin-3', left: 'btn-profile-pin-5', down: 'btn-profile-pin-9' },
            'btn-profile-pin-7': { up: 'btn-profile-pin-4', right: 'btn-profile-pin-8', down: 'btn-profile-pin-cancel' },
            'btn-profile-pin-8': {
                up: 'btn-profile-pin-5',
                left: 'btn-profile-pin-7',
                right: 'btn-profile-pin-9',
                down: 'btn-profile-pin-cancel',
            },
            'btn-profile-pin-9': { up: 'btn-profile-pin-6', left: 'btn-profile-pin-8', down: 'btn-profile-pin-cancel' },
            'btn-profile-pin-backspace': {
                up: 'btn-profile-pin-7',
                right: 'btn-profile-pin-0',
                down: 'btn-profile-pin-cancel',
            },
            'btn-profile-pin-0': {
                up: 'btn-profile-pin-8',
                left: 'btn-profile-pin-backspace',
                down: 'btn-profile-pin-cancel',
            },
            'btn-profile-pin-cancel': { up: 'btn-profile-pin-8' },
        };

        focusableIds.forEach((id) => {
            const element = document.getElementById(id);
            if (!element) return;
            nav.unregisterFocusable(id);
            nav.registerFocusable({
                id,
                element,
                neighbors: neighbors[id] ?? {},
                onSelect: () => {
                    (element as HTMLElement).click();
                },
            });
        });

        return focusableIds;
    }

    private _unregisterPinModalFocusables(nav: ReturnType<AppOrchestrator['getNavigation']>): void {
        if (!nav) return;
        const ids = [
            'btn-profile-pin-1',
            'btn-profile-pin-2',
            'btn-profile-pin-3',
            'btn-profile-pin-4',
            'btn-profile-pin-5',
            'btn-profile-pin-6',
            'btn-profile-pin-7',
            'btn-profile-pin-8',
            'btn-profile-pin-9',
            'btn-profile-pin-backspace',
            'btn-profile-pin-0',
            'btn-profile-pin-cancel',
        ];
        ids.forEach((id) => nav.unregisterFocusable(id));
    }

    private _registerFocusables(): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav) return;

        const focusableIds = [
            ...this._userButtonIds,
            this._mainButton.id,
            this._signOutButton.id,
        ];
        this._focusableIds = focusableIds;

        focusableIds.forEach((id, index) => {
            const element = document.getElementById(id);
            if (!element) return;

            const neighbors: FocusableElement['neighbors'] = {};
            if (index > 0) {
                const upId = focusableIds[index - 1];
                if (upId) {
                    neighbors.up = upId;
                }
            }
            if (index < focusableIds.length - 1) {
                const downId = focusableIds[index + 1];
                if (downId) {
                    neighbors.down = downId;
                }
            }

            if (id === this._mainButton.id) {
                neighbors.right = this._signOutButton.id;
            } else if (id === this._signOutButton.id) {
                neighbors.left = this._mainButton.id;
            }

            nav.registerFocusable({
                id,
                element: element as HTMLElement,
                neighbors,
                onSelect: () => {
                    (element as HTMLElement).click();
                },
            });
        });

        const preferredId = this._userButtonIds[0] ?? this._mainButton.id;
        if (preferredId) {
            nav.setFocus(preferredId);
        }
    }

    private _unregisterFocusables(): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav) return;

        for (const id of this._focusableIds) {
            nav.unregisterFocusable(id);
        }
        this._focusableIds = [];
    }

    private _registerKeyHandler(): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav || this._navKeyHandler) return;

        this._navKeyHandler = (event: KeyEvent): void => {
            if (!this._isPinOpen || event.handled) return;
            // Avoid accidental multi-digit entry from key repeat/long-press on TV remotes.
            if (event.isRepeat || event.isLongPress) return;
            if (event.button === 'back') {
                event.handled = true;
                this._closePinModal();
                return;
            }
            if (event.button.startsWith('num')) {
                const digit = event.button.replace('num', '');
                if (digit.length === 1) {
                    event.handled = true;
                    this._handlePinInput(digit);
                }
            }
        };
        nav.on('keyPress', this._navKeyHandler);
    }

    private _unregisterKeyHandler(): void {
        const nav = this._orchestrator.getNavigation();
        if (nav && this._navKeyHandler) {
            nav.off('keyPress', this._navKeyHandler);
        }
        this._navKeyHandler = null;
    }

    private _restoreFocus(): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav) return;
        if (this._restoreFocusTimeoutId !== null) {
            clearTimeout(this._restoreFocusTimeoutId);
            this._restoreFocusTimeoutId = null;
        }
        this._restoreFocusTimeoutId = setTimeout(() => {
            this._restoreFocusTimeoutId = null;
            if (!this._container.classList.contains('visible')) return;
            const preferredId = this._userButtonIds[0] ?? this._mainButton.id;
            nav.setFocus(preferredId);
        }, FOCUS_RESTORE_DELAY_MS);
    }

    private _setStatus(message: string): void {
        this._statusEl.textContent = message;
    }

    private _clearError(): void {
        this._errorEl.textContent = '';
    }

    private _handleError(error: unknown, fallback: string): void {
        if (error instanceof PlexApiError) {
            this._errorEl.textContent = error.message || fallback;
            return;
        }
        if (error instanceof Error) {
            this._errorEl.textContent = error.message || fallback;
            return;
        }
        this._errorEl.textContent = fallback;
    }
}
