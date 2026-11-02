/** @jest-environment jsdom */

import { AppAuthoringScreenRegistry } from '../deferred-screens/AppAuthoringScreenRegistry';
import type { ChannelDirectoryPorts } from '../../../modules/ui/channels/ChannelDirectoryPorts';
import type { ChannelStudioPorts } from '../../channel-studio/ChannelStudioContracts';
import type { ChannelDirectoryScreen } from '../../../modules/ui/channels/ChannelDirectoryScreen';
import type { ChannelStudioScreen } from '../../../modules/ui/channel-studio/ChannelStudioScreen';
import { flushPromises } from '../../../__tests__/helpers';

describe('AppAuthoringScreenRegistry', () => {
    it('discards instances bound to a previous server or profile scope', async () => {
        let scope = 'profile-a/server-a';
        const construct = jest.fn();
        const destroy = jest.fn();
        class FakeDirectory {
            constructor() { construct(); }
            show(): void { return; }
            hide(): void { return; }
            destroy(): void { destroy(); }
        }
        const registry = new AppAuthoringScreenRegistry({
            directoryContainer: document.createElement('div'),
            studioContainer: document.createElement('div'),
            createDirectoryPorts: (): ChannelDirectoryPorts => ({} as ChannelDirectoryPorts),
            createStudioPorts: (): ChannelStudioPorts => ({} as ChannelStudioPorts),
            getScopeKey: (): string => scope,
            onLoadError: jest.fn(),
            loaders: {
                directory: async (): Promise<typeof import('../../../modules/ui/channels/ChannelDirectoryScreen')> =>
                    ({ ChannelDirectoryScreen: FakeDirectory as unknown as typeof ChannelDirectoryScreen }),
            },
        });

        registry.showDirectory();
        await flushPromises(8);
        scope = 'profile-b/server-a';
        registry.showDirectory();
        await flushPromises(8);
        expect(construct).toHaveBeenCalledTimes(2);
        expect(destroy).toHaveBeenCalledTimes(1);
        registry.destroy();
    });

    it('does not reveal a late Directory load after Studio takes the route', async () => {
        let finishDirectory: ((value: typeof import('../../../modules/ui/channels/ChannelDirectoryScreen')) => void) | null = null;
        const directoryLoad = new Promise<typeof import('../../../modules/ui/channels/ChannelDirectoryScreen')>(resolve => {
            finishDirectory = resolve;
        });
        const directoryShow = jest.fn();
        const studioShow = jest.fn();
        const directoryHide = jest.fn();
        const studioHide = jest.fn();
        const directoryDestroy = jest.fn();
        const studioDestroy = jest.fn();
        const onLoadError = jest.fn();
        class FakeDirectory {
            show(_preferred?: string): void { directoryShow(_preferred); }
            hide(): void { directoryHide(); }
            destroy(): void { directoryDestroy(); }
        }
        class FakeStudio {
            show(request: { kind: string }): void { studioShow(request); }
            hide(): void { studioHide(); }
            destroy(): void { studioDestroy(); }
        }
        const registry = new AppAuthoringScreenRegistry({
            directoryContainer: document.createElement('div'),
            studioContainer: document.createElement('div'),
            createDirectoryPorts: (): ChannelDirectoryPorts => ({} as ChannelDirectoryPorts),
            createStudioPorts: (): ChannelStudioPorts => ({} as ChannelStudioPorts),
            getScopeKey: (): string => 'scope-1',
            onLoadError,
            loaders: {
                directory: (): typeof directoryLoad => directoryLoad,
                studio: async (): Promise<typeof import('../../../modules/ui/channel-studio/ChannelStudioScreen')> =>
                    ({ ChannelStudioScreen: FakeStudio as unknown as typeof ChannelStudioScreen }),
            },
        });

        registry.showDirectory();
        registry.showStudio({ kind: 'create' });
        await flushPromises(8);
        expect(onLoadError).not.toHaveBeenCalled();
        expect(studioShow).toHaveBeenCalledWith({ kind: 'create' });

        const releaseDirectory = finishDirectory as ((value: typeof import('../../../modules/ui/channels/ChannelDirectoryScreen')) => void) | null;
        releaseDirectory?.({ ChannelDirectoryScreen: FakeDirectory as unknown as typeof ChannelDirectoryScreen });
        await flushPromises(8);
        expect(directoryShow).not.toHaveBeenCalled();

        registry.showDirectory('channel-17');
        await flushPromises(8);
        expect(directoryShow).toHaveBeenCalledWith('channel-17');
        expect(studioHide).toHaveBeenCalled();

        registry.destroy();
        expect(directoryDestroy).toHaveBeenCalledTimes(1);
        expect(studioDestroy).toHaveBeenCalledTimes(1);
    });
});
