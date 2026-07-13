import type {
    Direction,
    KeyEvent,
    NavigationModalPolicy,
    RemoteButton,
} from '../contracts/interfaces';

interface NavigationRemoteInputRouterDeps {
    isInputBlocked: () => boolean;
    isRuntimeCommandGated?: () => boolean;
    getActiveModalPolicy?: () => NavigationModalPolicy | null;
    logInputSuppressed: (reason: string, button?: RemoteButton) => void;
    cancelDirectionalRepeat: () => void;
    emitKeyPress: (event: KeyEvent) => void;
    repairFocusDesync: () => void;
    handleDirectionalKeyDown: (button: Direction, isRepeat: boolean) => void;
    handleOk: () => void;
    handleBack: () => void;
    handleNumberKey: (button: RemoteButton) => void;
    emitGuide: () => void;
    emitSettings: () => void;
}

const DIRECTIONAL_BUTTONS = new Set<RemoteButton>(['up', 'down', 'left', 'right']);
const NUMBER_BUTTONS = new Set<RemoteButton>([
    'num0',
    'num1',
    'num2',
    'num3',
    'num4',
    'num5',
    'num6',
    'num7',
    'num8',
    'num9',
]);

export class NavigationRemoteInputRouter {
    private readonly deps: NavigationRemoteInputRouterDeps;

    constructor(deps: NavigationRemoteInputRouterDeps) {
        this.deps = deps;
    }

    public handleKeyEvent(keyEvent: KeyEvent): void {
        if (this.deps.isInputBlocked()) {
            this.deps.logInputSuppressed('input_blocked', keyEvent.button);
            return;
        }

        if (!DIRECTIONAL_BUTTONS.has(keyEvent.button)) {
            this.deps.cancelDirectionalRepeat();
        }

        if (
            this.deps.isRuntimeCommandGated?.() === true
            && this.deps.getActiveModalPolicy?.()?.blocksBackgroundCommands !== true
        ) {
            keyEvent.handled = true;
            keyEvent.originalEvent.preventDefault();
            this.deps.logInputSuppressed('runtime_command_gate', keyEvent.button);
            return;
        }

        if (this.deps.getActiveModalPolicy?.()?.blocksBackgroundCommands === true) {
            this._handleProtectedModalKeyEvent(keyEvent);
            return;
        }

        this.deps.emitKeyPress(keyEvent);
        if (keyEvent.handled) {
            return;
        }

        this.deps.repairFocusDesync();

        switch (keyEvent.button) {
            case 'up':
            case 'down':
            case 'left':
            case 'right':
                this.deps.handleDirectionalKeyDown(keyEvent.button, keyEvent.isRepeat);
                break;
            case 'ok':
                this.deps.handleOk();
                break;
            case 'back':
                this.deps.handleBack();
                break;
            case 'guide':
            case 'green':
                this.deps.emitGuide();
                break;
            case 'yellow':
                this.deps.emitSettings();
                break;
            default:
                if (NUMBER_BUTTONS.has(keyEvent.button)) {
                    this.deps.handleNumberKey(keyEvent.button);
                }
                break;
        }
    }

    private _handleProtectedModalKeyEvent(keyEvent: KeyEvent): void {
        keyEvent.handled = true;
        keyEvent.originalEvent.preventDefault();
        this.deps.repairFocusDesync();

        if (DIRECTIONAL_BUTTONS.has(keyEvent.button)) {
            this.deps.handleDirectionalKeyDown(keyEvent.button as Direction, keyEvent.isRepeat);
            return;
        }
        if (keyEvent.button === 'ok') {
            this.deps.handleOk();
            return;
        }
        this.deps.logInputSuppressed('protected_modal', keyEvent.button);
    }
}
