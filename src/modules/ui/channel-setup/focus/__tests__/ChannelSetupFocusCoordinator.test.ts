/**
 * @jest-environment jsdom
 */

import { ChannelSetupFocusCoordinator } from '../ChannelSetupFocusCoordinator';
import type { FocusCoordinatorDeps } from '../types';
import type { INavigationManager } from '../../../../navigation/interfaces';
import { createNavigationMock } from '../../__tests__/channel-setup-test-helpers';

describe('ChannelSetupFocusCoordinator', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('unregisters previously registered focusables when re-registering without an explicit unregisterAll', () => {
        const nav = createNavigationMock();

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
        expect(nav.registerFocusable).toHaveBeenCalledWith(expect.objectContaining({ id: 'btn-2' }));
    });

    it('unregisters previously registered focusables when re-registering via registerSpatial', () => {
        const nav = createNavigationMock();

        const deps: FocusCoordinatorDeps = {
            getNavigation: () => nav as unknown as INavigationManager,
        };
        const coordinator = new ChannelSetupFocusCoordinator(deps);

        const first = document.createElement('button');
        first.id = 'spatial-1';
        const second = document.createElement('button');
        second.id = 'spatial-2';

        coordinator.registerSpatial([first], null);
        coordinator.registerSpatial([second], null);

        expect(nav.unregisterFocusable).toHaveBeenCalledWith('spatial-1');
        expect(nav.registerFocusable).toHaveBeenCalledWith(expect.objectContaining({ id: 'spatial-2' }));
    });

    it('unregisters previously registered focusables when re-registering via registerStep2', () => {
        const nav = createNavigationMock();

        const deps: FocusCoordinatorDeps = {
            getNavigation: () => nav as unknown as INavigationManager,
        };
        const coordinator = new ChannelSetupFocusCoordinator(deps);

        const cat1 = document.createElement('button');
        cat1.id = 'cat-1';
        const detail1 = document.createElement('button');
        detail1.id = 'detail-1';
        const footer1 = document.createElement('button');
        footer1.id = 'footer-1';

        coordinator.registerStep2(
            [cat1],
            [detail1],
            [footer1],
            cat1.id,
            detail1.id,
            null,
            jest.fn()
        );

        const cat2 = document.createElement('button');
        cat2.id = 'cat-2';
        const detail2 = document.createElement('button');
        detail2.id = 'detail-2';
        const footer2 = document.createElement('button');
        footer2.id = 'footer-2';

        coordinator.registerStep2(
            [cat2],
            [detail2],
            [footer2],
            cat2.id,
            detail2.id,
            null,
            jest.fn()
        );

        expect(nav.unregisterFocusable).toHaveBeenCalledWith('cat-1');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('detail-1');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('footer-1');
    });

    it('unregisterAll clears registered ids and unregisters them from navigation', () => {
        const nav = createNavigationMock();

        const deps: FocusCoordinatorDeps = {
            getNavigation: () => nav as unknown as INavigationManager,
        };
        const coordinator = new ChannelSetupFocusCoordinator(deps);

        const first = document.createElement('button');
        first.id = 'btn-a';
        const second = document.createElement('button');
        second.id = 'btn-b';

        coordinator.registerLinear([first, second], null);

        coordinator.unregisterAll();

        expect(nav.unregisterFocusable).toHaveBeenCalledWith('btn-a');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('btn-b');

        nav.unregisterFocusable.mockClear();
        coordinator.unregisterAll();
        expect(nav.unregisterFocusable).not.toHaveBeenCalled();
    });

    it('clears registered ids and returns false when navigation is null', () => {
        const coordinator = new ChannelSetupFocusCoordinator({ getNavigation: (): INavigationManager | null => null });

        const button = document.createElement('button');
        button.id = 'x';

        expect(coordinator.registerLinear([button], null)).toBe(false);
        expect(() => coordinator.unregisterAll()).not.toThrow();
    });
});
