import { installMockLocalStorage, mockLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { fnv1a32Uint } from '../../../../utils/hash';
import { ChannelPersistenceStore } from '../persistence/ChannelPersistenceStore';
import { ChannelRepository } from '../persistence/ChannelRepository';
import { CURRENT_CHANNEL_KEY, MAX_CHANNEL_NUMBER, STORAGE_KEY } from '../constants';
import type { StoredChannelData } from '../contracts/types';

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

    it('default-constructs persisted channel records before returning runtime channel data', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                {
                    id: 'minimal-persisted',
                    number: 12,
                    contentSource: {
                        type: 'library',
                        libraryId: 'library-1',
                        libraryType: 'movie',
                        includeWatched: true,
                    },
                    playbackMode: 'unsupported-mode',
                    createdAt: 'bad',
                    updatedAt: 4,
                    lastContentRefresh: null,
                    itemCount: undefined,
                    totalDurationMs: 0,
                    skipIntros: 'bad',
                    skipCredits: undefined,
                    strayField: 'removed',
                },
            ],
            channelOrder: ['minimal-persisted'],
            currentChannelId: 'minimal-persisted',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);
        const channel = normalized.data.channels[0] as unknown as Record<string, unknown>;

        expect(channel).toEqual(expect.objectContaining({
            id: 'minimal-persisted',
            number: 12,
            name: 'Channel 12',
            playbackMode: 'sequential',
            skipIntros: false,
            skipCredits: false,
            createdAt: 0,
            updatedAt: 4,
            lastContentRefresh: 0,
            itemCount: 0,
            totalDurationMs: 0,
            shuffleSeed: fnv1a32Uint('minimal-persisted:shuffle'),
            phaseSeed: fnv1a32Uint('minimal-persisted:phase'),
        }));
        expect(channel.strayField).toBeUndefined();
        expect(normalized.didMutate).toBe(true);
    });

    it('keeps one canonical channel per id with the last decoded record in the first id position', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: 'duplicate', number: 2, name: 'Earlier value' }),
                createStoredChannel({ id: 'other', number: 1, name: 'Other channel' }),
                createStoredChannel({ id: 'duplicate', number: 3, name: 'Winning value' }),
            ],
            channelOrder: ['duplicate', 'other'],
            currentChannelId: 'duplicate',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(
            normalized.data.channels.map((channel) => ({
                id: channel.id,
                name: channel.name,
                number: channel.number,
            }))
        ).toEqual([
            { id: 'duplicate', name: 'Winning value', number: 3 },
            { id: 'other', name: 'Other channel', number: 1 },
        ]);
        expect(normalized.didMutate).toBe(true);
    });

    it('does not replace a valid channel with a later invalid record using the same id', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: 'duplicate', name: 'Valid value' }),
                createStoredChannel({
                    id: 'duplicate',
                    name: 'Invalid value',
                    contentSource: { type: 'library', libraryId: '' },
                }),
            ],
            channelOrder: ['duplicate'],
            currentChannelId: 'duplicate',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channels).toHaveLength(1);
        expect(normalized.data.channels[0]?.name).toBe('Valid value');
        expect(normalized.didMutate).toBe(true);
    });

    it('normalizes invalid and duplicate persisted channel numbers', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: 'fractional', number: 7.5 }),
                createStoredChannel({ id: 'valid-one', number: 1 }),
                createStoredChannel({ id: 'too-high', number: 501 }),
                createStoredChannel({ id: 'duplicate-one', number: 1 }),
            ],
            channelOrder: ['fractional', 'valid-one', 'too-high', 'duplicate-one'],
            currentChannelId: 'valid-one',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(
            normalized.data.channels.map((channel) => ({
                id: channel.id,
                number: channel.number,
            }))
        ).toEqual([
            { id: 'fractional', number: 2 },
            { id: 'valid-one', number: 1 },
            { id: 'too-high', number: 3 },
            { id: 'duplicate-one', number: 4 },
        ]);
        expect(normalized.didMutate).toBe(true);
    });

    it('assigns the next available number when a persisted channel number is missing', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: 'valid-one', number: 1 }),
                createStoredChannel({ id: 'missing-number', number: undefined }),
            ],
            channelOrder: ['valid-one', 'missing-number'],
            currentChannelId: 'valid-one',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(
            normalized.data.channels.map((channel) => ({
                id: channel.id,
                number: channel.number,
            }))
        ).toEqual([
            { id: 'valid-one', number: 1 },
            { id: 'missing-number', number: 2 },
        ]);
        expect(normalized.didMutate).toBe(true);
    });

    it('logs when number exhaustion drops persisted channels during normalized load', () => {
        const logger = { warn: jest.fn() };
        const repo = new ChannelRepository(STORAGE_KEY, CURRENT_CHANNEL_KEY, logger);
        const channels = Array.from({ length: MAX_CHANNEL_NUMBER }, (_value, index) =>
            createStoredChannel({
                id: `channel-${index + 1}`,
                number: index + 1,
            })
        );
        const payload = {
            channels: [
                ...channels,
                createStoredChannel({ id: 'overflow', number: undefined }),
            ],
            channelOrder: [
                ...channels.map((channel) => channel.id),
                'overflow',
            ],
            currentChannelId: 'channel-1',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channels).toHaveLength(MAX_CHANNEL_NUMBER);
        expect(normalized.data.channels.some((channel) => channel.id === 'overflow')).toBe(false);
        expect(normalized.data.channelOrder).not.toContain('overflow');
        expect(normalized.didMutate).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(
            'Dropping persisted channel during normalized load due to number exhaustion',
            { channelId: 'overflow' }
        );
    });

    it('strips legacy isSequentialVariant during normalized load without creating canonical playback variant', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({
                    id: 'variant-channel',
                    isSequentialVariant: true,
                }),
            ],
            channelOrder: ['variant-channel'],
            currentChannelId: 'variant-channel',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);
        const channel = normalized.data.channels[0] as unknown as Record<string, unknown>;

        expect(channel.isPlaybackModeVariant).toBeUndefined();
        expect(channel).not.toHaveProperty('isSequentialVariant');
        expect(normalized.didMutate).toBe(true);
    });

    it('preserves canonical isPlaybackModeVariant while stripping legacy-field residue', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({
                    id: 'mixed-version-channel',
                    isSequentialVariant: true,
                    isPlaybackModeVariant: false,
                }),
            ],
            channelOrder: ['mixed-version-channel'],
            currentChannelId: 'mixed-version-channel',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);
        const channel = normalized.data.channels[0] as unknown as Record<string, unknown>;

        expect(channel.isPlaybackModeVariant).toBe(false);
        expect(channel).not.toHaveProperty('isSequentialVariant');
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

    it('keeps only the first occurrence of duplicate order ids', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [createStoredChannel(), createStoredChannel({ id: 'channel-2', number: 2 })],
            channelOrder: ['channel-2', 'channel-2', 'channel-1'],
            currentChannelId: 'channel-2',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channelOrder).toEqual(['channel-2', 'channel-1']);
        expect(normalized.didMutate).toBe(true);
    });

    it('appends channels omitted from a partial order by channel number and preserves current id', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: 'channel-3', number: 3 }),
                createStoredChannel({ id: 'channel-1', number: 1 }),
                createStoredChannel({ id: 'channel-2', number: 2 }),
            ],
            channelOrder: ['channel-3'],
            currentChannelId: 'channel-2',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channelOrder).toEqual(['channel-3', 'channel-1', 'channel-2']);
        expect(normalized.data.currentChannelId).toBe('channel-2');
        expect(normalized.didMutate).toBe(true);
    });

    it('repairs mixed unknown, non-string, duplicate, and omitted order entries exactly once', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [
                createStoredChannel({ id: 'channel-3', number: 3 }),
                createStoredChannel({ id: 'channel-1', number: 1 }),
                createStoredChannel({ id: 'channel-2', number: 2 }),
            ],
            channelOrder: ['unknown', 123, 'channel-3', 'channel-3'],
            currentChannelId: 'channel-3',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data.channelOrder).toEqual(['channel-3', 'channel-1', 'channel-2']);
        expect(new Set(normalized.data.channelOrder).size).toBe(3);
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

    it('keeps empty channels and order unchanged', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [],
            channelOrder: [],
            currentChannelId: null,
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);

        expect(normalized.data).toEqual(payload);
        expect(normalized.didMutate).toBe(false);
    });

    it('deduplicates before number repair so discarded records cannot cause false exhaustion', () => {
        const repo = new ChannelRepository();
        const numberedChannels = Array.from({ length: MAX_CHANNEL_NUMBER - 1 }, (_value, index) =>
            createStoredChannel({
                id: `channel-${index + 1}`,
                number: index + 1,
            })
        );
        const payload = {
            channels: [
                ...numberedChannels,
                createStoredChannel({ id: 'duplicate', number: MAX_CHANNEL_NUMBER }),
                createStoredChannel({ id: 'duplicate', number: undefined, name: 'Winning value' }),
            ],
            channelOrder: [
                ...numberedChannels.map((channel) => channel.id),
                'duplicate',
            ],
            currentChannelId: 'duplicate',
            savedAt: Date.now(),
        };

        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const normalized = loadNormalized(repo);
        const duplicate = normalized.data.channels.find((channel) => channel.id === 'duplicate');

        expect(normalized.data.channels).toHaveLength(MAX_CHANNEL_NUMBER);
        expect(duplicate).toEqual(expect.objectContaining({
            name: 'Winning value',
            number: MAX_CHANNEL_NUMBER,
        }));
        expect(normalized.data.channelOrder).toHaveLength(MAX_CHANNEL_NUMBER);
        expect(normalized.data.channelOrder.at(-1)).toBe('duplicate');
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

        // JSON cannot represent Infinity (it would stringify to null). This test mocks the store
        // boundary directly to ensure ChannelRepository keeps the Number.isFinite guard.
        jest.spyOn(ChannelPersistenceStore.prototype, 'readStoredChannelData').mockReturnValue(payload);
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
        const delegate = jest
            .spyOn(ChannelPersistenceStore.prototype, 'writeStoredChannelData')
            .mockReturnValue({ ok: true });
        const data = {
            channels: [],
            channelOrder: [],
            currentChannelId: null,
            savedAt: Date.now(),
        } as StoredChannelData;

        expect(repo.saveStoredChannelData(data)).toEqual({ ok: true });
        expect(delegate).toHaveBeenCalledWith(data);
    });

    it('saveCurrentChannelId delegates to store writer', () => {
        const repo = new ChannelRepository();
        const delegate = jest
            .spyOn(ChannelPersistenceStore.prototype, 'writeCurrentChannelId')
            .mockReturnValue({ ok: true });

        expect(repo.saveCurrentChannelId('channel-1')).toEqual({ ok: true });
        expect(delegate).toHaveBeenCalledWith('channel-1');
    });

    it('treats blocked storage on load through the underlying helper as non-fatal', () => {
        const repo = new ChannelRepository();
        const getItemSpy = jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(repo.loadNormalized()).toBeNull();
        expect(getItemSpy).toHaveBeenCalled();
    });
});
