import { createRecoverableRuntimeWarningSink } from '../OrchestratorRecoverableRuntimeWarnings';

describe('OrchestratorRecoverableRuntimeWarnings', () => {
    it('delivers warnings through the provided sink', () => {
        const warn = jest.fn();
        const sink = createRecoverableRuntimeWarningSink({ warn });

        expect(
            sink.emit({
                message: 'Recoverable warning',
                data: { detail: 'x' },
            })
        ).toEqual({ delivered: true });
        expect(warn).toHaveBeenCalledWith('Recoverable warning', { detail: 'x' });
    });

    it('reports undelivered warnings when the sink throws', () => {
        const sink = createRecoverableRuntimeWarningSink({
            warn: () => {
                throw new Error('warn failed');
            },
        });

        expect(
            sink.emit({
                message: 'Recoverable warning',
                data: { detail: 'x' },
            })
        ).toEqual({ delivered: false });
    });
});
