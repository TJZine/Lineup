import type { PlexHomeUser } from '../../plex/auth';
import type { FocusableElement, INavigationManager, KeyEvent } from '../../navigation';
import { PlexApiError } from '../../plex/auth';
import { AppErrorCode } from '../../../types/app-errors';
import { buildDeterministicButtonIds } from '../../../utils/domIds';
import { sanitizeDiagnosticText } from '../../../utils/redact';
import { createScreenShell } from '../common/ScreenShell';
import type { ScreenStatus, ScreenTone } from '../types/screen-shell';
import type { ProfileSessionStore } from '../../settings/ProfileSessionStore';
import {
    createProfilePinBackspaceButton,
    createProfilePinCancelButton,
    createProfilePinDigitButton,
} from './ProfilePinControls';
import { renderProfilePinUserHeader } from './ProfilePinUserHeader';

const PIN_LENGTH = 4;
const MAX_PROFILE_GRID_COLUMNS = 5;
const PIN_MODAL_ID = 'profile-pin';
const PROFILE_TIP_DEFAULT = 'Tip: Set a PIN on the admin profile to prevent unwanted access.';
const PROFILE_TIP_WITH_RESTRICTED = `${PROFILE_TIP_DEFAULT} "Restricted" labels are informational only.`;

export interface ProfileSelectScreenPorts {
    getHomeUsers(options?: { signal?: AbortSignal | null }): Promise<PlexHomeUser[]>;
    switchHomeUser(userId: string, options?: { pin?: string | null; signal?: AbortSignal | null }): Promise<void>;
    useMainAccountProfile(): Promise<void>;
    signOutPlex(): Promise<void>;
    getNavigation(): INavigationManager | null;
}

export class ProfileSelectScreen {
    private static readonly PIN_MODAL_FOCUSABLE_IDS = [
        'btn-profile-pin-back',
        'btn-profile-pin-1',
        'btn-profile-pin-2',
        'btn-profile-pin-3',
        'btn-profile-pin-4',
        'btn-profile-pin-5',
        'btn-profile-pin-6',
        'btn-profile-pin-7',
        'btn-profile-pin-8',
        'btn-profile-pin-9',
        'btn-profile-pin-0',
        'btn-profile-pin-backspace',
        'btn-profile-pin-cancel',
    ] as const;

    private _container: HTMLElement;
    private _ports: ProfileSelectScreenPorts;
    private _destroyScreenShell: (() => void) | null = null;
    private _shellSetStatus: ((status: ScreenStatus | null) => void) | null = null;
    private _statusEl: HTMLElement;
    private _errorEl: HTMLElement;
    private _tipEl: HTMLElement;
    private _listEl: HTMLElement;
    private _mainButton: HTMLButtonElement;
    private _signOutButton: HTMLButtonElement;
    private _focusableIds: string[] = [];
    private _userButtonIds: string[] = [];
    private _profileGridColumns = MAX_PROFILE_GRID_COLUMNS;
    private _profileGridMeasureEl: HTMLElement;
    private _profileGridResizeObserver: ResizeObserver | null = null;
    private _profileGridResizeHandler: (() => void) | null = null;
    private _profileGridMutationObserver: MutationObserver | null = null;
    private _showMain = false;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _isLoading: boolean = false;

    private _pinModal: HTMLElement;
    private _pinUserEl: HTMLElement;
    private _pinPromptEl: HTMLElement;
    private _pinErrorEl: HTMLElement;
    private _pinSlotsWrapEl: HTMLElement;
    private _pinSlots: HTMLElement[] = [];
    private _pinDigits: string = '';
    private _pinTargetUser: PlexHomeUser | null = null;
    private _isPinOpen: boolean = false;
    private _isVisible: boolean = false;
    private _isDestroyed: boolean = false;
    private _visibilityGeneration: number = 0;
    private _isSwitching: boolean = false;
    private _activeLoadGeneration: number | null = null;
    private _activeSwitchGeneration: number | null = null;
    private _profileSwitchController: AbortController | null = null;
    private _pinJustFilledTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _pinErrorTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _idlePromise: Promise<void> = Promise.resolve();
    private _resolveIdlePromise: (() => void) | null = null;

    constructor(
        container: HTMLElement,
        ports: ProfileSelectScreenPorts,
        private readonly profileSessionStore: ProfileSessionStore
    ) {
        this._container = container;
        this._ports = ports;
        this._container.classList.add('screen', 'onboarding-screen', 'profile-select');

        const shell = createScreenShell(this._container, {
            variant: 'onboarding',
            title: "Who's watching?",
            subtitle: 'Choose a Plex Home profile to continue.',
            status: {
                title: 'Loading profiles...',
                tone: 'loading',
            },
            error: null,
            actions: [
                {
                    id: 'btn-profile-main',
                    label: 'Use Main Account',
                    variant: 'primary',
                    onSelect: (): void => {
                        void this._handleUseMainAccount();
                    },
                },
                {
                    id: 'btn-profile-signout',
                    label: 'Sign out',
                    variant: 'secondary',
                    onSelect: (): void => {
                        void this._handleSignOut();
                    },
                },
            ],
        });
        this._destroyScreenShell = shell.destroy;
        this._shellSetStatus = shell.setStatus;
        this._statusEl = shell.statusEl;
        this._errorEl = shell.errorEl;
        this._errorEl.setAttribute('role', 'alert');
        this._errorEl.setAttribute('aria-live', 'assertive');

        const list = document.createElement('div');
        list.className = 'profile-list';
        list.style.setProperty('--profile-grid-columns', String(MAX_PROFILE_GRID_COLUMNS));
        shell.contentEl.appendChild(list);
        this._listEl = list;

        const gridMeasure = document.createElement('div');
        gridMeasure.className = 'profile-grid-size-probe';
        gridMeasure.setAttribute('aria-hidden', 'true');
        shell.panelEl.appendChild(gridMeasure);
        this._profileGridMeasureEl = gridMeasure;

        const tip = document.createElement('div');
        tip.className = 'profile-tip';
        tip.textContent = PROFILE_TIP_DEFAULT;
        shell.contentEl.appendChild(tip);
        this._tipEl = tip;

        // Note: We cache action button references. If ScreenShell actions are ever re-rendered via shell.setActions(),
        // these references must be re-queried.
        const mainButton = shell.actionsEl.querySelector('#btn-profile-main');
        const signOutButton = shell.actionsEl.querySelector('#btn-profile-signout');
        if (!(mainButton instanceof HTMLButtonElement) || !(signOutButton instanceof HTMLButtonElement)) {
            throw new Error('ProfileSelectScreen shell actions unavailable');
        }
        this._mainButton = mainButton;
        this._signOutButton = signOutButton;

        // PIN modal (hidden by default)
        const modal = document.createElement('div');
        modal.className = 'profile-pin-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'profile-pin-title profile-pin-user-name');
        modal.setAttribute('aria-describedby', 'profile-pin-desc');
        modal.style.display = 'none';

        const modalCard = document.createElement('div');
        modalCard.className = 'profile-pin-card';

        const backButton = document.createElement('button');
        backButton.id = 'btn-profile-pin-back';
        backButton.type = 'button';
        backButton.className = 'profile-pin-back';
        backButton.textContent = '‹ Back to Profiles';
        backButton.addEventListener('click', () => this._closePinModal());
        modalCard.appendChild(backButton);

        const userHeader = document.createElement('div');
        userHeader.className = 'profile-pin-user';
        modalCard.appendChild(userHeader);
        this._pinUserEl = userHeader;

        const prompt = document.createElement('div');
        prompt.className = 'profile-pin-title sr-only';
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

        const pinError = document.createElement('div');
        pinError.className = 'profile-pin-error profile-pin-status';
        pinError.id = 'profile-pin-desc';
        pinError.textContent = '';
        pinError.setAttribute('role', 'status');
        pinError.setAttribute('aria-live', 'polite');
        modalCard.appendChild(pinError);
        this._pinErrorEl = pinError;

        const numpad = document.createElement('div');
        numpad.className = 'profile-numpad';
        numpad.setAttribute('role', 'group');
        numpad.setAttribute('aria-label', 'PIN entry numpad');

        for (let digit = 1; digit <= 9; digit++) {
            numpad.appendChild(createProfilePinDigitButton(digit, (value) => this._handlePinInput(value)));
        }

        const emptyCell = document.createElement('span');
        emptyCell.className = 'profile-numpad-spacer';
        emptyCell.setAttribute('aria-hidden', 'true');
        numpad.appendChild(emptyCell);
        numpad.appendChild(createProfilePinDigitButton(0, (value) => this._handlePinInput(value)));
        const backspaceButton = createProfilePinBackspaceButton(() => this._handlePinBackspace());
        backspaceButton.disabled = true;
        numpad.appendChild(backspaceButton);

        modalCard.appendChild(numpad);

        const cancelButton = createProfilePinCancelButton(() => this._closePinModal());
        modalCard.appendChild(cancelButton);

        modal.appendChild(modalCard);
        this._container.appendChild(modal);
        this._pinModal = modal;
    }

    show(): void {
        if (this._isDestroyed) return;
        const profileSwitchController = this._profileSwitchController;
        if (profileSwitchController?.signal.aborted
            && this._profileSwitchController === profileSwitchController) {
            this._profileSwitchController = null;
            this._isSwitching = false;
            this._activeSwitchGeneration = null;
        }
        this._isVisible = true;
        this._visibilityGeneration += 1;
        const generation = this._visibilityGeneration;
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        this._startProfileGridResizeTracking();
        this._setStatus('Loading profiles...', { tone: 'loading' });
        this._clearError();
        this._registerKeyHandler();
        void this._loadProfiles(generation);
    }

    async whenIdle(): Promise<void> {
        return this._hasPendingUiWork() ? this._idlePromise : Promise.resolve();
    }

    destroy(): void {
        this._isDestroyed = true;
        this.hide();
        this._destroyScreenShell?.();
        this._destroyScreenShell = null;
        this._resolveIdleIfSettled();
    }

    hide(): void {
        this._isVisible = false;
        this._visibilityGeneration += 1;
        this._stopProfileGridResizeTracking();
        const pendingProfileSwitch = this._profileSwitchController;
        this._profileSwitchController = null;
        this._activeSwitchGeneration = null;
        this._isSwitching = false;
        pendingProfileSwitch?.abort();
        this._unregisterFocusables();
        this._unregisterKeyHandler();
        this._closePinModal();
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
        this._resolveIdleIfSettled();
    }

    private async _loadProfiles(generation = this._visibilityGeneration): Promise<void> {
        if (this._isLoading && this._activeLoadGeneration === generation) return;
        this._ensureIdlePromise();
        this._isLoading = true;
        this._activeLoadGeneration = generation;
        this._listEl.replaceChildren();
        this._userButtonIds = [];
        this._showMain = false;
        this._mainButton.style.display = 'none';
        this._setStatus('Loading profiles...', { tone: 'loading' });
        this._setTip(PROFILE_TIP_DEFAULT);

        try {
            const users = await this._ports.getHomeUsers();
            if (!this._canUpdateUi(generation)) {
                return;
            }
            const hasRestrictedProfiles = users.some((user) => user.restricted === true);
            const tipText = hasRestrictedProfiles ? PROFILE_TIP_WITH_RESTRICTED : PROFILE_TIP_DEFAULT;
            this._showMain = users.length <= 1;
            this._mainButton.style.display = this._showMain ? '' : 'none';
            if (users.length <= 1) {
                if (users.length === 1) {
                    this._renderUsers(users);
                    this._setStatus('Only one profile is available for this account.');
                    this._setTip('Select "Use Main Account" to continue, or "Sign out" to switch accounts.');
                } else {
                    this._setStatus('No Plex Home profiles were found.');
                    this._setTip('Select "Sign out" to switch accounts, or "Use Main Account" to continue.');
                }
                return;
            }
            this._renderUsers(users);
            this._setStatus('Select a profile to continue.');
            this._setTip(tipText);
        } catch (error) {
            if (!this._canUpdateUi(generation)) {
                return;
            }
            this._handleError(error, 'Unable to load profiles.');
            this._setStatus('Profile list unavailable.');
            this._setTip('Select "Sign out" to switch accounts, then try again.');
        } finally {
            if (this._activeLoadGeneration === generation) {
                this._isLoading = false;
                this._activeLoadGeneration = null;
            }
            const nav = this._ports.getNavigation();
            if (this._canUpdateUi(generation) && nav?.getCurrentScreen() === 'profile-select') {
                this._registerFocusables();
            }
            this._resolveIdleIfSettled();
        }
    }

    private _renderUsers(users: PlexHomeUser[]): void {
        this._listEl.replaceChildren();
        this._userButtonIds = [];
        const buttonIds = this._buildUserButtonIds(users.map((user) => user.id));
        const lastUsedId = this.profileSessionStore.readLastProfileIdAndClean();

        users.forEach((user, index) => {
            const button = document.createElement('button');
            button.id = buttonIds[index] ?? 'btn-profile-unknown';
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

            const name = document.createElement('span');
            name.className = 'profile-name';
            name.textContent = user.title;

            const badges = document.createElement('div');
            badges.className = 'profile-badges';

            if (user.protected) {
                const lock = document.createElement('span');
                lock.className = 'profile-lock';
                lock.textContent = 'PIN required';
                lock.setAttribute('aria-label', 'PIN required');
                badges.appendChild(lock);
            }

            if (user.admin) {
                const admin = document.createElement('span');
                admin.className = 'profile-admin';
                admin.textContent = 'Admin';
                badges.appendChild(admin);
            }

            if (user.restricted === true) {
                const restricted = document.createElement('span');
                restricted.className = 'profile-restricted';
                restricted.textContent = 'Restricted';
                restricted.setAttribute('aria-label', 'Restricted profile');
                badges.appendChild(restricted);
            }

            button.appendChild(avatar);
            button.appendChild(name);
            if (badges.childElementCount > 0) {
                button.appendChild(badges);
            }

            if (user.id === lastUsedId) {
                const lastUsed = document.createElement('span');
                lastUsed.className = 'profile-last-used';
                lastUsed.textContent = 'Active';
                button.appendChild(lastUsed);
                button.classList.add('active');
                button.setAttribute('aria-current', 'true');
            } else {
                button.removeAttribute('aria-current');
            }

            this._listEl.appendChild(button);
            this._userButtonIds.push(button.id);
        });
    }

    private async _handleUserSelect(user: PlexHomeUser): Promise<void> {
        const generation = this._visibilityGeneration;
        if (!this._canUpdateUi(generation)) return;
        this._clearError();
        if (this._isSwitching) return;
        if (user.protected) {
            this._openPinModal(user);
            return;
        }
        await this._switchUser(user.id, undefined, generation);
    }

    private async _handleUseMainAccount(): Promise<void> {
        const generation = this._visibilityGeneration;
        if (!this._canUpdateUi(generation)) return;
        if (this._isSwitching) return;
        this._clearError();
        this._setStatus('Starting Lineup...', { tone: 'loading' });
        this._ensureIdlePromise();
        this._isSwitching = true;
        this._activeSwitchGeneration = generation;
        try {
            await this._ports.useMainAccountProfile();
            if (!this._canUpdateUi(generation) || this._activeSwitchGeneration !== generation) {
                return;
            }
            // Clear last-used hint — main account bypasses profile cards.
            this.profileSessionStore.writeLastProfileId(null);
        } catch (error) {
            if (this._canUpdateUi(generation)) {
                this._handleError(error, 'Unable to switch profile.');
            }
        } finally {
            if (this._activeSwitchGeneration === generation) {
                this._isSwitching = false;
                this._activeSwitchGeneration = null;
            }
            this._resolveIdleIfSettled();
        }
    }

    private async _handleSignOut(): Promise<void> {
        const generation = this._visibilityGeneration;
        if (!this._canUpdateUi(generation)) return;
        if (this._isSwitching) return;
        this._clearError();
        this._setStatus('Signing out...', { tone: 'loading' });
        this._ensureIdlePromise();
        this._isSwitching = true;
        this._activeSwitchGeneration = generation;
        try {
            await this._ports.signOutPlex();
        } catch (error) {
            if (this._canUpdateUi(generation)) {
                this._handleError(error, 'Unable to sign out.');
            }
        } finally {
            if (this._activeSwitchGeneration === generation) {
                this._isSwitching = false;
                this._activeSwitchGeneration = null;
            }
            this._resolveIdleIfSettled();
        }
    }

    private async _switchUser(
        userId: string,
        pin?: string,
        generation = this._visibilityGeneration
    ): Promise<boolean> {
        if (!this._canUpdateUi(generation)) return false;
        this._setStatus('Starting Lineup...', { tone: 'loading' });
        this._ensureIdlePromise();
        this._isSwitching = true;
        this._activeSwitchGeneration = generation;
        this._syncPinInputState();
        const controller = new AbortController();
        this._profileSwitchController = controller;
        try {
            await this._ports.switchHomeUser(userId, {
                pin: pin ?? null,
                signal: controller.signal,
            });
            if (
                this._profileSwitchController !== controller
                || controller.signal.aborted
                || !this._canUpdateUi(generation)
                || this._activeSwitchGeneration !== generation
            ) {
                return false;
            }
            this.profileSessionStore.writeLastProfileId(userId);
            return true;
        } catch (error) {
            if (this._profileSwitchController !== controller || !this._canUpdateUi(generation)) {
                return false;
            }
            if (error instanceof PlexApiError) {
                if (pin && error.code === AppErrorCode.AUTH_FAILED) {
                    this._handlePinError('Wrong PIN. Try again.');
                    return false;
                }
                if (error.code === AppErrorCode.AUTH_REQUIRED || error.code === AppErrorCode.AUTH_INVALID) {
                    this._closePinModal();
                    // Account token is no longer valid; force re-link.
                    try {
                        await this._ports.signOutPlex();
                    } catch (signOutError) {
                        if (this._canUpdateUi(generation)) {
                            const safeCause = this._sanitizeRecoveryCause(signOutError);
                            this._errorEl.textContent = safeCause.length > 0
                                ? `Profile authentication is no longer valid. Unable to sign out: ${safeCause}`
                                : 'Profile authentication is no longer valid, and Lineup could not sign out. Try again.';
                            this._setStatus('Profile recovery failed.', { tone: 'error', ariaLive: 'assertive' });
                        }
                    }
                    return false;
                }
            }
            if (pin && this._isPinOpen) {
                this._pinErrorEl.textContent = 'Unable to switch profiles. Try again.';
                this._pinErrorEl.setAttribute('role', 'alert');
                this._pinErrorEl.setAttribute('aria-live', 'assertive');
                this._pinErrorEl.classList.remove('pending');
                this._pinModal.classList.remove('checking');
            }
            this._handleError(error, 'Unable to switch profile.');
            return false;
        } finally {
            if (this._profileSwitchController === controller) {
                this._profileSwitchController = null;
                if (this._activeSwitchGeneration === generation) {
                    this._isSwitching = false;
                    this._activeSwitchGeneration = null;
                    this._syncPinInputState();
                }
            }
            this._resolveIdleIfSettled();
        }
    }

    private _openPinModal(user: PlexHomeUser): void {
        if (!this._canUpdateUi()) return;
        const nav = this._ports.getNavigation();
        if (!nav || this._isPinOpen) return;

        this._pinTargetUser = user;
        this._pinDigits = '';
        this._renderPinSlots();
        this._pinErrorEl.textContent = '';
        this._pinErrorEl.setAttribute('role', 'status');
        this._pinErrorEl.setAttribute('aria-live', 'polite');
        this._pinErrorEl.classList.remove('pending');
        this._pinModal.classList.remove('checking');
        this._pinPromptEl.textContent = 'Enter PIN';
        renderProfilePinUserHeader(this._pinUserEl, user);

        this._pinModal.style.display = 'flex';
        this._pinModal.classList.add('visible');
        this._isPinOpen = true;
        this._syncPinInputState();

        const focusableIds = this._registerPinModalFocusables(nav);
        nav.openModal(PIN_MODAL_ID, focusableIds);
        nav.setFocus('btn-profile-pin-1');
    }

    private _closePinModal(): void {
        if (!this._isPinOpen) return;
        const nav = this._ports.getNavigation();
        const pendingController = this._profileSwitchController;
        if (pendingController && this._isSwitching && this._pinTargetUser) {
            this._profileSwitchController = null;
            pendingController.abort();
            this._isSwitching = false;
            this._activeSwitchGeneration = null;
            this._syncPinInputState();
            this._resolveIdleIfSettled();
        }
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
        this._pinErrorEl.setAttribute('role', 'status');
        this._pinErrorEl.setAttribute('aria-live', 'polite');
        this._pinErrorEl.classList.remove('pending');
        this._pinModal.classList.remove('checking');
        this._pinSlotsWrapEl.classList.remove('error');
        this._pinUserEl.replaceChildren();
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
        if (this._pinErrorEl.textContent) {
            this._pinErrorEl.textContent = '';
            this._pinErrorEl.setAttribute('role', 'status');
            this._pinErrorEl.setAttribute('aria-live', 'polite');
            this._pinSlotsWrapEl.classList.remove('error');
        }
        this._pinErrorEl.classList.remove('pending');
        this._pinModal.classList.remove('checking');
        this._pinDigits += digit;
        this._renderPinSlots();
        this._syncPinInputState();
        const filledIndex = this._pinDigits.length - 1;
        const slot = this._pinSlots[filledIndex];
        if (slot) {
            this._pinSlots.forEach((pinSlot) => pinSlot.classList.remove('just-filled'));
            slot.classList.add('just-filled');
            if (this._pinJustFilledTimeoutId !== null) {
                clearTimeout(this._pinJustFilledTimeoutId);
            }
            this._ensureIdlePromise();
            this._pinJustFilledTimeoutId = setTimeout(() => {
                slot.classList.remove('just-filled');
                this._pinJustFilledTimeoutId = null;
                this._resolveIdleIfSettled();
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
        this._syncPinInputState();
    }

    private async _submitPin(): Promise<void> {
        if (!this._pinTargetUser) return;
        const generation = this._visibilityGeneration;
        const pinToSubmit = this._pinDigits;
        this._pinDigits = '';
        this._renderPinSlots();
        this._pinErrorEl.textContent = 'Checking PIN…';
        this._pinErrorEl.setAttribute('role', 'status');
        this._pinErrorEl.setAttribute('aria-live', 'polite');
        this._pinErrorEl.classList.add('pending');
        this._pinModal.classList.add('checking');
        const ok = await this._switchUser(this._pinTargetUser.id, pinToSubmit, generation);
        if (ok && this._canUpdateUi(generation)) {
            this._closePinModal();
            return;
        }
        if (this._isPinOpen && this._canUpdateUi(generation)) {
            this._ports.getNavigation()?.setFocus('btn-profile-pin-1');
        }
    }

    private _handlePinError(message: string): void {
        if (!this._canUpdateUi()) return;
        this._pinErrorEl.textContent = message;
        this._pinErrorEl.setAttribute('role', 'alert');
        this._pinErrorEl.setAttribute('aria-live', 'assertive');
        this._pinErrorEl.classList.remove('pending');
        this._pinModal.classList.remove('checking');
        this._pinDigits = '';
        this._renderPinSlots();
        this._syncPinInputState();
        this._pinSlotsWrapEl.classList.add('error');
        if (this._pinErrorTimeoutId !== null) {
            clearTimeout(this._pinErrorTimeoutId);
        }
        this._ensureIdlePromise();
        this._pinErrorTimeoutId = setTimeout(() => {
            this._pinSlotsWrapEl.classList.remove('error');
            this._pinErrorTimeoutId = null;
            this._resolveIdleIfSettled();
        }, 350);
    }

    private _syncPinInputState(): void {
        if (!this._pinModal) return;

        const switching = this._isSwitching;
        this._pinModal.querySelectorAll<HTMLButtonElement>('.profile-numpad-button:not(.numpad-action)')
            .forEach((button) => {
                button.disabled = switching;
            });

        const backspace = this._pinModal.querySelector<HTMLButtonElement>('#btn-profile-pin-backspace');
        if (backspace) {
            backspace.disabled = switching || this._pinDigits.length === 0;
        }

        const nav = this._ports.getNavigation();
        const focusedId = nav?.getState().focusedElementId ?? null;
        const focusOnNumpad = focusedId?.startsWith('btn-profile-pin-')
            && focusedId !== 'btn-profile-pin-cancel'
            && focusedId !== 'btn-profile-pin-back';
        if (switching && focusOnNumpad) {
            nav?.setFocus('btn-profile-pin-cancel');
        } else if (focusedId === 'btn-profile-pin-backspace' && backspace?.disabled) {
            nav?.setFocus(switching ? 'btn-profile-pin-cancel' : 'btn-profile-pin-0');
        }
    }

    private _hasPendingUiWork(): boolean {
        const generation = this._visibilityGeneration;
        return (this._isLoading && this._activeLoadGeneration === generation)
            || (this._isSwitching && this._activeSwitchGeneration === generation)
            || this._pinJustFilledTimeoutId !== null
            || this._pinErrorTimeoutId !== null;
    }

    private _canUpdateUi(generation = this._visibilityGeneration): boolean {
        return this._isVisible
            && !this._isDestroyed
            && generation === this._visibilityGeneration
            && this._container.classList.contains('visible')
            && this._container.style.display !== 'none';
    }

    private _ensureIdlePromise(): void {
        if (this._resolveIdlePromise) {
            return;
        }

        this._idlePromise = new Promise((resolve) => {
            this._resolveIdlePromise = resolve;
        });
    }

    private _resolveIdleIfSettled(): void {
        if (this._hasPendingUiWork() || !this._resolveIdlePromise) {
            return;
        }

        const resolve = this._resolveIdlePromise;
        this._resolveIdlePromise = null;
        resolve();
    }

    private _registerPinModalFocusables(nav: INavigationManager | null): string[] {
        if (!nav) {
            return [];
        }
        const focusableIds = ProfileSelectScreen.PIN_MODAL_FOCUSABLE_IDS.slice();

        const neighbors: Record<string, FocusableElement['neighbors']> = {
            'btn-profile-pin-back': { down: 'btn-profile-pin-1' },
            'btn-profile-pin-1': {
                up: 'btn-profile-pin-back',
                right: 'btn-profile-pin-2',
                down: 'btn-profile-pin-4',
            },
            'btn-profile-pin-2': {
                up: 'btn-profile-pin-back',
                left: 'btn-profile-pin-1',
                right: 'btn-profile-pin-3',
                down: 'btn-profile-pin-5',
            },
            'btn-profile-pin-3': {
                up: 'btn-profile-pin-back',
                left: 'btn-profile-pin-2',
                down: 'btn-profile-pin-6',
            },
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
            'btn-profile-pin-7': {
                up: 'btn-profile-pin-4',
                right: 'btn-profile-pin-8',
                down: 'btn-profile-pin-0',
            },
            'btn-profile-pin-8': {
                up: 'btn-profile-pin-5',
                left: 'btn-profile-pin-7',
                right: 'btn-profile-pin-9',
                down: 'btn-profile-pin-0',
            },
            'btn-profile-pin-9': {
                up: 'btn-profile-pin-6',
                left: 'btn-profile-pin-8',
                down: 'btn-profile-pin-backspace',
            },
            'btn-profile-pin-backspace': {
                up: 'btn-profile-pin-9',
                left: 'btn-profile-pin-0',
                down: 'btn-profile-pin-cancel',
            },
            'btn-profile-pin-0': {
                up: 'btn-profile-pin-8',
                left: 'btn-profile-pin-7',
                right: 'btn-profile-pin-backspace',
                down: 'btn-profile-pin-cancel',
            },
            'btn-profile-pin-cancel': {
                up: 'btn-profile-pin-0',
                left: 'btn-profile-pin-backspace',
            },
        };

        focusableIds.forEach((id) => {
            const element = document.getElementById(id);
            if (!element) return;
            nav.unregisterFocusable(id);
            nav.registerFocusable({
                id,
                element,
                neighbors: neighbors[id] ?? {},
            });
        });

        return focusableIds;
    }

    private _unregisterPinModalFocusables(nav: INavigationManager | null): void {
        if (!nav) return;
        ProfileSelectScreen.PIN_MODAL_FOCUSABLE_IDS.forEach((id) => {
            nav.unregisterFocusable(id);
        });
    }

    private _registerFocusables(options: { restoreFocus?: boolean } = {}): void {
        this._updateProfileGridColumnCount();
        const nav = this._ports.getNavigation();
        if (!nav) return;

        const showMain = this._showMain;
        const focusableIds = [
            ...this._userButtonIds,
            this._signOutButton.id,
        ];
        if (showMain) {
            focusableIds.splice(this._userButtonIds.length, 0, this._mainButton.id);
        }
        this._focusableIds = focusableIds;

        const userCount = this._userButtonIds.length;
        const firstActionId = showMain ? this._mainButton.id : this._signOutButton.id;
        const finalRowCardId = this._userButtonIds[userCount - 1];

        focusableIds.forEach((id, index) => {
            const element = document.getElementById(id);
            if (!element) return;

            const isUserCard = index < userCount;
            const neighbors: FocusableElement['neighbors'] = {};

            if (isUserCard) {
                const rowStart = Math.floor(index / this._profileGridColumns) * this._profileGridColumns;
                const column = index - rowStart;
                const previousRowStart = rowStart - this._profileGridColumns;
                const nextRowStart = rowStart + this._profileGridColumns;

                // Keep horizontal edges in their visual row instead of invoking spatial fallback.
                neighbors.left = column > 0 ? this._userButtonIds[index - 1] ?? id : id;
                neighbors.right = column < this._profileGridColumns - 1 && index + 1 < userCount
                    ? this._userButtonIds[index + 1] ?? id
                    : id;

                if (previousRowStart < 0) {
                    neighbors.up = id;
                } else {
                    const previousRowEnd = Math.min(
                        previousRowStart + this._profileGridColumns - 1,
                        userCount - 1
                    );
                    const previousRowIndex = Math.min(previousRowStart + column, previousRowEnd);
                    neighbors.up = this._userButtonIds[previousRowIndex] ?? id;
                }

                if (nextRowStart >= userCount) {
                    neighbors.down = firstActionId;
                } else {
                    const nextRowEnd = Math.min(nextRowStart + this._profileGridColumns - 1, userCount - 1);
                    const nextRowIndex = Math.min(nextRowStart + column, nextRowEnd);
                    neighbors.down = this._userButtonIds[nextRowIndex] ?? firstActionId;
                }
            } else {
                const isMainAction = showMain && id === this._mainButton.id;
                neighbors.up = finalRowCardId ?? id;
                neighbors.down = id;

                if (isMainAction) {
                    neighbors.left = id;
                    neighbors.right = this._signOutButton.id;
                } else if (id === this._signOutButton.id) {
                    neighbors.left = showMain ? this._mainButton.id : id;
                    neighbors.right = id;
                }
            }

            const focusable: FocusableElement = {
                id,
                element: element as HTMLElement,
                neighbors,
            };
            const userIndex = this._userButtonIds.indexOf(id);
            if (userIndex >= 0) {
                focusable.restoreGroup = 'profile-select-list';
                focusable.restorePriority = Math.max(0, 1000 - userIndex);
            }
            nav.registerFocusable(focusable);
        });

        if (options.restoreFocus === false) return;

        const preferredId = this._userButtonIds[0] ?? (showMain ? this._mainButton.id : this._signOutButton.id);
        if (nav.restoreFocusForCurrentScreen()) {
            return;
        }
        if (preferredId) {
            nav.setFocus(preferredId, { persist: false });
        }
    }

    private _updateProfileGridColumnCount(): boolean {
        const listStyle = window.getComputedStyle(this._listEl);
        const minimumColumnWidth = this._profileGridMeasureEl.getBoundingClientRect().width;
        const outerWidth = this._listEl.clientWidth;
        if (!Number.isFinite(minimumColumnWidth) || minimumColumnWidth <= 0 || outerWidth <= 0) {
            return false;
        }

        const parseStyleLength = (value: string): number => {
            const parsed = Number.parseFloat(value);
            return Number.isFinite(parsed) ? parsed : 0;
        };
        const gap = parseStyleLength(listStyle.columnGap);
        const padding = parseStyleLength(listStyle.paddingLeft) + parseStyleLength(listStyle.paddingRight);
        const availableWidth = Math.max(0, outerWidth - padding);
        const fittedColumns = Math.floor((availableWidth + gap) / (minimumColumnWidth + gap));
        const nextColumns = Math.max(1, Math.min(MAX_PROFILE_GRID_COLUMNS, fittedColumns));
        if (nextColumns === this._profileGridColumns) return false;

        this._profileGridColumns = nextColumns;
        this._listEl.style.setProperty('--profile-grid-columns', String(nextColumns));
        return true;
    }

    private _handleProfileGridResize(): void {
        if (!this._canUpdateUi() || !this._updateProfileGridColumnCount()) return;
        this._registerFocusables({ restoreFocus: false });
    }

    private _startProfileGridResizeTracking(): void {
        this._stopProfileGridResizeTracking();
        if (typeof ResizeObserver !== 'undefined') {
            this._profileGridResizeObserver = new ResizeObserver(() => {
                this._handleProfileGridResize();
            });
            this._profileGridResizeObserver.observe(this._listEl);
            this._profileGridResizeObserver.observe(this._profileGridMeasureEl);
            return;
        }

        const handleResize = (): void => this._handleProfileGridResize();
        window.addEventListener('resize', handleResize);
        this._profileGridResizeHandler = handleResize;
        if (typeof MutationObserver === 'undefined') return;

        this._profileGridMutationObserver = new MutationObserver(handleResize);
        let layoutAncestor = this._listEl.parentElement;
        while (layoutAncestor) {
            this._profileGridMutationObserver.observe(layoutAncestor, {
                attributes: true,
                attributeFilter: ['class', 'style'],
            });
            if (layoutAncestor === document.documentElement) break;
            layoutAncestor = layoutAncestor.parentElement;
        }
    }

    private _stopProfileGridResizeTracking(): void {
        this._profileGridResizeObserver?.disconnect();
        this._profileGridResizeObserver = null;
        if (this._profileGridResizeHandler) {
            window.removeEventListener('resize', this._profileGridResizeHandler);
            this._profileGridResizeHandler = null;
        }
        this._profileGridMutationObserver?.disconnect();
        this._profileGridMutationObserver = null;
    }

    private _unregisterFocusables(): void {
        const nav = this._ports.getNavigation();
        if (!nav) return;

        for (const id of this._focusableIds) {
            nav.unregisterFocusable(id);
        }
        this._focusableIds = [];
    }

    private _registerKeyHandler(): void {
        const nav = this._ports.getNavigation();
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
        const nav = this._ports.getNavigation();
        if (nav && this._navKeyHandler) {
            nav.off('keyPress', this._navKeyHandler);
        }
        this._navKeyHandler = null;
    }

    private _buildUserButtonIds(userIds: string[]): string[] {
        return buildDeterministicButtonIds('btn-profile-', userIds);
    }

    private _setStatus(message: string, options?: { tone?: ScreenTone; ariaLive?: ScreenStatus['ariaLive'] }): void {
        if (this._shellSetStatus) {
            if (message.length === 0) {
                this._shellSetStatus(null);
                return;
            }
            const status: ScreenStatus = {
                title: message,
                tone: options?.tone ?? 'neutral',
            };
            if (options?.ariaLive) {
                status.ariaLive = options.ariaLive;
            }
            this._shellSetStatus(status);
            return;
        }
        this._statusEl.textContent = message;
    }

    private _setTip(message: string): void {
        this._tipEl.textContent = message;
    }

    private _clearError(): void {
        this._errorEl.textContent = '';
    }
    private _sanitizeRecoveryCause(error: unknown): string {
        try {
            const message = typeof error === 'string' ? error : typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : '';
            return typeof message === 'string' ? sanitizeDiagnosticText(message, { maxLength: 200 }).trim() : '';
        } catch { return ''; }
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
