/**
 * @jest-environment jsdom
 */

import { ServerSelectFocusCoordinator } from '../ServerSelectFocusCoordinator';
import type { ServerSelectScreenNavigationPort } from '../../../navigation';

type NavigationStub = ServerSelectScreenNavigationPort & {
    restoreFocusForCurrentScreen: jest.Mock;
    setFocus: jest.Mock;
};

const createNavigationStub = (): NavigationStub => ({
    registerFocusable: jest.fn(),
    unregisterFocusable: jest.fn(),
    setFocus: jest.fn(),
    restoreFocusForCurrentScreen: jest.fn().mockReturnValue(false),
    getCurrentScreen: jest.fn().mockReturnValue('server-select'),
    replaceScreen: jest.fn(),
});

describe('ServerSelectFocusCoordinator', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('settles pending restore when the generation can no longer update UI', () => {
        const coordinator = new ServerSelectFocusCoordinator();
        const nav = createNavigationStub();
        const onPending = jest.fn();
        const onSettled = jest.fn();

        coordinator.restoreFocus({
            nav,
            generation: 1,
            canUpdateUi: () => false,
            onPending,
            onSettled,
        });

        jest.runOnlyPendingTimers();

        expect(onPending).toHaveBeenCalledTimes(1);
        expect(onSettled).toHaveBeenCalledTimes(1);
        expect(nav.restoreFocusForCurrentScreen).not.toHaveBeenCalled();
        expect(nav.setFocus).not.toHaveBeenCalled();
    });
});
