import type { PlexLibrarySection } from '../../../modules/plex/library';
import type { ChannelSetupNativeFacetFamilyDescriptor } from './ChannelSetupFacetFamilies';

export function shouldLoadNativeFacetForLibrary(
    descriptor: ChannelSetupNativeFacetFamilyDescriptor,
    library: PlexLibrarySection
): boolean {
    // PMS does not reliably expose playable episode-level studio directories for TV libraries.
    // Keep studios movie-oriented until a deliberate series/network index exists.
    if (descriptor.family === 'studios' && library.type !== 'movie') {
        return false;
    }
    return true;
}
