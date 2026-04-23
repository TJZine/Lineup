/**
 * @fileoverview Shared localStorage mock for unit tests.
 * @module __tests__/mocks/localStorage
 */

type MockStorageFunction<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;

export type MockLocalStorage = Storage & {
    getItem: MockStorageFunction<Storage['getItem']>;
    setItem: MockStorageFunction<Storage['setItem']>;
    removeItem: MockStorageFunction<Storage['removeItem']>;
    clear: MockStorageFunction<Storage['clear']>;
    key: MockStorageFunction<Storage['key']>;
};

const createStore = (): Record<string, string> => Object.create(null) as Record<string, string>;

let store = createStore();
let originalLocalStorageDescriptor: PropertyDescriptor | undefined;
let capturedOriginalDescriptor = false;

const readStoredValue = (key: string): string | null =>
    Object.prototype.hasOwnProperty.call(store, key) ? store[key]! : null;

const writeStoredValue = (key: string, value: string): void => {
    store[key] = value;
};

const removeStoredValue = (key: string): void => {
    delete store[key];
};

const resetStoredValues = (): void => {
    store = createStore();
};

/**
 * Creates a mock localStorage instance for testing.
 * @returns Storage-compatible mock object
 */
function createMockLocalStorage(): MockLocalStorage {
    return {
        get length(): number {
            return Object.keys(store).length;
        },
        key: jest.fn((index: number): string | null => {
            const keys = Object.keys(store);
            return index < keys.length ? keys[index]! : null;
        }),
        getItem: jest.fn((key: string): string | null => readStoredValue(key)),
        setItem: jest.fn((key: string, value: string): void => {
            writeStoredValue(key, value);
        }),
        removeItem: jest.fn((key: string): void => {
            removeStoredValue(key);
        }),
        clear: jest.fn((): void => {
            resetStoredValues();
        }),
    };
}

/**
 * Pre-configured mock localStorage singleton for test files.
 */
export const mockLocalStorage = createMockLocalStorage();

export function resetMockLocalStorage(): void {
    resetStoredValues();
    mockLocalStorage.key.mockReset();
    mockLocalStorage.key.mockImplementation((index: number): string | null => {
        const keys = Object.keys(store);
        return index < keys.length ? keys[index]! : null;
    });
    mockLocalStorage.getItem.mockReset();
    mockLocalStorage.getItem.mockImplementation((key: string): string | null => readStoredValue(key));
    mockLocalStorage.setItem.mockReset();
    mockLocalStorage.setItem.mockImplementation((key: string, value: string): void => {
        writeStoredValue(key, value);
    });
    mockLocalStorage.removeItem.mockReset();
    mockLocalStorage.removeItem.mockImplementation((key: string): void => {
        removeStoredValue(key);
    });
    mockLocalStorage.clear.mockReset();
    mockLocalStorage.clear.mockImplementation((): void => {
        resetStoredValues();
    });
}

/**
 * Installs the mock localStorage on globalThis.
 * Call this in beforeAll or at file top-level.
 */
export function installMockLocalStorage(): void {
    if (!capturedOriginalDescriptor) {
        originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        capturedOriginalDescriptor = true;
    }

    Object.defineProperty(globalThis, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
    });
}

export function restoreOriginalLocalStorage(): void {
    if (!capturedOriginalDescriptor) {
        return;
    }

    if (originalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
    } else {
        delete (globalThis as { localStorage?: Storage }).localStorage;
    }
}
