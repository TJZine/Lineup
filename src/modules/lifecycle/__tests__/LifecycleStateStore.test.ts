/**
 * @fileoverview Unit tests for LifecycleStateStore.
 * @module modules/lifecycle/__tests__/LifecycleStateStore.test
 */

import { LifecycleStateStore } from '../LifecycleStateStore';
import { PersistentState } from '../types';
import { STORAGE_CONFIG } from '../constants';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../__tests__/mocks/localStorage';

installMockLocalStorage();

const captureThrown = (operation: () => void): unknown => {
    try {
        operation();
    } catch (error) {
        return error;
    }
    throw new Error('Expected operation to throw');
};

describe('LifecycleStateStore', () => {
    let lifecycleStateStore: LifecycleStateStore;

    beforeEach(() => {
        resetMockLocalStorage();
        lifecycleStateStore = new LifecycleStateStore();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    describe('synchronous helper contract', () => {
        it('save returns synchronously', () => {
            const state = lifecycleStateStore.createDefaultState();
            const result = lifecycleStateStore.save(state);

            expect(result).toBeUndefined();
        });

        it('load returns state synchronously', () => {
            const state: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(state));

            const loaded = lifecycleStateStore.load() as unknown as PersistentState | null;

            expect(loaded).not.toBeNull();
            expect(loaded?.version).toBe(1);
        });

        it('clear returns synchronously', () => {
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, '{}');

            const result = lifecycleStateStore.clear();

            expect(result).toBeUndefined();
            expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_CONFIG.STATE_KEY);
        });
    });

    describe('save', () => {
        it('should save state to localStorage', async () => {
            const state = lifecycleStateStore.createDefaultState();

            await lifecycleStateStore.save(state);

            expect(localStorage.setItem).toHaveBeenCalledWith(
                STORAGE_CONFIG.STATE_KEY,
                expect.any(String)
            );

            const saved = JSON.parse(mockLocalStorage.getItem(STORAGE_CONFIG.STATE_KEY) as string);
            expect(saved.version).toBe(STORAGE_CONFIG.STATE_VERSION);
        });

        it('should include version number in saved state', async () => {
            const state = lifecycleStateStore.createDefaultState();

            await lifecycleStateStore.save(state);

            const saved = JSON.parse(mockLocalStorage.getItem(STORAGE_CONFIG.STATE_KEY) as string);
            expect(saved.version).toBe(STORAGE_CONFIG.STATE_VERSION);
            expect(saved.lastUpdated).toBeGreaterThan(0);
        });

        it('should handle quota exceeded by cleaning up', async () => {
            const state = lifecycleStateStore.createDefaultState();

            // First call throws QuotaExceededError, second succeeds
            const defaultSetItemImplementation = mockLocalStorage.setItem.getMockImplementation();
            let callCount = 0;
            mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
                callCount++;
                if (callCount === 1) {
                    const error = new DOMException('Quota exceeded', 'QuotaExceededError');
                    throw error;
                }
                defaultSetItemImplementation?.(key, value);
            });

            await lifecycleStateStore.save(state);

            // Should have called setItem twice (first failed, retry succeeded)
            expect(localStorage.setItem).toHaveBeenCalledTimes(2);
        });

        it('should ignore cleanup remove failures during quota retry', () => {
            const state = lifecycleStateStore.createDefaultState();
            const defaultSetItemImplementation = mockLocalStorage.setItem.getMockImplementation();
            let setCallCount = 0;
            mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
                setCallCount++;
                if (setCallCount === 1) {
                    throw new DOMException('Quota exceeded', 'QuotaExceededError');
                }
                defaultSetItemImplementation?.(key, value);
            });
            mockLocalStorage.removeItem.mockImplementation(() => {
                throw new DOMException('blocked', 'SecurityError');
            });

            expect(() => lifecycleStateStore.save(state)).not.toThrow();

            expect(localStorage.setItem).toHaveBeenCalledTimes(2);
            for (const key of STORAGE_CONFIG.CLEANUP_KEYS) {
                expect(localStorage.removeItem).toHaveBeenCalledWith(key);
            }
            expect(mockLocalStorage.getItem(STORAGE_CONFIG.STATE_KEY)).not.toBeNull();
        });

        it('should throw a quota error when cleanup retry cannot save state', () => {
            const state = lifecycleStateStore.createDefaultState();
            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('Quota exceeded', 'QuotaExceededError');
            });

            const thrown = captureThrown(() => lifecycleStateStore.save(state));

            expect(thrown).toBeInstanceOf(DOMException);
            expect((thrown as DOMException).name).toBe('QuotaExceededError');
            expect(localStorage.setItem).toHaveBeenCalledTimes(2);
        });

        it('should throw an unavailable storage error when storage is blocked while saving', () => {
            const state = lifecycleStateStore.createDefaultState();
            mockLocalStorage.setItem.mockImplementation(() => {
                throw new DOMException('blocked', 'SecurityError');
            });

            const thrown = captureThrown(() => lifecycleStateStore.save(state));

            expect(thrown).toBeInstanceOf(DOMException);
            expect((thrown as DOMException).name).toBe('SecurityError');
            expect(localStorage.setItem).toHaveBeenCalledTimes(1);
            expect(localStorage.removeItem).not.toHaveBeenCalled();
        });
    });

    describe('load', () => {
        it('should load and parse state from localStorage', async () => {
            const state: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(state));

            const loaded = await lifecycleStateStore.load();

            expect(loaded).not.toBeNull();
            expect(loaded?.version).toBe(1);
        });

        it('should return null when no stored state', async () => {
            const loaded = await lifecycleStateStore.load();
            expect(loaded).toBeNull();
        });

        it('should return null when storage is blocked while loading', () => {
            mockLocalStorage.getItem.mockImplementation(() => {
                throw new DOMException('blocked', 'SecurityError');
            });

            expect(lifecycleStateStore.load()).toBeNull();
        });

        it('should return null for invalid JSON', async () => {
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, '{invalid json');

            const loaded = await lifecycleStateStore.load();
            expect(loaded).toBeNull();
        });

        it('should return null for invalid state format', async () => {
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, '{"foo": "bar"}');

            const loaded = await lifecycleStateStore.load();
            expect(loaded).toBeNull();
        });

        it('should handle missing version gracefully', async () => {
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, '{"plexAuth": null, "lastUpdated": 123}');

            const loaded = await lifecycleStateStore.load();
            expect(loaded).toBeNull();
        });

        it('should reject older persisted versions without an approved migration', async () => {
            const oldState = {
                version: 0,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(oldState));

            const loaded = await lifecycleStateStore.load();

            expect(loaded).toBeNull();
        });

        it('should handle future version gracefully', async () => {
            const futureState = {
                version: 999,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(futureState));

            const loaded = await lifecycleStateStore.load();

            expect(loaded).not.toBeNull();
            expect(loaded?.version).toBe(999);
        });

        it('should ignore persisted plexAuth without wiping lifecycle-owned fields', async () => {
            const state = {
                version: 1,
                plexAuth: 0,
                userPreferences: { theme: 'light', volume: 50, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(state));

            const loaded = await lifecycleStateStore.load();

            expect(loaded).not.toHaveProperty('plexAuth');
            expect(loaded?.userPreferences).toEqual(state.userPreferences);
        });

        it('should drop persisted plexAuth data', async () => {
            const state = {
                version: 1,
                plexAuth: {
                    token: { token: 'abc', issuedAt: Date.now() },
                    selectedServerId: null,
                    selectedServerUri: null,
                },
                userPreferences: { theme: 'dark', volume: 60, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(state));

            const loaded = await lifecycleStateStore.load();

            expect(loaded).not.toHaveProperty('plexAuth');
        });

        it('should default invalid userPreferences', async () => {
            const state = {
                version: 1,
                userPreferences: { theme: 'nope', volume: 999 },
                lastUpdated: Date.now(),
            };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(state));

            const loaded = await lifecycleStateStore.load();

            expect(loaded?.userPreferences).toEqual(lifecycleStateStore.createDefaultState().userPreferences);
        });

        it('should ignore legacy channel fields from older persisted payloads', async () => {
            const state = {
                version: 1,
                channelConfigs: [
                    { id: 'c1', name: 'Channel 1', number: 1 },
                    { id: 'bad', name: 123, number: 'x' },
                    { id: 'c2', name: 'Channel 2', number: 2 },
                ],
                currentChannelIndex: 5,
                userPreferences: { theme: 'dark', volume: 70, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(state));

            const loaded = await lifecycleStateStore.load();

            expect(loaded).not.toBeNull();
            if (!loaded) return;
            expect(loaded.userPreferences).toEqual(state.userPreferences);
            expect('channelConfigs' in loaded).toBe(false);
            expect('currentChannelIndex' in loaded).toBe(false);
        });

        it('should repair minimal state after migration', async () => {
            const state = { version: 1 };
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, JSON.stringify(state));

            const loaded = await lifecycleStateStore.load();

            expect(loaded).not.toBeNull();
            expect(loaded?.userPreferences).toEqual(lifecycleStateStore.createDefaultState().userPreferences);
        });
    });

    describe('clear', () => {
        it('should remove stored state', async () => {
            mockLocalStorage.setItem(STORAGE_CONFIG.STATE_KEY, '{}');

            await lifecycleStateStore.clear();

            expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_CONFIG.STATE_KEY);
        });

        it('should not throw when storage is blocked while clearing', () => {
            mockLocalStorage.removeItem.mockImplementation(() => {
                throw new DOMException('blocked', 'SecurityError');
            });

            expect(() => lifecycleStateStore.clear()).not.toThrow();
            expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_CONFIG.STATE_KEY);
        });
    });

    describe('createDefaultState', () => {
        it('should create valid default state', () => {
            const state = lifecycleStateStore.createDefaultState();

            expect(state.version).toBe(STORAGE_CONFIG.STATE_VERSION);
            expect(state.userPreferences).toBeDefined();
            expect(state.lastUpdated).toBeGreaterThan(0);
        });
    });
});
