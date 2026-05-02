export interface IDisposable {
    dispose(): void;
}

/**
 * Type-safe event emitter interface with error isolation.
 * One handler's error does not prevent other handlers from executing.
 *
 * @template TEventMap - An object type mapping event names to payload types
 *
 * @example
 * ```typescript
 * interface MyEvents {
 *   userLogin: { userId: string };
 *   userLogout: { userId: string; reason: string };
 * }
 *
 * const emitter: IEventEmitter<MyEvents> = new EventEmitter();
 * emitter.on('userLogin', (payload) => console.log(payload.userId));
 * emitter.emit('userLogin', { userId: '123' });
 * ```
 */
export interface IEventEmitter<TEventMap extends object> {
    on<K extends keyof TEventMap>(
        event: K,
        handler: (payload: TEventMap[K]) => void
    ): IDisposable;

    off<K extends keyof TEventMap>(
        event: K,
        handler: (payload: TEventMap[K]) => void
    ): void;

    /**
     * Register a one-time event handler.
     * The handler will be automatically removed after it fires once.
     */
    once<K extends keyof TEventMap>(
        event: K,
        handler: (payload: TEventMap[K]) => void
    ): IDisposable;

    /**
     * Emit an event to all registered handlers.
     * Errors in handlers are caught and logged, NOT propagated.
     * This ensures one faulty handler doesn't crash the entire application.
     */
    emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void;

    removeAllListeners(event?: keyof TEventMap): void;

    listenerCount(event: keyof TEventMap): number;
}
