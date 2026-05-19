/**
 * @fileoverview Unit tests for ChannelManager.
 * @module modules/scheduler/channel-manager/__tests__/ChannelManager.test
 */

import { ChannelError, ChannelManager } from '../ChannelManager';
import type { IPlexLibraryMinimal } from '../interfaces';
import type {
    ChannelConfig,
    ChannelCreateInput,
    ChannelUpdateInput,
} from '../types';
import { AppErrorCode } from '../../../../types/app-errors';
import {
    installMockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import {
    MAX_CHANNELS,
} from '../constants';
import {
    createBaseChannel,
    createMockContentSource,
    createMockLibrary,
    seedDefaultLibrary,
} from './channel-manager-test-helpers';

installMockLocalStorage();

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
        seedDefaultLibrary(mockLibrary);

        manager = new ChannelManager({ plexLibrary: mockLibrary });
    });

    afterEach(async () => {
        if (manager) {
            await manager.flushSaves().catch(() => undefined);
        }
        jest.clearAllTimers();
        jest.useRealTimers();
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

        it('throws a typed error when the channel limit is reached', async () => {
            const channels = Array.from({ length: MAX_CHANNELS }, (_, index) => (
                createBaseChannel({ id: `c${index + 1}`, number: index + 1 })
            ));
            await manager.replaceAllChannels(channels);

            await expect(
                manager.createChannel({ contentSource: createMockContentSource() })
            ).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.MAX_CHANNELS_REACHED,
                message: 'Maximum number of channels reached',
            });
        });


        it('throws ChannelError if content source missing', async () => {
            const promise = manager.createChannel({ name: 'Test' } as unknown as ChannelCreateInput);

            await expect(promise).rejects.toBeInstanceOf(ChannelError);
            await expect(promise).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.CHANNEL_CONTENT_SOURCE_REQUIRED,
                message: 'Content source is required',
            });
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
            ).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.DUPLICATE_CHANNEL_NUMBER,
                message: 'Channel number already in use',
            });
        });

        it('should throw on invalid channel number', async () => {
            await expect(
                manager.createChannel({
                    number: 0,
                    contentSource: createMockContentSource(),
                })
            ).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.INVALID_CHANNEL_NUMBER,
                message: 'Channel number must be an integer between 1 and 500',
            });

            await expect(
                manager.createChannel({
                    number: 501,
                    contentSource: createMockContentSource(),
                })
            ).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.INVALID_CHANNEL_NUMBER,
                message: 'Channel number must be an integer between 1 and 500',
            });
        });

        it('should throw on fractional channel numbers', async () => {
            await expect(
                manager.createChannel({
                    number: 7.5,
                    contentSource: createMockContentSource(),
                })
            ).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.INVALID_CHANNEL_NUMBER,
                message: 'Channel number must be an integer between 1 and 500',
            });
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

        it('strips legacy runtime color from update results, events, and public getters', async () => {
            const channel = await manager.createChannel({
                name: 'Original',
                contentSource: createMockContentSource(),
            });
            const handler = jest.fn();
            manager.on('channelUpdated', handler);

            const updated = await manager.updateChannel(channel.id, {
                name: 'Updated',
                color: '#ff0000',
            } as unknown as ChannelUpdateInput);

            expect(updated.name).toBe('Updated');
            expect(updated).not.toHaveProperty('color');
            expect(handler).toHaveBeenCalledWith(expect.not.objectContaining({ color: expect.anything() }));
            expect(manager.getChannel(channel.id)).not.toHaveProperty('color');
            expect(manager.getAllChannels()[0]).not.toHaveProperty('color');
        });

        it('takes ownership of mutable content source and filter inputs', async () => {
            const contentSource = {
                ...createMockContentSource('owned-lib'),
                libraryFilter: { genre: 'Drama' },
            };
            const contentFilters: ChannelCreateInput['contentFilters'] = [
                { field: 'year', operator: 'gte', value: 2020 },
            ];

            const channel = await manager.createChannel({
                contentSource,
                contentFilters,
            });

            contentSource.libraryFilter.genre = 'Comedy';
            contentFilters[0]!.value = 1990;

            const stored = manager.getChannel(channel.id);
            expect(stored?.contentSource).toEqual(expect.objectContaining({
                libraryFilter: { genre: 'Drama' },
            }));
            expect(stored?.contentFilters).toEqual([
                { field: 'year', operator: 'gte', value: 2020 },
            ]);
        });

        it('takes ownership of mutable content source and filter updates', async () => {
            const channel = await manager.createChannel({
                name: 'Original',
                contentSource: createMockContentSource(),
            });
            const contentSource = {
                ...createMockContentSource('updated-lib'),
                libraryFilter: { genre: 'Drama' },
            };
            const contentFilters: ChannelUpdateInput['contentFilters'] = [
                { field: 'year', operator: 'gte', value: 2020 },
            ];

            const updated = await manager.updateChannel(channel.id, {
                contentSource,
                contentFilters,
            });

            contentSource.libraryFilter.genre = 'Comedy';
            contentFilters[0]!.value = 1990;

            expect(updated.contentSource).toEqual(expect.objectContaining({
                libraryFilter: { genre: 'Drama' },
            }));
            expect(updated.contentFilters).toEqual([
                { field: 'year', operator: 'gte', value: 2020 },
            ]);
            expect(manager.getChannel(channel.id)?.contentSource).toEqual(expect.objectContaining({
                libraryFilter: { genre: 'Drama' },
            }));
        });

        it('takes ownership of mutable replacement channel content fields', async () => {
            const replacement = createBaseChannel({
                id: 'replacement',
                contentSource: {
                    ...createMockContentSource('replacement-lib'),
                    libraryFilter: { genre: 'Drama' },
                },
                contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            });

            await manager.replaceAllChannels([replacement]);

            const source = replacement.contentSource;
            if (source.type !== 'library' || !source.libraryFilter || !replacement.contentFilters) {
                throw new Error('replacement fixture should use mutable library content fields');
            }
            source.libraryFilter.genre = 'Comedy';
            replacement.contentFilters[0]!.value = 1990;

            const stored = manager.getChannel('replacement');
            expect(stored?.contentSource).toEqual(expect.objectContaining({
                libraryFilter: { genre: 'Drama' },
            }));
            expect(stored?.contentFilters).toEqual([
                { field: 'year', operator: 'gte', value: 2020 },
            ]);
        });

        it('ignores explicit undefined update values so required fields are preserved', async () => {
            const channel = await manager.createChannel({
                name: 'Original',
                contentSource: createMockContentSource(),
            });

            const updated = await manager.updateChannel(channel.id, {
                name: undefined,
                contentSource: undefined,
            } as unknown as ChannelUpdateInput);

            expect(updated.name).toBe('Original');
            expect(updated.contentSource).toEqual(channel.contentSource);
        });

        it('throws ChannelError when updating a missing channel', async () => {
            await expect(manager.updateChannel('missing-channel', { name: 'Nope' })).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.CHANNEL_NOT_FOUND,
                message: 'Channel not found',
            });
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
            expect(updated.updatedAt).toBeGreaterThanOrEqual(channel.updatedAt);
            expect(updated.name).toBe('Updated');
        });

        it('should throw when updating to a fractional channel number', async () => {
            const channel = await manager.createChannel({
                name: 'Original',
                contentSource: createMockContentSource(),
            });

            await expect(
                manager.updateChannel(channel.id, { number: 7.5 })
            ).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.INVALID_CHANNEL_NUMBER,
                message: 'Channel number must be an integer between 1 and 500',
            });
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

        it('throws ChannelError when deleting a missing channel', async () => {
            await expect(manager.deleteChannel('missing-channel')).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.CHANNEL_NOT_FOUND,
                message: 'Channel not found',
            });
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

        it('returns owned clones from public getter surfaces', async () => {
            const ch1 = await manager.createChannel({
                number: 1,
                name: 'Protected 1',
                contentSource: {
                    ...createMockContentSource('lib-1'),
                    libraryFilter: { genre: 'Drama' },
                },
                contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            });
            const ch2 = await manager.createChannel({
                number: 2,
                name: 'Protected 2',
                contentSource: {
                    ...createMockContentSource('lib-2'),
                    libraryFilter: { genre: 'Comedy' },
                },
                contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            });
            await manager.createChannel({
                number: 3,
                name: 'Protected 3',
                contentSource: {
                    ...createMockContentSource('lib-3'),
                    libraryFilter: { genre: 'Action' },
                },
                contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            });
            manager.setCurrentChannel(ch2.id);

            const mutateReturnedChannel = (channel: ChannelConfig, marker: string): void => {
                channel.name = `Mutated ${marker}`;
                if (channel.contentSource.type !== 'library' || !channel.contentSource.libraryFilter) {
                    throw new Error('getter clone fixture should use library filters');
                }
                channel.contentSource.libraryFilter.genre = `Mutated ${marker}`;
                if (!channel.contentFilters) {
                    throw new Error('getter clone fixture should use content filters');
                }
                channel.contentFilters[0]!.value = 1900;
            };
            const expectOriginalChannel = (
                channel: ChannelConfig | null | undefined,
                expected: { name: string; genre: string; filterValue: number }
            ): void => {
                expect(channel).toEqual(expect.objectContaining({ name: expected.name }));
                expect(channel?.contentSource).toEqual(expect.objectContaining({
                    libraryFilter: { genre: expected.genre },
                }));
                expect(channel?.contentFilters).toEqual([
                    { field: 'year', operator: 'gte', value: expected.filterValue },
                ]);
            };

            mutateReturnedChannel(manager.getChannel(ch1.id)!, 'by-id');
            mutateReturnedChannel(
                manager.getAllChannels().find((channel) => channel.id === ch1.id)!,
                'all'
            );
            mutateReturnedChannel(manager.getChannelByNumber(ch1.number)!, 'by-number');
            mutateReturnedChannel(manager.getCurrentChannel()!, 'current');
            mutateReturnedChannel(manager.getNextChannel()!, 'next');
            mutateReturnedChannel(manager.getPreviousChannel()!, 'previous');

            expectOriginalChannel(manager.getChannel(ch1.id), {
                name: 'Protected 1',
                genre: 'Drama',
                filterValue: 2020,
            });
            expectOriginalChannel(
                manager.getAllChannels().find((channel) => channel.id === ch1.id),
                {
                    name: 'Protected 1',
                    genre: 'Drama',
                    filterValue: 2020,
                }
            );
            expectOriginalChannel(manager.getChannelByNumber(ch1.number), {
                name: 'Protected 1',
                genre: 'Drama',
                filterValue: 2020,
            });
            expectOriginalChannel(manager.getCurrentChannel(), {
                name: 'Protected 2',
                genre: 'Comedy',
                filterValue: 2020,
            });
            expectOriginalChannel(manager.getNextChannel(), {
                name: 'Protected 3',
                genre: 'Action',
                filterValue: 2020,
            });
            expectOriginalChannel(manager.getPreviousChannel(), {
                name: 'Protected 1',
                genre: 'Drama',
                filterValue: 2020,
            });
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

        it('throws ChannelError when switching to a missing channel', () => {
            let caught: unknown;
            try {
                manager.setCurrentChannel('missing-channel');
            } catch (error) {
                caught = error;
            }

            expect(caught).toBeInstanceOf(ChannelError);
            expect(caught).toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.CHANNEL_NOT_FOUND,
                message: 'Channel not found',
            });
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

        it('strips polluted public channel fields from channelSwitch payloads', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });
            (channel as unknown as Record<string, unknown>).color = '#ff0000';
            const handler = jest.fn();
            manager.on('channelSwitch', handler);

            manager.setCurrentChannel(channel.id);

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    channel: expect.not.objectContaining({ color: expect.anything() }),
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

});
