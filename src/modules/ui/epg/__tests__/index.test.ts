import * as epgRoot from '../index';

describe('epg root barrel', () => {
    it('exports only cross-module seams used outside the package', () => {
        expect(epgRoot.EPGCoordinator).toBeDefined();
        expect(epgRoot.DeferredEPGComponent).toBeDefined();
        expect(epgRoot.EPGDebugRuntime).toBeDefined();
        expect(epgRoot.buildEPGStartupConfig).toBeDefined();
        expect(epgRoot.withEpgVisibleRangeChangeBinding).toBeDefined();
        expect(epgRoot.EPG_CONTAINER_ID).toBeDefined();
        expect(epgRoot.createDefaultEpgConfig).toBeDefined();
        expect((epgRoot as Record<string, unknown>).DeferredEpgComponent).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).buildEpgStartupConfig).toBeUndefined();
    });

    it('does not expose view-layer symbols from the package root', () => {
        expect((epgRoot as Record<string, unknown>).EPGVirtualizer).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGTimeHeader).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGChannelList).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGInfoPanel).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGInfoPanelCoordinator).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGLibraryTabs).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGErrorBoundary).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).EPGVisibleRangeEmitter).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).formatTime).toBeUndefined();
        expect((epgRoot as Record<string, unknown>).formatTimeRange).toBeUndefined();
    });
});
