/**
 * @jest-environment jsdom
 */
import type { BuildStrategy } from '../../../scheduler/channel-manager/types';
import { getChannelBrandingIcon, getAvailableStrategies } from '../channelBrandingIcons';

describe('channelBrandingIcons', () => {
    it('returns SVG for each supported build strategy', () => {
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

        for (const strategy of strategies) {
            const icon = getChannelBrandingIcon(strategy);
            expect(icon).not.toBeNull();
            expect(icon?.tagName.toLowerCase()).toBe('svg');
            expect(icon?.querySelector('path')).not.toBeNull();
        }
    });

    it('lists all available strategies', () => {
        const strategies = getAvailableStrategies();
        expect(strategies).toEqual([
            'collections',
            'playlists',
            'genres',
            'directors',
            'decades',
            'recentlyAdded',
            'studios',
            'actors',
            'libraryFallback',
        ]);
    });
});
