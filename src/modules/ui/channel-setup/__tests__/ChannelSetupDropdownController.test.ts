/**
 * @jest-environment jsdom
 */

import { ChannelSetupDropdownController } from '../ChannelSetupDropdownController';
import { createNavigationMock } from './channel-setup-test-helpers';

describe('ChannelSetupDropdownController', () => {
    afterEach(() => {
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

        (container.querySelector('#setup-dropdown-option-1') as HTMLButtonElement).click();

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
});
