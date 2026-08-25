import { isSelectionAbortError, throwIfSelectionAborted } from '../ServerSelectionAbort';

describe('ServerSelectionAbort', () => {
    it('delegates selection cancellation to the shared abort reason contract', () => {
        const reason = new Error('selection superseded');
        const controller = new AbortController();
        controller.abort(reason);

        expect(() => throwIfSelectionAborted(controller.signal)).toThrow(reason);
    });

    it.each([null, undefined])('returns without throwing for a %s signal', (signal) => {
        expect(() => throwIfSelectionAborted(signal)).not.toThrow();
    });

    const reason = new DOMException('selection superseded', 'AbortError');
    const distinctReason = new DOMException('selection superseded', 'AbortError');

    it.each([
        { label: 'matching reason', aborted: true, candidate: reason, expected: true },
        { label: 'distinct reason object', aborted: true, candidate: distinctReason, expected: false },
        { label: 'non-aborted signal', aborted: false, candidate: reason, expected: false },
    ])('classifies $label', ({ aborted, candidate, expected }) => {
        const controller = new AbortController();
        if (aborted) controller.abort(reason);

        expect(isSelectionAbortError(candidate, controller.signal)).toBe(expected);
    });

    it('does not classify an error as selection cancellation without a signal', () => {
        expect(isSelectionAbortError(reason, undefined)).toBe(false);
    });
});
