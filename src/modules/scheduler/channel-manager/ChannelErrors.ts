import { AppErrorCode } from '../../../types/app-errors';

/**
 * Channel-specific error with AppErrorCode.
 * Error handling guidance lives in repo-local docs and checklists (see `docs/`).
 */
export class ChannelError extends Error {
    public readonly code: AppErrorCode;
    public readonly recoverable: boolean;

    constructor(code: AppErrorCode, message: string, recoverable = false) {
        super(message);
        this.name = 'ChannelError';
        this.code = code;
        this.recoverable = recoverable;
    }
}
