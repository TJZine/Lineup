/**
 * @jest-environment jsdom
 */
import type { BuildStrategy } from '../../../scheduler/channel-manager/contracts/types';
import { getChannelBrandingIcon, getAvailableStrategies } from '../channelBrandingIcons';

const strategies: BuildStrategy[] = [
    'collections',
    'playlists',
    'genres',
    'directors',
    'decades',
    'recentlyAdded',
    'studios',
    'actors',
    'libraryFallback',
];

describe('channelBrandingIcons', () => {
    it('returns SVG for each supported build strategy', () => {
        for (const strategy of strategies) {
            const icon = getChannelBrandingIcon(strategy);
            expect(icon).not.toBeNull();
            expect(icon?.tagName.toLowerCase()).toBe('svg');
            expect(icon?.querySelector('path')).not.toBeNull();
        }
    });

    it('lists all available strategies', () => {
        expect(getAvailableStrategies()).toEqual(strategies);
    });
});
