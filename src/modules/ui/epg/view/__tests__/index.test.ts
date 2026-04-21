import {
    EPGChannelList,
    EPGErrorBoundary,
    EPGInfoPanel,
    EPGInfoPanelCoordinator,
    EPGLibraryTabs,
    EPGTimeHeader,
    EPGVirtualizer,
    EPGVisibleRangeEmitter,
} from '../index';

describe('epg view barrel', () => {
    it('keeps view-layer exports available for package-local consumers', () => {
        expect(EPGVirtualizer).toBeDefined();
        expect(EPGTimeHeader).toBeDefined();
        expect(EPGChannelList).toBeDefined();
        expect(EPGInfoPanel).toBeDefined();
        expect(EPGInfoPanelCoordinator).toBeDefined();
        expect(EPGLibraryTabs).toBeDefined();
        expect(EPGErrorBoundary).toBeDefined();
        expect(EPGVisibleRangeEmitter).toBeDefined();
    });
});
