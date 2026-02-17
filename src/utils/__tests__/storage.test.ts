/**
 * @jest-environment jsdom
 */

import {
    readStoredBoolean,
} from '../storage';

describe('storage helpers', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('reads booleans from storage keys', () => {
        localStorage.setItem('k', '1');
        expect(readStoredBoolean('k', false)).toBe(true);
    });

});
