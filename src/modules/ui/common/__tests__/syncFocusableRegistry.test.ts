import { syncFocusableRegistry } from '../focus/syncFocusableRegistry';
import type { FocusableElement } from '../../../navigation/interfaces';

const makeFocusable = (id: string): FocusableElement => ({
    id,
    element: {} as HTMLElement,
    neighbors: {},
});

describe('syncFocusableRegistry', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('unregisters previous ids before registering next entries and returns ids in entry order', () => {
        const callOrder: string[] = [];
        const nav = {
            unregisterFocusable: jest.fn((id: string) => {
                callOrder.push(`u:${id}`);
            }),
            registerFocusable: jest.fn((entry: FocusableElement) => {
                callOrder.push(`r:${entry.id}`);
            }),
        };

        const entries = [makeFocusable('next-1'), makeFocusable('next-2')];
        const result = syncFocusableRegistry(nav, ['prev-1', 'prev-2'], entries);

        expect(callOrder).toEqual(['u:prev-1', 'u:prev-2', 'r:next-1', 'r:next-2']);
        expect(nav.registerFocusable).toHaveBeenNthCalledWith(1, entries[0]);
        expect(nav.registerFocusable).toHaveBeenNthCalledWith(2, entries[1]);
        expect(result).toEqual(['next-1', 'next-2']);
    });

    it('handles empty previous ids and empty next entries', () => {
        const nav = {
            unregisterFocusable: jest.fn(),
            registerFocusable: jest.fn(),
        };

        const result = syncFocusableRegistry(nav, [], []);

        expect(nav.unregisterFocusable).not.toHaveBeenCalled();
        expect(nav.registerFocusable).not.toHaveBeenCalled();
        expect(result).toEqual([]);
    });
});
