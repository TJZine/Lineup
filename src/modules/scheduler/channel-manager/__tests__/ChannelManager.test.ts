/**
 * @fileoverview Unit tests for ChannelManager.
 * @module modules/scheduler/channel-manager/__tests__/ChannelManager.test
 */

import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../ChannelRepository';
import { ContentResolver } from '../ContentResolver';
import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../interfaces';
import type {
    ChannelConfig,
    ChannelCreateInput,
    ChannelUpdateInput,
    LibraryContentSource,
} from '../types';
import { AppErrorCode } from '../../../lifecycle/types';
import { STORAGE_CONFIG } from '../../../lifecycle/constants';
import { expectConsoleWarn } from '../../../../__tests__/helpers';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import {
    STORAGE_KEY,
    CURRENT_CHANNEL_KEY,
    CACHE_TTL_MS,
    MAX_CHANNELS,
} from '../constants';

// ============================================
// Mock Setup
// ============================================

function createMockLibrary(): jest.Mocked<IPlexLibraryMinimal> {
    return {
        getLibraryItems: jest.fn(),
        getCollectionItems: jest.fn(),
        getShowEpisodes: jest.fn(),
        getPlaylistItems: jest.fn(),
        getItem: jest.fn(),
    };
}

function createMockItem(overrides: Partial<PlexMediaItemMinimal> = {}): PlexMediaItemMinimal {
    return {
        ratingKey: '1',
        type: 'movie',
        title: 'Test Movie',
        year: 2020,
        durationMs: 7200000,
        thumb: '/thumb/1',
        addedAt: new Date(),
        ...overrides,
    };
}

function createMockContentSource(): LibraryContentSource {
    return {
        type: 'library',
        libraryId: 'lib1',
        libraryType: 'movie',
        includeWatched: true,
    };
}

function createBaseChannel(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
    return {
        id: 'base',
        number: 1,
        name: 'Base Channel',
        contentSource: createMockContentSource(),
        playbackMode: 'shuffle',
        shuffleSeed: 1,
        phaseSeed: 1,
        startTimeAnchor: 0,
        skipIntros: false,
        skipCredits: false,
        createdAt: 0,
        updatedAt: 0,
        lastContentRefresh: 0,
        itemCount: 0,
        totalDurationMs: 0,
        ...overrides,
    };
}

installMockLocalStorage();

const expectPersistCurrentChannelWarning = (times: number = 1): void => {
    expectConsoleWarn([
        'Failed to persist current channel',
        expect.objectContaining({
            name: 'ChannelError',
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
        }),
    ], { times });
};

const expectDebouncedSaveQuotaWarning = (times: number = 1): void => {
    expectConsoleWarn([
        'Debounced save failed (quota)',
        expect.objectContaining({
            name: 'ChannelError',
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
        }),
    ], { times });
};

// ============================================
// Tests
// ============================================

describe('ChannelManager', () => {
    let mockLibrary: jest.Mocked<IPlexLibraryMinimal>;
    let manager: ChannelManager;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        resetMockLocalStorage();

        mockLibrary = createMockLibrary();
        mockLibrary.getLibraryItems.mockResolvedValue([
            createMockItem({ ratingKey: '1' }),
            createMockItem({ ratingKey: '2' }),
        ]);

        manager = new ChannelManager({ plexLibrary: mockLibrary });
    });

    afterEach(async () => {
        if (manager) {
            await manager.flushSaves().catch(() => undefined);
        }
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    describe('CRUD operations', () => {
        it('should create channel with generated ID and number', async () => {
            const channel = await manager.createChannel({
                name: 'Test Channel',
                contentSource: createMockContentSource(),
            });

            expect(channel.id).toMatch(/^[a-f0-9-]{36}$/);
            expect(channel.number).toBeGreaterThanOrEqual(1);
            expect(channel.name).toBe('Test Channel');
        });

        it('should persist blockSize and setup-variant metadata when creating channels', async () => {
            const channel = await manager.createChannel({
                name: 'Block Channel',
                contentSource: createMockContentSource(),
                playbackMode: 'block',
                blockSize: 4,
                lineupReplicaIndex: 2,
                isPlaybackModeVariant: true,
            });

            expect(channel.playbackMode).toBe('block');
            expect(channel.blockSize).toBe(4);
            expect(channel.lineupReplicaIndex).toBe(2);
            expect(channel.isPlaybackModeVariant).toBe(true);
        });

        it('should assign next available channel number', async () => {
            await manager.createChannel({
                number: 1,
                contentSource: createMockContentSource(),
            });
            const ch2 = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            expect(ch2.number).toBe(2);
        });

        it('should throw if content source missing', async () => {
            await expect(manager.createChannel({ name: 'Test' } as unknown as ChannelCreateInput)).rejects.toThrow(
                'Content source is required'
            );
        });

        it('should throw on duplicate channel number', async () => {
            await manager.createChannel({
                number: 5,
                contentSource: createMockContentSource(),
            });

            await expect(
                manager.createChannel({
                    number: 5,
                    contentSource: createMockContentSource(),
                })
            ).rejects.toThrow('Channel number already in use');
        });

        it('should throw on invalid channel number', async () => {
            await expect(
                manager.createChannel({
                    number: 0,
                    contentSource: createMockContentSource(),
                })
            ).rejects.toThrow('Channel number must be between 1 and 500');

            await expect(
                manager.createChannel({
                    number: 501,
                    contentSource: createMockContentSource(),
                })
            ).rejects.toThrow('Channel number must be between 1 and 500');
        });

        it('should emit channelCreated event', async () => {
            const handler = jest.fn();
            manager.on('channelCreated', handler);

            await manager.createChannel({ contentSource: createMockContentSource() });

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.any(String),
                    number: expect.any(Number),
                })
            );
        });

        it('should update channel and emit event', async () => {
            const channel = await manager.createChannel({
                name: 'Original',
                contentSource: createMockContentSource(),
            });

            const handler = jest.fn();
            manager.on('channelUpdated', handler);

            const updated = await manager.updateChannel(channel.id, { name: 'Updated' });

            expect(updated.name).toBe('Updated');
            expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }));
        });

        it('ignores runtime-managed fields during updates', async () => {
            const channel = await manager.createChannel({
                name: 'Original',
                contentSource: createMockContentSource(),
            });

            const updated = await manager.updateChannel(channel.id, {
                name: 'Updated',
                id: 'mutated-id',
                createdAt: 123,
                lastContentRefresh: 456,
                itemCount: 789,
                totalDurationMs: 101112,
            } as unknown as ChannelUpdateInput);

            expect(updated.id).toBe(channel.id);
            expect(updated.createdAt).toBe(channel.createdAt);
            expect(updated.lastContentRefresh).toBe(channel.lastContentRefresh);
            expect(updated.itemCount).toBe(channel.itemCount);
            expect(updated.totalDurationMs).toBe(channel.totalDurationMs);
            expect(updated.name).toBe('Updated');
        });

        it('should delete channel and emit event', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            const handler = jest.fn();
            manager.on('channelDeleted', handler);

            await manager.deleteChannel(channel.id);

            expect(manager.getChannel(channel.id)).toBeNull();
            expect(handler).toHaveBeenCalledWith(channel.id);
        });

        it('should find channel by number', async () => {
            await manager.createChannel({
                number: 5,
                name: 'Channel 5',
                contentSource: createMockContentSource(),
            });

            const ch = manager.getChannelByNumber(5);

            expect(ch).not.toBeNull();
            expect(ch!.number).toBe(5);
            expect(ch!.name).toBe('Channel 5');
        });
    });

    describe('replaceAllChannels', () => {
        it('normalizes duplicate and invalid channel numbers in input order', async () => {
            const channels = [
                createBaseChannel({ id: 'c1', number: 1 }),
                createBaseChannel({ id: 'c2', number: 1 }),
                createBaseChannel({ id: 'c3', number: 999 }),
                createBaseChannel({ id: 'c4', number: 2 }),
            ];

            await manager.replaceAllChannels(channels);

            const result = manager.getAllChannels();
            expect(result).toHaveLength(4);
            expect(result[0]!.number).toBe(1);
            expect(result[1]!.number).toBe(2);
            expect(result[2]!.number).toBe(3);
            expect(result[3]!.number).toBe(4);
        });

        it('skips channels over MAX_CHANNELS and warns per skipped channel', async () => {
            const warn = jest.fn();
            manager = new ChannelManager({ plexLibrary: mockLibrary, logger: { warn, error: jest.fn() } });

            const channels = Array.from({ length: MAX_CHANNELS + 2 }, (_, index) => ({
                ...createBaseChannel({ id: `c${index + 1}`, number: index + 1 }),
            }));

            await manager.replaceAllChannels(channels);

            expect(manager.getAllChannels()).toHaveLength(MAX_CHANNELS);
            expect(warn).toHaveBeenCalledTimes(2);
        });

        it('clears resolver source cache when replacing full lineup', async () => {
            const clearCachesSpy = jest.spyOn(ContentResolver.prototype, 'clearCaches');

            await manager.replaceAllChannels([createBaseChannel({ id: 'replace-1', number: 10 })]);

            expect(clearCachesSpy).toHaveBeenCalledTimes(1);
        });

        it('routes replaceAllChannels current-channel persistence through ChannelRepository.saveCurrentChannelId', async () => {
            const writeCurrentSpy = jest.spyOn(ChannelRepository.prototype, 'saveCurrentChannelId');
            const channels = [createBaseChannel({ id: 'replace-1', number: 10 })];

            await manager.replaceAllChannels(channels, { currentChannelId: 'replace-1' });

            expect(writeCurrentSpy).toHaveBeenCalledWith('replace-1');
        });

        it('emits quota-specific persistenceWarning when replaceAllChannels current-channel write hits quota', async () => {
            expectPersistCurrentChannelWarning();
            const warningHandler = jest.fn();
            manager.on('persistenceWarning', warningHandler);
            jest
                .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
                .mockReturnValue({ ok: false, reason: 'quota-exceeded' });

            await manager.replaceAllChannels([createBaseChannel({ id: 'replace-1', number: 10 })], {
                currentChannelId: 'replace-1',
            });

            expect(warningHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                    message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                })
            );
        });
    });

    describe('storage key updates', () => {
        it('clears resolver source cache when ChannelManager storage scope changes', () => {
            const clearCachesSpy = jest.spyOn(ContentResolver.prototype, 'clearCaches');

            manager.setStorageKeys('lineup_channels_new_scope', 'lineup_current_channel_new_scope');

            expect(clearCachesSpy).toHaveBeenCalledTimes(1);
        });

        it('forwards storage key changes to ChannelRepository', () => {
            const setKeysSpy = jest.spyOn(ChannelRepository.prototype, 'setStorageKeys');

            manager.setStorageKeys('lineup_channels_new_scope', 'lineup_current_channel_new_scope');

            expect(setKeysSpy).toHaveBeenCalledWith(
                'lineup_channels_new_scope',
                'lineup_current_channel_new_scope'
            );

            setKeysSpy.mockRestore();
        });

        it('emits persistenceWarning and does not throw when pending save flush fails during key switch', async () => {
            expectConsoleWarn([
                'ChannelManager.setStorageKeys failed while flushing pending saves',
                expect.objectContaining({
                    name: 'ChannelError',
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                }),
            ]);
            const warningHandler = jest.fn();
            manager.on('persistenceWarning', warningHandler);
            await manager.createChannel({ contentSource: createMockContentSource() });

            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('quota', 'QuotaExceededError');
            });

            expect(() =>
                manager.setStorageKeys('lineup_channels_new_scope', 'lineup_current_channel_new_scope')
            ).not.toThrow();
            expect(warningHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                })
            );
        });
    });

    describe('content resolution', () => {
        it('should resolve library content source', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            const result = await manager.resolveChannelContent(channel.id);

            expect(result.items).toHaveLength(2);
            expect(result.channelId).toBe(channel.id);
        });

        it('should resolve collection content source', async () => {
            mockLibrary.getCollectionItems.mockResolvedValue([createMockItem()]);

            const channel = await manager.createChannel({
                contentSource: {
                    type: 'collection',
                    collectionKey: 'col1',
                    collectionName: 'My Collection',
                },
            });

            const result = await manager.resolveChannelContent(channel.id);
            expect(result.items).toHaveLength(1);
        });

        it('should resolve show content source', async () => {
            mockLibrary.getShowEpisodes.mockResolvedValue([
                createMockItem({ ratingKey: 'ep1', type: 'episode' }),
                createMockItem({ ratingKey: 'ep2', type: 'episode' }),
                createMockItem({ ratingKey: 'ep3', type: 'episode' }),
            ]);

            const channel = await manager.createChannel({
                contentSource: {
                    type: 'show',
                    showKey: 'show1',
                    showName: 'Test Show',
                },
            });

            const result = await manager.resolveChannelContent(channel.id);
            expect(result.items).toHaveLength(3);
        });

        it('should resolve manual content source', async () => {
            mockLibrary.getItem.mockResolvedValue(createMockItem({ ratingKey: 'manual1' }));

            const channel = await manager.createChannel({
                contentSource: {
                    type: 'manual',
                    items: [{ ratingKey: 'manual1', title: 'Manual', durationMs: 1000 }],
                },
            });

            const result = await manager.resolveChannelContent(channel.id);
            expect(result.items.length).toBeGreaterThan(0);
        });

        it('should cache resolved content', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            // First resolution happens in createChannel
            mockLibrary.getLibraryItems.mockClear();

            await manager.resolveChannelContent(channel.id);
            await manager.resolveChannelContent(channel.id);

            // Should not call again due to cache
            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(0);
        });

        it('should force refresh bypasses cache', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            mockLibrary.getLibraryItems.mockClear();

            await manager.refreshChannelContent(channel.id);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(1);
        });

        it('resolveChannelItemsForSchedule returns deep-cloned cached items', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                {
                    ...createMockItem({
                        ratingKey: 'nested-1',
                        title: 'Nested One',
                        durationMs: 6000,
                    }),
                    genres: ['Drama'],
                    directors: ['Director A'],
                    media: [{
                        videoResolution: '4k',
                        audioCodec: 'aac',
                        audioChannels: 6,
                        parts: [],
                    }],
                } as unknown as PlexMediaItemMinimal,
                {
                    ...createMockItem({
                        ratingKey: 'nested-2',
                        title: 'Nested Two',
                        year: 2025,
                        durationMs: 6000,
                    }),
                    genres: ['Comedy'],
                    directors: ['Director B'],
                    media: [{
                        videoResolution: '1080p',
                        audioCodec: 'ac3',
                        audioChannels: 2,
                        parts: [],
                    }],
                } as unknown as PlexMediaItemMinimal,
            ]);
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });
            mockLibrary.getLibraryItems.mockClear();

            const first = await manager.resolveChannelItemsForSchedule(channel.id);
            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(0);

            first[0]!.title = 'Mutated Title';
            first[0]!.genres?.push('Mutated Genre');
            first[0]!.directors?.push('Mutated Director');
            if (first[0]!.mediaInfo) {
                first[0]!.mediaInfo.resolution = '240p';
            }

            const second = await manager.resolveChannelItemsForSchedule(channel.id);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(0);
            expect(second).not.toBe(first);
            expect(second[0]).not.toBe(first[0]);
            expect(second[0]!.title).toBe('Nested One');
            expect(second[0]!.genres).toEqual(['Drama']);
            expect(second[0]!.directors).toEqual(['Director A']);
            expect(second[0]!.mediaInfo).toEqual({
                resolution: '4K',
                audioCodec: 'aac',
                audioChannels: 6,
            });
        });

        it('does not clear all resolver caches when refreshing a single channel', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });
            const clearCachesSpy = jest.spyOn(ContentResolver.prototype, 'clearCaches');

            await manager.refreshChannelContent(channel.id);

            expect(clearCachesSpy).not.toHaveBeenCalled();
        });

        it('should handle library deleted gracefully', async () => {
            expectConsoleWarn([
                expect.stringContaining('Failed initial content resolution for channel'),
                expect.objectContaining({ message: '404' }),
            ]);
            mockLibrary.getLibraryItems.mockRejectedValue(new Error('404'));

            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            // Content should be empty but not throw
            expect(channel.itemCount).toBe(0);
        });

        it('should throw ACCESS_DENIED when library returns ACCESS_DENIED (403)', async () => {
            expectConsoleWarn([
                'Access denied resolving channel content',
                expect.objectContaining({
                    channelId: expect.any(String),
                    contentSource: expect.objectContaining({
                        type: 'library',
                        id: 'lib1',
                    }),
                    error: expect.objectContaining({
                        code: AppErrorCode.ACCESS_DENIED,
                        message: 'Access denied',
                    }),
                }),
            ]);
            // First create a channel successfully
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            // Now mock library to throw ACCESS_DENIED (simulating 403 for non-admin profile)
            const accessDeniedError = Object.assign(new Error('Access denied'), {
                code: AppErrorCode.ACCESS_DENIED,
            });
            mockLibrary.getLibraryItems.mockRejectedValue(accessDeniedError);

            // Force re-resolve (bypass cache) — single call to avoid side-effect drift
            try {
                await manager.refreshChannelContent(channel.id);
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error).toHaveProperty('code', AppErrorCode.ACCESS_DENIED);
                expect(error).toHaveProperty('recoverable', false);
            }
        });

        it('invalidates the source, cancels pending retries, and does not serve stale cache after ACCESS_DENIED', async () => {
            const logger = { warn: jest.fn(), error: jest.fn() };
            const localManager = new ChannelManager({ plexLibrary: mockLibrary, logger });
            const invalidateSourceSpy = jest.spyOn(ContentResolver.prototype, 'invalidateSource');
            const baseNow = Date.now();
            const nowSpy = jest.spyOn(Date, 'now');
            nowSpy.mockReturnValue(baseNow);

            try {
                const channel = await localManager.createChannel({
                    contentSource: createMockContentSource(),
                });

                nowSpy.mockReturnValue(baseNow + CACHE_TTL_MS + 1);
                mockLibrary.getLibraryItems.mockRejectedValueOnce(
                    Object.assign(new Error('Network timeout'), {
                        code: AppErrorCode.NETWORK_TIMEOUT,
                    })
                );

                const staleResult = await localManager.resolveChannelContent(channel.id);
                expect(staleResult.items).toHaveLength(2);

                const accessDeniedError = Object.assign(new Error('Access denied'), {
                    code: AppErrorCode.ACCESS_DENIED,
                    httpStatus: 403,
                });
                mockLibrary.getLibraryItems.mockRejectedValueOnce(accessDeniedError);

                await expect(localManager.resolveChannelContent(channel.id)).rejects.toHaveProperty(
                    'code',
                    AppErrorCode.ACCESS_DENIED
                );

                expect(invalidateSourceSpy).toHaveBeenCalledWith(channel.contentSource);

                mockLibrary.getLibraryItems.mockRejectedValueOnce(
                    Object.assign(new Error('Network timeout after 403'), {
                        code: AppErrorCode.NETWORK_TIMEOUT,
                    })
                );

                await expect(localManager.resolveChannelContent(channel.id)).rejects.toHaveProperty(
                    'code',
                    AppErrorCode.NETWORK_TIMEOUT
                );

                jest.advanceTimersByTime(30_000);
                await Promise.resolve();

                expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(4);
                expect(logger.warn).toHaveBeenCalledWith(
                    'Access denied resolving channel content',
                    expect.objectContaining({
                        channelId: channel.id,
                        httpStatus: 403,
                        contentSource: { type: 'library', id: 'lib1' },
                    })
                );
            } finally {
                nowSpy.mockRestore();
                await localManager.flushSaves().catch(() => undefined);
                localManager.dispose();
            }
        });
    });

    describe('channel switching', () => {
        it('should switch to channel by ID', async () => {
            // Create first channel to establish position
            await manager.createChannel({
                name: 'Ch1',
                contentSource: createMockContentSource(),
            });
            const ch2 = await manager.createChannel({
                name: 'Ch2',
                contentSource: createMockContentSource(),
            });

            manager.setCurrentChannel(ch2.id);

            expect(manager.getCurrentChannel()!.id).toBe(ch2.id);
        });

        it('should emit channelSwitch event', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            const handler = jest.fn();
            manager.on('channelSwitch', handler);

            manager.setCurrentChannel(channel.id);

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    channel: expect.objectContaining({ id: channel.id }),
                })
            );
        });

        it('should persist current channel', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            manager.setCurrentChannel(channel.id);

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                CURRENT_CHANNEL_KEY,
                channel.id
            );
        });

        it('routes setCurrentChannel persistence through ChannelRepository.saveCurrentChannelId', async () => {
            const ch1 = await manager.createChannel({ name: 'Ch1', contentSource: createMockContentSource() });
            const writeCurrentSpy = jest.spyOn(ChannelRepository.prototype, 'saveCurrentChannelId');

            manager.setCurrentChannel(ch1.id);

            expect(writeCurrentSpy).toHaveBeenCalledWith(ch1.id);
            expect(writeCurrentSpy).toHaveBeenCalledTimes(1);
        });

        it('emits quota-specific persistenceWarning when current-channel write hits quota', async () => {
            expectPersistCurrentChannelWarning();
            const ch1 = await manager.createChannel({ name: 'Ch1', contentSource: createMockContentSource() });
            const warningHandler = jest.fn();
            manager.on('persistenceWarning', warningHandler);
            jest
                .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
                .mockReturnValue({ ok: false, reason: 'quota-exceeded' });

            manager.setCurrentChannel(ch1.id);

            expect(warningHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                    message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                })
            );
        });

        it('resets persistence warning backoff after a successful current-channel save', async () => {
            expectPersistCurrentChannelWarning(2);
            const ch1 = await manager.createChannel({ name: 'Ch1', contentSource: createMockContentSource() });
            const ch2 = await manager.createChannel({ name: 'Ch2', contentSource: createMockContentSource() });
            const warningHandler = jest.fn();
            manager.on('persistenceWarning', warningHandler);
            jest
                .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
                .mockReturnValueOnce({ ok: false, reason: 'quota-exceeded' })
                .mockReturnValueOnce({ ok: true })
                .mockReturnValueOnce({ ok: false, reason: 'quota-exceeded' });

            manager.setCurrentChannel(ch1.id);
            manager.setCurrentChannel(ch2.id);
            manager.setCurrentChannel(ch1.id);

            expect(warningHandler).toHaveBeenCalledTimes(2);
            expect(warningHandler).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                    message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                })
            );
            expect(warningHandler).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                    message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                })
            );
        });

        it('should get next and previous channels', async () => {
            const ch1 = await manager.createChannel({
                name: 'Ch1',
                contentSource: createMockContentSource(),
            });
            const ch2 = await manager.createChannel({
                name: 'Ch2',
                contentSource: createMockContentSource(),
            });
            const ch3 = await manager.createChannel({
                name: 'Ch3',
                contentSource: createMockContentSource(),
            });

            manager.setCurrentChannel(ch2.id);

            expect(manager.getNextChannel()!.id).toBe(ch3.id);
            expect(manager.getPreviousChannel()!.id).toBe(ch1.id);
        });

        it('should wrap around for next/previous', async () => {
            const ch1 = await manager.createChannel({
                name: 'Ch1',
                contentSource: createMockContentSource(),
            });
            const ch2 = await manager.createChannel({
                name: 'Ch2',
                contentSource: createMockContentSource(),
            });

            manager.setCurrentChannel(ch2.id);
            expect(manager.getNextChannel()!.id).toBe(ch1.id);

            manager.setCurrentChannel(ch1.id);
            expect(manager.getPreviousChannel()!.id).toBe(ch2.id);
        });
    });

    describe('persistence', () => {
        it('loads persisted channels through ChannelRepository boundary', async () => {
            const persistedChannel = createBaseChannel({
                id: 'persisted-1',
                number: 42,
                name: 'Persisted Channel',
            });

            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [persistedChannel],
                channelOrder: [persistedChannel.id],
                currentChannelId: persistedChannel.id,
                savedAt: Date.now(),
            }));
            mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, persistedChannel.id);

            const loadSpy = jest.spyOn(ChannelRepository.prototype, 'loadNormalized');

            await manager.loadChannels();

            expect(loadSpy).toHaveBeenCalledTimes(1);
            expect(manager.getAllChannels()).toHaveLength(1);
            expect(manager.getAllChannels()[0]?.id).toBe('persisted-1');
            expect(manager.getCurrentChannel()?.id).toBe('persisted-1');

            loadSpy.mockRestore();
        });

        it('strips legacy isSequentialVariant from loaded channels and from exported JSON', async () => {
            const persistedLegacy = {
                ...createBaseChannel({
                    id: 'persisted-legacy',
                    number: 88,
                    name: 'Persisted Legacy',
                }),
                isSequentialVariant: true,
            };

            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [persistedLegacy],
                channelOrder: [persistedLegacy.id],
                currentChannelId: persistedLegacy.id,
                savedAt: Date.now(),
            }));
            mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, persistedLegacy.id);

            await manager.loadChannels();
            await manager.flushSaves();

            const loaded = manager.getAllChannels();
            expect(loaded).toHaveLength(1);
            expect((loaded[0] as unknown as Record<string, unknown>).isSequentialVariant).toBeUndefined();

            const exported = JSON.parse(manager.exportChannels()) as Array<Record<string, unknown>>;
            expect(exported[0]?.isSequentialVariant).toBeUndefined();

            const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
                channels?: Array<Record<string, unknown>>;
            };
            expect(persisted.channels?.[0]?.isSequentialVariant).toBeUndefined();
        });

        it('does not persist when saved current-channel key only changes current', async () => {
            const persistedChannel = createBaseChannel({
                id: 'persisted-1',
                number: 42,
                name: 'Persisted Channel',
            });

            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [persistedChannel],
                channelOrder: [persistedChannel.id],
                currentChannelId: 'different-current-id',
                savedAt: Date.now(),
            }));
            mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, persistedChannel.id);

            const loadManager = new ChannelManager({ plexLibrary: mockLibrary });
            const queueSaveSpy = jest.spyOn(loadManager as unknown as { _queueSave: () => void }, '_queueSave');

            await loadManager.loadChannels();

            expect(loadManager.getCurrentChannel()?.id).toBe(persistedChannel.id);
            expect(queueSaveSpy).not.toHaveBeenCalled();
        });

        it('saveChannels reuses one pending promise for burst saves', async () => {
            expectDebouncedSaveQuotaWarning();
            await manager.createChannel({ contentSource: createMockContentSource() });

            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('quota', 'QuotaExceededError');
            });

            const first = manager.saveChannels();
            const second = manager.saveChannels();
            expect(second).toBe(first);

            jest.advanceTimersByTime(500);

            await expect(first).rejects.toMatchObject({
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            });
        });

        it('routes debounced channel blob writes through ChannelRepository.saveStoredChannelData', async () => {
            const channel = await manager.createChannel({ contentSource: createMockContentSource() });
            const writeStoredSpy = jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData');
            manager.setCurrentChannel(channel.id);

            await manager.flushSaves();

            expect(writeStoredSpy).toHaveBeenCalledTimes(1);
            expect(writeStoredSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    channels: expect.any(Array),
                    channelOrder: expect.any(Array),
                    currentChannelId: expect.anything(),
                    savedAt: expect.any(Number),
                })
            );
        });

        it('emits throttled persistenceWarning for debounced background save failures', async () => {
            expectDebouncedSaveQuotaWarning();
            const warningHandler = jest.fn();
            manager.on('persistenceWarning', warningHandler);

            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('quota', 'QuotaExceededError');
            });

            const channel = await manager.createChannel({ contentSource: createMockContentSource() });
            jest.advanceTimersByTime(500);
            await Promise.resolve();

            await manager.updateChannel(channel.id, { name: 'Updated Name' });
            jest.advanceTimersByTime(500);
            await Promise.resolve();

            expect(warningHandler).toHaveBeenCalledTimes(1);
            expect(warningHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                    message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                })
            );
        });

        it('saveChannels should reject when debounced persistence fails', async () => {
            expectDebouncedSaveQuotaWarning();
            await manager.createChannel({ contentSource: createMockContentSource() });

            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('quota', 'QuotaExceededError');
            });

            const pendingSave = manager.saveChannels();
            jest.advanceTimersByTime(500);

            await expect(pendingSave).rejects.toMatchObject({
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            });
        });

        it('flushSaves should propagate persistence failure when pending save exists', async () => {
            expectDebouncedSaveQuotaWarning();
            await manager.createChannel({ contentSource: createMockContentSource() });

            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('quota', 'QuotaExceededError');
            });

            await expect(manager.flushSaves()).rejects.toMatchObject({
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            });
        });

        it('should debounce saves to localStorage', async () => {
            mockLocalStorage.setItem.mockClear();

            await manager.createChannel({
                contentSource: createMockContentSource()
            });

            // Should not be called immediately due to 500ms debounce
            expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
                STORAGE_KEY,
                expect.any(String)
            );

            // Should be called synchronously once flushed
            await manager.flushSaves();
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEY,
                expect.any(String)
            );
        });

        it('dispose cancels pending save timer and rejects queued promise', async () => {
            const pendingSave = manager.saveChannels();

            manager.dispose();
            jest.advanceTimersByTime(500);

            await expect(pendingSave).rejects.toThrow('ChannelManager disposed');
        });

        it('should save channels to localStorage', async () => {
            await manager.createChannel({ contentSource: createMockContentSource() });
            await manager.flushSaves();

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEY,
                expect.any(String)
            );
        });

        it('should restore channels on load', async () => {
            // Create and save a channel
            await manager.createChannel({
                name: 'Saved Channel',
                contentSource: createMockContentSource(),
            });
            await manager.flushSaves();

            // Create new manager and load
            const newManager = new ChannelManager({ plexLibrary: mockLibrary });
            await newManager.loadChannels();

            expect(newManager.getAllChannels()).toHaveLength(1);
            expect(newManager.getAllChannels()[0]!.name).toBe('Saved Channel');
        });

        it('should not throw on malformed persisted contentSource', async () => {
            await manager.createChannel({
                name: 'Bad Channel',
                contentSource: createMockContentSource(),
            });
            const channel = manager.getAllChannels()[0]!;

            mockLocalStorage.clear();
            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [{ ...channel, contentSource: null }],
                channelOrder: [channel.id],
                currentChannelId: channel.id,
                savedAt: Date.now(),
            }));

            const newManager = new ChannelManager({ plexLibrary: mockLibrary });
            await expect(newManager.loadChannels()).resolves.toBeUndefined();
            expect(newManager.getAllChannels()).toHaveLength(0);
        });

        it('should prune channels with malformed manual item shapes on load', async () => {
            await manager.createChannel({
                name: 'Bad Manual Channel',
                contentSource: createMockContentSource(),
            });
            const channel = manager.getAllChannels()[0]!;

            mockLocalStorage.clear();
            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [{
                    ...channel,
                    contentSource: {
                        type: 'manual',
                        items: [
                            // durationMs has wrong type
                            { ratingKey: 'rk1', title: 'Manual Item', durationMs: '1000' },
                        ],
                    },
                }],
                channelOrder: [channel.id],
                currentChannelId: channel.id,
                savedAt: Date.now(),
            }));

            const newManager = new ChannelManager({ plexLibrary: mockLibrary });
            await newManager.loadChannels();
            expect(newManager.getAllChannels()).toHaveLength(0);
        });

        it('should drop non-object channel records when loading from storage', async () => {
            await manager.createChannel({
                name: 'Saved Channel',
                contentSource: createMockContentSource(),
            });
            const channel = manager.getAllChannels()[0]!;

            mockLocalStorage.clear();
            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [null, 'bad', 123, channel],
                channelOrder: [channel.id],
                currentChannelId: channel.id,
                savedAt: Date.now(),
            }));

            const newManager = new ChannelManager({ plexLibrary: mockLibrary });
            await expect(newManager.loadChannels()).resolves.toBeUndefined();
            expect(newManager.getAllChannels()).toHaveLength(1);
            expect(newManager.getAllChannels()[0]!.id).toBe(channel.id);
        });

        it('should rebuild channelOrder when persisted order is empty', async () => {
            const ch1 = await manager.createChannel({
                name: 'Ch 10',
                number: 10,
                contentSource: createMockContentSource(),
            });
            const ch2 = await manager.createChannel({
                name: 'Ch 2',
                number: 2,
                contentSource: createMockContentSource(),
            });

            mockLocalStorage.clear();
            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [ch1, ch2],
                channelOrder: [],
                currentChannelId: 'missing',
                savedAt: Date.now(),
            }));

            const newManager = new ChannelManager({ plexLibrary: mockLibrary });
            await newManager.loadChannels();

            const loaded = newManager.getAllChannels();
            expect(loaded).toHaveLength(2);
            // Rebuilt order is by channel number.
            expect(loaded[0]?.number).toBe(2);
            expect(loaded[1]?.number).toBe(10);
            // Current channel is sanitized to first if invalid.
            expect(newManager.getCurrentChannel()?.id).toBe(loaded[0]?.id);
        });

        it('should export channels as JSON', async () => {
            await manager.createChannel({
                name: 'Export Test',
                contentSource: createMockContentSource(),
            });

            const json = manager.exportChannels();
            const parsed = JSON.parse(json);

            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0].name).toBe('Export Test');
        });

        it('should import channels from JSON', async () => {
            const importData = JSON.stringify([
                {
                    name: 'Imported Channel',
                    contentSource: createMockContentSource(),
                },
            ]);

            const result = await manager.importChannels(importData);

            expect(result.success).toBe(true);
            expect(result.importedCount).toBe(1);
            expect(result.errors).toHaveLength(0);
            expect(manager.getAllChannels()).toHaveLength(1);
        });

        it('ignores legacy isSequentialVariant when importing channels without canonical playback variant metadata', async () => {
            const importData = JSON.stringify([
                {
                    name: 'Imported Variant',
                    contentSource: createMockContentSource(),
                    playbackMode: 'block',
                    blockSize: 4,
                    isSequentialVariant: true,
                },
            ]);

            const result = await manager.importChannels(importData);

            expect(result.success).toBe(true);
            expect(result.importedCount).toBe(1);
            expect(result.errors).toHaveLength(0);

            const channels = manager.getAllChannels();
            expect(channels).toHaveLength(1);
            expect(channels[0]?.isPlaybackModeVariant).toBeUndefined();
        });

        it('should handle invalid import data', async () => {
            const result = await manager.importChannels('not valid json');

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should skip invalid channels during import', async () => {
            const importData = JSON.stringify([
                { name: 'Missing contentSource' },
                { name: 'Valid', contentSource: createMockContentSource() },
            ]);

            const result = await manager.importChannels(importData);

            expect(result.importedCount).toBe(1);
            expect(result.skippedCount).toBe(1);
        });
    });

    describe('channel ordering', () => {
        it('should reorder channels', async () => {
            const ch1 = await manager.createChannel({
                name: 'Ch1',
                contentSource: createMockContentSource(),
            });
            const ch2 = await manager.createChannel({
                name: 'Ch2',
                contentSource: createMockContentSource(),
            });
            const ch3 = await manager.createChannel({
                name: 'Ch3',
                contentSource: createMockContentSource(),
            });

            await manager.reorderChannels([ch3.id, ch1.id, ch2.id]);

            const all = manager.getAllChannels();
            expect(all[0]!.id).toBe(ch3.id);
            expect(all[1]!.id).toBe(ch1.id);
            expect(all[2]!.id).toBe(ch2.id);
        });
    });

    describe('content filtering and sorting', () => {
        it('should apply content filters', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: '1', year: 2018 }),
                createMockItem({ ratingKey: '2', year: 2020 }),
                createMockItem({ ratingKey: '3', year: 2022 }),
            ]);

            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
                contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            });

            expect(channel.itemCount).toBe(2);
        });

        it('should apply sort order', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: '1', title: 'Zebra' }),
                createMockItem({ ratingKey: '2', title: 'Apple' }),
            ]);

            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
                sortOrder: 'title_asc',
            });

            const content = await manager.resolveChannelContent(channel.id);
            expect(content.items[0]!.title).toBe('Apple');
        });

        it('should filter out zero-duration items', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: '1', durationMs: 0 }),
                createMockItem({ ratingKey: '2', durationMs: 7200000 }),
            ]);

            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            expect(channel.itemCount).toBe(1);
        });
    });
});

describe('ChannelManager constructor validation', () => {
    it('throws when currentChannelKey is provided as an empty string', () => {
        const plexLibrary = createMockLibrary();
        expect(() => new ChannelManager({ plexLibrary, currentChannelKey: '' })).toThrow(
            'Storage keys must be non-empty strings'
        );
    });

    it('throws when storageKey is provided as whitespace', () => {
        const plexLibrary = createMockLibrary();
        expect(() => new ChannelManager({ plexLibrary, storageKey: '   ' })).toThrow(
            'Storage keys must be non-empty strings'
        );
    });
});
