import { EPGChannelList, EPGTimeHeader, EPGVirtualizer } from '../index';

describe('epg root barrel', () => {
    it('re-exports moved view symbols from the package root', () => {
        expect(EPGVirtualizer).toBeDefined();
        expect(EPGTimeHeader).toBeDefined();
        expect(EPGChannelList).toBeDefined();
    });
});
