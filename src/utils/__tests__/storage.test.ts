/**
 * @jest-environment jsdom
 */

import {
    readStoredBoolean,
    readStoredBooleanWithLegacy,
} from '../storage';

describe('storage helpers', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('reads booleans from storage keys', () => {
        localStorage.setItem('k', '1');
        expect(readStoredBoolean('k', false)).toBe(true);
    });

    it('prefers primary key when reading legacy-aware boolean', () => {
        localStorage.setItem('primary', '0');
        localStorage.setItem('legacy', '1');

        expect(readStoredBooleanWithLegacy('primary', 'legacy', true)).toBe(false);
        expect(localStorage.getItem('primary')).toBe('0');
        expect(localStorage.getItem('legacy')).toBe('1');
    });

    it('migrates legacy key value to primary key', () => {
        localStorage.setItem('legacy', '1');

        expect(readStoredBooleanWithLegacy('primary', 'legacy', false)).toBe(true);
        expect(localStorage.getItem('primary')).toBe('1');
        expect(localStorage.getItem('legacy')).toBeNull();
    });

    it('returns default when primary and legacy are missing/invalid', () => {
        localStorage.setItem('legacy', 'nope');

        expect(readStoredBooleanWithLegacy('primary', 'legacy', false)).toBe(false);
        expect(localStorage.getItem('primary')).toBeNull();
        expect(localStorage.getItem('legacy')).toBe('nope');
    });
});
