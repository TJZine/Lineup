/**
 * @fileoverview Unit tests for StateManager.
 * @module modules/lifecycle/__tests__/StateManager.test
 */

import { StateManager } from '../StateManager';
import { PersistentState } from '../types';
import { STORAGE_CONFIG } from '../constants';

describe('StateManager', () => {
    let stateManager: StateManager;
    let mockLocalStorage: Record<string, string>;

    beforeEach(() => {
        // Mock localStorage
        mockLocalStorage = {};
        Object.defineProperty(global, 'localStorage', {
            value: {
                getItem: jest.fn((key: string) => {
                    const val = mockLocalStorage[key];
                    return val !== undefined ? val : null;
                }),
                setItem: jest.fn((key: string, value: string) => {
                    mockLocalStorage[key] = value;
                }),
                removeItem: jest.fn((key: string) => {
                    delete mockLocalStorage[key];
                }),
                clear: jest.fn(() => {
                    mockLocalStorage = {};
                }),
            },
            writable: true,
            configurable: true,
        });

        stateManager = new StateManager();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('synchronous helper contract', () => {
        it('save returns synchronously', () => {
            const state = stateManager.createDefaultState();
            const result = stateManager.save(state);

            expect(result).toBeUndefined();
        });

        it('load returns state synchronously', () => {
            const state: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = JSON.stringify(state);

            const loaded = stateManager.load() as unknown as PersistentState | null;

            expect(loaded).not.toBeNull();
            expect(loaded?.version).toBe(1);
        });

        it('clear returns synchronously', () => {
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = '{}';

            const result = stateManager.clear();

            expect(result).toBeUndefined();
            expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_CONFIG.STATE_KEY);
        });
    });

    describe('save', () => {
        it('should save state to localStorage', async () => {
            const state = stateManager.createDefaultState();

            await stateManager.save(state);

            expect(localStorage.setItem).toHaveBeenCalledWith(
                STORAGE_CONFIG.STATE_KEY,
                expect.any(String)
            );

            const saved = JSON.parse(mockLocalStorage[STORAGE_CONFIG.STATE_KEY] as string);
            expect(saved.version).toBe(STORAGE_CONFIG.STATE_VERSION);
        });

        it('should include version number in saved state', async () => {
            const state = stateManager.createDefaultState();

            await stateManager.save(state);

            const saved = JSON.parse(mockLocalStorage[STORAGE_CONFIG.STATE_KEY] as string);
            expect(saved.version).toBe(STORAGE_CONFIG.STATE_VERSION);
            expect(saved.lastUpdated).toBeGreaterThan(0);
        });

        it('should handle quota exceeded by cleaning up', async () => {
            const state = stateManager.createDefaultState();

            // First call throws QuotaExceededError, second succeeds
            let callCount = 0;
            (localStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
                callCount++;
                if (callCount === 1) {
                    const error = new DOMException('Quota exceeded', 'QuotaExceededError');
                    throw error;
                }
                mockLocalStorage[key] = value;
            });

            await stateManager.save(state);

            // Should have called setItem twice (first failed, retry succeeded)
            expect(localStorage.setItem).toHaveBeenCalledTimes(2);
        });
    });

    describe('load', () => {
        it('should load and parse state from localStorage', async () => {
            const state: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = JSON.stringify(state);

            const loaded = await stateManager.load();

            expect(loaded).not.toBeNull();
            expect(loaded?.version).toBe(1);
        });

        it('should return null when no stored state', async () => {
            const loaded = await stateManager.load();
            expect(loaded).toBeNull();
        });

        it('should return null for invalid JSON', async () => {
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = '{invalid json';

            const loaded = await stateManager.load();
            expect(loaded).toBeNull();
        });

        it('should return null for invalid state format', async () => {
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = '{"foo": "bar"}';

            const loaded = await stateManager.load();
            expect(loaded).toBeNull();
        });

        it('should handle missing version gracefully', async () => {
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = '{"plexAuth": null, "lastUpdated": 123}';

            const loaded = await stateManager.load();
            expect(loaded).toBeNull();
        });

        it('should handle future version gracefully', async () => {
            const futureState = {
                version: 999,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = JSON.stringify(futureState);

            const loaded = await stateManager.load();

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
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = JSON.stringify(state);

            const loaded = await stateManager.load();

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
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = JSON.stringify(state);

            const loaded = await stateManager.load();

            expect(loaded).not.toHaveProperty('plexAuth');
        });

        it('should default invalid userPreferences', async () => {
            const state = {
                version: 1,
                userPreferences: { theme: 'nope', volume: 999 },
                lastUpdated: Date.now(),
            };
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = JSON.stringify(state);

            const loaded = await stateManager.load();

            expect(loaded?.userPreferences).toEqual(stateManager.createDefaultState().userPreferences);
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
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = JSON.stringify(state);

            const loaded = await stateManager.load();

            expect(loaded).not.toBeNull();
            if (!loaded) return;
            expect(loaded.userPreferences).toEqual(state.userPreferences);
            expect('channelConfigs' in loaded).toBe(false);
            expect('currentChannelIndex' in loaded).toBe(false);
        });

        it('should repair minimal state after migration', async () => {
            const state = { version: 1 };
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = JSON.stringify(state);

            const loaded = await stateManager.load();

            expect(loaded).not.toBeNull();
            expect(loaded?.userPreferences).toEqual(stateManager.createDefaultState().userPreferences);
        });
    });

    describe('clear', () => {
        it('should remove stored state', async () => {
            mockLocalStorage[STORAGE_CONFIG.STATE_KEY] = '{}';

            await stateManager.clear();

            expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_CONFIG.STATE_KEY);
        });
    });

    describe('createDefaultState', () => {
        it('should create valid default state', () => {
            const state = stateManager.createDefaultState();

            expect(state.version).toBe(STORAGE_CONFIG.STATE_VERSION);
            expect(state.userPreferences).toBeDefined();
            expect(state.lastUpdated).toBeGreaterThan(0);
        });
    });
});
