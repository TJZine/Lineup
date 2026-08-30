import { EventEmitter } from '../../../utils/EventEmitter';
import { IDisposable } from '../../../utils/interfaces';
import {
    INavigationManager,
    NavigationConfig,
    NavigationState,
    NavigationEventMap,
    Screen,
    ServerSelectNavigationParams,
    FocusableElement,
    FocusGroup,
    RemoteButton, Direction,
    NavigationModalPolicy,
} from '../contracts/interfaces';
import { FocusManager } from './FocusManager';
import { RemoteHandler } from '../input/RemoteHandler';
import { NavigationFocusPolicy } from './NavigationFocusPolicy';
import { NavigationRemoteInputRouter } from '../input/NavigationRemoteInputRouter';
import { NavigationDirectionalRepeatController } from '../input/NavigationDirectionalRepeatController';
import { NavigationChannelNumberInputController } from '../input/NavigationChannelNumberInputController';
import {
    DEFAULT_NAVIGATION_CONFIG,
    INITIAL_SCREEN,
    FOCUS_CLASSES,
    CURSOR_HIDE_DELAY_MS,
    CHANNEL_INPUT_CONFIG,
} from '../config/constants';
import type { PlatformInputService } from '../../../platform';

interface NavigationInternalState {
    config: NavigationConfig;
    currentScreen: Screen;
    screenStack: Screen[];
    serverSelectParams: ServerSelectNavigationParams | null;
    modalStack: string[];
    modalFocusableIds: Map<string, string[]>;
    modalPolicies: Map<string, NavigationModalPolicy>;
    isPointerActive: boolean;
    isInputBlocked: boolean;
    isRuntimeCommandGated: boolean;
}

export interface NavigationManagerOptions {
    readDebugLoggingEnabled?: () => boolean;
}

interface FocusableClickHandlers {
    element: HTMLElement;
    guard: (event: MouseEvent) => void;
    activate: (event: MouseEvent) => void;
}

/**
 * NavigationManager coordinates screen navigation, focus management,
 * and remote control input for the Lineup webOS application.
 *
 * @implements INavigationManager
 *
 * @example
 * ```typescript
 * const nav = new NavigationManager();
 * nav.initialize({ enablePointerMode: true, ... });
 * nav.registerFocusable({ id: 'btn1', element: el, neighbors: {} });
 * nav.setFocus('btn1');
 * nav.goTo('settings');
 * ```
 */
export class NavigationManager
    extends EventEmitter<NavigationEventMap>
    implements INavigationManager {
    private readonly _readDebugLoggingEnabled: () => boolean;
    private _state: NavigationInternalState;
    private _focusManager: FocusManager;
    private _remoteHandler: RemoteHandler;
    private _pointerHideTimer: number | null = null;
    private _keyDownDisposable: IDisposable | null = null;
    private _keyUpDisposable: IDisposable | null = null;
    private _boundFocusInHandler: (event: FocusEvent) => void;
    private _isInitialized: boolean = false;
    private _clickHandlers: Map<string, FocusableClickHandlers> = new Map();
    private readonly _focusPolicy: NavigationFocusPolicy;
    private readonly _remoteInputRouter: NavigationRemoteInputRouter;
    private readonly _directionalRepeatController: NavigationDirectionalRepeatController;
    private readonly _channelNumberInputController: NavigationChannelNumberInputController;
    private _suppressedLogTimestamps: Map<string, number> = new Map();

    constructor(inputService?: PlatformInputService, options?: NavigationManagerOptions) {
        super();
        this._focusManager = new FocusManager();
        this._focusPolicy = new NavigationFocusPolicy();
        this._directionalRepeatController = new NavigationDirectionalRepeatController({
            getRepeatConfig: (): { delayMs: number; intervalMs: number } => ({
                delayMs: this._state.config.keyRepeatDelayMs,
                intervalMs: this._state.config.keyRepeatIntervalMs,
            }),
            tryMoveFocus: (direction): boolean => this.moveFocus(direction),
        });
        this._channelNumberInputController = new NavigationChannelNumberInputController({
            getChannelInputConfig: (): { timeoutMs: number; maxDigits: number } => ({
                timeoutMs: CHANNEL_INPUT_CONFIG.TIMEOUT_MS,
                maxDigits: CHANNEL_INPUT_CONFIG.MAX_DIGITS,
            }),
            emitChannelInputUpdate: (payload): void => this.emit('channelInputUpdate', payload),
            emitChannelNumberEntered: (payload): void => this.emit('channelNumberEntered', payload),
        });
        this._remoteInputRouter = new NavigationRemoteInputRouter({
            isInputBlocked: (): boolean => this._state.isInputBlocked,
            isRuntimeCommandGated: (): boolean => this._state.isRuntimeCommandGated,
            getActiveModalPolicy: (): NavigationModalPolicy | null => this.getActiveModalPolicy(),
            logInputSuppressed: (reason, button): void => this._logInputSuppressed(reason, button),
            cancelDirectionalRepeat: (): void => this._directionalRepeatController.stop(),
            emitKeyPress: (keyEvent): void => this.emit('keyPress', keyEvent),
            repairFocusDesync: (): void => this._repairFocusDesync(),
            handleDirectionalKeyDown: (button, isRepeat): void => (
                this._directionalRepeatController.handleDirectionalKeyDown(button, isRepeat)
            ),
            handleOk: (): void => this._handleOkButton(),
            handleBack: (): void => this._handleBackButton(),
            handleNumberKey: (button): void => this._channelNumberInputController.handleNumberKey(button),
            emitGuide: (): void => this.emit('guide', undefined),
            emitSettings: (): void => this.emit('settings', undefined),
        });
        this._remoteHandler = new RemoteHandler(inputService);
        this._readDebugLoggingEnabled = options?.readDebugLoggingEnabled ?? (() : boolean => false);
        this._boundFocusInHandler = this._handleFocusIn.bind(this);
        this._state = {
            config: DEFAULT_NAVIGATION_CONFIG,
            currentScreen: INITIAL_SCREEN,
            screenStack: [],
            serverSelectParams: null,
            modalStack: [],
            modalFocusableIds: new Map(),
            modalPolicies: new Map(),
            isPointerActive: false,
            isInputBlocked: false,
            isRuntimeCommandGated: false,
        };
    }

    public initialize(config: NavigationConfig): void {
        if (this._isInitialized) {
            return;
        }

        this._state.config = { ...DEFAULT_NAVIGATION_CONFIG, ...config };

        this._remoteHandler.initialize();

        this._keyDownDisposable = this._remoteHandler.on('keyDown', (keyEvent) => {
            this._remoteInputRouter.handleKeyEvent(keyEvent);
        });
        this._keyUpDisposable = this._remoteHandler.on('keyUp', ({ button }) => {
            this._handleKeyUp(button);
        });

        // Focus desync repair (lightweight): catches cases where browser focus drops to <body>
        // (e.g., after modal close) while the app still has a tracked focus id.
        if (typeof document !== 'undefined') {
            document.addEventListener('focusin', this._boundFocusInHandler, { passive: true });
        }

        if (this._state.config.enablePointerMode) {
            this._initializePointerMode();
        }

        this._isInitialized = true;
    }

    public destroy(): void {
        if (!this._isInitialized) {
            return;
        }

        if (this._pointerHideTimer !== null) {
            window.clearTimeout(this._pointerHideTimer);
            this._pointerHideTimer = null;
        }

        this._directionalRepeatController.destroy();
        this._channelNumberInputController.destroy();

        document.removeEventListener('mousemove', this._handlePointerMove);
        document.removeEventListener('click', this._handlePointerClick);
        document.removeEventListener('focusin', this._boundFocusInHandler);

        if (this._keyDownDisposable) {
            this._keyDownDisposable.dispose();
            this._keyDownDisposable = null;
        }
        if (this._keyUpDisposable) {
            this._keyUpDisposable.dispose();
            this._keyUpDisposable = null;
        }

        for (const elementId of this._clickHandlers.keys()) {
            this._removeClickHandlers(elementId);
        }

        this._remoteHandler.destroy();
        this._focusManager.clear();
        this.removeAllListeners();

        this._isInitialized = false;

    }

    public goTo(screen: 'server-select', params: ServerSelectNavigationParams): void;
    public goTo(screen: 'server-select'): void;
    public goTo(screen: Exclude<Screen, 'server-select'>): void;
    public goTo(screen: Screen, params?: ServerSelectNavigationParams): void {
        if (this._state.isInputBlocked || this._blocksBackgroundCommands()) {
            return;
        }

        const from = this._state.currentScreen;

        if (this._state.config.focusMemoryEnabled) {
            this._focusManager.saveFocusState(from);
        }

        this._state.screenStack.push(from);

        this._state.currentScreen = screen;
        this._state.serverSelectParams = screen === 'server-select'
            ? (params !== undefined ? { ...params } : null)
            : null;

        this.emit('screenChange', { from, to: screen });

        if (this._state.config.focusMemoryEnabled && this._state.modalStack.length === 0) {
            this._focusManager.restoreFocusState(screen);
        }

    }

    public goBack(): boolean {
        if (this._state.isInputBlocked) {
            return false;
        }

        if (this._state.modalStack.length > 0) {
            if (this.getActiveModalPolicy()?.dismissOnBack === false) {
                return false;
            }
            this.closeModal();
            return true;
        }

        if (this._state.screenStack.length === 0) {
            return false;
        }

        const from = this._state.currentScreen;
        const previousScreen = this._state.screenStack.pop();

        if (previousScreen === undefined) {
            return false;
        }

        if (this._state.config.focusMemoryEnabled) {
            this._focusManager.saveFocusState(from);
        }

        this._state.currentScreen = previousScreen;
        this._state.serverSelectParams = null;

        this.emit('screenChange', { from, to: previousScreen });

        if (this._state.config.focusMemoryEnabled && this._state.modalStack.length === 0) {
            this._focusManager.restoreFocusState(previousScreen);
        }

        return true;
    }

    public replaceScreen(screen: Screen): void {
        if (this._state.isInputBlocked || this._blocksBackgroundCommands()) {
            return;
        }

        const from = this._state.currentScreen;
        this._state.currentScreen = screen;
        this._state.serverSelectParams = null;

        this.emit('screenChange', { from, to: screen });

    }

    public getServerSelectParams(): ServerSelectNavigationParams | null {
        return this._state.currentScreen === 'server-select' && this._state.serverSelectParams !== null
            ? { ...this._state.serverSelectParams }
            : null;
    }

    public getCurrentScreen(): Screen {
        return this._state.currentScreen;
    }

    public setFocus(elementId: string, options?: { persist?: boolean }): void {
        if (!this._isAllowedByActiveModal(elementId)) {
            return;
        }

        const previousId = this._focusManager.getCurrentFocusId();
        const success = this._focusManager.focus(elementId);

        if (!success) {
            return;
        }

        const shouldPersist = options?.persist !== false;
        const modalOpen = this._state.modalStack.length > 0;
        if (shouldPersist && !modalOpen && this._state.config.focusMemoryEnabled) {
            this._focusManager.saveFocusState(this._state.currentScreen);
        }
        if (previousId !== elementId) {
            this.emit('focusChange', { from: previousId, to: elementId });
        }
    }

    public restoreFocusForCurrentScreen(): boolean {
        if (!this._state.config.focusMemoryEnabled || this._state.modalStack.length > 0) {
            return false;
        }
        return this._focusManager.restoreFocusState(this._state.currentScreen);
    }

    public getFocusedElement(): FocusableElement | null {
        return this._focusManager.getFocusedElement();
    }

    public moveFocus(direction: Direction): boolean {
        if (this._state.isInputBlocked) {
            return false;
        }

        const currentId = this._focusManager.getCurrentFocusId();
        if (!currentId) {
            return false;
        }

        const policyResult = this._focusPolicy.evaluateMove({
            neighborId: this._focusManager.findNeighbor(currentId, direction),
            modalStack: this._state.modalStack,
            modalFocusableIds: this._state.modalFocusableIds,
        });
        if (!policyResult.allowed || !policyResult.targetId) {
            if (policyResult.reason === 'modal_open') {
                this._logInputSuppressed(policyResult.reason, direction);
            }
            return false;
        }

        this.setFocus(policyResult.targetId);
        return true;
    }

    public registerFocusable(element: FocusableElement): void {
        this._removeClickHandlers(element.id);

        this._focusManager.registerFocusable(element);

        const clickGuard = (event: MouseEvent): void => {
            if (!this._isAllowedByActiveModal(element.id)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };
        const clickHandler = (_event: MouseEvent): void => {
            this.setFocus(element.id);
            if (this._focusManager.getFocusedElement()?.id !== element.id) {
                return;
            }
            if (element.onSelect) {
                element.onSelect();
            }
        };
        this._clickHandlers.set(element.id, {
            element: element.element,
            guard: clickGuard,
            activate: clickHandler,
        });
        element.element.addEventListener('click', clickGuard, true);
        element.element.addEventListener('click', clickHandler);
    }

    public unregisterFocusable(elementId: string): void {
        this._removeClickHandlers(elementId);
        this._focusManager.unregisterFocusable(elementId);
    }

    public registerFocusGroup(group: FocusGroup): void {
        this._focusManager.registerFocusGroup(group);
    }

    public unregisterFocusGroup(groupId: string): void {
        this._focusManager.unregisterFocusGroup(groupId);
    }

    public openModal(
        modalId: string,
        focusableIds?: string[],
        policy: NavigationModalPolicy = {
            dismissOnBack: true,
            blocksBackgroundCommands: false,
        }
    ): void {
        if (this._state.isInputBlocked) {
            return;
        }

        if (this._state.modalStack.includes(modalId)) {
            if (focusableIds && focusableIds.length > 0) {
                this._state.modalFocusableIds.set(modalId, focusableIds);
            }
            this._state.modalPolicies.set(modalId, { ...policy });
            return;
        }

        this._focusManager.savePreModalFocus();

        this._state.modalStack.push(modalId);
        this._state.modalPolicies.set(modalId, { ...policy });

        if (focusableIds && focusableIds.length > 0) {
            this._state.modalFocusableIds.set(modalId, focusableIds);
        }

        this.emit('modalOpen', { modalId });

    }

    public closeModal(modalId?: string): void {
        if (this._state.modalStack.length === 0) {
            return;
        }

        let closedModalId: string;

        if (modalId !== undefined) {
            const index = this._state.modalStack.indexOf(modalId);
            if (index === -1) {
                return;
            }
            this._state.modalStack.splice(index, 1);
            this._state.modalFocusableIds.delete(modalId);
            this._state.modalPolicies.delete(modalId);
            closedModalId = modalId;
        } else {
            const topModal = this._state.modalStack.pop();
            if (topModal === undefined) {
                return;
            }
            this._state.modalFocusableIds.delete(topModal);
            this._state.modalPolicies.delete(topModal);
            closedModalId = topModal;
        }

        this.emit('modalClose', { modalId: closedModalId });

        if (this._state.modalStack.length === 0) {
            this._focusManager.restorePreModalFocus();
        }

    }

    public isModalOpen(modalId?: string): boolean {
        if (modalId !== undefined) {
            return this._state.modalStack.indexOf(modalId) !== -1;
        }
        return this._state.modalStack.length > 0;
    }

    public getActiveModalPolicy(): NavigationModalPolicy | null {
        const activeModalId = this._state.modalStack[this._state.modalStack.length - 1];
        if (activeModalId === undefined) {
            return null;
        }
        const policy = this._state.modalPolicies.get(activeModalId);
        return policy ? { ...policy } : null;
    }

    public cancelPendingChannelInput(): void {
        this._channelNumberInputController.cancelPendingInput();
    }

    public activateRuntimeCommandGate(): void {
        this._state.isRuntimeCommandGated = true;
    }

    public deactivateRuntimeCommandGate(): void {
        this._state.isRuntimeCommandGated = false;
    }

    public isRuntimeCommandGated(): boolean {
        return this._state.isRuntimeCommandGated;
    }

    public blockInput(): void {
        this._state.isInputBlocked = true;

    }

    public unblockInput(): void {
        this._state.isInputBlocked = false;

    }

    public isInputBlocked(): boolean {
        return this._state.isInputBlocked;
    }

    public getState(): NavigationState {
        return {
            currentScreen: this._state.currentScreen,
            screenStack: [...this._state.screenStack],
            focusedElementId: this._focusManager.getCurrentFocusId(),
            modalStack: [...this._state.modalStack],
            isPointerActive: this._state.isPointerActive,
        };
    }

    public handleLongPress(button: RemoteButton, callback: () => void): void {
        this._remoteHandler.registerLongPress(button, callback);
    }

    public cancelLongPress(): void {
        this._remoteHandler.cancelLongPress();
    }

    /**
     * Focus desync repair hook.
     * We only re-apply focus when browser focus drops to <body> while the app still tracks a focus id.
     */
    private _handleFocusIn(_event: FocusEvent): void {
        if (!this._isInitialized) return;
        this._restoreFocusIfBodyActive();
    }

    private _repairFocusDesync(): void {
        this._restoreFocusIfBodyActive();
    }

    private _restoreFocusIfBodyActive(): void {
        if (typeof document === 'undefined' || document.activeElement !== document.body) {
            return;
        }

        const currentId = this._focusManager.getCurrentFocusId();
        if (!currentId) {
            return;
        }

        this._focusManager.focus(currentId);
    }

    private _isDebugLoggingEnabled(): boolean {
        return this._readDebugLoggingEnabled();
    }

    private _logInputSuppressed(reason: string, button?: RemoteButton): void {
        if (!this._isDebugLoggingEnabled()) return;
        const key = [
            reason,
            button ?? 'none',
            this._state.currentScreen,
            this._state.modalStack.join(','),
            this._state.isInputBlocked ? 'blocked' : 'open',
        ].join('|');
        const now = Date.now();
        const last = this._suppressedLogTimestamps.get(key) ?? 0;
        if (now - last < 1000) {
            return;
        }
        if (this._suppressedLogTimestamps.size > 50) {
            this._suppressedLogTimestamps.clear();
        }
        this._suppressedLogTimestamps.set(key, now);
    }

    private _handleKeyUp(button: RemoteButton): void {
        this.emit('keyUp', { button });
        this._directionalRepeatController.handleDirectionalKeyUp(button);
    }

    private _handleOkButton(): void {
        const focused = this._focusManager.getFocusedElement();
        if (focused && this._isAllowedByActiveModal(focused.id)) {
            if (focused.onSelect) {
                focused.onSelect();
            } else {
                focused.element.click();
            }
        }
    }

    private _handleBackButton(): void {
        if (this._state.modalStack.length > 0) {
            if (this.getActiveModalPolicy()?.dismissOnBack !== false) {
                this.closeModal();
            }
            return;
        }

        if (this._state.screenStack.length > 0) {
            this.goBack();
            return;
        }

        // Root screen Back behavior per spec
        // Using replaceScreen() to maintain standard navigation flow (input-block checks)
        // without pushing to history, which is appropriate for root back transitions.
        const screen = this._state.currentScreen;
        switch (screen) {
            case 'splash':
                // Mandatory webOS UX guideline: Back on entry screen must exit to Home.
                window.close();
                break;
            case 'player':
            case 'auth':
                // Exit to Home when at a root screen without wired navigation coordinators.
                // (Player context overrides this via NavigationCoordinator with an in-app confirmation modal.)
                window.close();
                break;
            case 'server-select':
                this.replaceScreen('auth');
                break;
            case 'profile-select':
                this.replaceScreen('auth');
                break;
            case 'audio-setup':
                this.replaceScreen('server-select');
                break;
            case 'channel-setup':
                this.replaceScreen('audio-setup');
                break;
            case 'settings':
            case 'channel-edit':
                this.replaceScreen('player');
                break;
            default:
                break;
        }
    }

    private _blocksBackgroundCommands(): boolean {
        return this.getActiveModalPolicy()?.blocksBackgroundCommands === true;
    }

    private _isAllowedByActiveModal(elementId: string): boolean {
        const activeModalId = this._state.modalStack[this._state.modalStack.length - 1];
        if (activeModalId === undefined) {
            return true;
        }
        return this._state.modalFocusableIds.get(activeModalId)?.includes(elementId) === true;
    }

    private _removeClickHandlers(elementId: string): void {
        const handlers = this._clickHandlers.get(elementId);
        if (!handlers) {
            return;
        }
        handlers.element.removeEventListener('click', handlers.guard, true);
        handlers.element.removeEventListener('click', handlers.activate);
        this._clickHandlers.delete(elementId);
    }

    private _initializePointerMode(): void {
        document.addEventListener('mousemove', this._handlePointerMove);
        document.addEventListener('click', this._handlePointerClick);
    }

    private _handlePointerMove = (): void => {
        if (!this._state.isPointerActive) {
            this._state.isPointerActive = true;
            document.body.classList.add(FOCUS_CLASSES.POINTER_MODE);
            this.emit('pointerModeChange', { active: true });
        }

        if (this._pointerHideTimer !== null) {
            window.clearTimeout(this._pointerHideTimer);
        }

        this._pointerHideTimer = window.setTimeout(() => {
            this._state.isPointerActive = false;
            document.body.classList.remove(FOCUS_CLASSES.POINTER_MODE);
            this.emit('pointerModeChange', { active: false });
            this._pointerHideTimer = null;
        }, CURSOR_HIDE_DELAY_MS);
    };

    private _handlePointerClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        const focusable = target.closest('.' + FOCUS_CLASSES.FOCUSABLE) as HTMLElement;

        if (focusable && focusable.id) {
            this.setFocus(focusable.id);
        }
    };
}
