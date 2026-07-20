import type { AppError } from '../../../modules/lifecycle';
import { AppErrorCode } from '../../../types/app-errors';
import { SELECTED_SERVER_QUARANTINE_PHASES } from '../../server-selection/SelectedServerQuarantineRecoveryState';
import { createSelectedServerRecoveryLogData } from '../runtime/SelectedServerRecoveryAppError';

const RECOVERY_DIAGNOSTIC = {
    operationFailure: {
        step: 'selection',
        error: { name: 'Error', message: 'selection failed' },
    },
    recoveryFailure: {
        step: 'proof',
        error: { name: 'Error', message: 'proof failed' },
    },
} as const;

function createRecoveryError(recoveryPhase: unknown): AppError {
    return {
        code: AppErrorCode.INITIALIZATION_FAILED,
        message: 'Selected-server recovery requires user action.',
        recoverable: true,
        context: {
            recoveryMode: 'selected-server-quarantine',
            recoveryPhase,
            recoveryDiagnostic: RECOVERY_DIAGNOSTIC,
        },
    };
}

describe('SelectedServerRecoveryAppError', () => {
    it.each(SELECTED_SERVER_QUARANTINE_PHASES)(
        'projects the %s quarantine phase from untyped error context',
        (recoveryPhase) => {
            expect(createSelectedServerRecoveryLogData(createRecoveryError(recoveryPhase)))
                .toEqual({
                    selectedServerRecovery: {
                        recoveryMode: 'selected-server-quarantine',
                        recoveryPhase,
                        recoveryDiagnostic: RECOVERY_DIAGNOSTIC,
                    },
                });
        }
    );

    it('rejects recovery phases outside the quarantine state model', () => {
        expect(createSelectedServerRecoveryLogData(createRecoveryError('future_phase')))
            .toBeUndefined();
    });
});
