import { EPGChannelPrimePublisher } from '../coordinator/EPGChannelPrimePublisher';
import { createEpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';
import type { EpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';
import type { IEPGComponent } from '../interfaces';

describe('EPGChannelPrimePublisher', () => {
    const createOperation = (controller: AbortController): EpgRetainedOperationContext =>
        createEpgRetainedOperationContext([{
        signal: controller.signal,
        assertCurrent: (): void => {
            if (controller.signal.aborted) throw controller.signal.reason;
        },
        }]);

    it('stops the ordered publication suffix when authority becomes stale', () => {
        const controller = new AbortController();
        const reason = new DOMException('server transaction superseded', 'AbortError');
        const epg = {
            setLibraryTabs: jest.fn(() => controller.abort(reason)),
            setLayoutMode: jest.fn(),
            setNowWatchingBannerEnabled: jest.fn(),
            setVisibleHours: jest.fn(),
            loadChannels: jest.fn(),
        } as unknown as IEPGComponent;
        const operation = createOperation(controller);
        const publisher = new EPGChannelPrimePublisher(() => epg);

        expect(() => publisher.publish({
            shouldClearPersistedSelection: false,
            clearPersistedSelection: jest.fn(),
            tabs: { libraries: [], selectedId: null },
            layoutMode: 'classic',
            nowWatchingEnabled: true,
            visibleHours: 2,
            channels: [],
        }, operation)).toThrow(reason);

        expect(epg.setLibraryTabs).toHaveBeenCalledTimes(1);
        expect(epg.setLayoutMode).not.toHaveBeenCalled();
        expect(epg.loadChannels).not.toHaveBeenCalled();
        operation.release();
    });

    it('gates tabs and all UI publication behind invalid-filter cleanup', () => {
        const controller = new AbortController();
        const reason = new DOMException('cleanup superseded', 'AbortError');
        const epg = {
            setLibraryTabs: jest.fn(),
            setLayoutMode: jest.fn(),
            setNowWatchingBannerEnabled: jest.fn(),
            setVisibleHours: jest.fn(),
            loadChannels: jest.fn(),
        } as unknown as IEPGComponent;
        const operation = createOperation(controller);
        const publisher = new EPGChannelPrimePublisher(() => epg);

        expect(() => publisher.publish({
            shouldClearPersistedSelection: true,
            clearPersistedSelection: () => controller.abort(reason),
            tabs: { libraries: [], selectedId: null },
            layoutMode: 'classic',
            nowWatchingEnabled: true,
            visibleHours: 2,
            channels: [],
        }, operation)).toThrow(reason);

        expect(epg.setLibraryTabs).not.toHaveBeenCalled();
        expect(epg.loadChannels).not.toHaveBeenCalled();
        operation.release();
    });
});
