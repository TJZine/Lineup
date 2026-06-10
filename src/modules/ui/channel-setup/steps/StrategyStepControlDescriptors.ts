import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../../scheduler/channel-manager/constants';
import type {
    ChannelSetupSessionSnapshot,
    StrategyStepMutableState,
} from '../ChannelSetupSessionContracts';
import {
    ALTERNATE_LINEUP_COPY_OPTIONS,
    BUILD_MODE_OPTIONS,
    COMBINE_MODE_OPTIONS,
    SERIES_BASE_MODE_OPTIONS,
    SERIES_BLOCK_PRESETS,
    SERIES_VARIANT_TYPE_OPTIONS,
    STEP2_CONTROL_IDS,
} from '../strategyConstants';
import type { StrategyStepStateSnapshot } from './types';

export type StrategyControlValue = string | number;

export type StrategyControlOptionsAdapters = {
    channelLimitOptions: number[];
    minItemsOptions: number[];
};

export type StrategyControlDescriptor = {
    controlId: string;
    label: string;
    meta: string;
    options: (adapters: StrategyControlOptionsAdapters) => readonly StrategyControlValue[];
    currentValue: (session: ChannelSetupSessionSnapshot) => StrategyControlValue;
    stateText: (state: StrategyStepStateSnapshot) => string;
    applyValue: (draft: StrategyStepMutableState, value: StrategyControlValue) => void;
    cycleMode?: 'discrete' | 'preset';
    isDisabled?: (session: ChannelSetupSessionSnapshot | StrategyStepStateSnapshot) => boolean;
    isSelected?: (state: StrategyStepStateSnapshot) => boolean;
};

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const STRATEGY_CONTROL_DESCRIPTORS: readonly StrategyControlDescriptor[] = [
    {
        controlId: STEP2_CONTROL_IDS.buildMode,
        label: 'Build mode',
        meta: 'Replace, append, or merge with your lineup.',
        options: (): readonly StrategyControlValue[] => BUILD_MODE_OPTIONS,
        currentValue: (session): StrategyControlValue => session.buildMode,
        stateText: (state): string => capitalize(state.buildMode),
        applyValue: (draft, value): void => {
            draft.buildMode = value as typeof draft.buildMode;
        },
    },
    {
        controlId: STEP2_CONTROL_IDS.combineMode,
        label: 'Actor/Studio combine',
        meta: 'Separate movies + TV or combine together.',
        options: (): readonly StrategyControlValue[] => COMBINE_MODE_OPTIONS,
        currentValue: (session): StrategyControlValue => session.actorStudioCombineMode,
        stateText: (state): string => state.actorStudioCombineMode === 'combined' ? 'Combined' : 'Separate',
        applyValue: (draft, value): void => {
            draft.actorStudioCombineMode = value as typeof draft.actorStudioCombineMode;
        },
    },
    {
        controlId: STEP2_CONTROL_IDS.alternateLineupCopies,
        label: 'Alternate Lineup Copies',
        meta: 'How many extra copies per generated channel.',
        options: (): readonly StrategyControlValue[] => ALTERNATE_LINEUP_COPY_OPTIONS,
        currentValue: (session): StrategyControlValue => session.channelExpansion.alternateLineupCopies,
        stateText: (state): string => String(state.channelExpansion.alternateLineupCopies),
        applyValue: (draft, value): void => {
            draft.channelExpansion.alternateLineupCopies = Number(value);
        },
        isDisabled: (session): boolean => !session.channelExpansion.addAlternateLineups,
    },
    {
        controlId: STEP2_CONTROL_IDS.seriesBaseMode,
        label: 'Base Series Mode',
        meta: 'Default playback mode for TV-derived channels.',
        options: (): readonly StrategyControlValue[] => SERIES_BASE_MODE_OPTIONS,
        currentValue: (session): StrategyControlValue => session.seriesOrdering.basePlaybackMode,
        stateText: (state): string => state.seriesOrdering.basePlaybackMode === 'block'
            ? `Block • ${state.seriesOrdering.baseBlockSize}`
            : capitalize(state.seriesOrdering.basePlaybackMode),
        applyValue: (draft, value): void => {
            draft.seriesOrdering.basePlaybackMode = value as typeof draft.seriesOrdering.basePlaybackMode;
        },
        isSelected: (state): boolean => state.seriesOrdering.basePlaybackMode !== 'shuffle',
    },
    {
        controlId: STEP2_CONTROL_IDS.seriesBaseBlockSize,
        label: 'Base Block Size',
        meta: 'Episodes per show before switching in block mode.',
        options: (): readonly StrategyControlValue[] => SERIES_BLOCK_PRESETS,
        currentValue: (session): StrategyControlValue => session.seriesOrdering.baseBlockSize,
        stateText: (state): string => String(state.seriesOrdering.baseBlockSize),
        applyValue: (draft, value): void => {
            draft.seriesOrdering.baseBlockSize = Number(value);
        },
        isDisabled: (session): boolean => session.seriesOrdering.basePlaybackMode !== 'block',
    },
    {
        controlId: STEP2_CONTROL_IDS.seriesVariantType,
        label: 'Variant Type',
        meta: 'Optional extra series channel mode.',
        options: (): readonly StrategyControlValue[] => SERIES_VARIANT_TYPE_OPTIONS,
        currentValue: (session): StrategyControlValue => session.channelExpansion.variantType,
        stateText: (state): string => {
            if (state.channelExpansion.variantType === 'none') {
                return 'None';
            }
            if (state.channelExpansion.variantType === 'sequential') {
                return 'Sequential';
            }
            return `Block • ${state.channelExpansion.variantBlockSize}`;
        },
        applyValue: (draft, value): void => {
            draft.channelExpansion.variantType = value as typeof draft.channelExpansion.variantType;
        },
        isSelected: (state): boolean => state.channelExpansion.variantType !== 'none',
    },
    {
        controlId: STEP2_CONTROL_IDS.seriesVariantBlockSize,
        label: 'Variant Block Size',
        meta: 'Block size for generated block variants.',
        options: (): readonly StrategyControlValue[] => SERIES_BLOCK_PRESETS,
        currentValue: (session): StrategyControlValue => session.channelExpansion.variantBlockSize,
        stateText: (state): string => String(state.channelExpansion.variantBlockSize),
        applyValue: (draft, value): void => {
            draft.channelExpansion.variantBlockSize = Number(value);
        },
        isDisabled: (session): boolean => session.channelExpansion.variantType !== 'block',
    },
    {
        controlId: STEP2_CONTROL_IDS.maxChannels,
        label: 'Max channels',
        meta: `Default ${DEFAULT_CHANNEL_SETUP_MAX}. Limit up to ${MAX_CHANNELS}.`,
        options: (adapters): readonly StrategyControlValue[] => adapters.channelLimitOptions,
        currentValue: (session): StrategyControlValue => session.maxChannels,
        stateText: (state): string => String(state.maxChannels),
        applyValue: (draft, value): void => {
            draft.maxChannels = Number(value);
        },
        cycleMode: 'preset',
    },
    {
        controlId: STEP2_CONTROL_IDS.minItems,
        label: 'Min items',
        meta: 'Minimum content items per channel.',
        options: (adapters): readonly StrategyControlValue[] => adapters.minItemsOptions,
        currentValue: (session): StrategyControlValue => session.minItems,
        stateText: (state): string => String(state.minItems),
        applyValue: (draft, value): void => {
            draft.minItems = Number(value);
        },
        cycleMode: 'preset',
    },
];

export const getStrategyControlDescriptor = (controlId: string): StrategyControlDescriptor | null =>
    STRATEGY_CONTROL_DESCRIPTORS.find((descriptor) => descriptor.controlId === controlId) ?? null;
