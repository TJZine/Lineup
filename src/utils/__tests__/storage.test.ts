/**
 * @jest-environment jsdom
 */

import {
    readStoredBoolean,
    readStoredBooleanAndClean,
    readStoredBooleanMaybeAndClean,
} from '../storage';

describe('storage helpers', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('reads booleans from storage keys', () => {
        localStorage.setItem('k', '1');
        expect(readStoredBoolean('k', false)).toBe(true);
    });

    it('returns null for invalid stored boolean values and removes invalid entries', () => {
        localStorage.setItem('flag', 'maybe');

        expect(readStoredBooleanMaybeAndClean('flag')).toBe(null);
        expect(localStorage.getItem('flag')).toBe(null);
    });

    it('reads booleans with fallback and removes invalid entries', () => {
        localStorage.setItem('flag', 'oops');

        expect(readStoredBooleanAndClean('flag', true)).toBe(true);
        expect(localStorage.getItem('flag')).toBe(null);
    });

    it('readStoredBooleanMaybeAndClean parses 1 and does not remove the key', () => {
        localStorage.setItem('flag', '1');

        expect(readStoredBooleanMaybeAndClean('flag')).toBe(true);
        expect(localStorage.getItem('flag')).toBe('1');
    });

    it('readStoredBooleanMaybeAndClean parses 0 and does not remove the key', () => {
        localStorage.setItem('flag', '0');

        expect(readStoredBooleanMaybeAndClean('flag')).toBe(false);
        expect(localStorage.getItem('flag')).toBe('0');
    });

    it('readStoredBooleanMaybeAndClean returns null when key is missing', () => {
        expect(readStoredBooleanMaybeAndClean('missing')).toBe(null);
    });

    it('readStoredBooleanAndClean returns fallback when key is missing', () => {
        expect(readStoredBooleanAndClean('missing', true)).toBe(true);
    });

});
