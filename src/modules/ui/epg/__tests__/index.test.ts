import * as epgRoot from '../index';

describe('epg root barrel', () => {
    it('exports only cross-module seams used outside the package', () => {
        expect(epgRoot.EPGCoordinator).toBeDefined();
        expect(epgRoot.DeferredEpgComponent).toBeDefined();
        expect(epgRoot.EPGDebugRuntime).toBeDefined();
        expect(epgRoot.buildEpgStartupConfig).toBeDefined();
        expect(epgRoot.withEpgVisibleRangeChangeBinding).toBeDefined();
        expect(epgRoot.EPG_CONTAINER_ID).toBeDefined();
    });

    it('does not expose view-layer symbols from the package root', () => {
        expect((epgRoot as Record<string, unknown>).EPGVirtualizer).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGTimeHeader).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGChannelList).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).formatTime).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).formatTimeRange).toBeUndefined();
    });
});
