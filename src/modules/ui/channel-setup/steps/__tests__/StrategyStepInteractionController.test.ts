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
        const controller = new StrategyStepInteractionController({
            strategySupportsMixedScope: (strategy): boolean =>
                strategy === 'genres' || strategy === 'directors' || strategy === 'studios' || strategy === 'actors',
            toDomId: (raw): string => raw,
        });
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

        expect(adapters.registerStep2).toHaveBeenCalledWith(
            categoryButtons,
            detailButtons,
            [backButton, nextButton],
            controller.categoryButtonId('content-sources'),
            'setup-strategy-playlists',
            'setup-strategy-playlists',
            expect.any(Function)
        );
    });
});
