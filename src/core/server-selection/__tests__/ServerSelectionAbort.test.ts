import { isSelectionAbortError, throwIfSelectionAborted } from '../ServerSelectionAbort';

describe('ServerSelectionAbort', () => {
    it('delegates selection cancellation to the shared abort reason contract', () => {
        const reason = new Error('selection superseded');
        const controller = new AbortController();
        controller.abort(reason);

        expect(() => throwIfSelectionAborted(controller.signal)).toThrow(reason);
    });

    it.each([
        { label: 'matching reason', aborted: true, candidate: 'reason', expected: true },
        { label: 'different reason', aborted: true, candidate: 'other', expected: false },
        { label: 'non-aborted signal', aborted: false, candidate: 'reason', expected: false },
    ])('classifies $label', ({ aborted, candidate, expected }) => {
        const controller = new AbortController();
        if (aborted) controller.abort('reason');

        expect(isSelectionAbortError(candidate, controller.signal)).toBe(expected);
    });
});
