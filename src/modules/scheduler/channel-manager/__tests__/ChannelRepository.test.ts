import { installMockLocalStorage, mockLocalStorage, resetMockLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { fnv1a32Uint } from '../../../../utils/hash';
import { ChannelPersistenceStore } from '../persistence/ChannelPersistenceStore';
import { ChannelRepository, type LoadedChannelState } from '../persistence/ChannelRepository';
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
): Extract<LoadedChannelState, { kind: 'readable' }> {
    const normalized = repository.loadNormalized();
    expect(normalized.kind).toBe('readable');
    return normalized as Extract<LoadedChannelState, { kind: 'readable' }>;
}

describe('ChannelRepository', () => {
    beforeEach(() => {
        resetMockLocalStorage();
        jest.restoreAllMocks();
    });

    it('returns null and does not read current-channel key when payload missing', () => {
        const repo = new ChannelRepository();
        const readCurrentSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readCurrentChannelId');

        expect(repo.loadNormalized()).toEqual({ kind: 'absent' });
        expect(readCurrentSpy).not.toHaveBeenCalled();
    });

    it('returns null and does not read current-channel key when payload is invalid', () => {
        const repo = new ChannelRepository();
        const readCurrentSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readCurrentChannelId');
        mockLocalStorage.setItem(STORAGE_KEY, '{bad-json');
        mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, 'channel-1');

        expect(repo.loadNormalized()).toEqual({ kind: 'unreadable', raw: '{bad-json' });
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
            kind: 'readable',
            data: payload,
            didMutate: false,
        });
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(readCurrentSpy).toHaveBeenCalledTimes(1);
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

    it('blocks number exhaustion without dropping or rewriting saved channels', () => {
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

        const raw = JSON.stringify(payload);
        mockLocalStorage.setItem(STORAGE_KEY, raw);
        expect(repo.loadNormalized()).toEqual({ kind: 'unreadable', raw });
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(raw);
        expect(logger.warn).toHaveBeenCalledWith(
            'Blocking persisted lineup because channel numbers cannot be normalized without loss'
        );
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
        jest.spyOn(ChannelPersistenceStore.prototype, 'readStoredChannelData').mockReturnValue({ kind: 'readable', data: payload, raw: JSON.stringify(payload) });
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

        expect(repo.loadNormalized()).toEqual({ kind: 'read-failed' });
        expect(getItemSpy).toHaveBeenCalled();
    });

    it('preserves duplicate-id payloads as unreadable instead of dropping authored records', () => {
        const repo = new ChannelRepository();
        const payload = { channels: [createStoredChannel(), createStoredChannel({ number: 2 })],
            channelOrder: ['channel-1'], currentChannelId: null, savedAt: 1 };
        const raw = JSON.stringify(payload);
        mockLocalStorage.setItem(STORAGE_KEY, raw);
        expect(repo.loadNormalized()).toEqual({ kind: 'unreadable', raw });
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(raw);
    });

});
