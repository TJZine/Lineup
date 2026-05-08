/**
 * @jest-environment jsdom
 */

import { createNavigationCoordinatorRuntimeServices } from '../coordinator/NavigationCoordinatorRuntimeServices';
import type { KeyEvent, NavigationState } from '../contracts/interfaces';
import type { NavigationCoordinatorEventPort } from '../coordinator/NavigationCoordinatorEventPort';

const createKeyEvent = (): KeyEvent => ({
    button: 'ok',
    isRepeat: false,
    isLongPress: false,
    timestamp: 123,
    originalEvent: new KeyboardEvent('keydown'),
});

const createNavigationState = (overrides: Partial<NavigationState> = {}): NavigationState => ({
    currentScreen: 'player',
    screenStack: [],
    focusedElementId: null,
    modalStack: ['playback-options'],
    isPointerActive: false,
    ...overrides,
});

const createEventPort = (
    overrides: {
        debugEnabled?: boolean;
        state?: NavigationState | null;
        inputBlocked?: boolean;
        logDebug?: jest.Mock;
    } = {}
): NavigationCoordinatorEventPort => ({
    navigation: {
        getState: jest.fn(() => overrides.state ?? createNavigationState()),
        isInputBlocked: jest.fn(() => overrides.inputBlocked ?? true),
    } as unknown as NavigationCoordinatorEventPort['navigation'],
    miniGuide: {} as NavigationCoordinatorEventPort['miniGuide'],
    channelSwitching: {} as NavigationCoordinatorEventPort['channelSwitching'],
    reportRecoverableAsyncFailure: jest.fn(),
    readDebugLoggingEnabled: jest.fn(() => overrides.debugEnabled ?? true),
    ...(overrides.logDebug ? { logDebug: overrides.logDebug } : {}),
});

describe('createNavigationCoordinatorRuntimeServices', () => {
    it('logs unhandled input details when debug logging is enabled', () => {
        const logDebug = jest.fn();
        const events = createEventPort({ logDebug });
        const runtime = createNavigationCoordinatorRuntimeServices(events);

        runtime.logInputNotHandled('modal_open', createKeyEvent());

        expect(logDebug).toHaveBeenCalledWith('navigation.inputNotHandled', {
            reason: 'modal_open',
            button: 'ok',
            currentScreen: 'player',
            modalStack: ['playback-options'],
            inputBlocked: true,
        });
    });

    it('keeps debug logging gated and rate-limited by input state', () => {
        const logDebug = jest.fn();
        const dateNowSpy = jest.spyOn(Date, 'now')
            .mockReturnValueOnce(1_000)
            .mockReturnValueOnce(1_500)
            .mockReturnValueOnce(2_100);
        const events = createEventPort({ logDebug });
        const runtime = createNavigationCoordinatorRuntimeServices(events);
        const event = createKeyEvent();

        try {
            runtime.logInputNotHandled('input_blocked', event);
            runtime.logInputNotHandled('input_blocked', event);
            runtime.logInputNotHandled('input_blocked', event);

            expect(logDebug).toHaveBeenCalledTimes(2);
        } finally {
            dateNowSpy.mockRestore();
        }
    });

    it('keeps input handling non-fatal when debug diagnostics throw', () => {
        const logDebug = jest.fn(() => {
            throw new Error('diagnostics unavailable');
        });
        const events = createEventPort({ logDebug });
        const runtime = createNavigationCoordinatorRuntimeServices(events);

        expect(() => {
            runtime.logInputNotHandled('modal_open', createKeyEvent());
        }).not.toThrow();

        expect(logDebug).toHaveBeenCalledWith('navigation.inputNotHandled', expect.objectContaining({
            reason: 'modal_open',
            button: 'ok',
        }));
    });

    it('does not log when debug logging is disabled', () => {
        const logDebug = jest.fn();
        const events = createEventPort({ debugEnabled: false, logDebug });
        const runtime = createNavigationCoordinatorRuntimeServices(events);

        runtime.logInputNotHandled('screen_not_player', createKeyEvent());

        expect(logDebug).not.toHaveBeenCalled();
    });
});
