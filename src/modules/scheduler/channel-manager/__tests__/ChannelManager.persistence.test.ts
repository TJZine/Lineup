import { ChannelError, ChannelManager } from '../ChannelManager';
import { ChannelPersistenceCoordinator } from '../ChannelPersistenceCoordinator';
import { ChannelRepository } from '../ChannelRepository';
import { ContentResolver } from '../ContentResolver';
import type { IPlexLibraryMinimal } from '../interfaces';
import { TIMING_CONFIG } from '../../../../config/timing';
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
                    message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
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
