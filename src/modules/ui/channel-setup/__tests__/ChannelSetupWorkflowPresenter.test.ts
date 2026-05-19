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
import { flushPromises } from '../../../../__tests__/helpers';
import { createScreenPorts, DEFAULT_PREVIEW } from './channel-setup-test-helpers';

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
            resetStep2Scroll: jest.fn(),
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

    it('preloads review from Step 2 after the preview is ready', async () => {
        const contentEl = document.createElement('div');
        const ctx = {
            contentEl,
            stepEl: document.createElement('div'),
            statusEl: document.createElement('div'),
            detailEl: document.createElement('div'),
            errorEl: document.createElement('div'),
        };
        let snapshot = createSnapshot({
            setupContext: 'existing',
            preview: DEFAULT_PREVIEW,
            previewStatus: 'ready',
        });
        const session = {
            getSnapshot: jest.fn(() => snapshot),
            syncSetupContext: jest.fn(),
            updateStrategyState: jest.fn(),
            schedulePreview: jest.fn(),
            setStep: jest.fn(),
            ensureReviewLoaded: jest.fn((onStateChange: () => void) => {
                onStateChange();
            }),
        };
        let visibilityToken = 1;
        const renderStep = jest.fn();
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
            contentEl,
            previewPanelId: 'setup-preview-panel',
            getPreferredFocusId: jest.fn(() => null),
            setPreferredFocusId: jest.fn(),
            getVisibilityToken: jest.fn(() => visibilityToken),
            renderStep,
            resetStep2Scroll: jest.fn(),
            toDomId: (raw): string => raw,
        });

        presenter.renderStrategyStep(ctx);
        await flushPromises();

        expect(session.ensureReviewLoaded).toHaveBeenCalledWith(expect.any(Function));
        expect(renderStep).not.toHaveBeenCalled();

        const [onStateChange] = session.ensureReviewLoaded.mock.calls[0] ?? [];
        snapshot = createSnapshot({
            step: 3,
            setupContext: 'existing',
            preview: DEFAULT_PREVIEW,
            previewStatus: 'ready',
        });
        onStateChange?.();
        expect(renderStep).toHaveBeenCalledTimes(1);

        visibilityToken = 2;
        onStateChange?.();
        expect(renderStep).toHaveBeenCalledTimes(1);
    });

    it('clears a failed Step 2 preload before opening review so Step 3 can retry', () => {
        const contentEl = document.createElement('div');
        const ctx = {
            contentEl,
            stepEl: document.createElement('div'),
            statusEl: document.createElement('div'),
            detailEl: document.createElement('div'),
            errorEl: document.createElement('div'),
        };
        let snapshot = createSnapshot({
            setupContext: 'existing',
            preview: DEFAULT_PREVIEW,
            previewStatus: 'ready',
            reviewError: 'preload failed',
        });
        const session = {
            getSnapshot: jest.fn(() => snapshot),
            syncSetupContext: jest.fn(),
            updateStrategyState: jest.fn(),
            schedulePreview: jest.fn(),
            setStep: jest.fn((step: 1 | 2 | 3) => {
                snapshot = { ...snapshot, step };
            }),
            clearReviewForEdits: jest.fn(() => {
                snapshot = { ...snapshot, reviewError: null };
            }),
        };
        const renderStep = jest.fn();
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
            contentEl,
            previewPanelId: 'setup-preview-panel',
            getPreferredFocusId: jest.fn(() => null),
            setPreferredFocusId: jest.fn(),
            getVisibilityToken: jest.fn(() => 1),
            renderStep,
            resetStep2Scroll: jest.fn(),
            toDomId: (raw): string => raw,
        });

        presenter.renderStrategyStep(ctx);
        (contentEl.querySelector('#setup-next') as HTMLButtonElement).click();

        expect(session.clearReviewForEdits).toHaveBeenCalledTimes(1);
        expect(session.setStep).toHaveBeenCalledWith(3);
        expect(session.clearReviewForEdits.mock.invocationCallOrder[0]!)
            .toBeLessThan(session.setStep.mock.invocationCallOrder[0]!);
        expect(renderStep).toHaveBeenCalledTimes(1);
    });
});
