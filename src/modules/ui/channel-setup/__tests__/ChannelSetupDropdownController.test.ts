/**
 * @jest-environment jsdom
 */

import { ChannelSetupDropdownController } from '../ChannelSetupDropdownController';
import { createNavigationMock } from './channel-setup-test-helpers';
import type { FocusableElement } from '../../../navigation/contracts/interfaces';
import { NavigationManager } from '../../../navigation';

describe('ChannelSetupDropdownController', () => {
    const navigationManagers: NavigationManager[] = [];

    afterEach(() => {
        for (const navigation of navigationManagers) {
            navigation.destroy();
        }
        navigationManagers.length = 0;
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('owns dropdown selection cleanup and flushes deferred renders after select', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        anchor.id = 'setup-build-mode';
        container.appendChild(anchor);
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const controller = new ChannelSetupDropdownController();
        const onSelect = jest.fn();
        const renderStep = jest.fn();
        const setPreferredFocusId = jest.fn();

        controller.open({
            anchorId: anchor.id,
            options: [
                { label: 'Replace', value: 'replace' },
                { label: 'Merge', value: 'merge' },
            ],
            currentValue: 'replace',
            onSelect,
        }, {
            container,
            nav: nav as never,
            setPreferredFocusId,
            renderStep,
        });
        controller.deferRender();

        const selectedOption = nav.focusables.get('setup-dropdown-option-1') as FocusableElement | undefined;
        selectedOption?.onSelect?.();

        expect(onSelect).toHaveBeenCalledWith('merge');
        expect(container.querySelector('#setup-dropdown')).toBeNull();
        expect(setPreferredFocusId).toHaveBeenCalledWith(anchor.id);
        expect(renderStep).toHaveBeenCalledTimes(1);
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('setup-dropdown-option-0');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('setup-dropdown-option-1');
    });

    it('dismisses to the anchor focus target and clears pending deferred renders', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        anchor.id = 'setup-build-mode';
        container.appendChild(anchor);
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const controller = new ChannelSetupDropdownController();
        const renderStep = jest.fn();

        controller.open({
            anchorId: anchor.id,
            options: [{ label: 'Replace', value: 'replace' }],
            currentValue: 'replace',
            onSelect: jest.fn(),
        }, {
            container,
            nav: nav as never,
            setPreferredFocusId: jest.fn(),
            renderStep,
        });
        controller.deferRender();
        controller.dismiss(renderStep);

        expect(container.querySelector('#setup-dropdown')).toBeNull();
        expect(nav.setFocus).toHaveBeenLastCalledWith(anchor.id);
        expect(renderStep).toHaveBeenCalledTimes(1);
        controller.flushDeferredRender(renderStep);
        expect(renderStep).toHaveBeenCalledTimes(1);
    });

    it('keeps a pointer-open strategy chooser focused after anchor activation', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        anchor.id = 'setup-build-mode';
        container.appendChild(anchor);
        document.body.appendChild(container);

        const nav = new NavigationManager();
        nav.initialize({
            enablePointerMode: true,
            keyRepeatDelayMs: 500,
            keyRepeatIntervalMs: 100,
            focusMemoryEnabled: true,
            debugMode: false,
        });
        navigationManagers.push(nav);

        const controller = new ChannelSetupDropdownController();
        const onSelect = jest.fn();
        anchor.addEventListener('click', () => {
            controller.open({
                anchorId: anchor.id,
                options: [{ label: 'Replace', value: 'replace' }],
                currentValue: 'replace',
                onSelect,
            }, {
                container,
                nav,
                setPreferredFocusId: jest.fn(),
                renderStep: jest.fn(),
            });
        });
        nav.registerFocusable({ id: anchor.id, element: anchor, neighbors: {} });
        nav.setFocus(anchor.id);

        anchor.click();

        expect(container.querySelector('#setup-dropdown')).not.toBeNull();
        expect(nav.getState().focusedElementId).toBe('setup-dropdown-option-0');
        expect(nav.isModalOpen('setup-dropdown-modal')).toBe(true);
        expect(onSelect).not.toHaveBeenCalled();

        controller.close();
        expect(nav.getState().focusedElementId).toBe(anchor.id);
    });
});
