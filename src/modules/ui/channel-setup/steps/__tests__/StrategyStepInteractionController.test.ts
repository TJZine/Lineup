/**
 * @jest-environment jsdom
 */

import { createDefaultStrategyOrder, createDefaultStrategyState } from '../../ChannelSetupSessionState';
import type {
    ChannelSetupSessionSnapshot,
    StrategyStepMutableState,
} from '../../ChannelSetupSessionContracts';
import { StrategyStepInteractionController } from '../StrategyStepInteractionController';
import { STRATEGY_CONTROL_DESCRIPTORS } from '../StrategyStepControlDescriptors';
import { STEP2_CONTROL_IDS } from '../../strategyConstants';

const createSnapshot = (
    overrides: Partial<ChannelSetupSessionSnapshot> = {}
): ChannelSetupSessionSnapshot => ({
    step: 2,
    libraries: [],
    selectedLibraryIds: new Set(),
    loadError: null,
    strategies: createDefaultStrategyState(),
    strategyOrder: createDefaultStrategyOrder(),
    channelExpansion: {
        addAlternateLineups: false,
        alternateLineupCopies: 1,
        variantType: 'none',
        variantBlockSize: 3,
    },
    seriesOrdering: {
        basePlaybackMode: 'shuffle',
        baseBlockSize: 3,
    },
    buildMode: 'replace',
    actorStudioCombineMode: 'separate',
    maxChannels: 200,
    minItems: 1,
    isLoading: false,
    isBuilding: false,
    isPreviewLoading: false,
    isReviewLoading: false,
    replaceConfirm: false,
    preview: null,
    previewError: null,
    previewStatus: 'idle',
    review: null,
    reviewError: null,
    previewDeltas: {},
    previewDeltaExpiresAtMs: 0,
    recordApplied: true,
    setupContext: 'unknown',
    ...overrides,
});

type InteractionAdapters = Parameters<StrategyStepInteractionController['handleKeyPress']>[2];
type DropdownConfig = Parameters<InteractionAdapters['openDropdown']>[0];

const createAdapters = (
    snapshot: ChannelSetupSessionSnapshot,
    overrides: Partial<InteractionAdapters> = {}
): InteractionAdapters => ({
    channelLimitOptions: [50, 100, 200],
    minItemsOptions: [1, 5, 10],
    deferDropdownRender: jest.fn(),
    dismissDropdown: jest.fn(),
    getPreferredFocusId: jest.fn(() => null),
    getSessionSnapshot: jest.fn(() => snapshot),
    hasActiveDropdown: jest.fn(() => false),
    openDropdown: jest.fn(),
    registerStep2: jest.fn(() => false),
    renderStep: jest.fn(),
    resetStep2Scroll: jest.fn(),
    setPreferredFocusId: jest.fn(),
    setPriorityRowGrabbedVisual: jest.fn(),
    updateStrategyState: jest.fn((mutate: (draft: StrategyStepMutableState) => void) => {
        const draft: StrategyStepMutableState = {
            strategies: JSON.parse(JSON.stringify(snapshot.strategies)) as StrategyStepMutableState['strategies'],
            strategyOrder: [...snapshot.strategyOrder],
            channelExpansion: {
                addAlternateLineups: snapshot.channelExpansion.addAlternateLineups,
                alternateLineupCopies: snapshot.channelExpansion.alternateLineupCopies,
                variantType: snapshot.channelExpansion.variantType,
                variantBlockSize: snapshot.channelExpansion.variantBlockSize,
            },
            seriesOrdering: {
                basePlaybackMode: snapshot.seriesOrdering.basePlaybackMode,
                baseBlockSize: snapshot.seriesOrdering.baseBlockSize,
            },
            buildMode: snapshot.buildMode,
            actorStudioCombineMode: snapshot.actorStudioCombineMode,
            maxChannels: snapshot.maxChannels,
            minItems: snapshot.minItems,
        };
        mutate(draft);
    }),
    ...overrides,
});

const createNav = (focusedId: string): { getFocusedElement: jest.Mock; setFocus: jest.Mock } => ({
    getFocusedElement: jest.fn((): { id: string } => ({ id: focusedId })),
    setFocus: jest.fn(),
});

const createEvent = (
    button: 'left' | 'right' | 'ok' | 'up' | 'down' | 'back',
    options: { isRepeat?: boolean; isLongPress?: boolean } = {}
): {
    button: 'left' | 'right' | 'ok' | 'up' | 'down' | 'back';
    handled: boolean;
    isRepeat: boolean;
    isLongPress: boolean;
    timestamp: number;
    originalEvent: KeyboardEvent;
} => ({
    button,
    handled: false,
    isRepeat: options.isRepeat ?? false,
    isLongPress: options.isLongPress ?? false,
    timestamp: Date.now(),
    originalEvent: {
        preventDefault: jest.fn(),
    } as unknown as KeyboardEvent,
});

const createController = (): StrategyStepInteractionController =>
    new StrategyStepInteractionController({
        strategySupportsMixedScope: (strategy): boolean =>
            strategy === 'genres' || strategy === 'directors' || strategy === 'studios' || strategy === 'actors',
        toDomId: (raw): string => raw,
    });

describe('StrategyStepInteractionController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('applySettingChange remembers focus, updates state, and rerenders when no dropdown is active', () => {
        const controller = new StrategyStepInteractionController({
            strategySupportsMixedScope: (strategy): boolean =>
                strategy === 'genres' || strategy === 'directors' || strategy === 'studios' || strategy === 'actors',
            toDomId: (raw): string => raw,
        });
        const snapshot = createSnapshot();
        const adapters = createAdapters(snapshot);

        controller.applySettingChange('setup-strategy-playlists', (draft) => {
            draft.strategies.playlists.enabled = false;
        }, adapters);

        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith('setup-strategy-playlists');
        expect(adapters.updateStrategyState).toHaveBeenCalledTimes(1);
        expect(adapters.renderStep).toHaveBeenCalledTimes(1);
    });

    const descriptorCategory = (controlId: string): 'build-options' | 'series-ordering' | 'limits' => {
        if (
            controlId === STEP2_CONTROL_IDS.buildMode
            || controlId === STEP2_CONTROL_IDS.combineMode
            || controlId === STEP2_CONTROL_IDS.addAlternateLineups
            || controlId === STEP2_CONTROL_IDS.alternateLineupCopies
        ) {
            return 'build-options';
        }
        if (
            controlId === STEP2_CONTROL_IDS.seriesBaseMode
            || controlId === STEP2_CONTROL_IDS.seriesBaseBlockSize
            || controlId === STEP2_CONTROL_IDS.seriesVariantType
            || controlId === STEP2_CONTROL_IDS.seriesVariantBlockSize
        ) {
            return 'series-ordering';
        }
        return 'limits';
    };

    const snapshotForDescriptor = (controlId: string): ChannelSetupSessionSnapshot => {
        const snapshot = createSnapshot();
        if (controlId === STEP2_CONTROL_IDS.alternateLineupCopies) {
            snapshot.channelExpansion.addAlternateLineups = true;
        }
        if (controlId === STEP2_CONTROL_IDS.seriesBaseBlockSize) {
            snapshot.seriesOrdering.basePlaybackMode = 'block';
        }
        if (controlId === STEP2_CONTROL_IDS.seriesVariantBlockSize) {
            snapshot.channelExpansion.variantType = 'block';
        }
        return snapshot;
    };

    for (const descriptor of STRATEGY_CONTROL_DESCRIPTORS) {
        it(`keeps ${descriptor.controlId} dropdown-only for D-pad right and left`, () => {
            const controller = createController();
            const category = descriptorCategory(descriptor.controlId);
            controller.applyCategoryChange(category, `setup-category-${category}`, {
                renderStep: jest.fn(),
                resetStep2Scroll: jest.fn(),
                setPreferredFocusId: jest.fn(),
                setPriorityRowGrabbedVisual: jest.fn(),
            });
            const snapshot = snapshotForDescriptor(descriptor.controlId);

            const rightAdapters = createAdapters(snapshot);
            const right = createEvent('right');
            controller.handleKeyPress(right, createNav(descriptor.controlId) as never, rightAdapters);
            expect(right.handled).toBe(true);
            expect(right.originalEvent.preventDefault).toHaveBeenCalledTimes(1);
            expect(rightAdapters.openDropdown).not.toHaveBeenCalled();
            expect(rightAdapters.updateStrategyState).not.toHaveBeenCalled();

            const okAdapters = createAdapters(snapshot);
            const ok = createEvent('ok');
            controller.handleKeyPress(ok, createNav(descriptor.controlId) as never, okAdapters);
            expect(ok.handled).toBe(true);
            expect(ok.originalEvent.preventDefault).toHaveBeenCalledTimes(1);
            expect(okAdapters.openDropdown).toHaveBeenCalledTimes(1);
            expect(okAdapters.updateStrategyState).not.toHaveBeenCalled();

            const leftAdapters = createAdapters(snapshot);
            const leftNav = createNav(descriptor.controlId);
            const left = createEvent('left');
            controller.handleKeyPress(left, leftNav as never, leftAdapters);
            expect(left.handled).toBe(true);
            expect(left.originalEvent.preventDefault).toHaveBeenCalledTimes(1);
            expect(leftAdapters.openDropdown).not.toHaveBeenCalled();
            expect(leftAdapters.updateStrategyState).not.toHaveBeenCalled();
            expect(leftAdapters.setPreferredFocusId).toHaveBeenCalledWith(`setup-category-${category}`);
            expect(leftNav.setFocus).toHaveBeenCalledWith(`setup-category-${category}`);
        });
    }

    it.each([
        ['repeat', { isRepeat: true }],
        ['long press', { isLongPress: true }],
    ] as const)('keeps descriptor D-pad handling stable for %s input', (_label, options) => {
        for (const descriptor of STRATEGY_CONTROL_DESCRIPTORS) {
            const controller = createController();
            const category = descriptorCategory(descriptor.controlId);
            controller.applyCategoryChange(category, `setup-category-${category}`, {
                renderStep: jest.fn(),
                resetStep2Scroll: jest.fn(),
                setPreferredFocusId: jest.fn(),
                setPriorityRowGrabbedVisual: jest.fn(),
            });
            const adapters = createAdapters(snapshotForDescriptor(descriptor.controlId));
            const right = createEvent('right', options);
            controller.handleKeyPress(right, createNav(descriptor.controlId) as never, adapters);
            expect(right.handled).toBe(true);
            expect(adapters.updateStrategyState).not.toHaveBeenCalled();
            expect(adapters.openDropdown).not.toHaveBeenCalled();

            const leftAdapters = createAdapters(snapshotForDescriptor(descriptor.controlId));
            const leftNav = createNav(descriptor.controlId);
            const left = createEvent('left', options);
            controller.handleKeyPress(left, leftNav as never, leftAdapters);
            expect(left.handled).toBe(true);
            expect(leftAdapters.updateStrategyState).not.toHaveBeenCalled();
            expect(leftAdapters.openDropdown).not.toHaveBeenCalled();
            expect(leftAdapters.setPreferredFocusId).toHaveBeenCalledWith(`setup-category-${category}`);
            expect(leftNav.setFocus).toHaveBeenCalledWith(`setup-category-${category}`);
        }
    });

    it('grabs and reorders priority rows directly from the controller state machine', () => {
        const controller = new StrategyStepInteractionController({
            strategySupportsMixedScope: (): boolean => false,
            toDomId: (raw): string => raw,
        });
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const snapshot = createSnapshot();
        let reorderedDraft: StrategyStepMutableState | null = null;
        const adapters = createAdapters(snapshot, {
            setPriorityRowGrabbedVisual: jest.fn(),
            updateStrategyState: jest.fn((mutate: (draft: StrategyStepMutableState) => void) => {
                const draft: StrategyStepMutableState = {
                    strategies: JSON.parse(JSON.stringify(snapshot.strategies)) as StrategyStepMutableState['strategies'],
                    strategyOrder: [...snapshot.strategyOrder],
                    channelExpansion: { ...snapshot.channelExpansion },
                    seriesOrdering: { ...snapshot.seriesOrdering },
                    buildMode: snapshot.buildMode,
                    actorStudioCombineMode: snapshot.actorStudioCombineMode,
                    maxChannels: snapshot.maxChannels,
                    minItems: snapshot.minItems,
                };
                mutate(draft);
                reorderedDraft = draft;
            }),
        });
        const nav = createNav('setup-priority-row-playlists');

        const grabEvent = createEvent('ok');
        controller.handleKeyPress(grabEvent, nav as never, adapters);
        expect(grabEvent.handled).toBe(true);
        expect(adapters.setPriorityRowGrabbedVisual).toHaveBeenCalledWith('playlists', true);

        const reorderEvent = createEvent('down');
        controller.handleKeyPress(reorderEvent, nav as never, adapters);
        expect(reorderEvent.handled).toBe(true);
        expect(adapters.updateStrategyState).toHaveBeenCalledTimes(1);
        expect(reorderedDraft).not.toBeNull();
        expect((reorderedDraft as unknown as StrategyStepMutableState).strategyOrder).toEqual([
            'collections',
            'playlists',
            'recentlyAdded',
            'genres',
            'studios',
            'actors',
            'decades',
            'directors',
        ]);
        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith('setup-priority-row-playlists');
        expect(controller.getGrabbedPriorityKey()).toBe('playlists');
    });

    it('registerStep2Focusables uses the remembered detail target for the active category', () => {
        const controller = createController();
        const snapshot = createSnapshot();
        const adapters = createAdapters(snapshot, {
            getPreferredFocusId: jest.fn(() => 'setup-strategy-playlists'),
        });
        const categoryButtons = [
            { id: controller.categoryButtonId('content-sources') } as HTMLButtonElement,
        ];
        const detailButtons = [
            { id: 'setup-strategy-collections', disabled: false } as HTMLButtonElement,
            { id: 'setup-strategy-playlists', disabled: false } as HTMLButtonElement,
        ];
        const backButton = { id: 'setup-back' } as HTMLButtonElement;
        const nextButton = { id: 'setup-next' } as HTMLButtonElement;

        controller.applySettingChange('setup-strategy-playlists', (draft) => {
            draft.strategies.playlists.enabled = false;
        }, adapters);
        jest.clearAllMocks();

        controller.registerStep2Focusables(categoryButtons, detailButtons, backButton, nextButton, adapters);

        expect(adapters.registerStep2).toHaveBeenCalledWith({
            categoryButtons,
            detailButtons,
            footerButtons: [backButton, nextButton],
            activeCategoryId: controller.categoryButtonId('content-sources'),
            detailFocusTarget: 'setup-strategy-playlists',
            preferredFocusId: 'setup-strategy-playlists',
            onDetailFocus: expect.any(Function),
        });
    });

    it('exposes stable ids, clears transient state, and resets controller-owned focus state', () => {
        const controller = createController();

        expect(controller.categoryButtonId('limits')).toBe('setup-category-limits');
        expect(controller.strategyButtonId('recentlyAdded')).toBe('setup-strategy-recentlyAdded');
        expect(controller.priorityRowId('genres')).toBe('setup-priority-row-genres');
        expect(controller.scopeButtonId('actors')).toBe('setup-scope-actors');

        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const adapters = createAdapters(createSnapshot(), {
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const nav = createNav('setup-priority-row-playlists');

        controller.handleKeyPress(createEvent('ok'), nav as never, adapters);
        controller.handleKeyPress(createEvent('down'), nav as never, adapters);
        expect(controller.getActiveStrategyCategory()).toBe('priority-order');
        expect(controller.getGrabbedPriorityKey()).toBe('playlists');

        controller.clearTransientState(adapters.setPriorityRowGrabbedVisual);
        expect(controller.getGrabbedPriorityKey()).toBeNull();
        expect(controller.getLastReorder()).toBeNull();
        expect(adapters.setPriorityRowGrabbedVisual).toHaveBeenCalledWith('playlists', false);

        controller.reset();
        expect(controller.getActiveStrategyCategory()).toBe('content-sources');
        expect(controller.getLastReorder()).toBeNull();
        expect(controller.getGrabbedPriorityKey()).toBeNull();
    });

    it('applyCategoryChange clears grabbed priority rows when leaving the reorder category', () => {
        const controller = createController();
        const categoryAdapters = {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        };
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', categoryAdapters);

        const grabAdapters = createAdapters(createSnapshot(), {
            setPriorityRowGrabbedVisual: categoryAdapters.setPriorityRowGrabbedVisual,
        });
        controller.handleKeyPress(createEvent('ok'), createNav('setup-priority-row-playlists') as never, grabAdapters);
        jest.clearAllMocks();

        controller.applyCategoryChange('limits', 'setup-category-limits', categoryAdapters);

        expect(controller.getActiveStrategyCategory()).toBe('limits');
        expect(categoryAdapters.setPreferredFocusId).toHaveBeenCalledWith('setup-category-limits');
        expect(categoryAdapters.resetStep2Scroll).toHaveBeenCalledTimes(1);
        expect(categoryAdapters.renderStep).toHaveBeenCalledTimes(1);
        expect(categoryAdapters.setPriorityRowGrabbedVisual).toHaveBeenCalledWith('playlists', false);
    });

    it('applySettingChange defers rerender when a dropdown is already open', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const snapshot = createSnapshot();
        const adapters = createAdapters(snapshot, {
            hasActiveDropdown: jest.fn(() => true),
        });

        controller.applySettingChange('setup-strategy-playlists', (draft) => {
            draft.strategies.playlists.enabled = true;
        }, adapters);

        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith('setup-strategy-playlists');
        expect(adapters.deferDropdownRender).toHaveBeenCalledTimes(1);
        expect(adapters.renderStep).not.toHaveBeenCalled();
    });

    it.each([
        [STEP2_CONTROL_IDS.buildMode, createSnapshot(), 'merge', 'replace'],
        [STEP2_CONTROL_IDS.combineMode, createSnapshot(), 'combined', 'separate'],
        [STEP2_CONTROL_IDS.alternateLineupCopies, createSnapshot({
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 2,
                variantType: 'none',
                variantBlockSize: 3,
            },
        }), '3', '2'],
        [STEP2_CONTROL_IDS.seriesBaseMode, createSnapshot(), 'block', 'shuffle'],
        [STEP2_CONTROL_IDS.seriesBaseBlockSize, createSnapshot({
            seriesOrdering: {
                basePlaybackMode: 'block',
                baseBlockSize: 3,
            },
        }), '4', '3'],
        [STEP2_CONTROL_IDS.seriesVariantType, createSnapshot(), 'block', 'none'],
        [STEP2_CONTROL_IDS.seriesVariantBlockSize, createSnapshot({
            channelExpansion: {
                addAlternateLineups: false,
                alternateLineupCopies: 1,
                variantType: 'block',
                variantBlockSize: 3,
            },
        }), '4', '3'],
        [STEP2_CONTROL_IDS.maxChannels, createSnapshot(), '100', '200'],
        [STEP2_CONTROL_IDS.minItems, createSnapshot(), '5', '1'],
    ] as const)(
        'openAdjustableControl builds a dropdown contract for %s',
        (controlId, snapshot, selectedValue, currentValue) => {
            const controller = createController();
            const openDropdown = jest.fn();
            const adapters = createAdapters(snapshot, { openDropdown });

            controller.openAdjustableControl(controlId, adapters);

            const config = openDropdown.mock.calls[0]?.[0] as DropdownConfig | undefined;
            expect(config?.anchorId).toBe(controlId);
            expect(config?.currentValue).toBe(currentValue);

            config?.onSelect(selectedValue);
            expect(adapters.updateStrategyState).toHaveBeenCalledTimes(1);
            expect(adapters.renderStep).toHaveBeenCalledTimes(1);
        }
    );

    it('openAdjustableControl skips disabled and unknown dropdown targets', () => {
        const controller = createController();
        const openDropdown = jest.fn();

        controller.openAdjustableControl(STEP2_CONTROL_IDS.alternateLineupCopies, createAdapters(createSnapshot(), {
            openDropdown,
        }));
        controller.openAdjustableControl(STEP2_CONTROL_IDS.seriesBaseBlockSize, createAdapters(createSnapshot(), {
            openDropdown,
        }));
        controller.openAdjustableControl(STEP2_CONTROL_IDS.seriesVariantBlockSize, createAdapters(createSnapshot(), {
            openDropdown,
        }));
        controller.openAdjustableControl('setup-unknown-control', createAdapters(createSnapshot(), {
            openDropdown,
        }));

        expect(openDropdown).not.toHaveBeenCalled();
    });

    it('handleKeyPress short-circuits for pre-handled events, dropdown back, and empty focus', () => {
        const controller = createController();
        const snapshot = createSnapshot();

        const handledEvent = createEvent('right');
        handledEvent.handled = true;
        const handledAdapters = createAdapters(snapshot);
        controller.handleKeyPress(handledEvent, createNav(STEP2_CONTROL_IDS.buildMode) as never, handledAdapters);
        expect(handledAdapters.updateStrategyState).not.toHaveBeenCalled();

        const backEvent = createEvent('back');
        const dropdownAdapters = createAdapters(snapshot, {
            hasActiveDropdown: jest.fn(() => true),
        });
        controller.handleKeyPress(backEvent, createNav(STEP2_CONTROL_IDS.buildMode) as never, dropdownAdapters);
        expect(dropdownAdapters.dismissDropdown).toHaveBeenCalledTimes(1);
        expect(backEvent.handled).toBe(true);

        const noFocusAdapters = createAdapters(snapshot);
        controller.handleKeyPress(
            createEvent('right'),
            { getFocusedElement: jest.fn(() => null), setFocus: jest.fn() } as never,
            noFocusAdapters
        );
        expect(noFocusAdapters.updateStrategyState).not.toHaveBeenCalled();
    });

    it('handleKeyPress manages priority grab state, repeats, and reorder boundaries', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const adapters = createAdapters(createSnapshot(), {
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const nav = createNav('setup-priority-row-playlists');

        controller.handleKeyPress(createEvent('ok'), nav as never, adapters);
        controller.handleKeyPress(createEvent('ok'), nav as never, adapters);
        expect(adapters.setPriorityRowGrabbedVisual).toHaveBeenNthCalledWith(1, 'playlists', true);
        expect(adapters.setPriorityRowGrabbedVisual).toHaveBeenNthCalledWith(2, 'playlists', false);
        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith('setup-priority-row-playlists');
        expect(adapters.renderStep).toHaveBeenCalledTimes(1);

        controller.handleKeyPress(createEvent('ok'), nav as never, adapters);
        controller.handleKeyPress(createEvent('ok'), createNav('setup-priority-row-genres') as never, adapters);
        expect(adapters.setPriorityRowGrabbedVisual).toHaveBeenCalledWith('playlists', false);
        expect(controller.getGrabbedPriorityKey()).toBeNull();

        controller.handleKeyPress(createEvent('ok'), createNav('setup-priority-row-genres') as never, adapters);
        expect(adapters.setPriorityRowGrabbedVisual).toHaveBeenCalledWith('genres', true);

        const repeatEvent = createEvent('down');
        repeatEvent.isRepeat = true;
        controller.handleKeyPress(repeatEvent, createNav('setup-priority-row-genres') as never, adapters);
        expect(repeatEvent.handled).toBe(true);
        expect(adapters.updateStrategyState).not.toHaveBeenCalled();

        const missingIndexAdapters = createAdapters(createSnapshot({
            strategyOrder: createDefaultStrategyOrder().filter((key) => key !== 'genres'),
        }));
        controller.handleKeyPress(createEvent('down'), createNav('setup-priority-row-genres') as never, missingIndexAdapters);
        expect(missingIndexAdapters.updateStrategyState).not.toHaveBeenCalled();

        controller.handleKeyPress(createEvent('ok'), createNav('setup-priority-row-collections') as never, adapters);
        controller.handleKeyPress(createEvent('ok'), createNav('setup-priority-row-collections') as never, adapters);
        const boundaryEvent = createEvent('up');
        controller.handleKeyPress(boundaryEvent, createNav('setup-priority-row-collections') as never, createAdapters(createSnapshot()));
        expect(boundaryEvent.handled).toBe(true);
    });

    it('parses Guide Order row ids through the configured DOM id encoder', () => {
        const controller = new StrategyStepInteractionController({
            strategySupportsMixedScope: (): boolean => false,
            toDomId: (raw): string => raw.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`),
        });
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const adapters = createAdapters(createSnapshot(), {
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const event = createEvent('ok');

        controller.handleKeyPress(
            event,
            createNav('setup-priority-row-recently-added') as never,
            adapters
        );

        expect(event.handled).toBe(true);
        expect(adapters.setPriorityRowGrabbedVisual).toHaveBeenCalledWith('recentlyAdded', true);
        expect(controller.getGrabbedPriorityKey()).toBe('recentlyAdded');
    });

    it('Back cancels a grabbed guide-order move and restores the pre-grab order', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        let snapshot = createSnapshot();
        const adapters = createAdapters(snapshot, {
            getSessionSnapshot: jest.fn(() => snapshot),
            updateStrategyState: jest.fn((mutate: (draft: StrategyStepMutableState) => void) => {
                const draft: StrategyStepMutableState = {
                    strategies: JSON.parse(JSON.stringify(snapshot.strategies)) as StrategyStepMutableState['strategies'],
                    strategyOrder: [...snapshot.strategyOrder],
                    channelExpansion: { ...snapshot.channelExpansion },
                    seriesOrdering: { ...snapshot.seriesOrdering },
                    buildMode: snapshot.buildMode,
                    actorStudioCombineMode: snapshot.actorStudioCombineMode,
                    maxChannels: snapshot.maxChannels,
                    minItems: snapshot.minItems,
                };
                mutate(draft);
                snapshot = { ...snapshot, strategyOrder: draft.strategyOrder };
            }),
        });

        controller.handleKeyPress(createEvent('ok'), createNav('setup-priority-row-playlists') as never, adapters);
        controller.handleKeyPress(createEvent('down'), createNav('setup-priority-row-playlists') as never, adapters);
        expect(snapshot.strategyOrder[0]).toBe('collections');

        const back = createEvent('back');
        controller.handleKeyPress(back, createNav('setup-priority-row-playlists') as never, adapters);

        expect(back.handled).toBe(true);
        expect(snapshot.strategyOrder).toEqual(createDefaultStrategyOrder());
        expect(controller.getGrabbedPriorityKey()).toBeNull();
        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith('setup-priority-row-playlists');
        expect(adapters.renderStep).toHaveBeenCalled();
    });

    it('resetGuideOrder restores active default order and keeps focus in Guide Order rows', () => {
        const controller = createController();
        const strategies = createDefaultStrategyState();
        strategies.genres.enabled = false;
        strategies.decades.enabled = false;
        const snapshot = createSnapshot({
            strategies,
            strategyOrder: [
                'genres',
                'collections',
                'playlists',
                'decades',
                'actors',
                'studios',
                'recentlyAdded',
                'directors',
            ],
        });
        let resetDraft: StrategyStepMutableState | null = null;
        const adapters = createAdapters(snapshot, {
            updateStrategyState: jest.fn((mutate: (draft: StrategyStepMutableState) => void) => {
                const draft: StrategyStepMutableState = {
                    strategies: JSON.parse(JSON.stringify(snapshot.strategies)) as StrategyStepMutableState['strategies'],
                    strategyOrder: [...snapshot.strategyOrder],
                    channelExpansion: { ...snapshot.channelExpansion },
                    seriesOrdering: { ...snapshot.seriesOrdering },
                    buildMode: snapshot.buildMode,
                    actorStudioCombineMode: snapshot.actorStudioCombineMode,
                    maxChannels: snapshot.maxChannels,
                    minItems: snapshot.minItems,
                };
                mutate(draft);
                resetDraft = draft;
            }),
        });

        controller.resetGuideOrder('setup-guide-order-reset', adapters);

        expect(resetDraft).not.toBeNull();
        const draft = resetDraft as unknown as StrategyStepMutableState;
        expect(draft.strategyOrder).toEqual([
            'genres',
            'playlists',
            'collections',
            'decades',
            'recentlyAdded',
            'studios',
            'actors',
            'directors',
        ]);
        expect(draft.strategies.genres.enabled).toBe(false);
        expect(draft.strategies.decades.enabled).toBe(false);
        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith('setup-priority-row-playlists');
    });

    it('handleKeyPress blocks focus escape while a guide-order row is grabbed', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const grabAdapters = createAdapters(createSnapshot(), {
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        controller.handleKeyPress(createEvent('ok'), createNav('setup-priority-row-playlists') as never, grabAdapters);
        jest.clearAllMocks();

        const adapters = createAdapters(createSnapshot(), {
            setPriorityRowGrabbedVisual: grabAdapters.setPriorityRowGrabbedVisual,
        });

        const left = createEvent('left');
        controller.handleKeyPress(left, createNav('setup-priority-row-playlists') as never, adapters);
        expect(left.handled).toBe(true);
        expect(adapters.setPreferredFocusId).not.toHaveBeenCalled();
        expect(adapters.setPriorityRowGrabbedVisual).not.toHaveBeenCalled();

        const right = createEvent('right');
        controller.handleKeyPress(right, createNav('setup-priority-row-playlists') as never, adapters);
        expect(right.handled).toBe(true);
        expect(adapters.resetStep2Scroll).not.toHaveBeenCalled();
        expect(controller.getGrabbedPriorityKey()).toBe('playlists');
    });

    it('handleKeyPress moves between category rail and detail focus while preserving valid targets', () => {
        const controller = createController();
        controller.applyCategoryChange('build-options', 'setup-category-build-options', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const buildSnapshot = createSnapshot();
        const buildAdapters = createAdapters(buildSnapshot);

        const enterDetailEvent = createEvent('right');
        controller.handleKeyPress(enterDetailEvent, createNav('setup-category-build-options') as never, buildAdapters);
        expect(enterDetailEvent.handled).toBe(true);
        expect(buildAdapters.setPreferredFocusId).toHaveBeenLastCalledWith(STEP2_CONTROL_IDS.buildMode);

        const leftNav = createNav(STEP2_CONTROL_IDS.buildMode);
        controller.handleKeyPress(createEvent('left'), leftNav as never, buildAdapters);
        expect(buildAdapters.setPreferredFocusId).toHaveBeenLastCalledWith('setup-category-build-options');
        expect(leftNav.setFocus).toHaveBeenCalledWith('setup-category-build-options');
    });

    it('handleKeyPress sends Guide Order category right to reset before rows when reset is enabled', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const adapters = createAdapters(createSnapshot({
            strategyOrder: [
                'collections',
                'playlists',
                'recentlyAdded',
                'genres',
                'studios',
                'actors',
                'decades',
                'directors',
            ],
        }));

        const event = createEvent('right');
        controller.handleKeyPress(event, createNav('setup-category-priority-order') as never, adapters);

        expect(event.handled).toBe(true);
        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith('setup-guide-order-reset');
        expect(adapters.renderStep).toHaveBeenCalledTimes(1);
    });

    it('handleKeyPress sends Guide Order category right to reset when a row was remembered', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const defaultAdapters = createAdapters(createSnapshot());
        controller.handleKeyPress(
            createEvent('right'),
            createNav('setup-category-priority-order') as never,
            defaultAdapters
        );
        expect(defaultAdapters.setPreferredFocusId).toHaveBeenCalledWith(`setup-priority-row-${createDefaultStrategyOrder()[0]}`);

        const resetEnabledAdapters = createAdapters(createSnapshot({
            strategyOrder: [
                'collections',
                'playlists',
                'recentlyAdded',
                'genres',
                'studios',
                'actors',
                'decades',
                'directors',
            ],
        }));
        const event = createEvent('right');

        controller.handleKeyPress(event, createNav('setup-category-priority-order') as never, resetEnabledAdapters);

        expect(event.handled).toBe(true);
        expect(resetEnabledAdapters.setPreferredFocusId).toHaveBeenCalledWith('setup-guide-order-reset');
        expect(resetEnabledAdapters.renderStep).toHaveBeenCalledTimes(1);
    });

    it('handleKeyPress skips disabled Guide Order reset and targets the first enabled row', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const adapters = createAdapters(createSnapshot());

        const event = createEvent('right');
        controller.handleKeyPress(event, createNav('setup-category-priority-order') as never, adapters);

        expect(event.handled).toBe(true);
        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith(`setup-priority-row-${createDefaultStrategyOrder()[0]}`);
        expect(adapters.renderStep).toHaveBeenCalledTimes(1);
    });

    it('handleKeyPress keeps Guide Order category focus when one active strategy leaves rows disabled', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const strategies = createDefaultStrategyState();
        for (const strategy of createDefaultStrategyOrder()) {
            strategies[strategy].enabled = strategy === 'playlists';
        }
        const adapters = createAdapters(createSnapshot({ strategies }));

        const event = createEvent('right');
        controller.handleKeyPress(event, createNav('setup-category-priority-order') as never, adapters);

        expect(event.handled).toBe(false);
        expect(event.originalEvent.preventDefault).not.toHaveBeenCalled();
        expect(adapters.setPreferredFocusId).not.toHaveBeenCalled();
        expect(adapters.renderStep).not.toHaveBeenCalled();
    });

    it('handleKeyPress routes non-adjustable detail controls back to the active category rail', () => {
        const controller = createController();
        controller.applyCategoryChange('limits', 'setup-category-limits', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const adapters = createAdapters(createSnapshot());
        const nav = createNav(STEP2_CONTROL_IDS.expandLineup);

        controller.handleKeyPress(createEvent('left'), nav as never, adapters);

        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith('setup-category-limits');
        expect(nav.setFocus).toHaveBeenCalledWith('setup-category-limits');
    });

    it('handleKeyPress tolerates invalid and sparse priority-row state without mutating order', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const invalidOk = createEvent('ok');
        const invalidAdapters = createAdapters(createSnapshot());
        controller.handleKeyPress(invalidOk, createNav('setup-priority-row-unknown') as never, invalidAdapters);
        expect(invalidOk.handled).toBe(true);
        expect(invalidAdapters.setPriorityRowGrabbedVisual).not.toHaveBeenCalled();

        const sparseOrder = [...createDefaultStrategyOrder()];
        const sparseKey = sparseOrder[0] ?? 'actors';
        sparseOrder[1] = undefined as never;
        const sparseAdapters = createAdapters(createSnapshot({
            strategyOrder: sparseOrder,
        }));
        controller.handleKeyPress(createEvent('ok'), createNav(`setup-priority-row-${sparseKey}`) as never, sparseAdapters);

        const sparseDown = createEvent('down');
        controller.handleKeyPress(sparseDown, createNav(`setup-priority-row-${sparseKey}`) as never, sparseAdapters);
        expect(sparseDown.handled).toBe(true);
        expect(sparseAdapters.updateStrategyState).toHaveBeenCalledTimes(1);
    });

    it('registerStep2Focusables falls back to the first enabled detail target and clears preferred focus when applied', () => {
        const controller = createController();
        controller.applyCategoryChange('series-ordering', 'setup-category-series-ordering', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const snapshot = createSnapshot({
            seriesOrdering: {
                basePlaybackMode: 'shuffle',
                baseBlockSize: 3,
            },
            channelExpansion: {
                addAlternateLineups: false,
                alternateLineupCopies: 1,
                variantType: 'none',
                variantBlockSize: 3,
            },
        });
        const adapters = createAdapters(snapshot, {
            getPreferredFocusId: jest.fn(() => 'setup-series-base-block-size'),
            registerStep2: jest.fn((options) => {
                expect(options.categoryButtons).toHaveLength(1);
                expect(options.detailButtons).toHaveLength(3);
                expect(options.footerButtons).toHaveLength(2);
                expect(options.activeCategoryId).toBe('setup-category-series-ordering');
                expect(options.detailFocusTarget).toBe(STEP2_CONTROL_IDS.seriesBaseMode);
                expect(options.preferredFocusId).toBe('setup-series-base-block-size');
                options.onDetailFocus(STEP2_CONTROL_IDS.seriesVariantType);
                return true;
            }),
        });

        controller.registerStep2Focusables(
            [{ id: 'setup-category-series-ordering' } as HTMLButtonElement],
            [
                { id: STEP2_CONTROL_IDS.seriesBaseMode, disabled: false } as HTMLButtonElement,
                { id: STEP2_CONTROL_IDS.seriesBaseBlockSize, disabled: true } as HTMLButtonElement,
                { id: STEP2_CONTROL_IDS.seriesVariantType, disabled: false } as HTMLButtonElement,
            ],
            { id: 'setup-back' } as HTMLButtonElement,
            { id: 'setup-next' } as HTMLButtonElement,
            adapters
        );

        expect(adapters.setPreferredFocusId).toHaveBeenCalledWith(null);

        const rememberedAdapters = createAdapters(snapshot);
        const nav = createNav('setup-category-series-ordering');
        controller.handleKeyPress(createEvent('right'), nav as never, rememberedAdapters);
        expect(rememberedAdapters.setPreferredFocusId).toHaveBeenCalledWith(STEP2_CONTROL_IDS.seriesVariantType);
        expect(nav.setFocus).not.toHaveBeenCalled();
    });
});
