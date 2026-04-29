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
    });
});
