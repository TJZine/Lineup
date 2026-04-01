import { getPlexRequestIntentForChannelSetup } from '../requestIntent';

describe('getPlexRequestIntentForChannelSetup', () => {
    it('maps preview use-cases to preview request intent', () => {
        expect(getPlexRequestIntentForChannelSetup('preview')).toBe('preview');
    });

    it('maps build use-cases to background request intent', () => {
        expect(getPlexRequestIntentForChannelSetup('build')).toBe('background');
    });
});
