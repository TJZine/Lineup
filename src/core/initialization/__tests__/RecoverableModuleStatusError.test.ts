import { AppErrorCode } from '../../../types/app-errors';
import { toRecoverableModuleStatusError } from '../RecoverableModuleStatusError';

describe('toRecoverableModuleStatusError', () => {
    it('preserves valid code, message, recoverable flag, and context', () => {
        const error = toRecoverableModuleStatusError(
            {
                code: AppErrorCode.SERVER_UNREACHABLE,
                message: 'Discovery timed out.',
                recoverable: false,
                context: { moduleId: 'plex-discovery', attempt: 2 },
            },
            'Fallback message'
        );

        expect(error).toEqual({
            code: AppErrorCode.SERVER_UNREACHABLE,
            message: 'Discovery timed out.',
            recoverable: false,
            context: { moduleId: 'plex-discovery', attempt: 2 },
        });
    });

    it('falls back when code and message are invalid while defaulting recoverable to true', () => {
        const error = toRecoverableModuleStatusError(
            {
                code: 'NOT_REAL',
                message: '   ',
                context: ['not', 'an', 'object'],
            },
            'Module failed to start.',
            AppErrorCode.INITIALIZATION_FAILED
        );

        expect(error).toEqual({
            code: AppErrorCode.INITIALIZATION_FAILED,
            message: 'Module failed to start.',
            recoverable: true,
        });
    });

    it.each([
        [
            new Error('Network request failed'),
            {
                code: AppErrorCode.MODULE_INIT_FAILED,
                message: 'Network request failed',
                recoverable: true,
            },
        ],
        [
            'Storage quota exceeded',
            {
                code: AppErrorCode.MODULE_INIT_FAILED,
                message: 'Storage quota exceeded',
                recoverable: true,
            },
        ],
    ])('uses normalized fallback structure for %p inputs', (input, expected) => {
        expect(toRecoverableModuleStatusError(input, 'Fallback message')).toEqual(expected);
    });

    it('uses object message values while defaulting non-boolean recoverable to true', () => {
        expect(
            toRecoverableModuleStatusError(
                {
                    code: AppErrorCode.AUTH_REQUIRED,
                    message: 'Token expired.',
                    recoverable: 'yes',
                },
                'Fallback message'
            )
        ).toEqual({
            code: AppErrorCode.AUTH_REQUIRED,
            message: 'Token expired.',
            recoverable: true,
        });
    });

    it('drops invalid object context while preserving a valid fallback message', () => {
        expect(
            toRecoverableModuleStatusError(
                {
                    code: AppErrorCode.SERVER_UNREACHABLE,
                    message: '',
                    context: null,
                },
                'Server was unavailable.'
            )
        ).toEqual({
            code: AppErrorCode.SERVER_UNREACHABLE,
            message: 'Server was unavailable.',
            recoverable: true,
        });
    });
});
