import { EventEmitter } from '../../../../utils/EventEmitter';
import { redactSensitiveTokens } from '../../../../utils/redact';
import { AppErrorCode } from '../../../../types/app-errors';
import type { EPGErrorType } from '../types';

interface EPGErrorBoundaryEvents {
    /** Fired when too many errors of same type occur */
    degradedMode: { type: EPGErrorType; count: number };
}

/**
 * Centralized error handling for EPG component.
 * Prevents cascading failures and enables graceful degradation.
 */
export class EPGErrorBoundary extends EventEmitter<EPGErrorBoundaryEvents> {
    private errorCounts: Map<EPGErrorType, number> = new Map();
    private readonly MAX_ERRORS_PER_TYPE = 3;

    private showFallbackRowFn: ((context: string) => void) | null = null;
    private resetScrollPositionFn: (() => void) | null = null;
    private forceRecycleAllFn: (() => void) | null = null;

    setCallbacks(callbacks: {
        showFallbackRow?: (context: string) => void;
        resetScrollPosition?: () => void;
        forceRecycleAll?: () => void;
    }): void {
        if (callbacks.showFallbackRow) {
            this.showFallbackRowFn = callbacks.showFallbackRow;
        }
        if (callbacks.resetScrollPosition) {
            this.resetScrollPositionFn = callbacks.resetScrollPosition;
        }
        if (callbacks.forceRecycleAll) {
            this.forceRecycleAllFn = callbacks.forceRecycleAll;
        }
    }

    /**
     * Handle an error with appropriate recovery strategy.
     */
    handleError(type: EPGErrorType, context: string, error?: Error): void {
        const existing = this.errorCounts.get(type);
        const count = (existing !== undefined ? existing : 0) + 1;
        this.errorCounts.set(type, count);

        console.warn(
            `[EPG] ${type} in ${context}:`,
            error ? redactSensitiveTokens(error.message) : undefined
        );

        switch (type) {
            case AppErrorCode.RENDER_ERROR:
                // Show fallback row, don't crash entire grid
                if (this.showFallbackRowFn) {
                    this.showFallbackRowFn(context);
                }
                break;
            case AppErrorCode.SCROLL_TIMEOUT:
                // Reset to known good state
                if (this.resetScrollPositionFn) {
                    this.resetScrollPositionFn();
                }
                break;
            case AppErrorCode.POOL_EXHAUSTED:
                // Aggressive cleanup
                if (this.forceRecycleAllFn) {
                    this.forceRecycleAllFn();
                }
                break;
            case AppErrorCode.EMPTY_CHANNEL:
            case AppErrorCode.NAV_BOUNDARY:
            case AppErrorCode.PARSE_ERROR:
                // These are handled silently, just logged
                break;
        }

        if (count >= this.MAX_ERRORS_PER_TYPE) {
            this.emit('degradedMode', { type, count });
        }
    }

    /**
     * Wrap an operation with error handling.
     */
    wrap<T>(
        type: EPGErrorType,
        context: string,
        operation: () => T
    ): T | undefined {
        try {
            return operation();
        } catch (error) {
            this.handleError(
                type,
                context,
                error instanceof Error ? error : new Error(String(error))
            );
            return undefined;
        }
    }

    /**
     * Reset error counts (e.g., on successful recovery).
     */
    resetCounts(): void {
        this.errorCounts.clear();
    }

    getErrorCount(type: EPGErrorType): number {
        return this.errorCounts.get(type) || 0;
    }

    isDegraded(type: EPGErrorType): boolean {
        return this.getErrorCount(type) >= this.MAX_ERRORS_PER_TYPE;
    }

    destroy(): void {
        this.errorCounts.clear();
        this.showFallbackRowFn = null;
        this.resetScrollPositionFn = null;
        this.forceRecycleAllFn = null;
        this.removeAllListeners();
    }
}
