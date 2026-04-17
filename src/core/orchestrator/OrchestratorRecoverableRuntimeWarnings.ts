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

    return {
        emit: ({ message, data }: RecoverableRuntimeWarningEntry): { delivered: boolean } => {
            try {
                warn(message, data);
                return { delivered: true };
            } catch {
                return { delivered: false };
            }
        },
    };
}

function defaultRecoverableRuntimeWarn(message?: unknown, ...optionalParams: unknown[]): void {
    globalThis.console?.warn?.call(globalThis.console, message, ...optionalParams);
}
