import {
    createEmptyChannelSetupEstimates,
    toChannelSetupDecadeValue,
} from '../planning/ChannelSetupPlanningTypes';

describe('ChannelSetupPlanningTypes helpers', () => {
    it('creates an empty estimates object for every setup strategy', () => {
        expect(createEmptyChannelSetupEstimates()).toEqual({
            total: 0,
            collections: 0,
            playlists: 0,
            genres: 0,
            directors: 0,
            decades: 0,
            recentlyAdded: 0,
            studios: 0,
            actors: 0,
        });
    });

    it('normalizes year labels into decade starts', () => {
        expect(toChannelSetupDecadeValue('1997')).toBe(1990);
        expect(toChannelSetupDecadeValue('not-a-year')).toBeNull();
    });
});
