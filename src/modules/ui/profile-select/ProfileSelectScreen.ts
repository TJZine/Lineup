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
    private _pinSlots: HTMLElement[] = [];
    private _pinCancelButton: HTMLButtonElement;
    private _pinDigits: string = '';
    private _pinTargetUser: PlexHomeUser | null = null;
    private _isPinOpen: boolean = false;
    private _isSwitching: boolean = false;

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
        modal.setAttribute('aria-label', 'Profile PIN');
        modal.style.display = 'none';

        const modalCard = document.createElement('div');
        modalCard.className = 'profile-pin-card';

        const prompt = document.createElement('div');
        prompt.className = 'profile-pin-title';
        prompt.textContent = 'Enter PIN';
        modalCard.appendChild(prompt);
        this._pinPromptEl = prompt;

        const slots = document.createElement('div');
        slots.className = 'profile-pin-slots';
        for (let i = 0; i < PIN_LENGTH; i++) {
            const slot = document.createElement('span');
            slot.className = 'profile-pin-slot';
            slot.setAttribute('aria-hidden', 'true');
            slots.appendChild(slot);
            this._pinSlots.push(slot);
        }
        modalCard.appendChild(slots);

        const pinError = document.createElement('div');
        pinError.className = 'profile-pin-error';
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

        nav.unregisterFocusable(this._pinCancelButton.id);
        nav.registerFocusable({
            id: this._pinCancelButton.id,
            element: this._pinCancelButton,
            neighbors: {},
        });
        nav.openModal(PIN_MODAL_ID, [this._pinCancelButton.id]);
        nav.setFocus(this._pinCancelButton.id);
    }

    private _closePinModal(): void {
        if (!this._isPinOpen) return;
        const nav = this._orchestrator.getNavigation();
        if (nav) {
            nav.closeModal(PIN_MODAL_ID);
            nav.unregisterFocusable(this._pinCancelButton.id);
        }
        this._pinModal.style.display = 'none';
        this._pinModal.classList.remove('visible');
        this._pinDigits = '';
        this._pinTargetUser = null;
        this._isPinOpen = false;
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
        if (this._pinDigits.length >= PIN_LENGTH) {
            void this._submitPin();
        }
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
