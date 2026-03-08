import { installMockLocalStorage, mockLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { fnv1a32Uint } from '../../../../utils/hash';
import { ChannelPersistenceStore } from '../ChannelPersistenceStore';
import { ChannelRepository } from '../ChannelRepository';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from '../constants';
import type { StoredChannelData } from '../types';

installMockLocalStorage();

type StoredChannelRecord = NonNullable<StoredChannelData['channels']>[number];

function createStoredChannel(overrides: Record<string, unknown> = {}): StoredChannelRecord {
    return {
        id: 'channel-1',
        number: 1,
        name: 'Channel 1',
        contentSource: {
            type: 'library',
            libraryId: 'library-1',
            libraryType: 'movie',
            includeWatched: true,
        },
        playbackMode: 'shuffle',
        shuffleSeed: 1,
        phaseSeed: 2,
        startTimeAnchor: 0,
        skipIntros: false,
        skipCredits: false,
        createdAt: 0,
        updatedAt: 0,
        lastContentRefresh: 0,
        itemCount: 0,
        totalDurationMs: 0,
        ...overrides,
    } as StoredChannelRecord;
}

function loadNormalized(
    repository: ChannelRepository
): NonNullable<ReturnType<ChannelRepository['loadNormalized']>> {
    const normalized = repository.loadNormalized();
    expect(normalized).not.toBeNull();
    return normalized as NonNullable<ReturnType<ChannelRepository['loadNormalized']>>;
}

describe('ChannelRepository', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        jest.restoreAllMocks();
    });

    it('returns null and does not read current-channel key when payload missing', () => {
        const repo = new ChannelRepository();
        const readCurrentSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readCurrentChannelId');

        expect(repo.loadNormalized()).toBeNull();
        expect(readCurrentSpy).not.toHaveBeenCalled();
    });

    it('returns null and does not read current-channel key when payload is invalid', () => {
        const repo = new ChannelRepository();
        const readCurrentSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readCurrentChannelId');
        mockLocalStorage.setItem(STORAGE_KEY, '{bad-json');
        mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, 'channel-1');

        expect(repo.loadNormalized()).toBeNull();
        expect(readCurrentSpy).not.toHaveBeenCalled();
    });

    it('reads stored payload and current-channel value together', () => {
        const repo = new ChannelRepository();
        const now = Date.now();
        const payload = {
            channels: [createStoredChannel()],
            channelOrder: ['channel-1'],
            currentChannelId: 'channel-1',
            savedAt: now,
        } satisfies Partial<StoredChannelData>;
        const loadSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readStoredChannelData');
        const readCurrentSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readCurrentChannelId');
        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, 'channel-1');

        const normalized = loadNormalized(repo);
        expect(normalized).toEqual({
            data: payload,
            didMutate: false,
        });
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(readCurrentSpy).toHaveBeenCalledTimes(1);
    });

    it('drops non-object channel records during normalized load', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [null, 'bad', 123, createStoredChannel()],
            channelOrder: ['channel-1'],
            currentChannelId: 'channel-1',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channels).toHaveLength(1);
        expect(normalized.didMutate).toBe(true);
    });

    it('drops channels with invalid ids during normalized load', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: '' }),
                createStoredChannel({ id: 'channel-2' }),
            ],
            channelOrder: ['channel-1', 'channel-2'],
            currentChannelId: 'channel-2',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channels).toHaveLength(1);
        expect(normalized.data.channels[0]?.id).toBe('channel-2');
        expect(normalized.didMutate).toBe(true);
    });

    it('fills missing shuffle and phase seeds deterministically', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({
                    id: 'seeded',
                    shuffleSeed: null,
                    phaseSeed: undefined,
                }),
            ],
            channelOrder: ['seeded'],
            currentChannelId: 'seeded',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channels[0]?.shuffleSeed).toBe(fnv1a32Uint('seeded:shuffle'));
        expect(normalized.data.channels[0]?.phaseSeed).toBe(fnv1a32Uint('seeded:phase'));
        expect(normalized.didMutate).toBe(true);
    });

    it('prunes invalid content sources during normalized load', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: 'bad-source', contentSource: { type: 'library', libraryId: '' } }),
                createStoredChannel({ id: 'good-source' }),
            ],
            channelOrder: ['bad-source', 'good-source'],
            currentChannelId: 'bad-source',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channels).toHaveLength(1);
        expect(normalized.data.channels[0]?.id).toBe('good-source');
        expect(normalized.didMutate).toBe(true);
    });

    it('filters channelOrder entries that no longer exist', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [createStoredChannel(), createStoredChannel({ id: 'channel-2', number: 2 })],
            channelOrder: ['channel-1', 'missing', 'channel-2', 123],
            currentChannelId: 'channel-1',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channelOrder).toEqual(['channel-1', 'channel-2']);
        expect(normalized.didMutate).toBe(true);
    });

    it('rebuilds stable order when persisted order is empty', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: 'channel-2', number: 2 }),
                createStoredChannel({ id: 'channel-1', number: 1 }),
            ],
            channelOrder: [],
            currentChannelId: 'channel-1',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channelOrder).toEqual(['channel-1', 'channel-2']);
        expect(normalized.didMutate).toBe(true);
    });

    it('coerces invalid savedAt without marking mutation', () => {
        const repo = new ChannelRepository();
        jest.spyOn(Date, 'now').mockReturnValue(1_234_567);
        const payload = {
            channels: [createStoredChannel()],
            channelOrder: ['channel-1'],
            currentChannelId: 'channel-1',
            savedAt: Infinity,
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.savedAt).toBe(1_234_567);
        expect(normalized.didMutate).toBe(false);
    });

    it('coerces non-string currentChannelId to null without marking mutation', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [createStoredChannel()],
            channelOrder: ['channel-1'],
            currentChannelId: { bad: 'channel-id' },
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.currentChannelId).toBeNull();
        expect(normalized.didMutate).toBe(false);
    });

    it('uses saved current-channel key only if it points at an existing channel', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [createStoredChannel()],
            channelOrder: ['channel-1'],
            currentChannelId: 'other-channel',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, 'channel-1');

        const normalized = loadNormalized(repo);

        expect(normalized.data.currentChannelId).toBe('channel-1');
        expect(normalized.didMutate).toBe(false);
    });

    it('falls back to first channel if stored currentChannelId is invalid', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel(),
                createStoredChannel({ id: 'channel-2', number: 2 }),
            ],
            channelOrder: ['channel-2', 'channel-1'],
            currentChannelId: 'missing-channel',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.currentChannelId).toBe('channel-2');
        expect(normalized.didMutate).toBe(true);
    });

    it('does not invent a current-channel fallback when currentChannelId is null', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [createStoredChannel(), createStoredChannel({ id: 'channel-2', number: 2 })],
            channelOrder: ['channel-2', 'channel-1'],
            currentChannelId: null,
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.currentChannelId).toBeNull();
        expect(normalized.didMutate).toBe(false);
    });

    it('saveStoredChannelData delegates to store writer', () => {
        const repo = new ChannelRepository();
        const delegate = jest.spyOn(ChannelPersistenceStore.prototype, 'writeStoredChannelData').mockReturnValue('ok');
        const data = {
            channels: [],
            channelOrder: [],
            currentChannelId: null,
            savedAt: Date.now(),
        } as StoredChannelData;

        expect(repo.saveStoredChannelData(data)).toBe('ok');
        expect(delegate).toHaveBeenCalledWith(data);
    });

    it('saveCurrentChannelId delegates to store writer', () => {
        const repo = new ChannelRepository();
        const delegate = jest.spyOn(ChannelPersistenceStore.prototype, 'writeCurrentChannelId').mockReturnValue('ok');

        expect(repo.saveCurrentChannelId('channel-1')).toBe('ok');
        expect(delegate).toHaveBeenCalledWith('channel-1');
    });

    it('treats blocked storage on load through the underlying helper as non-fatal', () => {
        const repo = new ChannelRepository();
        jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => repo.loadNormalized()).not.toThrow();
    });
});
