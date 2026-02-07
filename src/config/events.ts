/**
 * @fileoverview Shared browser event names and helpers.
 * @module config/events
 * @version 1.0.0
 */

export const RETUNE_EVENT_NAMES = {
    DEBUG_LOGGING_CHANGED: 'retune:debug-logging-changed',
} as const;

export type DebugLoggingChangedDetail = {
    enabled: boolean;
};

export function dispatchDebugLoggingChanged(enabled: boolean): void {
    window.dispatchEvent(
        new CustomEvent<DebugLoggingChangedDetail>(RETUNE_EVENT_NAMES.DEBUG_LOGGING_CHANGED, {
            detail: { enabled },
        })
    );
}
