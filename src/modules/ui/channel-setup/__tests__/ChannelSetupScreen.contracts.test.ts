/**
 * @jest-environment jsdom
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { ChannelSetupCandidateRow } from '../../../../core/channel-setup/build/ChannelSetupPreparedCandidate';
import type { ChannelSetupConfig } from '../../../../core/channel-setup/types';
import type { INavigationManager } from '../../../navigation/contracts/interfaces';
import type { ChannelSetupScreenPorts } from '../ChannelSetupScreenPorts';
import { flushPromises, flushPromisesAndTimers } from '../../../../__tests__/helpers';
import {
    ADVANCED_STRATEGY_KEYS,
    CONTENT_STRATEGY_KEYS,
    MIXED_SCOPE_STRATEGY_KEYS,
    STEP2_CONTROL_IDS,
    SETUP_STRATEGY_KEYS,
} from '../strategyConstants';
import {
    clickButton,
    createNavigationMock,
    createSplitScreenPorts,
    createScreenDeps,
    DEFAULT_BUILD_RESULT,
    DEFAULT_REVIEW,
    makeLibrary,
} from './channel-setup-test-helpers';

const reviewedRow = (action: ChannelSetupCandidateRow['action']): ChannelSetupCandidateRow => ({
    action,
    channelId: action === 'removed' ? 'old-films' : 'new-films',
    number: 7,
    name: action === 'removed' ? 'Old Films' : 'New Films',
    sourceLibraryId: 'movies',
    sourceLibraryIds: ['movies'],
    sourceKind: 'library',
    playbackMode: 'shuffle',
    shuffleSeed: 17,
    startTimeAnchor: 1000,
    scheduleAnchorMode: 'daily',
    blockSize: null,
    includeSpecials: true,
    buildStrategy: null,
    reason: action === 'removed' ? 'Complete library replaced' : 'Generated from Movies',
});

const enterConfigure = async (container: HTMLElement): Promise<void> => {
    clickButton(container, '#setup-scan');
    await flushPromisesAndTimers(4, 2);
    const next = container.querySelector('#setup-next');
    if (!(next instanceof HTMLButtonElement) || next.disabled) {
        throw new Error('Expected scanned libraries to enable Configure');
    }
    next.click();
    await flushPromisesAndTimers(4, 2);
};

const enterReview = async (container: HTMLElement): Promise<void> => {
    clickButton(container, '#setup-next');
    await flushPromisesAndTimers(4, 2);
};

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

    it('keeps selected-server persistence behind app-shell ports', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const getSelectedServerId = jest.fn<ReturnType<ChannelSetupScreenPorts['getSelectedServerId']>, []>(
            () => 'server-1'
        );
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
            getSelectedServerId,
        });

        const publicScreenPorts: ChannelSetupScreenPorts = screenPorts;
        expect('getSelectedServerStorageKey' in publicScreenPorts).toBe(false);
        expect('getServerHealthStorageKey' in publicScreenPorts).toBe(false);

        const screen = new ChannelSetupScreen(container, createScreenDeps({
            workflowPort,
            screenPorts: publicScreenPorts,
        }));
        activeScreen = screen;
        screen.show();
        await flushPromises();

        expect(getSelectedServerId).toHaveBeenCalled();
    });

    it('keeps channel setup UI runtime errors as strings at the screen boundary', () => {
        const contracts = readFileSync(
            path.resolve(process.cwd(), 'src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts'),
            'utf8'
        );
        const screen = readFileSync(
            path.resolve(process.cwd(), 'src/modules/ui/channel-setup/ChannelSetupScreen.ts'),
            'utf8'
        );

        expect(contracts).toContain('loadError: string | null');
        expect(contracts).toContain('previewError: string | null');
        expect(contracts).toContain('reviewError: string | null');
        expect(contracts).toContain("{ kind: 'blocked'; message: string; reason?: ChannelSetupApplyFailure }");
        expect(contracts).toContain("{ kind: 'error'; message: string }");
        expect(contracts).toContain('bookkeepingError?: string');
        expect(screen).not.toContain('AppErrorCode');
        expect(screen).not.toContain('getAppErrorCode');
    });

    it('keeps source, programming, consent, and action controls reachable through staged setup', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const removal = reviewedRow('removed');
        const reviewed = { ...DEFAULT_REVIEW, rows: [removal],
            diff: { ...DEFAULT_REVIEW.diff, summary: { created: 0, removed: 1, unchanged: 0 } } };
        const getSetupReview = jest.fn().mockResolvedValue(reviewed);
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
            getSelectedServerId: jest.fn(() => 'server-1'),
            getSetupReview,
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({
            workflowPort,
            screenPorts,
        }));
        activeScreen = screen;
        screen.show();
        await flushPromises();

        expect(container.querySelector('#setup-select-all')).not.toBeNull();
        expect(container.querySelector('#setup-clear-all')).not.toBeNull();
        expect((container.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(false);
        clickButton(container, '#setup-clear-all');
        expect((container.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(true);
        clickButton(container, '#setup-select-all');
        expect((container.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(false);
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-lib-movies')).not.toBeNull();
        await enterConfigure(container);

        expect(container.querySelector('.setup-configure-footer-summary')).not.toBeNull();
        expect(container.querySelector('.setup-configure-footer-actions #setup-next')).not.toBeNull();
        expect(container.querySelector('#setup-preview-panel')).toBeNull();
        expect(container.querySelector('.setup-preview-strip')).toBeNull();

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
        for (const mode of ['shuffle', 'sequential', 'block', 'random']) {
            expect(container.querySelector(`#setup-playback-${mode}`)).not.toBeNull();
        }
        expect(container.querySelector('#setup-lineup-seed')).not.toBeNull();
        expect(container.querySelector('#setup-start-anchor')).not.toBeNull();
        expect(container.querySelector('#setup-include-specials')).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.seriesBaseBlockSize}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.seriesVariantType}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.seriesVariantBlockSize}`)).not.toBeNull();

        clickButton(container, '#setup-category-limits');
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.maxChannels}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.minItems}`)).not.toBeNull();
        expect(container.querySelector(`#${STEP2_CONTROL_IDS.expandLineup}`)).not.toBeNull();

        await enterReview(container);
        expect(getSetupReview).toHaveBeenCalledTimes(1);
        expect(container.querySelector('#setup-review-search')).not.toBeNull();
        expect(container.querySelector('#setup-review-row-old-films-removed')).not.toBeNull();
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect((container.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
        expect(container.querySelector('#setup-replace-confirm')).not.toBeNull();
        clickButton(container, '#setup-replace-confirm');
        expect((container.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(false);
    });

    it('requires first-time Review and Apply before exposing saved-result Guide and Studio actions', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const nav = createNavigationMock();
        const created = reviewedRow('created');
        const reviewed = { ...DEFAULT_REVIEW, rows: [created],
            diff: { ...DEFAULT_REVIEW.diff, summary: { created: 1, removed: 0, unchanged: 0 } } };
        const applySetupReview = jest.fn().mockResolvedValue({ kind: 'committed', summary: DEFAULT_BUILD_RESULT });
        const markSetupComplete = jest.fn((_serverId: string, setupConfig: ChannelSetupConfig, _scopeKey: string) => ({ ok: true as const,
            record: { ...setupConfig, createdAt: 0, updatedAt: 0 } }));
        const openCustomChannelStudio = jest.fn();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSelectedServerId: jest.fn(() => 'server-1'),
            getSetupReview: jest.fn().mockResolvedValue(reviewed),
            applySetupReview,
            markSetupComplete,
            openCustomChannelStudio,
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        activeScreen = screen;
        screen.show();
        await flushPromises();
        await enterConfigure(container);
        clickButton(container, '#setup-category-series-ordering');
        clickButton(container, '#setup-playback-random');
        await enterReview(container);
        expect(container.textContent).toContain('Review your lineup');
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-confirm')).not.toBeNull();
        expect(container.querySelector('#setup-done')).toBeNull();
        expect(applySetupReview).not.toHaveBeenCalled();
        expect(markSetupComplete).not.toHaveBeenCalled();

        clickButton(container, '#setup-confirm');
        await flushPromisesAndTimers(4, 2);
        expect(applySetupReview).toHaveBeenCalledWith('prepared-review-1', expect.any(Object),
            expect.any(Object), expect.any(Object));
        const appliedConfig = applySetupReview.mock.calls[0]?.[1] as ChannelSetupConfig;
        expect(appliedConfig.seriesOrdering?.basePlaybackMode).toBe('random');
        expect(markSetupComplete).toHaveBeenCalledTimes(1);
        expect(markSetupComplete).toHaveBeenCalledWith('server-1', appliedConfig, DEFAULT_REVIEW.inventory.scopeKey);
        expect(container.textContent).toContain('Channels saved');
        expect(container.querySelector('#setup-done')).not.toBeNull();
        expect(container.querySelector('#setup-add-custom')).not.toBeNull();
        clickButton(container, '#setup-add-custom');
        expect(openCustomChannelStudio).toHaveBeenCalledTimes(1);
        expect(nav.replaceScreen).not.toHaveBeenCalled();
        clickButton(container, '#setup-done');
        expect(nav.replaceScreen).toHaveBeenCalledTimes(1);
        expect(nav.replaceScreen).toHaveBeenCalledWith('guide');
    });

    it('keeps a typed blocked Apply message user-readable and does not save completion', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const applySetupReview = jest.fn().mockResolvedValue({ kind: 'blocked', reason: 'stale',
            message: 'Review expired. Refresh Review.' });
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            applySetupReview,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        activeScreen = screen;
        screen.show();
        await flushPromises();
        await enterConfigure(container);
        await enterReview(container);
        clickButton(container, '#setup-confirm');
        await flushPromisesAndTimers(4, 2);

        expect(container.textContent).toContain('Review expired. Refresh Review. Nothing was saved.');
        expect(container.textContent).not.toContain('[object Object]');
        expect(workflowPort.markSetupComplete).not.toHaveBeenCalled();
        expect(container.querySelector('#setup-done')).not.toBeNull();
        expect((container.querySelector('#setup-done') as HTMLButtonElement).disabled).toBe(true);
        clickButton(container, '#setup-back');
        expect(container.textContent).toContain('Review is out of date');
        expect((container.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
    });

    it('unregisters previously registered focusables before each rerender', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        activeScreen = screen;
        screen.show();
        await flushPromises();

        clickButton(container, '#setup-select-all');
        expect(nav.unregisterFocusable).toHaveBeenCalled();
    });

    it('keeps the approved Configure footer and Review row-to-Apply remote focus route', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const nav = createNavigationMock();
        const created = reviewedRow('created');
        const reviewed = { ...DEFAULT_REVIEW, rows: [created],
            diff: { ...DEFAULT_REVIEW.diff, summary: { created: 1, removed: 0, unchanged: 0 } } };
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupReview: jest.fn().mockResolvedValue(reviewed),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        activeScreen = screen;
        screen.show();
        await flushPromises();
        await enterConfigure(container);
        expect(nav.focusables.has('setup-next')).toBe(true);
        expect(nav.focusables.has('setup-strategy-collections')).toBe(true);
        expect(container.querySelector('.setup-configure-footer-actions #setup-next')).not.toBeNull();
        await enterReview(container);
        expect(nav.focusables.has('setup-review-search')).toBe(true);
        expect(nav.focusables.has('setup-review-row-new-films-created')).toBe(true);
        nav.setMockFocus('setup-review-row-new-films-created');
        const event = nav.emitKeyPress('right');
        expect(event.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-confirm');
        expect(nav.focusables.has('setup-confirm')).toBe(true);
    });
});
