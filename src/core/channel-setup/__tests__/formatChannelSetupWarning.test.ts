import { formatChannelSetupWarning } from '../shared/formatChannelSetupWarning';

describe('formatChannelSetupWarning', () => {
    it('returns the message unchanged when no details are provided', () => {
        expect(formatChannelSetupWarning('Partial setup plan')).toBe('Partial setup plan');
    });

    it('formats error and object details as a stable suffix', () => {
        expect(
            formatChannelSetupWarning(
                'Partial setup plan',
                new Error('Plex timeout'),
                { code: 'NETWORK_TIMEOUT' }
            )
        ).toBe('Partial setup plan: Plex timeout; {"code":"NETWORK_TIMEOUT"}');
    });
});
