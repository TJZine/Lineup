import { fnv1a32Uint } from '../../../utils/hash';
import type { SafeLocalStorageWriteResult } from '../../../utils/storage';
import { isValidContentSource } from './ChannelContentSourceValidator';
import { ChannelPersistenceStore } from './ChannelPersistenceStore';
import {
    CURRENT_CHANNEL_KEY,
    MAX_CHANNEL_NUMBER,
    MIN_CHANNEL_NUMBER,
    STORAGE_KEY,
} from './constants';
import { stripLegacySequentialVariant } from './stripLegacySequentialVariant';
import type { ChannelConfig, StoredChannelData } from './types';

export type LoadedChannelState = {
    data: StoredChannelData;
    didMutate: boolean;
} | null;

type ChannelRepositoryLogger = {
    warn: (message: string, ...args: unknown[]) => void;
};

function isValidChannelNumber(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= MIN_CHANNEL_NUMBER &&
        value <= MAX_CHANNEL_NUMBER
    );
}

function normalizeChannelNumbers(
    channels: ChannelConfig[],
    logger?: ChannelRepositoryLogger
): { channels: ChannelConfig[]; didMutate: boolean } {
    const reservedNumbers = new Set<number>();
    for (const channel of channels) {
        const number = (channel as { number?: unknown }).number;
        if (isValidChannelNumber(number)) {
            reservedNumbers.add(number);
        }
    }

    let didMutate = false;
    const seenValidNumbers = new Set<number>();
    const normalizedChannels: ChannelConfig[] = [];

    const takeNextAvailableNumber = (): number | null => {
        for (let n = MIN_CHANNEL_NUMBER; n <= MAX_CHANNEL_NUMBER; n++) {
            if (!reservedNumbers.has(n)) {
                reservedNumbers.add(n);
                return n;
            }
        }
        return null;
    };

    for (const channel of channels) {
        const number = (channel as { number?: unknown }).number;
        if (isValidChannelNumber(number) && !seenValidNumbers.has(number)) {
            seenValidNumbers.add(number);
            normalizedChannels.push(channel);
            continue;
        }

        const fallbackNumber = takeNextAvailableNumber();
        if (fallbackNumber === null) {
            didMutate = true;
            logger?.warn('Dropping persisted channel during normalized load due to number exhaustion', {
                channelId: typeof channel.id === 'string' ? channel.id : null,
            });
            continue;
        }

        didMutate = true;
        normalizedChannels.push({
            ...channel,
            number: fallbackNumber,
        });
    }

    return { channels: normalizedChannels, didMutate };
}

export class ChannelRepository {
    private readonly _store: ChannelPersistenceStore;

    constructor(
        storageKey: string = STORAGE_KEY,
        currentChannelKey: string = CURRENT_CHANNEL_KEY,
        private readonly _logger?: ChannelRepositoryLogger
    ) {
        this._store = new ChannelPersistenceStore(storageKey, currentChannelKey);
    }

    setStorageKeys(storageKey: string, currentChannelKey: string): void {
        this._store.setStorageKeys(storageKey, currentChannelKey);
    }

    loadNormalized(): LoadedChannelState {
        const stored = this._store.readStoredChannelData();
        if (stored === null) {
            return null;
        }

        if (!Array.isArray(stored.channels) || !Array.isArray(stored.channelOrder)) {
            return null;
        }

        const savedCurrentChannelId = this._store.readCurrentChannelId();
        const savedAt =
            typeof stored.savedAt === 'number' && Number.isFinite(stored.savedAt) ? stored.savedAt : Date.now();

        const dataCurrentChannelId =
            typeof stored.currentChannelId === 'string' ? stored.currentChannelId : null;

        const channelCandidates: ChannelConfig[] = [];
        let didMutate = false;

        for (const raw of stored.channels) {
            if (!raw || typeof raw !== 'object') {
                didMutate = true;
                continue;
            }
            const sanitized = stripLegacySequentialVariant(raw);
            if (sanitized.didMutate) {
                didMutate = true;
            }
            const channel = sanitized.channel as ChannelConfig;
            if (typeof channel.id !== 'string' || channel.id.length === 0) {
                didMutate = true;
                continue;
            }
            if (
                typeof channel.shuffleSeed !== 'number' ||
                !Number.isFinite(channel.shuffleSeed)
            ) {
                channel.shuffleSeed = fnv1a32Uint(`${channel.id}:shuffle`);
                didMutate = true;
            }
            if (typeof channel.phaseSeed !== 'number' || !Number.isFinite(channel.phaseSeed)) {
                channel.phaseSeed = fnv1a32Uint(`${channel.id}:phase`);
                didMutate = true;
            }
            if (!isValidContentSource(channel.contentSource)) {
                didMutate = true;
                continue;
            }
            channelCandidates.push(channel);
        }

        const channelNumberNormalization = normalizeChannelNumbers(channelCandidates, this._logger);
        if (channelNumberNormalization.didMutate) {
            didMutate = true;
        }
        const normalizedChannels = channelNumberNormalization.channels;
        const channelIds = new Set<string>();
        for (const channel of normalizedChannels) {
            channelIds.add(channel.id);
        }

        const normalizedOrder = stored.channelOrder.filter((id) => {
            if (typeof id !== 'string') {
                return false;
            }
            return channelIds.has(id);
        });
        if (normalizedOrder.length !== stored.channelOrder.length) {
            didMutate = true;
        }

        let channelOrder = normalizedOrder;
        if (channelOrder.length === 0 && normalizedChannels.length > 0) {
            channelOrder = [...normalizedChannels]
                .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
                .map((channel) => channel.id);
            didMutate = true;
        }

        let currentChannelId = dataCurrentChannelId;
        if (savedCurrentChannelId !== null && channelIds.has(savedCurrentChannelId)) {
            currentChannelId = savedCurrentChannelId;
        } else if (
            typeof dataCurrentChannelId === 'string' &&
            !channelIds.has(dataCurrentChannelId)
        ) {
            currentChannelId = channelOrder[0] ?? null;
            didMutate = true;
        }

        return {
            data: {
                channels: normalizedChannels,
                channelOrder,
                currentChannelId,
                savedAt,
            },
            didMutate,
        };
    }

    saveStoredChannelData(data: StoredChannelData): SafeLocalStorageWriteResult {
        return this._store.writeStoredChannelData(data);
    }

    saveCurrentChannelId(channelId: string): SafeLocalStorageWriteResult {
        return this._store.writeCurrentChannelId(channelId);
    }
}
