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
});
