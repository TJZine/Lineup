import { createTestEventSurface } from './eventSurfaceTestUtils';

describe('createTestEventSurface', () => {
    it('delivers events to every registered listener and removes only the requested handler', () => {
        const eventSurface = createTestEventSurface();
        const firstHandler = jest.fn();
        const secondHandler = jest.fn();

        eventSurface.on('sample', firstHandler);
        eventSurface.on('sample', secondHandler);
        eventSurface.emit('sample', 'payload');

        expect(firstHandler).toHaveBeenCalledWith('payload');
        expect(secondHandler).toHaveBeenCalledWith('payload');

        eventSurface.off('sample', firstHandler);
        eventSurface.emit('sample', 'next-payload');

        expect(firstHandler).toHaveBeenCalledTimes(1);
        expect(secondHandler).toHaveBeenCalledWith('next-payload');
        expect(secondHandler).toHaveBeenCalledTimes(2);
        expect(secondHandler).toHaveBeenNthCalledWith(1, 'payload');
        expect(secondHandler).toHaveBeenNthCalledWith(2, 'next-payload');
    });

    it('uses a stable listener snapshot for each emit', () => {
        const eventSurface = createTestEventSurface();
        const calls: string[] = [];
        const addedHandler = jest.fn(() => {
            calls.push('added');
        });
        const removedHandler = jest.fn(() => {
            calls.push('removed');
        });
        const mutatingHandler = jest.fn(() => {
            calls.push('mutating');
            eventSurface.off('sample', removedHandler);
            eventSurface.on('sample', addedHandler);
        });

        eventSurface.on('sample', mutatingHandler);
        eventSurface.on('sample', removedHandler);

        eventSurface.emit('sample', 'payload');

        expect(calls).toEqual(['mutating', 'removed']);
        expect(addedHandler).not.toHaveBeenCalled();
        expect(removedHandler).toHaveBeenCalledTimes(1);
    });
});
