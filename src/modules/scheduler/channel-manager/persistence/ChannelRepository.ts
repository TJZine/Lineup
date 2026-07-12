import type { SafeLocalStorageMutationResult } from '../../../../utils/storage';
import { ChannelPersistenceStore } from './ChannelPersistenceStore';
import { decodeStoredChannelConfigRecord } from './StoredChannelDataCodec';
import {
    CURRENT_CHANNEL_KEY,
    MAX_CHANNEL_NUMBER,
    MIN_CHANNEL_NUMBER,
    STORAGE_KEY,
} from '../constants';
import type { ChannelConfig, StoredChannelData } from '../contracts/types';

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
        const storedChannelOrder = stored.channelOrder;

        const savedCurrentChannelId = this._store.readCurrentChannelId();
        const savedAt =
            typeof stored.savedAt === 'number' && Number.isFinite(stored.savedAt) ? stored.savedAt : Date.now();

        const dataCurrentChannelId =
            typeof stored.currentChannelId === 'string' ? stored.currentChannelId : null;

        const channelCandidatesById = new Map<string, ChannelConfig>();
        let didMutate = false;

        for (const raw of stored.channels) {
            const decoded = decodeStoredChannelConfigRecord(raw);
            if (decoded === null) {
                didMutate = true;
                continue;
            }
            if (decoded.didMutate) {
                didMutate = true;
            }
            if (channelCandidatesById.has(decoded.channel.id)) {
                didMutate = true;
            }
            channelCandidatesById.set(decoded.channel.id, decoded.channel);
        }

        const channelNumberNormalization = normalizeChannelNumbers(
            [...channelCandidatesById.values()],
            this._logger
        );
        if (channelNumberNormalization.didMutate) {
            didMutate = true;
        }
        const normalizedChannels = channelNumberNormalization.channels;
        const channelIds = new Set<string>();
        for (const channel of normalizedChannels) {
            channelIds.add(channel.id);
        }

        const channelOrder: string[] = [];
        const orderedChannelIds = new Set<string>();
        for (const id of storedChannelOrder) {
            if (
                typeof id === 'string' &&
                channelIds.has(id) &&
                !orderedChannelIds.has(id)
            ) {
                channelOrder.push(id);
                orderedChannelIds.add(id);
            }
        }

        const omittedChannels = normalizedChannels
            .filter((channel) => !orderedChannelIds.has(channel.id))
            .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
        for (const channel of omittedChannels) {
            channelOrder.push(channel.id);
        }

        if (
            channelOrder.length !== storedChannelOrder.length ||
            channelOrder.some((id, index) => id !== storedChannelOrder[index])
        ) {
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

    saveStoredChannelData(data: StoredChannelData): SafeLocalStorageMutationResult {
        return this._store.writeStoredChannelData(data);
    }

    saveCurrentChannelId(channelId: string): SafeLocalStorageMutationResult {
        return this._store.writeCurrentChannelId(channelId);
    }
}
