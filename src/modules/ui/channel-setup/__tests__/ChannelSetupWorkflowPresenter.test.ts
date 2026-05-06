/**
 * @jest-environment jsdom
 */

import type { KeyEvent } from '../../../navigation';
import { createDefaultStrategyOrder, createDefaultStrategyState } from '../ChannelSetupSessionState';
import type {
    ChannelSetupSessionSnapshot,
    StrategyStepMutableState,
} from '../ChannelSetupSessionContracts';
import { ChannelSetupWorkflowPresenter } from '../ChannelSetupWorkflowPresenter';
import { STEP2_CONTROL_IDS } from '../steps/constants';
import { createScreenPorts } from './channel-setup-test-helpers';

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

const createDraft = (snapshot: ChannelSetupSessionSnapshot): StrategyStepMutableState => ({
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
});

const createKeyEvent = (button: KeyEvent['button']): KeyEvent => ({
    button,
    handled: false,
    isRepeat: false,
    isLongPress: false,
    timestamp: Date.now(),
    originalEvent: {
        preventDefault: jest.fn(),
    } as unknown as KeyboardEvent,
});

describe('ChannelSetupWorkflowPresenter', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('owns Step 2 preset cycling glue without requiring screen helper methods', () => {
        const snapshot = createSnapshot({ maxChannels: 75 });
        const captured: { draftAfterMutation?: StrategyStepMutableState } = {};
        const session = {
            getSnapshot: jest.fn(() => snapshot),
            syncSetupContext: jest.fn(),
            updateStrategyState: jest.fn((mutate: (draft: StrategyStepMutableState) => void) => {
                const draft = createDraft(snapshot);
                mutate(draft);
                captured.draftAfterMutation = draft;
            }),
            schedulePreview: jest.fn(),
            setStep: jest.fn(),
        };
        const presenter = new ChannelSetupWorkflowPresenter({
            session: session as never,
            focus: { registerStep2: jest.fn(() => false) } as never,
            dropdown: {
                deferRender: jest.fn(),
                dismiss: jest.fn(),
                hasActiveDropdown: jest.fn(() => false),
                open: jest.fn(),
            } as never,
            screenPorts: createScreenPorts(),
            contentEl: document.createElement('div'),
            previewPanelId: 'setup-preview-panel',
            getPreferredFocusId: jest.fn(() => null),
            setPreferredFocusId: jest.fn(),
            getVisibilityToken: jest.fn(() => 1),
            renderStep: jest.fn(),
            toDomId: (raw): string => raw,
        });
        const nav = {
            getFocusedElement: jest.fn(() => ({ id: STEP2_CONTROL_IDS.maxChannels })),
            setFocus: jest.fn(),
        };
        const event = createKeyEvent('right');

        presenter.handleStrategyKeyPress(event, nav as never);

        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
        expect(session.updateStrategyState).toHaveBeenCalledTimes(1);
        expect(captured.draftAfterMutation?.maxChannels).toBe(100);
        expect(session.schedulePreview).toHaveBeenCalledTimes(1);
    });
});
