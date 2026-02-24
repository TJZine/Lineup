/**
 * @fileoverview Shared browser event names and helpers.
 * @module config/events
 * @version 1.0.0
 */

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
