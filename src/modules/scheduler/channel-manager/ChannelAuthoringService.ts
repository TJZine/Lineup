import { fnv1a32Uint } from '../../../utils/hash';
import { AppErrorCode } from '../../../types/app-errors';
import { CHANNEL_ERROR_MESSAGES, MAX_CHANNELS, MAX_CHANNEL_NUMBER, MIN_CHANNEL_NUMBER } from './constants';
import { ChannelError } from './ChannelErrors';
import { isValidContentSource } from './ChannelContentSourceValidator';
import {
    cloneChannelForOwnership,
    cloneContentFilters,
    cloneContentSource,
} from './ChannelDomainClone';
import type { ChannelConfig, ChannelContentSource, ChannelCreateInput, ChannelUpdateInput } from './types';

type ChannelAuthoringServiceConfig = {
    generateId: () => string;
    now: () => number;
};

type ChannelAuthoringLogger = {
    warn: (message: string, ...args: unknown[]) => void;
};

export function omitUndefinedChannelUpdates(updates: ChannelUpdateInput): ChannelUpdateInput {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            filtered[key] = value;
        }
    }
    return filtered as ChannelUpdateInput;
}

export type ReplacementChannelState = {
    channels: Map<string, ChannelConfig>;
    channelOrder: string[];
};

export class ChannelAuthoringService {
    private readonly _generateId: () => string;
    private readonly _now: () => number;

    constructor(config: ChannelAuthoringServiceConfig) {
        this._generateId = config.generateId;
        this._now = config.now;
    }

    createChannel(input: ChannelCreateInput, existingChannels: Iterable<ChannelConfig>): ChannelConfig {
        if (!input.contentSource) {
            throw new ChannelError(
                AppErrorCode.CHANNEL_CONTENT_SOURCE_REQUIRED,
                CHANNEL_ERROR_MESSAGES.CONTENT_SOURCE_REQUIRED,
                false
            );
        }
        const contentSource = this._validateContentSource(input.contentSource);

        const channels = Array.from(existingChannels);
        if (channels.length >= MAX_CHANNELS) {
            throw new ChannelError(
                AppErrorCode.MAX_CHANNELS_REACHED,
                CHANNEL_ERROR_MESSAGES.MAX_CHANNELS_REACHED,
                false
            );
        }

        const channelNumber = typeof input.number === 'number'
            ? this._validateRequestedNumber(input.number, channels)
            : this.getNextAvailableNumber(channels);
        const now = this._now();
        const channel: ChannelConfig = {
            id: this._generateId(),
            number: channelNumber,
            name:
                typeof input.name === 'string' && input.name.length > 0
                    ? input.name
                    : `Channel ${channelNumber}`,
            contentSource: cloneContentSource(contentSource),
            playbackMode: input.playbackMode || 'sequential',
            startTimeAnchor:
                typeof input.startTimeAnchor === 'number'
                    ? input.startTimeAnchor
                    : now,
            skipIntros: input.skipIntros === true,
            skipCredits: input.skipCredits === true,
            createdAt: now,
            updatedAt: now,
            lastContentRefresh: 0,
            itemCount: 0,
            totalDurationMs: 0,
        };

        this._applyOptionalFields(channel, input);
        this.applySeedDefaults(channel);
        return channel;
    }

    buildReplacementState(
        channels: ChannelConfig[],
        logger: ChannelAuthoringLogger
    ): ReplacementChannelState {
        const nextChannels = new Map<string, ChannelConfig>();
        const nextChannelOrder: string[] = [];
        const availableNumbers: number[] = [];
        for (let n = MIN_CHANNEL_NUMBER; n <= MAX_CHANNEL_NUMBER; n++) {
            availableNumbers.push(n);
        }
        const usedNumbers = new Set<number>();
        const takeNextAvailable = (): number | null => {
            const next = availableNumbers.shift();
            if (next === undefined) {
                return null;
            }
            usedNumbers.add(next);
            return next;
        };

        for (const channel of channels) {
            if (!this._shouldAcceptReplacementChannel(channel, nextChannels, nextChannelOrder, logger)) {
                continue;
            }
            const normalizedChannel = cloneChannelForOwnership(channel);
            const isValidNumber =
                typeof normalizedChannel.number === 'number' &&
                Number.isInteger(normalizedChannel.number) &&
                normalizedChannel.number >= MIN_CHANNEL_NUMBER &&
                normalizedChannel.number <= MAX_CHANNEL_NUMBER &&
                !usedNumbers.has(normalizedChannel.number);
            if (isValidNumber) {
                const index = availableNumbers.indexOf(normalizedChannel.number);
                if (index >= 0) {
                    availableNumbers.splice(index, 1);
                }
                usedNumbers.add(normalizedChannel.number);
            } else {
                const fallback = takeNextAvailable();
                if (fallback === null) {
                    logger.warn(`Skipping channel ${channel.name} (${channel.id}) due to number exhaustion`);
                    continue;
                }
                normalizedChannel.number = fallback;
            }
            this.applySeedDefaults(normalizedChannel);
            nextChannels.set(normalizedChannel.id, normalizedChannel);
            nextChannelOrder.push(normalizedChannel.id);
        }

        return { channels: nextChannels, channelOrder: nextChannelOrder };
    }

    updateChannel(
        channel: ChannelConfig,
        updates: ChannelUpdateInput,
        existingChannels: Iterable<ChannelConfig>
    ): ChannelConfig {
        const filteredUpdates = omitUndefinedChannelUpdates(updates);
        if (typeof filteredUpdates.number === 'number' && filteredUpdates.number !== channel.number) {
            this._validateRequestedNumber(filteredUpdates.number, existingChannels);
        }

        const hasContentSourceUpdate = Object.prototype.hasOwnProperty.call(filteredUpdates, 'contentSource');
        const contentSourceUpdate = hasContentSourceUpdate
            ? this._validateContentSource(filteredUpdates.contentSource)
            : undefined;
        const clonedUpdates: ChannelUpdateInput = {
            ...filteredUpdates,
            ...(hasContentSourceUpdate && contentSourceUpdate
                ? { contentSource: cloneContentSource(contentSourceUpdate) }
                : {}),
            ...(filteredUpdates.contentFilters ? { contentFilters: cloneContentFilters(filteredUpdates.contentFilters) } : {}),
        };

        const updated: ChannelConfig = {
            ...channel,
            ...clonedUpdates,
            id: channel.id,
            createdAt: channel.createdAt,
            updatedAt: this._now(),
            lastContentRefresh: channel.lastContentRefresh,
            itemCount: channel.itemCount,
            totalDurationMs: channel.totalDurationMs,
        };

        this._applyOptionalFields(updated, clonedUpdates);
        this.applySeedDefaults(updated);
        return updated;
    }

    getNextAvailableNumber(channels: Iterable<ChannelConfig>): number {
        const existing = Array.from(channels);
        const usedNumbers = new Set<number>();
        for (const channel of existing) {
            usedNumbers.add(channel.number);
        }

        for (let n = MIN_CHANNEL_NUMBER; n <= MAX_CHANNEL_NUMBER; n++) {
            if (!usedNumbers.has(n)) {
                return n;
            }
        }

        return existing.length + 1;
    }

    isChannelNumberInUse(number: number, channels: Iterable<ChannelConfig>): boolean {
        for (const channel of channels) {
            if (channel.number === number) {
                return true;
            }
        }
        return false;
    }

    applySeedDefaults(channel: ChannelConfig): void {
        if (typeof channel.shuffleSeed !== 'number' || !Number.isFinite(channel.shuffleSeed)) {
            channel.shuffleSeed = fnv1a32Uint(`${channel.id}:shuffle`);
        }
        if (typeof channel.phaseSeed !== 'number' || !Number.isFinite(channel.phaseSeed)) {
            channel.phaseSeed = fnv1a32Uint(`${channel.id}:phase`);
        }
    }

    private _applyOptionalFields(channel: ChannelConfig, input: Partial<ChannelCreateInput>): void {
        if (input.description !== undefined) channel.description = input.description;
        if (input.isAutoGenerated !== undefined) channel.isAutoGenerated = input.isAutoGenerated;
        if (input.icon !== undefined) channel.icon = input.icon;
        if (input.color !== undefined) channel.color = input.color;
        if (input.buildStrategy !== undefined) channel.buildStrategy = input.buildStrategy;
        if (input.sourceLibraryId !== undefined) channel.sourceLibraryId = input.sourceLibraryId;
        if (input.sourceLibraryName !== undefined) channel.sourceLibraryName = input.sourceLibraryName;
        if (typeof input.lineupReplicaIndex === 'number' && Number.isFinite(input.lineupReplicaIndex)) {
            channel.lineupReplicaIndex = Math.max(0, Math.floor(input.lineupReplicaIndex));
        }
        if (typeof input.isPlaybackModeVariant === 'boolean') {
            channel.isPlaybackModeVariant = input.isPlaybackModeVariant;
        }
        if (typeof input.shuffleSeed === 'number' && Number.isFinite(input.shuffleSeed)) {
            channel.shuffleSeed = input.shuffleSeed;
        }
        if (typeof input.phaseSeed === 'number' && Number.isFinite(input.phaseSeed)) {
            channel.phaseSeed = input.phaseSeed;
        }
        if (
            channel.playbackMode === 'block'
            && typeof input.blockSize === 'number'
            && Number.isFinite(input.blockSize)
        ) {
            channel.blockSize = Math.max(1, Math.floor(input.blockSize));
        }
        if (input.contentFilters !== undefined) channel.contentFilters = cloneContentFilters(input.contentFilters);
        if (input.sortOrder !== undefined) channel.sortOrder = input.sortOrder;
        if (input.maxEpisodeRunTimeMs !== undefined) channel.maxEpisodeRunTimeMs = input.maxEpisodeRunTimeMs;
        if (input.minEpisodeRunTimeMs !== undefined) channel.minEpisodeRunTimeMs = input.minEpisodeRunTimeMs;
    }

    private _validateContentSource(source: unknown): ChannelContentSource {
        if (!isValidContentSource(source)) {
            throw new ChannelError(
                AppErrorCode.CHANNEL_CONTENT_SOURCE_INVALID,
                CHANNEL_ERROR_MESSAGES.CONTENT_SOURCE_INVALID,
                false
            );
        }
        return source;
    }

    private _validateRequestedNumber(number: number, existingChannels: Iterable<ChannelConfig>): number {
        if (
            !Number.isInteger(number) ||
            number < MIN_CHANNEL_NUMBER ||
            number > MAX_CHANNEL_NUMBER
        ) {
            throw new ChannelError(
                AppErrorCode.INVALID_CHANNEL_NUMBER,
                CHANNEL_ERROR_MESSAGES.INVALID_CHANNEL_NUMBER,
                false
            );
        }
        if (this.isChannelNumberInUse(number, existingChannels)) {
            throw new ChannelError(
                AppErrorCode.DUPLICATE_CHANNEL_NUMBER,
                CHANNEL_ERROR_MESSAGES.DUPLICATE_CHANNEL_NUMBER,
                false
            );
        }
        return number;
    }

    private _shouldAcceptReplacementChannel(
        channel: ChannelConfig,
        nextChannels: Map<string, ChannelConfig>,
        nextChannelOrder: string[],
        logger: ChannelAuthoringLogger
    ): boolean {
        if (!isValidContentSource(channel.contentSource)) {
            logger.warn(`Skipping invalid channel ${channel.name} (${channel.id}) during replaceAllChannels`);
            return false;
        }
        if (nextChannels.has(channel.id)) {
            logger.warn(`Skipping duplicate channel ${channel.name} (${channel.id}) during replaceAllChannels`);
            return false;
        }
        if (nextChannelOrder.length >= MAX_CHANNELS) {
            logger.warn(`Skipping channel ${channel.name} (${channel.id}) due to MAX_CHANNELS limit`);
            return false;
        }
        return true;
    }
}
