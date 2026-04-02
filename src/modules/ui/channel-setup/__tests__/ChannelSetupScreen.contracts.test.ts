/**
 * @jest-environment jsdom
 */

import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { INavigationManager } from '../../../navigation/interfaces';
import { flushPromises, flushPromisesAndTimers } from '../../../../__tests__/helpers';
import { MIXED_SCOPE_STRATEGY_KEYS } from '../../../../core/channel-setup/constants';
import {
    ADVANCED_STRATEGY_KEYS,
    CONTENT_STRATEGY_KEYS,
    STEP2_CONTROL_IDS,
    STRATEGY_CATEGORIES,
} from '../steps/constants';
import { SETUP_STRATEGY_KEYS } from '../../../../core/channel-setup/constants';
import {
    clickButton,
    createNavigationMock,
    createOrchestrator,
    createScreenDeps,
    makeLibrary,
} from './channel-setup-test-helpers';

describe('ChannelSetupScreen contracts', () => {
    let activeScreen: ChannelSetupScreen | null = null;

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        activeScreen?.destroy();
        activeScreen = null;
        jest.useRealTimers();
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('preserves first-pass DOM IDs across all steps', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps(orchestrator));
        activeScreen = screen;
        screen.show();
        await flushPromises();

        expect(container.querySelector('#setup-select-all')).not.toBeNull();
        expect(container.querySelector('#setup-clear-all')).not.toBeNull();
        expect(container.querySelector('#setup-next')).not.toBeNull();
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-lib-movies')).not.toBeNull();

        clickButton(container, '#setup-next');
        await flushPromises();
        for (const category of STRATEGY_CATEGORIES) {
            expect(container.querySelector(`#setup-category-${category}`)).not.toBeNull();
        }
        expect(container.querySelector('#setup-preview-panel')).not.toBeNull();

        for (const key of CONTENT_STRATEGY_KEYS) {
            expect(container.querySelector(`#setup-strategy-${key}`)).not.toBeNull();
            const scopeControl = container.querySelector(`#setup-scope-${key}`);
            if (MIXED_SCOPE_STRATEGY_KEYS.has(key)) {
                expect(scopeControl).not.toBeNull();
            } else {
                expect(scopeControl).toBeNull();
            }
        }

        clickButton(container, '#setup-category-advanced-sources');
        for (const key of ADVANCED_STRATEGY_KEYS) {
            expect(container.querySelector(`#setup-strategy-${key}`)).not.toBeNull();
            const scopeControl = container.querySelector(`#setup-scope-${key}`);
            if (MIXED_SCOPE_STRATEGY_KEYS.has(key)) {
                expect(scopeControl).not.toBeNull();
            } else {
                expect(scopeControl).toBeNull();
            }
        }

        clickButton(container, '#setup-category-priority-order');
        for (const key of SETUP_STRATEGY_KEYS) {
            expect(container.querySelector(`#setup-priority-row-${key}`)).not.toBeNull();
        }

        clickButton(container, '#setup-category-build-options');
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.buildMode}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.combineMode}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.addAlternateLineups}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.alternateLineupCopies}`)).not.toBeNull();

        clickButton(container, '#setup-category-series-ordering');
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.seriesBaseMode}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.seriesBaseBlockSize}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.seriesVariantType}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.seriesVariantBlockSize}`)).not.toBeNull();

        clickButton(container, '#setup-category-limits');
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.maxChannels}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.minItems}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.expandLineup}`)).not.toBeNull();

        clickButton(container, '#setup-next');
        await flushPromisesAndTimers(2, 2);
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-confirm')).not.toBeNull();
        await flushPromisesAndTimers(2, 2);
        expect(container.querySelector('#setup-replace-confirm')).not.toBeNull();
    });

    it('preserves fast-path build screen IDs for first-time setup', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps(orchestrator));
        activeScreen = screen;
        screen.show();
        await flushPromises();
        clickButton(container, '#setup-next');
        await flushPromises();
        clickButton(container, '#setup-next');
        await flushPromises();

        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-done')).not.toBeNull();
    });

    it('unregisters previously registered focusables before each rerender', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps(orchestrator));
        activeScreen = screen;
        screen.show();
        await flushPromises();

        clickButton(container, '#setup-select-all');
        expect(nav.unregisterFocusable).toHaveBeenCalled();
    });

    it('preserves Step 2 category->detail transfer behavior', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps(orchestrator));
        activeScreen = screen;
        screen.show();
        await flushPromises();
        clickButton(container, '#setup-next');
        await flushPromises();

        nav.setMockFocus('setup-category-content-sources');
        const event = nav.emitKeyPress('right');
        expect(event.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-strategy-collections');
    });
});
