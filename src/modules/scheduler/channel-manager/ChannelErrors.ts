import { AppErrorCode } from '../../../types/app-errors';

export interface ChannelErrorDiagnostics {
    readonly context?: {
        readonly channelId?: string;
        readonly contentSource?: {
            readonly type: string;
            readonly id?: string;
        };
        readonly httpStatus?: number;
    };
    readonly causeSummary?: unknown;
}

/**
 * Channel-specific error with AppErrorCode.
 * Error handling guidance lives in repo-local docs and checklists (see `docs/`).
 */
export class ChannelError extends Error {
    public readonly code: AppErrorCode;
    public readonly recoverable: boolean;
    public readonly diagnostics?: ChannelErrorDiagnostics;

    constructor(
        code: AppErrorCode,
        message: string,
        recoverable = false,
        diagnostics?: ChannelErrorDiagnostics
    ) {
        super(message);
        this.name = 'ChannelError';
        this.code = code;
        this.recoverable = recoverable;
        if (diagnostics !== undefined) {
            this.diagnostics = diagnostics;
        }
    }
}
