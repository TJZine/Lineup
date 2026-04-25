import type { IEPGDebugRuntime } from './EPGDebugRuntime';

export const isDebugRuntimeEnabled = (
    debugRuntime: IEPGDebugRuntime | null | undefined
): boolean => {
    try {
        return debugRuntime?.isEnabled() ?? false;
    } catch {
        return false;
    }
};

export const appendDebugRuntimeLog = (
    debugRuntime: IEPGDebugRuntime | null | undefined,
    event: string,
    payload: Record<string, unknown>
): void => {
    if (!debugRuntime) {
        return;
    }

    try {
        debugRuntime.append(event, payload);
    } catch {
        // Debug logging must never break UI flows.
    }
};
