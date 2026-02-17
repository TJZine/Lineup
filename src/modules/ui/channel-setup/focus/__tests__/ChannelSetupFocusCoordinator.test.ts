/**
 * @jest-environment jsdom
 */

import { ChannelSetupFocusCoordinator } from '../ChannelSetupFocusCoordinator';
import type { FocusCoordinatorDeps } from '../types';
import type { INavigationManager } from '../../../../navigation/interfaces';

describe('ChannelSetupFocusCoordinator', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('unregisters previously registered focusables when re-registering without an explicit unregisterAll', () => {
        const nav = {
            registerFocusable: jest.fn(),
            unregisterFocusable: jest.fn(),
            setFocus: jest.fn(),
        };

        const deps: FocusCoordinatorDeps = {
            getNavigation: () => nav as unknown as INavigationManager,
        };
        const coordinator = new ChannelSetupFocusCoordinator(deps);

        const first = document.createElement('button');
        first.id = 'btn-1';
        const second = document.createElement('button');
        second.id = 'btn-2';

        coordinator.registerLinear([first], null);
        coordinator.registerLinear([second], null);

        expect(nav.unregisterFocusable).toHaveBeenCalledWith('btn-1');
    });
});
