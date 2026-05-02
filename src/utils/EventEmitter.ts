import { IEventEmitter, IDisposable } from './interfaces';
import { summarizeErrorForLog } from './errors';

function warnHandlerError(event: PropertyKey, summary: unknown): void {
    globalThis.console?.warn?.call(
        globalThis.console,
        "[EventEmitter] Handler error for event '" + String(event) + "':",
        summary
    );
}

function reportHandlerError(event: PropertyKey, error: unknown): void {
    warnHandlerError(event, summarizeErrorForLog(error));
}

export class EventEmitter<TEventMap extends object>
    implements IEventEmitter<TEventMap> {
    private _handlers: Map<keyof TEventMap, Set<(payload: unknown) => void>> =
        new Map();

    public on<K extends keyof TEventMap>(
        event: K,
        handler: (payload: TEventMap[K]) => void
    ): IDisposable {
        if (!this._handlers.has(event)) {
            this._handlers.set(event, new Set());
        }
        const handlerSet = this._handlers.get(event);
        if (handlerSet) {
            handlerSet.add(handler as (payload: unknown) => void);
        }

        return {
            dispose: (): void => this.off(event, handler),
        };
    }

    public off<K extends keyof TEventMap>(
        event: K,
        handler: (payload: TEventMap[K]) => void
    ): void {
        const handlerSet = this._handlers.get(event);
        if (handlerSet) {
            handlerSet.delete(handler as (payload: unknown) => void);
        }
    }

    public once<K extends keyof TEventMap>(
        event: K,
        handler: (payload: TEventMap[K]) => void
    ): IDisposable {
        const wrappedHandler = (payload: TEventMap[K]): void => {
            this.off(event, wrappedHandler);
            handler(payload);
        };
        return this.on(event, wrappedHandler);
    }

    public emit<K extends keyof TEventMap>(
        event: K,
        payload: TEventMap[K]
    ): void {
        const eventHandlers = this._handlers.get(event);
        if (!eventHandlers) {
            return;
        }

        for (const handler of [...eventHandlers]) {
            try {
                handler(payload);
            } catch (error) {
                try {
                    reportHandlerError(event, error);
                } catch {
                    // Best-effort logging only; delivery isolation is the real contract.
                }
            }
        }
    }

    public removeAllListeners(event?: keyof TEventMap): void {
        if (event !== undefined) {
            this._handlers.delete(event);
        } else {
            this._handlers.clear();
        }
    }

    public listenerCount(event: keyof TEventMap): number {
        const handlerSet = this._handlers.get(event);
        if (handlerSet) {
            return handlerSet.size;
        }
        return 0;
    }
}
