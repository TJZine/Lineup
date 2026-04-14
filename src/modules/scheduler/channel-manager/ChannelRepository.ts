import { fnv1a32Uint } from '../../../utils/hash';
import type { SafeLocalStorageWriteResult } from '../../../utils/storage';
import { isValidContentSource } from './ChannelContentSourceValidator';
import { ChannelPersistenceStore } from './ChannelPersistenceStore';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from './constants';
import type { ChannelConfig, StoredChannelData } from './types';

export type LoadedChannelState = {
    data: StoredChannelData;
    didMutate: boolean;
} | null;

export class ChannelRepository {
    private readonly _store: ChannelPersistenceStore;

    constructor(storageKey: string = STORAGE_KEY, currentChannelKey: string = CURRENT_CHANNEL_KEY) {
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

        const normalizedChannels: ChannelConfig[] = [];
        const channelIds = new Set<string>();
        let didMutate = false;

        for (const raw of stored.channels) {
            if (!raw || typeof raw !== 'object') {
                didMutate = true;
                continue;
            }
            const record = raw as unknown as Record<string, unknown>;
            if (Object.prototype.hasOwnProperty.call(record, 'isSequentialVariant')) {
                delete record.isSequentialVariant;
                didMutate = true;
            }
            const channel = record as unknown as ChannelConfig;
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
            normalizedChannels.push(channel);
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
