/**
 * @jest-environment jsdom
 */

import { normalizeToastInput } from '../toast';

describe('toast payload normalization', () => {
    it('defaults payload type to info', () => {
        expect(normalizeToastInput({ message: 'Hello' })).toEqual({ message: 'Hello', type: 'info' });
    });

    it('preserves payload type', () => {
        expect(normalizeToastInput({ message: 'Oops', type: 'warning' })).toEqual({ message: 'Oops', type: 'warning' });
    });
});
