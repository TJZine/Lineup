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

});
