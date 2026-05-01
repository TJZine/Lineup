/**
 * @jest-environment jsdom
 */

import { createPlexIdentityMetadata } from '../modules/plex/auth/config';
import { createPlatformIdentityService } from './webosPlatformServices';

describe('createPlatformIdentityService', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('adapts canonical Plex auth identity metadata for platform stream identity', () => {
        const identity = createPlatformIdentityService();
        const canonicalConfig = createPlexIdentityMetadata('client-id-1', '6.0');

        const platformIdentity = identity.getDefaultPlexIdentity(canonicalConfig.clientIdentifier);

        expect(platformIdentity).toEqual(expect.objectContaining({
            'X-Plex-Client-Identifier': canonicalConfig.clientIdentifier,
            'X-Plex-Product': canonicalConfig.product,
            'X-Plex-Version': canonicalConfig.version,
            'X-Plex-Platform': canonicalConfig.platform,
            'X-Plex-Device': canonicalConfig.device,
            'X-Plex-Device-Name': canonicalConfig.deviceName,
            'X-Plex-Model': 'LGTV',
        }));
    });
});
