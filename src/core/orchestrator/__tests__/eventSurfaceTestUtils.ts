export type TestEventHandler = (...args: readonly unknown[]) => void;

export interface TestEventSurface {
    on: jest.Mock;
    off: jest.Mock;
    emit: (event: string, ...args: readonly unknown[]) => void;
}

export function createTestEventSurface(): TestEventSurface {
    const handlers = new Map<string, Set<TestEventHandler>>();

    return {
        on: jest.fn((event: string, handler: TestEventHandler) => {
            const eventHandlers = handlers.get(event) ?? new Set<TestEventHandler>();
            eventHandlers.add(handler);
            handlers.set(event, eventHandlers);
        }),
        off: jest.fn((event: string, handler: TestEventHandler) => {
            const eventHandlers = handlers.get(event);
            if (!eventHandlers) {
                return;
            }

            eventHandlers.delete(handler);
            if (eventHandlers.size === 0) {
                handlers.delete(event);
            }
        }),
        emit: (event: string, ...args: readonly unknown[]): void => {
            handlers.get(event)?.forEach((handler) => {
                handler(...args);
            });
        },
    };
}
