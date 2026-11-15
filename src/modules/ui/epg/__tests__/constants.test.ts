import {
    DEFAULT_EPG_CONFIG,
    EPG_CONSTANTS,
    EPG_CONTAINER_ID,
    createDefaultEpgConfig,
} from '../constants';
import { blockFor, declarationValue, read, topLevelBlockForProperty } from '../../../../styles/__tests__/helpers/css-test-utils';

describe('EPG default config', () => {
    it('owns the canonical row height through EPG constants', () => {
        expect(EPG_CONSTANTS.ROW_HEIGHT).toBe(114);
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

    it('fits five complete default rows on the approved 1920×1080 Guide canvas', () => {
        const shell = read('src/modules/ui/epg/styles.shell.css');
        const classic = read('src/modules/ui/epg/styles.classic.css');
        const grid = read('src/modules/ui/epg/styles.grid.css');
        const tracks = declarationValue(blockFor(shell, '.epg-container.visible'), 'grid-template-rows');
        const fixedTracks = [...tracks.matchAll(/(\d+)px/g)].map((match) => Number(match[1]));
        expect(fixedTracks).toEqual([80, 324, 66]);

        const gridBlock = blockFor(classic, '.epg-container .epg-grid');
        const headerBlock = topLevelBlockForProperty(classic, '.epg-container .epg-time-header', 'box-sizing');
        const rowBlock = blockFor(grid, '.epg-channel-row');
        expect(declarationValue(gridBlock, 'box-sizing')).toBe('border-box');
        expect(declarationValue(headerBlock, 'box-sizing')).toBe('border-box');
        expect(declarationValue(rowBlock, 'box-sizing')).toBe('border-box');

        const gridBorder = Number(declarationValue(gridBlock, 'border-top').match(/^\d+/)?.[0]);
        const headerHeight = Number(declarationValue(headerBlock, 'height').match(/^\d+/)?.[0]);
        const availableRowsHeight = 1080 - fixedTracks.reduce((total, track) => total + track, 0)
            - gridBorder - headerHeight;
        expect(availableRowsHeight).toBeGreaterThanOrEqual(5 * EPG_CONSTANTS.ROW_HEIGHT);
    });
});
