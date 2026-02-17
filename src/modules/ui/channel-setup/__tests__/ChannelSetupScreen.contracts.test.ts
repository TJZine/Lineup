/**
 * @jest-environment jsdom
 */

import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { INavigationManager } from '../../../navigation/interfaces';
import { flushPromises } from '../../../../__tests__/helpers';
import { MIXED_SCOPE_STRATEGY_KEYS } from '../../../../core/channel-setup/constants';
import {
    ADVANCED_STRATEGY_KEYS,
    CONTENT_STRATEGY_KEYS,
    STEP2_CONTROL_IDS,
    STRATEGY_CATEGORIES,
} from '../steps/constants';
import {
    clickButton,
    createNavigationMock,
    createOrchestrator,
    makeLibrary,
} from './channel-setup-test-helpers';

describe('ChannelSetupScreen contracts', () => {
    afterEach(() => {
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

        const screen = new ChannelSetupScreen(container, orchestrator);
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
            expect(container.querySelector(`#setup-priority-${key}`)).not.toBeNull();
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
            expect(container.querySelector(`#setup-priority-${key}`)).not.toBeNull();
            const scopeControl = container.querySelector(`#setup-scope-${key}`);
            if (MIXED_SCOPE_STRATEGY_KEYS.has(key)) {
                expect(scopeControl).not.toBeNull();
            } else {
                expect(scopeControl).toBeNull();
            }
        }

        clickButton(container, '#setup-category-build-options');
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.buildMode}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.combineMode}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.addAlternateLineups}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.alternateLineupCopies}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.addSequentialVariants}`)).not.toBeNull();

        clickButton(container, '#setup-category-limits');
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.maxChannels}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.minItems}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.expandLineup}`)).not.toBeNull();

        clickButton(container, '#setup-next');
        // Multiple microtask ticks: click handler schedules state changes; render->loadReview uses a deferred microtask;
        // and the final update reveals '#setup-back', '#setup-confirm', and '#setup-replace-confirm'.
        await flushPromises();
        await flushPromises();
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-confirm')).not.toBeNull();
        await flushPromises();
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

        const screen = new ChannelSetupScreen(container, orchestrator);
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

        const screen = new ChannelSetupScreen(container, orchestrator);
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

        const screen = new ChannelSetupScreen(container, orchestrator);
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
