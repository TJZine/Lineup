import { summarizeErrorForLog } from '../../../utils/errors';

export interface RecoverableRuntimeWarningEntry {
    message: string;
    data: unknown;
}

export interface RecoverableRuntimeWarningSink {
    emit: (entry: RecoverableRuntimeWarningEntry) => { delivered: boolean };
}

interface CreateRecoverableRuntimeWarningSinkInput {
    warn?: ((message?: unknown, ...optionalParams: unknown[]) => void) | undefined;
}

export function createRecoverableRuntimeWarningSink(
    input: CreateRecoverableRuntimeWarningSinkInput = {}
): RecoverableRuntimeWarningSink {
    const warn = input.warn ?? defaultRecoverableRuntimeWarn;
    const usesDefaultWarn = input.warn === undefined;

    return {
        emit: ({ message, data }: RecoverableRuntimeWarningEntry): { delivered: boolean } => {
            try {
                warn(message, data);
                return { delivered: true };
            } catch (error) {
                if (!usesDefaultWarn) {
                    try {
                        defaultRecoverableRuntimeWarn(
                            '[RecoverableRuntimeWarning] injected warn failed:',
                            {
                                warning: { message, data },
                                error: summarizeErrorForLog(error),
                            }
                        );
                    } catch {
                        // Default warning delivery is already the final fallback path.
                    }
                }
                return { delivered: false };
            }
        },
    };
}

function defaultRecoverableRuntimeWarn(message?: unknown, ...optionalParams: unknown[]): void {
    globalThis.console?.warn?.call(globalThis.console, message, ...optionalParams);
}
