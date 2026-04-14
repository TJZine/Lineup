import { EPGChannelList, EPGTimeHeader, EPGVirtualizer } from '../index';

describe('epg view barrel', () => {
    it('keeps view-layer exports available for package-local consumers', () => {
        expect(EPGVirtualizer).toBeDefined();
        expect(EPGTimeHeader).toBeDefined();
        expect(EPGChannelList).toBeDefined();
    });
});
