import { createRecoverableRuntimeWarningSink } from '../runtime/OrchestratorRecoverableRuntimeWarnings';

describe('OrchestratorRecoverableRuntimeWarnings', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('delivers warnings through the default console-backed sink', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const sink = createRecoverableRuntimeWarningSink();

        expect(
            sink.emit({
                message: 'Recoverable warning',
                data: { detail: 'x' },
            })
        ).toEqual({ delivered: true });
        expect(consoleWarnSpy).toHaveBeenCalledWith('Recoverable warning', { detail: 'x' });
    });

    it('falls back to the default console warning when an injected warn throws', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[RecoverableRuntimeWarning] injected warn failed:',
            expect.objectContaining({
                warning: {
                    message: 'Recoverable warning',
                    data: { detail: 'x' },
                },
                error: expect.objectContaining({
                    message: 'warn failed',
                }),
            })
        );
    });

    it('reports undelivered warnings without recursive fallback when the default warn path throws', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            throw new Error('console failed');
        });
        const sink = createRecoverableRuntimeWarningSink();

        expect(
            sink.emit({
                message: 'Recoverable warning',
                data: { detail: 'x' },
            })
        ).toEqual({ delivered: false });
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
});
