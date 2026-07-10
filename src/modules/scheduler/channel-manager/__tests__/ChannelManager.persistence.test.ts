import { ChannelError, ChannelManager } from '../ChannelManager';
import { ChannelPersistenceCoordinator } from '../persistence/ChannelPersistenceCoordinator';
import { ChannelRepository } from '../persistence/ChannelRepository';
import { ContentResolver } from '../resolution/ContentResolver';
import type { IPlexLibraryMinimal } from '../contracts/interfaces';
import { TIMING_CONFIG } from '../../../../config/timing';
import { AppErrorCode } from '../../../../types/app-errors';
import { STORAGE_QUOTA_EXCEEDED_MESSAGE } from '../../../../shared/persistenceMessages';
import { expectConsoleWarn } from '../../../../__tests__/helpers';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import {
    CURRENT_CHANNEL_KEY,
    STORAGE_KEY,
} from '../constants';
import {
    createBaseChannel,
    createMockContentSource,
    createMockLibrary,
    seedDefaultLibrary,
} from './channel-manager-test-helpers';

installMockLocalStorage();

afterAll(() => {
    restoreOriginalLocalStorage();
});

const advanceSaveDebounce = (): void => {
    jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS);
};

const settleSaveDebounce = async (): Promise<void> => {
    advanceSaveDebounce();
    await Promise.resolve();
};

const expectPersistCurrentChannelWarning = (times: number = 1): void => {
    expectConsoleWarn([
        'Failed to persist current channel',
        expect.objectContaining({
            name: 'ChannelError',
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
        }),
    ], { times });
};

const expectDebouncedSaveQuotaWarning = (times: number = 1): void => {
    expectConsoleWarn([
        'Debounced save failed (quota)',
        expect.objectContaining({
            name: 'ChannelError',
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
        }),
    ], { times });
};

describe('ChannelManager persistence and storage keys', () => {
    let mockLibrary: jest.Mocked<IPlexLibraryMinimal>;
    let manager: ChannelManager;
    const createdManagers: ChannelManager[] = [];

    const createManagedChannelManager = (): ChannelManager => {
        const created = new ChannelManager({ plexLibrary: mockLibrary });
        createdManagers.push(created);
        return created;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        resetMockLocalStorage();

        mockLibrary = createMockLibrary();
        seedDefaultLibrary(mockLibrary);

        manager = new ChannelManager({ plexLibrary: mockLibrary });
    });

    afterEach(async () => {
        for (const created of createdManagers.splice(0)) {
            await created.flushSaves().catch(() => undefined);
            created.dispose();
        }
        if (manager) {
            await manager.flushSaves().catch(() => undefined);
            manager.dispose();
        }
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
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
        });

        it('throws a typed validation error for empty storage keys', () => {
            expect(() => manager.setStorageKeys('lineup_channels_new_scope', '   ')).toThrow(ChannelError);
            expect(() => manager.setStorageKeys('lineup_channels_new_scope', '   ')).toThrow(
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_VALIDATION_FAILED,
                    message: 'Storage keys must be non-empty strings',
                })
            );
        });

        it('emits persistenceWarning and does not throw when pending save flush fails during key switch', async () => {
            expectConsoleWarn([
                'ChannelManager.clearRuntimeState failed while flushing pending saves',
                expect.objectContaining({
                    name: 'ChannelError',
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
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

        it('flushes a queued mutation to the previous scope before runtime clear and key switch', async () => {
            const persistedChannel = createBaseChannel({
                id: 'persisted-channel',
                name: 'Persisted Channel',
                contentSource: createMockContentSource('persisted-lib'),
            });
            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [persistedChannel],
                channelOrder: [persistedChannel.id],
                currentChannelId: persistedChannel.id,
                savedAt: Date.now(),
            }));
            await manager.loadChannels();
            const unsavedChannel = await manager.createChannel({
                name: 'Unsaved Runtime Channel',
                contentSource: createMockContentSource('runtime-lib'),
            });

            manager.clearRuntimeState();
            manager.setStorageKeys('lineup_channels_next_scope', 'lineup_current_channel_next_scope');
            await manager.flushSaves();
            await settleSaveDebounce();

            const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
                channels?: Array<{ id?: string }>;
                channelOrder?: string[];
                currentChannelId?: string | null;
            };
            expect(persisted.channels?.map((channel) => channel.id)).toEqual([
                'persisted-channel',
                unsavedChannel.id,
            ]);
            expect(persisted.channelOrder).toEqual(['persisted-channel', unsavedChannel.id]);
            expect(persisted.currentChannelId).toBe('persisted-channel');
            expect(mockLocalStorage.getItem('lineup_channels_next_scope')).toBeNull();
        });

        it('completes runtime clear and key switch when flush and failure reporting throw', async () => {
            const persistedChannel = createBaseChannel({
                id: 'persisted-channel',
                name: 'Persisted Channel',
                contentSource: createMockContentSource('persisted-lib'),
            });
            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [persistedChannel],
                channelOrder: [persistedChannel.id],
                currentChannelId: persistedChannel.id,
                savedAt: Date.now(),
            }));
            await manager.loadChannels();
            await manager.createChannel({
                name: 'Old Scope Mutation',
                contentSource: createMockContentSource('old-scope-lib'),
            });
            jest.spyOn(ChannelPersistenceCoordinator.prototype, 'flush')
                .mockImplementationOnce(() => {
                    throw new Error('flush failed');
                });
            jest.spyOn(ChannelPersistenceCoordinator.prototype, 'reportFailure')
                .mockImplementationOnce(() => {
                    throw new Error('report failed');
                });

            expect(() => manager.setStorageKeys(
                'lineup_channels_next_scope',
                'lineup_current_channel_next_scope'
            )).not.toThrow();
            expect(manager.getAllChannels()).toEqual([]);

            const newScopeChannel = await manager.createChannel({
                name: 'New Scope Channel',
                contentSource: createMockContentSource('new-scope-lib'),
            });
            await manager.flushSaves();

            const oldScope = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
                channels?: Array<{ id?: string }>;
            };
            const newScope = JSON.parse(
                mockLocalStorage.getItem('lineup_channels_next_scope') ?? '{}'
            ) as { channels?: Array<{ id?: string }> };
            expect(oldScope.channels?.map((channel) => channel.id)).toEqual(['persisted-channel']);
            expect(newScope.channels?.map((channel) => channel.id)).toEqual([newScopeChannel.id]);
        });
    });

    describe('current-channel persistence', () => {
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
                    message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
                })
            );
        });

        it('keeps the public channel switch best-effort when current-channel storage fails', async () => {
            expectPersistCurrentChannelWarning();
            const ch1 = await manager.createChannel({ name: 'Ch1', contentSource: createMockContentSource() });
            const switchHandler = jest.fn();
            const warningHandler = jest.fn();
            manager.on('channelSwitch', switchHandler);
            manager.on('persistenceWarning', warningHandler);
            jest
                .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
                .mockReturnValue({ ok: false, reason: 'quota-exceeded' });

            expect(() => manager.setCurrentChannel(ch1.id)).not.toThrow();

            expect(manager.getCurrentChannel()?.id).toBe(ch1.id);
            expect(switchHandler).toHaveBeenCalledWith({
                channel: ch1,
                index: 0,
            });
            expect(warningHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                    message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
                })
            );
        });

        it('emits typed persistence fallback warning when current-channel write is unavailable', async () => {
            expectConsoleWarn([
                'Failed to persist current channel',
                expect.objectContaining({
                    name: 'ChannelError',
                    code: AppErrorCode.PERSISTENCE_FALLBACK,
                    message: 'Failed to persist current channel',
                }),
            ]);
            const ch1 = await manager.createChannel({ name: 'Ch1', contentSource: createMockContentSource() });
            const warningHandler = jest.fn();
            manager.on('persistenceWarning', warningHandler);
            jest
                .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
                .mockReturnValue({ ok: false, reason: 'unavailable' });

            manager.setCurrentChannel(ch1.id);

            expect(warningHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.PERSISTENCE_FALLBACK,
                    isQuotaError: false,
                    message: 'Failed to persist channels; some changes may not be saved',
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
                    message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
                })
            );
            expect(warningHandler).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                    message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
                })
            );
        });
    });

    describe('load, save, and export', () => {
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

        it('strips legacy color from loaded channels and rewrites storage on flush', async () => {
            const persistedLegacy = {
                ...createBaseChannel({
                    id: 'persisted-color',
                    number: 89,
                    name: 'Persisted Color',
                }),
                color: '#ff0000',
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
            expect(loaded[0]).not.toHaveProperty('color');

            const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
                channels?: Array<Record<string, unknown>>;
            };
            expect(persisted.channels?.[0]?.color).toBeUndefined();
        });

        it('does not rewrite channel data when saved current-channel key only changes current', async () => {
            const persistedChannel = createBaseChannel({
                id: 'persisted-1',
                number: 42,
                name: 'Persisted Channel',
            });
            const persistedBlob = JSON.stringify({
                channels: [persistedChannel],
                channelOrder: [persistedChannel.id],
                currentChannelId: 'different-current-id',
                savedAt: Date.now(),
            });

            mockLocalStorage.setItem(STORAGE_KEY, persistedBlob);
            mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, persistedChannel.id);

            const writeStoredSpy = jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData');
            const loadManager = createManagedChannelManager();

            await loadManager.loadChannels();
            await loadManager.flushSaves();

            expect(loadManager.getCurrentChannel()?.id).toBe(persistedChannel.id);
            expect(writeStoredSpy).not.toHaveBeenCalled();
            expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(persistedBlob);
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

            const rejectedSave = expect(first).rejects.toMatchObject({
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            });
            advanceSaveDebounce();

            await rejectedSave;
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

        it('captures queued save payloads before later state mutations can leak into the write', async () => {
            const coordinator = new ChannelPersistenceCoordinator({
                logger: { warn: jest.fn(), error: jest.fn() },
                emitPersistenceWarning: jest.fn(),
            });
            const channel = createBaseChannel({ id: 'queued-channel', name: 'Queued Name' });
            const channelOrder = ['queued-channel'];
            const writeStoredSpy = jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData');

            coordinator.queueSave({
                channels: [channel],
                channelOrder,
                currentChannelId: 'queued-channel',
            });

            channel.name = 'Mutated Name';
            channelOrder.push('late-channel');

            await settleSaveDebounce();

            expect(writeStoredSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    channels: [expect.objectContaining({ id: 'queued-channel', name: 'Queued Name' })],
                    channelOrder: ['queued-channel'],
                    currentChannelId: 'queued-channel',
                })
            );
            coordinator.dispose();
        });

        it('does not let an older pending debounced save overwrite loaded channel storage', async () => {
            await manager.createChannel({
                name: 'Old Channel',
                contentSource: createMockContentSource('old-lib'),
            });

            const loadedChannel = createBaseChannel({
                id: 'loaded-channel',
                name: 'Loaded Channel',
                number: 22,
                contentSource: createMockContentSource('loaded-lib'),
            });
            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [loadedChannel],
                channelOrder: [loadedChannel.id],
                currentChannelId: loadedChannel.id,
                savedAt: Date.now(),
            }));

            await manager.loadChannels();
            await settleSaveDebounce();

            const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
                channels?: Array<{ id?: string; name?: string }>;
                channelOrder?: string[];
                currentChannelId?: string | null;
            };

            expect(persisted.channels?.map((channel) => channel.id)).toEqual(['loaded-channel']);
            expect(persisted.channels?.[0]?.name).toBe('Loaded Channel');
            expect(persisted.channelOrder).toEqual(['loaded-channel']);
            expect(persisted.currentChannelId).toBe('loaded-channel');
        });

        it('resets current-channel warning throttling after a best-effort save succeeds', () => {
            const emitPersistenceWarning = jest.fn();
            const coordinator = new ChannelPersistenceCoordinator({
                logger: { warn: jest.fn(), error: jest.fn() },
                emitPersistenceWarning,
            });
            const saveCurrentSpy = jest
                .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
                .mockReturnValueOnce({ ok: false, reason: 'quota-exceeded' })
                .mockReturnValueOnce({ ok: true })
                .mockReturnValueOnce({ ok: false, reason: 'quota-exceeded' });

            coordinator.persistCurrentChannelIdBestEffort('channel-1');
            coordinator.persistCurrentChannelIdBestEffort('channel-1');
            coordinator.persistCurrentChannelIdBestEffort('channel-1');

            expect(saveCurrentSpy).toHaveBeenCalledTimes(3);
            expect(emitPersistenceWarning).toHaveBeenCalledTimes(2);
            coordinator.dispose();
        });

        it('clears stale resolved content and resolver caches when loading restored channels', async () => {
            const channel = await manager.createChannel({
                name: 'Old Channel',
                contentSource: createMockContentSource('old-lib'),
            });
            await manager.resolveChannelContent(channel.id);
            mockLibrary.getLibraryItems.mockClear();

            const restoredChannel = createBaseChannel({
                ...channel,
                name: 'Restored Channel',
                contentSource: createMockContentSource('new-lib'),
                itemCount: 0,
                totalDurationMs: 0,
            });
            mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
                channels: [restoredChannel],
                channelOrder: [channel.id],
                currentChannelId: channel.id,
                savedAt: Date.now(),
            }));

            await manager.loadChannels();
            await manager.resolveChannelContent(channel.id);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledWith(
                'new-lib',
                expect.any(Object)
            );
        });

        it('does not let an older pending debounced save overwrite replaceAllChannels storage', async () => {
            await manager.createChannel({
                name: 'Old Channel',
                contentSource: createMockContentSource(),
            });

            await manager.replaceAllChannels([
                createBaseChannel({
                    id: 'replacement-channel',
                    name: 'Replacement Channel',
                    number: 12,
                    contentSource: createMockContentSource('replacement-library'),
                }),
            ], { currentChannelId: 'replacement-channel' });

            await settleSaveDebounce();

            const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
                channels?: Array<{ id?: string }>;
                channelOrder?: string[];
                currentChannelId?: string | null;
            };

            expect(persisted.channels?.map((channel) => channel.id)).toEqual(['replacement-channel']);
            expect(persisted.channelOrder).toEqual(['replacement-channel']);
            expect(persisted.currentChannelId).toBe('replacement-channel');
        });

        it('emits throttled persistenceWarning for debounced background save failures', async () => {
            expectDebouncedSaveQuotaWarning();
            const warningHandler = jest.fn();
            manager.on('persistenceWarning', warningHandler);

            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('quota', 'QuotaExceededError');
            });

            const channel = await manager.createChannel({ contentSource: createMockContentSource() });
            await settleSaveDebounce();

            await manager.updateChannel(channel.id, { name: 'Updated Name' });
            await settleSaveDebounce();

            expect(warningHandler).toHaveBeenCalledTimes(1);
            expect(warningHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    isQuotaError: true,
                    message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
                })
            );
        });

        it('strips legacy runtime color updates from persisted channel records', async () => {
            const channel = await manager.createChannel({
                name: 'Runtime Color',
                contentSource: createMockContentSource(),
            });
            await manager.flushSaves();

            await manager.updateChannel(channel.id, {
                color: '#ff0000',
            } as unknown as Parameters<ChannelManager['updateChannel']>[1]);
            await manager.flushSaves();

            const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
                channels?: Array<Record<string, unknown>>;
            };
            expect(persisted.channels?.[0]?.id).toBe(channel.id);
            expect(persisted.channels?.[0]?.color).toBeUndefined();
        });

        it('saveChannels should reject when debounced persistence fails', async () => {
            expectDebouncedSaveQuotaWarning();
            await manager.createChannel({ contentSource: createMockContentSource() });

            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('quota', 'QuotaExceededError');
            });

            const pendingSave = manager.saveChannels();
            const rejectedSave = expect(pendingSave).rejects.toMatchObject({
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            });
            advanceSaveDebounce();

            await rejectedSave;
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

            expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
                STORAGE_KEY,
                expect.any(String)
            );

            await manager.flushSaves();
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEY,
                expect.any(String)
            );
        });

        it('dispose cancels pending save timer and rejects queued promise', async () => {
            const pendingSave = manager.saveChannels();

            manager.dispose();

            await expect(pendingSave).rejects.toMatchObject({
                name: 'ChannelError',
                code: AppErrorCode.CHANNEL_MANAGER_DISPOSED,
                message: 'ChannelManager disposed',
            });
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
            await manager.createChannel({
                name: 'Saved Channel',
                contentSource: createMockContentSource(),
            });
            await manager.flushSaves();

            const newManager = createManagedChannelManager();
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

            const newManager = createManagedChannelManager();
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
                            { ratingKey: 'rk1', title: 'Manual Item', durationMs: '1000' },
                        ],
                    },
                }],
                channelOrder: [channel.id],
                currentChannelId: channel.id,
                savedAt: Date.now(),
            }));

            const newManager = createManagedChannelManager();
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

            const newManager = createManagedChannelManager();
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

            const newManager = createManagedChannelManager();
            await newManager.loadChannels();

            const loaded = newManager.getAllChannels();
            expect(loaded).toHaveLength(2);
            expect(loaded[0]?.number).toBe(2);
            expect(loaded[1]?.number).toBe(10);
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

        it('omits color from exported JSON even when a runtime channel is polluted', async () => {
            const channel = await manager.createChannel({
                name: 'Polluted Export',
                contentSource: createMockContentSource(),
            });
            (channel as unknown as Record<string, unknown>).color = '#ff0000';

            const parsed = JSON.parse(manager.exportChannels()) as Array<Record<string, unknown>>;

            expect(parsed[0]?.name).toBe('Polluted Export');
            expect(parsed[0]?.color).toBeUndefined();
        });
    });
});

describe('ChannelManager constructor validation', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('throws when currentChannelKey is provided as an empty string', () => {
        const plexLibrary = createMockLibrary();
        expect(() => new ChannelManager({ plexLibrary, currentChannelKey: '' })).toThrow(ChannelError);
        expect(() => new ChannelManager({ plexLibrary, currentChannelKey: '' })).toThrow(
            expect.objectContaining({
                code: AppErrorCode.STORAGE_VALIDATION_FAILED,
                message: 'Storage keys must be non-empty strings',
            })
        );
    });

    it('throws when storageKey is provided as whitespace', () => {
        const plexLibrary = createMockLibrary();
        expect(() => new ChannelManager({ plexLibrary, storageKey: '   ' })).toThrow(ChannelError);
        expect(() => new ChannelManager({ plexLibrary, storageKey: '   ' })).toThrow(
            expect.objectContaining({
                code: AppErrorCode.STORAGE_VALIDATION_FAILED,
                message: 'Storage keys must be non-empty strings',
            })
        );
    });
});
