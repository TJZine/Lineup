import type { OrchestratorServerSelectionRuntime } from '../runtime/OrchestratorServerSelectionRuntime';
import { OrchestratorServerSelectionRuntimeProjection } from '../runtime/OrchestratorServerSelectionRuntimeProjection';

function createRuntime(): jest.Mocked<OrchestratorServerSelectionRuntime> {
    return {
        getSelectedServerId: jest.fn().mockReturnValue('server-1'),
        selectServer: jest.fn().mockResolvedValue({
            kind: 'selection_failed',
            reason: 'server_not_found',
        }),
        clearSelectedServer: jest.fn().mockResolvedValue(undefined),
        getQuarantineState: jest.fn().mockReturnValue({ kind: 'clear' }),
        retryQuarantineRecovery: jest.fn().mockResolvedValue(undefined),
        exitQuarantine: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrchestratorServerSelectionRuntime>;
}

describe('OrchestratorServerSelectionRuntimeProjection', () => {
    it('delegates selection and quarantine commands without changing results', async () => {
        const runtime = createRuntime();
        const reportGlobalError = jest.fn();
        const projection = new OrchestratorServerSelectionRuntimeProjection(runtime, reportGlobalError);

        await expect(projection.selectServer('server-1')).resolves.toEqual({
            kind: 'selection_failed',
            reason: 'server_not_found',
        });
        await projection.retryQuarantineRecovery();
        await projection.exitQuarantine();

        expect(reportGlobalError).not.toHaveBeenCalled();
        expect(runtime.retryQuarantineRecovery).toHaveBeenCalledTimes(1);
        expect(runtime.exitQuarantine).toHaveBeenCalledTimes(1);
    });

    it('reports sanitized recovery presentation only when a failed selection entered quarantine', async () => {
        const error = new Error('credential-shaped internal detail');
        const runtime = createRuntime();
        runtime.selectServer.mockRejectedValue(error);
        runtime.getQuarantineState.mockReturnValue({
            kind: 'quarantined',
            phase: 'proof',
            commandPending: false,
        });
        const reportGlobalError = jest.fn();
        const projection = new OrchestratorServerSelectionRuntimeProjection(runtime, reportGlobalError);

        await expect(projection.selectServer('server-1')).rejects.toBe(error);

        expect(reportGlobalError).toHaveBeenCalledWith({
            code: 'INITIALIZATION_FAILED',
            message: 'Selected-server recovery requires user action.',
            recoverable: true,
            context: { recoveryMode: 'selected-server-quarantine' },
        }, 'server-selection-quarantine');
        expect(JSON.stringify(reportGlobalError.mock.calls)).not.toContain(error.message);
    });
});
