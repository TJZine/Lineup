/**
 * @jest-environment jsdom
 */

import { createDefaultStrategyOrder, createDefaultStrategyState } from '../../ChannelSetupSessionState';
import type {
    ChannelSetupSessionSnapshot,
    StrategyStepMutableState,
} from '../../ChannelSetupSessionContracts';
import { StrategyStepInteractionController } from '../StrategyStepInteractionController';
import { STEP2_CONTROL_IDS } from '../constants';

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
    schedulePreview: jest.fn(),
    setPreferredFocusId: jest.fn(),
    setPriorityRowGrabbedVisual: jest.fn(),
    stepPreset: jest.fn((options: number[], current: number, dir: 'left' | 'right') => {
        const index = options.indexOf(current);
        if (index < 0) {
            return current;
        }
        const nextIndex = dir === 'left'
            ? Math.max(0, index - 1)
            : Math.min(options.length - 1, index + 1);
        return options[nextIndex] ?? current;
    }),
    updatePriorityRowState: jest.fn(() => false),
    updateStrategyState: jest.fn((mutate: (draft: StrategyStepMutableState) => void) => {
        const draft: StrategyStepMutableState = {
            strategies: createDefaultStrategyState(),
            strategyOrder: createDefaultStrategyOrder(),
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
    button: 'left' | 'right' | 'ok' | 'up' | 'down' | 'back'
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
    isRepeat: false,
    isLongPress: false,
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
        expect(adapters.schedulePreview).toHaveBeenCalledTimes(1);
        expect(adapters.renderStep).toHaveBeenCalledTimes(1);
    });

    it('handleKeyPress adjusts build mode with left/right on adjustable controls', () => {
        const controller = new StrategyStepInteractionController({
            strategySupportsMixedScope: (): boolean => false,
            toDomId: (raw): string => raw,
        });
        const snapshot = createSnapshot();
        const adapters = createAdapters(snapshot);
        const nav = createNav(STEP2_CONTROL_IDS.buildMode);
        const event = createEvent('right');

        controller.handleKeyPress(event, nav as never, adapters);

        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
        expect(adapters.updateStrategyState).toHaveBeenCalledTimes(1);
        expect(adapters.schedulePreview).toHaveBeenCalledTimes(1);
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
        const adapters = createAdapters(snapshot, {
            setPriorityRowGrabbedVisual: jest.fn(),
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

    it('applySettingChange updates priority rows in place and defers rerender when a dropdown is already open', () => {
        const controller = createController();
        controller.applyCategoryChange('priority-order', 'setup-category-priority-order', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });

        const before = createSnapshot();
        const after = createSnapshot({
            strategies: {
                ...createDefaultStrategyState(),
                playlists: {
                    ...createDefaultStrategyState().playlists,
                    enabled: true,
                },
            },
        });
        const getSessionSnapshot = jest.fn<ChannelSetupSessionSnapshot, []>()
            .mockReturnValueOnce(before)
            .mockReturnValueOnce(after);
        const adapters = createAdapters(before, {
            getSessionSnapshot,
            hasActiveDropdown: jest.fn(() => true),
            updatePriorityRowState: jest.fn(() => true),
        });

        controller.applySettingChange('setup-priority-row-playlists', (draft) => {
            draft.strategies.playlists.enabled = true;
        }, adapters);

        expect(adapters.setPreferredFocusId).toHaveBeenNthCalledWith(1, 'setup-priority-row-playlists');
        expect(adapters.setPreferredFocusId).toHaveBeenNthCalledWith(2, null);
        expect(adapters.updatePriorityRowState).toHaveBeenCalledWith('setup-priority-row-playlists', true);
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
            expect(adapters.schedulePreview).toHaveBeenCalledTimes(1);
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

    it('handleKeyPress uses adjustable controls for dropdown open, option cycling, and category fallback', () => {
        const controller = createController();

        const okAdapters = createAdapters(createSnapshot());
        controller.handleKeyPress(createEvent('ok'), createNav(STEP2_CONTROL_IDS.buildMode) as never, okAdapters);
        expect(okAdapters.openDropdown).toHaveBeenCalledTimes(1);

        const cycleAdapters = createAdapters(createSnapshot(), {
            updateStrategyState: jest.fn(),
        });
        controller.handleKeyPress(createEvent('right'), createNav(STEP2_CONTROL_IDS.combineMode) as never, cycleAdapters);
        expect(cycleAdapters.updateStrategyState).toHaveBeenCalledTimes(1);
        expect(cycleAdapters.schedulePreview).toHaveBeenCalledTimes(1);

        const leftBoundaryNav = createNav(STEP2_CONTROL_IDS.buildMode);
        const leftBoundaryAdapters = createAdapters(createSnapshot({
            buildMode: 'replace',
        }));
        controller.handleKeyPress(createEvent('left'), leftBoundaryNav as never, leftBoundaryAdapters);
        expect(leftBoundaryAdapters.setPreferredFocusId).toHaveBeenCalledWith('setup-category-content-sources');
        expect(leftBoundaryNav.setFocus).toHaveBeenCalledWith('setup-category-content-sources');

        const stringFallbackAdapters = createAdapters(createSnapshot({
            buildMode: 'unknown' as never,
        }));
        controller.handleKeyPress(createEvent('right'), createNav(STEP2_CONTROL_IDS.buildMode) as never, stringFallbackAdapters);
        expect(stringFallbackAdapters.updateStrategyState).toHaveBeenCalledTimes(1);

        controller.applyCategoryChange('build-options', 'setup-category-build-options', {
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            setPreferredFocusId: jest.fn(),
            setPriorityRowGrabbedVisual: jest.fn(),
        });
        const numericFallbackAdapters = createAdapters(createSnapshot({
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 4 as never,
                variantType: 'none',
                variantBlockSize: 3,
            },
        }));
        controller.handleKeyPress(
            createEvent('left'),
            createNav(STEP2_CONTROL_IDS.alternateLineupCopies) as never,
            numericFallbackAdapters
        );
        expect(numericFallbackAdapters.updateStrategyState).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            STEP2_CONTROL_IDS.combineMode,
            createSnapshot({ actorStudioCombineMode: 'combined' }),
            'left',
            'content-sources',
        ],
        [
            STEP2_CONTROL_IDS.alternateLineupCopies,
            createSnapshot({
                channelExpansion: {
                    addAlternateLineups: true,
                    alternateLineupCopies: 2,
                    variantType: 'none',
                    variantBlockSize: 3,
                },
            }),
            'right',
            'content-sources',
        ],
        [
            STEP2_CONTROL_IDS.seriesBaseMode,
            createSnapshot({
                seriesOrdering: {
                    basePlaybackMode: 'sequential',
                    baseBlockSize: 3,
                },
            }),
            'right',
            'content-sources',
        ],
        [
            STEP2_CONTROL_IDS.seriesBaseBlockSize,
            createSnapshot({
                seriesOrdering: {
                    basePlaybackMode: 'block',
                    baseBlockSize: 3,
                },
            }),
            'right',
            'content-sources',
        ],
        [
            STEP2_CONTROL_IDS.seriesVariantType,
            createSnapshot({
                channelExpansion: {
                    addAlternateLineups: false,
                    alternateLineupCopies: 1,
                    variantType: 'sequential',
                    variantBlockSize: 3,
                },
            }),
            'right',
            'content-sources',
        ],
        [
            STEP2_CONTROL_IDS.seriesVariantBlockSize,
            createSnapshot({
                channelExpansion: {
                    addAlternateLineups: false,
                    alternateLineupCopies: 1,
                    variantType: 'block',
                    variantBlockSize: 3,
                },
            }),
            'right',
            'content-sources',
        ],
        [
            STEP2_CONTROL_IDS.maxChannels,
            createSnapshot({ maxChannels: 100 }),
            'right',
            'content-sources',
        ],
        [
            STEP2_CONTROL_IDS.minItems,
            createSnapshot({ minItems: 5 }),
            'right',
            'content-sources',
        ],
    ] as const)('handleKeyPress cycles %s directly through the interaction owner', (controlId, snapshot, button, expectedCategory) => {
        const controller = createController();
        const adapters = createAdapters(snapshot);
        const nav = createNav(controlId);
        const event = createEvent(button);

        controller.handleKeyPress(event, nav as never, adapters);

        expect(event.handled).toBe(true);
        expect(adapters.updateStrategyState).toHaveBeenCalledTimes(1);
        expect(adapters.schedulePreview).toHaveBeenCalledTimes(1);
        if (controlId === STEP2_CONTROL_IDS.maxChannels) {
            expect(adapters.stepPreset).toHaveBeenCalledWith([50, 100, 200], 100, 'right', 'clamp');
        }
        if (controlId === STEP2_CONTROL_IDS.minItems) {
            expect(adapters.stepPreset).toHaveBeenCalledWith([1, 5, 10], 5, 'right', 'clamp');
        }
        expect(controller.getActiveStrategyCategory()).toBe(expectedCategory);
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

        controller.handleKeyPress(createEvent('ok'), nav as never, adapters);
        controller.handleKeyPress(createEvent('ok'), createNav('setup-priority-row-genres') as never, adapters);
        expect(adapters.setPriorityRowGrabbedVisual).toHaveBeenCalledWith('playlists', false);
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
        const boundaryEvent = createEvent('up');
        controller.handleKeyPress(boundaryEvent, createNav('setup-priority-row-collections') as never, createAdapters(createSnapshot()));
        expect(boundaryEvent.handled).toBe(true);
    });

    it('handleKeyPress moves between category rail and detail focus while preserving valid targets', () => {
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

        const buildSnapshot = createSnapshot();
        const buildAdapters = createAdapters(buildSnapshot, {
            setPriorityRowGrabbedVisual: grabAdapters.setPriorityRowGrabbedVisual,
        });
        controller.handleKeyPress(
            createEvent('right'),
            createNav('setup-category-build-options') as never,
            buildAdapters
        );
        expect(buildAdapters.setPreferredFocusId).toHaveBeenCalledWith('setup-category-build-options');
        expect(buildAdapters.resetStep2Scroll).toHaveBeenCalledTimes(1);
        expect(buildAdapters.renderStep).toHaveBeenCalledTimes(1);
        expect(buildAdapters.setPriorityRowGrabbedVisual).toHaveBeenCalledWith('playlists', false);

        const enterDetailEvent = createEvent('right');
        controller.handleKeyPress(enterDetailEvent, createNav('setup-category-build-options') as never, buildAdapters);
        expect(enterDetailEvent.handled).toBe(true);
        expect(buildAdapters.setPreferredFocusId).toHaveBeenLastCalledWith(STEP2_CONTROL_IDS.buildMode);

        const leftNav = createNav(STEP2_CONTROL_IDS.buildMode);
        controller.handleKeyPress(createEvent('left'), leftNav as never, buildAdapters);
        expect(buildAdapters.setPreferredFocusId).toHaveBeenLastCalledWith('setup-category-build-options');
        expect(leftNav.setFocus).toHaveBeenCalledWith('setup-category-build-options');
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
        expect(sparseAdapters.updateStrategyState).not.toHaveBeenCalled();
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
