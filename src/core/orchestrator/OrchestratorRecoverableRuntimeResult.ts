export type RecoverableRuntimeResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: unknown };

/**
 * `captureRecoverableRuntimeResult` is only for operations that complete synchronously.
 * Callers that may return or await a Promise must use `captureRecoverableRuntimeResultAsync`.
 */
export function captureRecoverableRuntimeResult<T>(
    operation: () => T
): RecoverableRuntimeResult<T> {
    try {
        return { ok: true, value: operation() };
    } catch (error) {
        return { ok: false, error };
    }
}

export async function captureRecoverableRuntimeResultAsync<T>(
    operation: () => Promise<T>
): Promise<RecoverableRuntimeResult<T>> {
    try {
        return { ok: true, value: await operation() };
    } catch (error) {
        return { ok: false, error };
    }
}
