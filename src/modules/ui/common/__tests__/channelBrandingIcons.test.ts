/**
 * @jest-environment jsdom
 */
import { getChannelBrandingIcon, getAvailableStrategies } from '../channelBrandingIcons';

describe('channelBrandingIcons', () => {
    it('returns SVG for known build strategies', () => {
        const icon = getChannelBrandingIcon('collections');
        expect(icon).not.toBeNull();
        expect(icon?.tagName.toLowerCase()).toBe('svg');
        expect(icon?.querySelector('path')).not.toBeNull();
    });

    it('returns null for unknown strategies', () => {
        expect(getChannelBrandingIcon('nonexistent')).toBeNull();
    });

    it('lists all available strategies', () => {
        const strategies = getAvailableStrategies();
        expect(strategies.length).toBeGreaterThanOrEqual(8);
    });
});
