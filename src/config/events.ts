export const LINEUP_EVENT_NAMES = {
    DEBUG_LOGGING_CHANGED: 'lineup:debug-logging-changed',
} as const;

type DebugLoggingChangedDetail = {
    enabled: boolean;
};

export function dispatchDebugLoggingChanged(enabled: boolean): void {
    window.dispatchEvent(
        new CustomEvent<DebugLoggingChangedDetail>(LINEUP_EVENT_NAMES.DEBUG_LOGGING_CHANGED, {
            detail: { enabled },
        })
    );
}
