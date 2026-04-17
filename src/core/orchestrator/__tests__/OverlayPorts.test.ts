import * as overlayPorts from '../OverlayPorts';
import type {
    ChannelBadgeOverlayInitPort,
    ChannelNumberOverlayInitPort,
    ChannelNumberOverlayRuntimePort,
} from '../OverlayPorts';

describe('OverlayPorts', () => {
    it('exports only type-level overlay port contracts at runtime', () => {
        expect(overlayPorts).toEqual({});
    });

    it('narrows the channel number overlay init/runtime port shapes', () => {
        const channelNumberInitPort: ChannelNumberOverlayInitPort = {
            initialize: jest.fn(),
            showDigits: jest.fn(),
            showError: jest.fn(),
            scheduleHide: jest.fn(),
            hide: jest.fn(),
            isVisible: jest.fn(() => false),
            destroy: jest.fn(),
        };
        const channelNumberRuntimePort: ChannelNumberOverlayRuntimePort = channelNumberInitPort;

        channelNumberInitPort.initialize('channel-number-overlay');
        channelNumberRuntimePort.showDigits('123', 3);
        channelNumberRuntimePort.scheduleHide(900);

        expect(channelNumberInitPort.initialize).toHaveBeenCalledWith('channel-number-overlay');
        expect(channelNumberRuntimePort.showDigits).toHaveBeenCalledWith('123', 3);
        expect(channelNumberRuntimePort.scheduleHide).toHaveBeenCalledWith(900);
    });

    it('narrows the channel badge overlay init port shape', () => {
        const channelBadgePort: ChannelBadgeOverlayInitPort = {
            initialize: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            isVisible: jest.fn(() => true),
            destroy: jest.fn(),
        };

        channelBadgePort.initialize({ containerId: 'channel-badge-overlay' });
        channelBadgePort.show({ channelNumber: 7, channelName: 'Seven' });
        channelBadgePort.hide();

        expect(channelBadgePort.initialize).toHaveBeenCalledWith({
            containerId: 'channel-badge-overlay',
        });
        expect(channelBadgePort.show).toHaveBeenCalledWith({
            channelNumber: 7,
            channelName: 'Seven',
        });
        expect(channelBadgePort.hide).toHaveBeenCalledTimes(1);
    });
});
