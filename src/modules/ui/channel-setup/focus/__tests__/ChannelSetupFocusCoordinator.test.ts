/**
 * @jest-environment jsdom
 */

import { ChannelSetupFocusCoordinator } from '../ChannelSetupFocusCoordinator';
import type { FocusCoordinatorDeps } from '../types';
import type { INavigationManager } from '../../../../navigation/contracts/interfaces';
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

        coordinator.registerStep2({
            categoryButtons: [cat1],
            detailButtons: [detail1],
            footerButtons: [footer1],
            activeCategoryId: cat1.id,
            detailFocusTarget: detail1.id,
            preferredFocusId: null,
            onDetailFocus: jest.fn(),
        });

        const cat2 = document.createElement('button');
        cat2.id = 'cat-2';
        const detail2 = document.createElement('button');
        detail2.id = 'detail-2';
        const footer2 = document.createElement('button');
        footer2.id = 'footer-2';

        coordinator.registerStep2({
            categoryButtons: [cat2],
            detailButtons: [detail2],
            footerButtons: [footer2],
            activeCategoryId: cat2.id,
            detailFocusTarget: detail2.id,
            preferredFocusId: null,
            onDetailFocus: jest.fn(),
        });

        expect(nav.unregisterFocusable).toHaveBeenCalledWith('cat-1');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('detail-1');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('footer-1');
    });

    it('registers library-step bulk neighbors through the coordinator-owned registry', () => {
        const nav = createNavigationMock();
        const coordinator = new ChannelSetupFocusCoordinator({
            getNavigation: (): INavigationManager => nav as unknown as INavigationManager,
        });

        const selectAllButton = document.createElement('button');
        selectAllButton.id = 'setup-select-all';
        const clearAllButton = document.createElement('button');
        clearAllButton.id = 'setup-clear-all';
        const listButton = document.createElement('button');
        listButton.id = 'setup-lib-movies';
        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        const nextButton = document.createElement('button');
        nextButton.id = 'setup-next';

        expect(coordinator.registerLibraryStep({
            selectAllButton,
            clearAllButton,
            listButtons: [listButton],
            footerButtons: [backButton, nextButton],
            preferredFocusId: 'setup-clear-all',
        })).toBe(true);

        expect(nav.focusables.get('setup-select-all')?.neighbors).toEqual({
            right: 'setup-clear-all',
            down: 'setup-lib-movies',
        });
        expect(nav.focusables.get('setup-clear-all')?.neighbors).toEqual({
            left: 'setup-select-all',
            down: 'setup-lib-movies',
        });
        expect(nav.focusables.get('setup-lib-movies')?.neighbors).toEqual({});
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-clear-all');
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

    it('preserves preferred-focus boolean contract for register methods', () => {
        const nav = createNavigationMock();
        const deps: FocusCoordinatorDeps = {
            getNavigation: () => nav as unknown as INavigationManager,
        };
        const coordinator = new ChannelSetupFocusCoordinator(deps);

        const first = document.createElement('button');
        first.id = 'first';
        const second = document.createElement('button');
        second.id = 'second';

        expect(coordinator.registerLinear([first, second], 'second')).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('second');

        expect(coordinator.registerSpatial([first, second], 'missing')).toBe(false);
        expect(nav.setFocus).toHaveBeenLastCalledWith('first');
    });
});
