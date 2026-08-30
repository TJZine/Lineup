import { NavigationRemoteInputRouter } from '../input/NavigationRemoteInputRouter';
import type { KeyEvent, RemoteButton } from '../contracts/interfaces';

function createKeyEvent(button: RemoteButton, overrides: Partial<KeyEvent> = {}): KeyEvent {
    return {
        button,
        isRepeat: false,
        isLongPress: false,
        timestamp: Date.now(),
        originalEvent: { preventDefault: jest.fn() } as unknown as KeyboardEvent,
        ...overrides,
    };
}

describe('NavigationRemoteInputRouter', () => {
    it('consumes every command while the runtime gate is active before modal presentation', () => {
        const deps = {
            isInputBlocked: jest.fn().mockReturnValue(false),
            isRuntimeCommandGated: jest.fn().mockReturnValue(true),
            getActiveModalPolicy: jest.fn().mockReturnValue(null),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: jest.fn(),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: jest.fn(),
            emitSettings: jest.fn(),
        };
        const router = new NavigationRemoteInputRouter(deps);

        for (const button of ['up', 'ok', 'back', 'num4', 'play', 'guide'] as RemoteButton[]) {
            router.handleKeyEvent(createKeyEvent(button));
        }

        expect(deps.emitKeyPress).not.toHaveBeenCalled();
        expect(deps.handleDirectionalKeyDown).not.toHaveBeenCalled();
        expect(deps.handleOk).not.toHaveBeenCalled();
        expect(deps.handleNumberKey).not.toHaveBeenCalled();
    });

    it('short-circuits and logs when input is blocked', () => {
        const deps = {
            isInputBlocked: jest.fn().mockReturnValue(true),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: jest.fn(),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: jest.fn(),
            emitSettings: jest.fn(),
        };
        const router = new NavigationRemoteInputRouter(deps);

        router.handleKeyEvent(createKeyEvent('ok'));

        expect(deps.logInputSuppressed).toHaveBeenCalledWith('input_blocked', 'ok');
        expect(deps.emitKeyPress).not.toHaveBeenCalled();
        expect(deps.cancelDirectionalRepeat).not.toHaveBeenCalled();
    });

    it('cancels repeat for non-directional keys and routes yellow to settings', () => {
        const deps = {
            isInputBlocked: jest.fn().mockReturnValue(false),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: jest.fn(),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: jest.fn(),
            emitSettings: jest.fn(),
        };
        const router = new NavigationRemoteInputRouter(deps);

        router.handleKeyEvent(createKeyEvent('yellow'));

        expect(deps.cancelDirectionalRepeat).toHaveBeenCalledTimes(1);
        expect(deps.emitKeyPress).toHaveBeenCalledTimes(1);
        expect(deps.emitSettings).toHaveBeenCalledTimes(1);
        expect(deps.emitGuide).not.toHaveBeenCalled();
    });

    it('stops default routing when keyPress handler marks event as handled', () => {
        const deps = {
            isInputBlocked: jest.fn().mockReturnValue(false),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: jest.fn((event: KeyEvent) => {
                event.handled = true;
            }),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: jest.fn(),
            emitSettings: jest.fn(),
        };
        const router = new NavigationRemoteInputRouter(deps);

        router.handleKeyEvent(createKeyEvent('down'));

        expect(deps.handleDirectionalKeyDown).not.toHaveBeenCalled();
        expect(deps.repairFocusDesync).not.toHaveBeenCalled();
    });

    it('routes directional and numeric events to focused handlers', () => {
        const deps = {
            isInputBlocked: jest.fn().mockReturnValue(false),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: jest.fn(),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: jest.fn(),
            emitSettings: jest.fn(),
        };
        const router = new NavigationRemoteInputRouter(deps);

        router.handleKeyEvent(createKeyEvent('left', { isRepeat: true }));
        router.handleKeyEvent(createKeyEvent('num7'));

        expect(deps.cancelDirectionalRepeat).toHaveBeenCalledTimes(1);
        expect(deps.handleDirectionalKeyDown).toHaveBeenCalledWith('left', true);
        expect(deps.handleNumberKey).toHaveBeenCalledWith('num7');
    });

    it('routes button-specific callbacks for ok/back/guide', () => {
        const deps = {
            isInputBlocked: jest.fn().mockReturnValue(false),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: jest.fn(),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: jest.fn(),
            emitSettings: jest.fn(),
        };
        const router = new NavigationRemoteInputRouter(deps);

        router.handleKeyEvent(createKeyEvent('ok'));
        router.handleKeyEvent(createKeyEvent('back'));
        router.handleKeyEvent(createKeyEvent('green'));

        expect(deps.handleOk).toHaveBeenCalledTimes(1);
        expect(deps.handleBack).toHaveBeenCalledTimes(1);
        expect(deps.emitGuide).toHaveBeenCalledTimes(1);
    });

    it('routes only direction and OK inside a protected modal and consumes background commands', () => {
        const deps = {
            isInputBlocked: jest.fn().mockReturnValue(false),
            getActiveModalPolicy: jest.fn().mockReturnValue({
                dismissOnBack: false,
                blocksBackgroundCommands: true,
            }),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: jest.fn(),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: jest.fn(),
            emitSettings: jest.fn(),
        };
        const router = new NavigationRemoteInputRouter(deps);

        const protectedModalInput: RemoteButton[] = [
            'left', 'ok', 'back', 'guide', 'green', 'yellow', 'info', 'blue',
            'channelUp', 'channelDown', 'num0', 'num3', 'num9', 'red',
            'play', 'pause', 'stop', 'rewind', 'fastforward',
        ];
        for (const button of protectedModalInput) {
            router.handleKeyEvent(createKeyEvent(button));
        }

        expect(deps.handleDirectionalKeyDown).toHaveBeenCalledWith('left', false);
        expect(deps.handleOk).toHaveBeenCalledTimes(1);
        expect(deps.emitKeyPress).not.toHaveBeenCalled();
        expect(deps.handleBack).not.toHaveBeenCalled();
        expect(deps.handleNumberKey).not.toHaveBeenCalled();
        expect(deps.emitGuide).not.toHaveBeenCalled();
        expect(deps.emitSettings).not.toHaveBeenCalled();
        expect(deps.logInputSuppressed).toHaveBeenCalledWith('protected_modal', 'back');
    });

    it('routes Back for a dismissible background-blocking modal', () => {
        const deps = {
            isInputBlocked: jest.fn().mockReturnValue(false),
            getActiveModalPolicy: jest.fn().mockReturnValue({
                dismissOnBack: true,
                blocksBackgroundCommands: true,
            }),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: jest.fn(),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: jest.fn(),
            emitSettings: jest.fn(),
        };
        const router = new NavigationRemoteInputRouter(deps);

        router.handleKeyEvent(createKeyEvent('back'));

        expect(deps.handleBack).toHaveBeenCalledTimes(1);
        expect(deps.logInputSuppressed).not.toHaveBeenCalled();
    });
});
