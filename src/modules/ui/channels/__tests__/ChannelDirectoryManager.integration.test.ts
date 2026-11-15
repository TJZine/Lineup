import { ChannelManager } from '../../../scheduler/channel-manager/ChannelManager';
import { createBaseChannel, createMockLibrary } from '../../../scheduler/channel-manager/__tests__/channel-manager-test-helpers';
import { installMockLocalStorage, resetMockLocalStorage, restoreOriginalLocalStorage } from '../../../../__tests__/mocks/localStorage';
import type { ChannelDirectoryPorts } from '../ChannelDirectoryPorts';
import { ChannelDirectoryModel } from '../ChannelDirectoryModel';

installMockLocalStorage();

describe('directory writes through durable ChannelManager', () => {
    let manager: ChannelManager;
    beforeEach(() => {
        resetMockLocalStorage();
        manager = new ChannelManager({ plexLibrary: createMockLibrary(), logger: { warn: jest.fn(), error: jest.fn() } });
    });
    afterEach(() => manager.dispose());
    afterAll(() => restoreOriginalLocalStorage());

    test('reorder atomically assigns existing number slots and preserves late selection', async () => {
        await manager.replaceAllChannels([
            createBaseChannel({ id: 'a', number: 10 }), createBaseChannel({ id: 'b', number: 30 }),
            createBaseChannel({ id: 'c', number: 80 }),
        ]);
        const ports: ChannelDirectoryPorts = {
            manager, navigation: {
                registerFocusable: jest.fn(), unregisterFocusable: jest.fn(), setFocus: jest.fn(),
                getFocusedElement: jest.fn((): null => null), on: jest.fn(() => ({ dispose: jest.fn() })), off: jest.fn(),
                openModal: jest.fn(), closeModal: jest.fn(), isModalOpen: jest.fn(() => false),
            },
            openStudio: jest.fn(), openGenerate: jest.fn(), goBack: jest.fn(),
            getActiveMediaIdentity: jest.fn((): null => null), getDirectoryScopeKey: (): string => 'scope',
            stopDeletedMediaIfCurrent: jest.fn(async () => 'superseded'),
            refreshAfterCommit: jest.fn(async () => undefined), openGuideAfterActiveDelete: jest.fn(), now: (): number => 1,
        };
        const model = new ChannelDirectoryModel(ports);
        expect(model.beginReorder()).toBe(true); model.move('b', -1);
        manager.setCurrentChannel('c');
        expect(await model.saveOrder()).toBe(true);
        expect(manager.getAllChannels().map(ch => [ch.id, ch.number])).toEqual([['b', 10], ['a', 30], ['c', 80]]);
        expect(manager.getCurrentChannel()?.id).toBe('c');
    });
});
