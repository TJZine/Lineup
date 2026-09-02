/**
 * @jest-environment jsdom
 */

import type { KeyEvent } from '../../../navigation';
import { createDefaultStrategyOrder, createDefaultStrategyState } from '../ChannelSetupSessionState';
import type {
    ChannelSetupSessionSnapshot,
} from '../ChannelSetupSessionContracts';
import { ChannelSetupWorkflowPresenter } from '../ChannelSetupWorkflowPresenter';
import { STEP2_CONTROL_IDS } from '../strategyConstants';
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

    it('consumes Step 2 right presses without mutating dropdown-only controls or planning preview', () => {
        const snapshot = createSnapshot({ maxChannels: 75 });
        const session = {
            getSnapshot: jest.fn(() => snapshot),
            syncSetupContext: jest.fn(),
            updateStrategyState: jest.fn(),
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
            getPreferredFocusId: jest.fn(() => null),
            setPreferredFocusId: jest.fn(),
            getVisibilityToken: jest.fn(() => 1),
            renderStep: jest.fn(),
            resetStep2Scroll: jest.fn(),
            toDomId: (raw): string => raw,
            revealPlayerProvisionally: jest.fn(),
            restoreSetupAfterProvisionalReveal: jest.fn(),
        });
        const nav = {
            getFocusedElement: jest.fn(() => ({ id: STEP2_CONTROL_IDS.maxChannels })),
            setFocus: jest.fn(),
        };
        const event = createKeyEvent('right');

        presenter.handleStrategyKeyPress(event, nav as never);

        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
        expect(session.updateStrategyState).not.toHaveBeenCalled();
        expect(snapshot.maxChannels).toBe(75);
        expect(session.schedulePreview).not.toHaveBeenCalled();
    });

    it('clears a failed review before reopening Step 3 so it can retry', () => {
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
            reviewError: 'review failed',
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
            getPreferredFocusId: jest.fn(() => null),
            setPreferredFocusId: jest.fn(),
            getVisibilityToken: jest.fn(() => 1),
            renderStep,
            resetStep2Scroll: jest.fn(),
            toDomId: (raw): string => raw,
            revealPlayerProvisionally: jest.fn(),
            restoreSetupAfterProvisionalReveal: jest.fn(),
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
