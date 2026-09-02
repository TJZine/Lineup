import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../scheduler/channel-manager/constants';
import type { INavigationManager, KeyEvent } from '../../navigation/contracts/interfaces';
import { ChannelSetupDropdownController } from './ChannelSetupDropdownController';
import { ChannelSetupSessionController } from './ChannelSetupSessionController';
import {
    type ChannelSetupSessionSnapshot,
    type StrategyStepMutableState,
} from './ChannelSetupSessionContracts';
import { strategySupportsMixedScope } from './ChannelSetupSessionState';
import type { ChannelSetupFocusCoordinator } from './focus/ChannelSetupFocusCoordinator';
import type { RegisterStep2FocusOptions } from './focus/types';
import type { ChannelSetupScreenPorts } from './ChannelSetupScreenPorts';
import { ChannelSetupBuildStepPresenter } from './steps/ChannelSetupBuildStepPresenter';
import {
    SETUP_STRATEGY_KEYS,
    type SetupStrategyKey,
} from './strategyConstants';
import { StrategyStepController } from './steps/StrategyStepController';
import { StrategyStepInteractionController } from './steps/StrategyStepInteractionController';
import type { StepRenderContext, StrategyStepDropdownConfig } from './stepContracts';

const CHANNEL_LIMIT_PRESETS = [50, 100, 150, 200, 300, 400, 500];
const MIN_ITEMS_PRESETS = [1, 5, 10, 20, 50];

export class ChannelSetupWorkflowPresenter {
    private readonly _strategyStep = new StrategyStepController();
    private readonly _buildStep = new ChannelSetupBuildStepPresenter();
    private readonly _strategyInteraction: StrategyStepInteractionController;
    private _channelLimitOptions: number[] = CHANNEL_LIMIT_PRESETS.filter((value) => value <= MAX_CHANNELS);

    constructor(
        private readonly _deps: {
            session: ChannelSetupSessionController;
            focus: ChannelSetupFocusCoordinator;
            dropdown: ChannelSetupDropdownController;
            screenPorts: ChannelSetupScreenPorts;
            contentEl: HTMLElement;
            getPreferredFocusId: () => string | null;
            setPreferredFocusId: (focusId: string | null) => void;
            getVisibilityToken: () => number;
            renderStep: () => void;
            resetStep2Scroll: () => void;
            toDomId: (raw: string) => string;
            revealPlayerProvisionally: () => void;
            restoreSetupAfterProvisionalReveal: () => void;
        }
    ) {
        this._strategyInteraction = new StrategyStepInteractionController({
            strategySupportsMixedScope,
            toDomId: _deps.toDomId,
        });

        if (!this._channelLimitOptions.includes(DEFAULT_CHANNEL_SETUP_MAX)) {
            this._channelLimitOptions.push(DEFAULT_CHANNEL_SETUP_MAX);
            this._channelLimitOptions.sort((a, b) => a - b);
        }
    }

    resetStrategyInteraction(): void {
        this._strategyInteraction.reset();
    }

    clearStrategyStepTransientState(): void {
        this._strategyInteraction.clearTransientState((strategy, grabbed) => {
            this._setPriorityRowGrabbedVisual(strategy, grabbed);
        });
    }

    cancelDoneTransition(): void {
        this._buildStep.cancelDoneTransition();
    }

    dispose(): void {
        this._buildStep.dispose();
    }

    handleStrategyKeyPress(event: KeyEvent, nav: INavigationManager): void {
        this._strategyInteraction.handleKeyPress(event, nav, this._createStrategyInteractionAdapters());
    }

    renderStrategyStep(ctx: StepRenderContext): void {
        this._deps.session.syncSetupContext();
        const session = this._deps.session.getSnapshot();
        const strategyInteraction = this._createStrategyInteractionAdapters();
        this._strategyStep.render(ctx, {
            state: {
                activeStrategyCategory: this._strategyInteraction.getActiveStrategyCategory(),
                strategies: session.strategies,
                strategyOrder: session.strategyOrder,
                channelExpansion: session.channelExpansion,
                seriesOrdering: session.seriesOrdering,
                buildMode: session.buildMode,
                actorStudioCombineMode: session.actorStudioCombineMode,
                maxChannels: session.maxChannels,
                minItems: session.minItems,
                setupContext: session.setupContext,
            },
            strategyKeys: SETUP_STRATEGY_KEYS,
            categoryButtonId: (category) => this._strategyInteraction.categoryButtonId(category),
            strategyButtonId: (strategy) => this._strategyInteraction.strategyButtonId(strategy),
            priorityRowId: (strategy) => this._strategyInteraction.priorityRowId(strategy),
            lastReorder: this._strategyInteraction.getLastReorder(),
            grabbedPriorityKey: this._strategyInteraction.getGrabbedPriorityKey(),
            scopeButtonId: (strategy) => this._strategyInteraction.scopeButtonId(strategy),
            strategySupportsMixedScope,
            applyCategoryChange: (category, focusId) => {
                this._strategyInteraction.applyCategoryChange(category, focusId, strategyInteraction);
            },
            applySettingChange: (focusId, mutate) => {
                this._strategyInteraction.applySettingChange(focusId, mutate, strategyInteraction);
            },
            resetGuideOrder: (focusId) => {
                this._strategyInteraction.resetGuideOrder(focusId, strategyInteraction);
            },
            openAdjustableControl: (controlId) => {
                this._strategyInteraction.openAdjustableControl(controlId, strategyInteraction);
            },
            onBack: () => {
                this.clearStrategyStepTransientState();
                this._deps.session.setStep(1);
                this._deps.renderStep();
            },
            onNext: () => {
                this.clearStrategyStepTransientState();
                const current = this._deps.session.getSnapshot();
                if (current.reviewError && !current.review && !current.isReviewLoading) {
                    this._deps.session.clearReviewForEdits();
                }
                this._deps.session.setStep(3);
                this._deps.renderStep();
            },
            registerStep2Focusables: (categoryButtons, detailButtons, backButton, nextButton, options) => {
                this._strategyInteraction.registerStep2Focusables(
                    categoryButtons,
                    detailButtons,
                    backButton,
                    nextButton,
                    strategyInteraction,
                    options
                );
            },
            detailText: session.strategies.genres.enabled || session.strategies.directors.enabled
                ? 'Performance warning: may be slow on large libraries.'
                : '',
        });
        this._setPriorityRowGrabbedVisual(this._strategyInteraction.getGrabbedPriorityKey(), true);
    }

    renderBuildStep(ctx: StepRenderContext): void {
        this._buildStep.render(ctx, {
            session: this._deps.session,
            focus: this._deps.focus,
            screenPorts: this._deps.screenPorts,
            getPreferredFocusId: this._deps.getPreferredFocusId,
            setPreferredFocusId: this._deps.setPreferredFocusId,
            getVisibilityToken: this._deps.getVisibilityToken,
            renderStep: this._deps.renderStep,
            revealPlayerProvisionally: this._deps.revealPlayerProvisionally,
            restoreSetupAfterProvisionalReveal: this._deps.restoreSetupAfterProvisionalReveal,
        });
    }

    private _createStrategyInteractionAdapters(): Parameters<StrategyStepInteractionController['handleKeyPress']>[2] {
        return {
            channelLimitOptions: this._channelLimitOptions,
            deferDropdownRender: (): void => {
                this._deps.dropdown.deferRender();
            },
            dismissDropdown: (): void => {
                this._deps.dropdown.dismiss(() => this._deps.renderStep());
            },
            getPreferredFocusId: this._deps.getPreferredFocusId,
            getSessionSnapshot: (): ChannelSetupSessionSnapshot => this._deps.session.getSnapshot(),
            hasActiveDropdown: (): boolean => this._deps.dropdown.hasActiveDropdown(),
            minItemsOptions: MIN_ITEMS_PRESETS,
            openDropdown: (config: StrategyStepDropdownConfig): void => {
                this._openStep2Dropdown(config);
            },
            registerStep2: (options: RegisterStep2FocusOptions): boolean => this._deps.focus.registerStep2(options),
            renderStep: this._deps.renderStep,
            resetStep2Scroll: this._deps.resetStep2Scroll,
            setPreferredFocusId: this._deps.setPreferredFocusId,
            setPriorityRowGrabbedVisual: (strategy: SetupStrategyKey | null, grabbed: boolean): void => {
                this._setPriorityRowGrabbedVisual(strategy, grabbed);
            },
            updateStrategyState: (mutate: (draft: StrategyStepMutableState) => void): void => {
                this._deps.session.updateStrategyState(mutate);
            },
        };
    }

    private _openStep2Dropdown(config: StrategyStepDropdownConfig): void {
        const nav = this._deps.screenPorts.getNavigation();
        this._deps.dropdown.open(config, {
            container: this._deps.contentEl,
            nav,
            setPreferredFocusId: this._deps.setPreferredFocusId,
            renderStep: this._deps.renderStep,
        });
    }

    private _setPriorityRowGrabbedVisual(strategy: SetupStrategyKey | null, grabbed: boolean): void {
        if (!strategy) return;
        const el = document.getElementById(this._strategyInteraction.priorityRowId(strategy));
        el?.classList.toggle('setup-priority-row--grabbed', grabbed);
        el?.setAttribute('aria-grabbed', grabbed ? 'true' : 'false');
    }
}
