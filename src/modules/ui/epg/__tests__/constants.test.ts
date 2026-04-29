import {
    DEFAULT_EPG_CONFIG,
    EPG_CONSTANTS,
    EPG_CONTAINER_ID,
    createDefaultEpgConfig,
} from '../constants';

describe('EPG default config', () => {
    it('owns the canonical row height through EPG constants', () => {
        expect(EPG_CONSTANTS.ROW_HEIGHT).toBe(108);
        expect(DEFAULT_EPG_CONFIG.rowHeight).toBe(EPG_CONSTANTS.ROW_HEIGHT);
        expect(createDefaultEpgConfig().rowHeight).toBe(EPG_CONSTANTS.ROW_HEIGHT);
    });

    it('creates fresh default config objects from the EPG-owned defaults', () => {
        const first = createDefaultEpgConfig();
        const second = createDefaultEpgConfig();

        expect(first).not.toBe(second);
        expect(first).toEqual(DEFAULT_EPG_CONFIG);
        expect(first.containerId).toBe(EPG_CONTAINER_ID);

        first.rowHeight = 1;

        expect(second.rowHeight).toBe(EPG_CONSTANTS.ROW_HEIGHT);
        expect(DEFAULT_EPG_CONFIG.rowHeight).toBe(EPG_CONSTANTS.ROW_HEIGHT);
    });
});
