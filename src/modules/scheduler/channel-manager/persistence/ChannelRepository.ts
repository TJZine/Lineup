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

export type LoadedChannelState =
    | { kind: 'absent' | 'read-failed' }
    | { kind: 'unreadable' | 'unsupported'; raw: string }
    | { kind: 'readable'; data: StoredChannelData; didMutate: boolean };

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
    channels: ChannelConfig[]
): { channels: ChannelConfig[]; didMutate: boolean } | null {
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
            return null;
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
        if (stored.kind !== 'readable') return stored;
        const body = stored.data;

        if (!Array.isArray(body.channels) || !Array.isArray(body.channelOrder)) {
            return { kind: 'unreadable', raw: stored.raw };
        }
        if (body.channels.length === 0 && body.channelOrder.length !== 0) {
            return { kind: 'unreadable', raw: stored.raw };
        }
        const storedChannelOrder = body.channelOrder;

        const savedCurrentChannelId = this._store.readCurrentChannelId();
        const savedAt =
            typeof body.savedAt === 'number' && Number.isFinite(body.savedAt) ? body.savedAt : Date.now();

        const dataCurrentChannelId =
            typeof body.currentChannelId === 'string' ? body.currentChannelId : null;

        const channelCandidatesById = new Map<string, ChannelConfig>();
        let didMutate = false;

        for (const raw of body.channels) {
            const decoded = decodeStoredChannelConfigRecord(raw);
            if (decoded === null) {
                return { kind: 'unreadable', raw: stored.raw };
            }
            if (decoded.didMutate) {
                didMutate = true;
            }
            if (channelCandidatesById.has(decoded.channel.id)) {
                return { kind: 'unreadable', raw: stored.raw };
            }
            channelCandidatesById.set(decoded.channel.id, decoded.channel);
        }

        const channelNumberNormalization = normalizeChannelNumbers([...channelCandidatesById.values()]);
        if (channelNumberNormalization === null) {
            this._logger?.warn('Blocking persisted lineup because channel numbers cannot be normalized without loss');
            return { kind: 'unreadable', raw: stored.raw };
        }
        if (channelNumberNormalization.didMutate) {
            didMutate = true;
        }
        const normalizedChannels = channelNumberNormalization.channels;
        if (body.channels.length > 0 && normalizedChannels.length === 0) {
            return { kind: 'unreadable', raw: stored.raw };
        }
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
            kind: 'readable',
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

    readRawBody(): { ok: true; value: string | null } | { ok: false } {
        return this._store.readRawBody();
    }
}
