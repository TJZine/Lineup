import * as runtime from '../index';

describe('epg runtime barrel', () => {
    it('exports the runtime-owned epg primitives', () => {
        expect(runtime.EPGBackgroundWarmQueue).toBeDefined();
        expect(runtime.EPGScheduleCacheStore).toBeDefined();
        expect(runtime.EPGScheduleRefreshRuntime).toBeDefined();
        expect(runtime.EPGVisibleRangeRefreshQueue).toBeDefined();
    });
});
