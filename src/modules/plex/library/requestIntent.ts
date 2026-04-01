import type { PlexLibraryRequestIntent } from './interfaces';

/**
 * Channel setup asks for a semantic use-case.
 * Plex owns the mapping from that use-case to transport policy.
 */
export type ChannelSetupPlexRequestUseCase = 'preview' | 'build';

export function getPlexRequestIntentForChannelSetup(
    useCase: ChannelSetupPlexRequestUseCase
): PlexLibraryRequestIntent {
    return useCase === 'preview' ? 'preview' : 'background';
}
