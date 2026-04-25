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

    it('formats an Error detail without an object suffix', () => {
        expect(formatChannelSetupWarning('Partial setup plan', new Error('Plex timeout')))
            .toBe('Partial setup plan: Plex timeout');
    });

    it('formats object-only details as JSON', () => {
        expect(formatChannelSetupWarning('Partial setup plan', { code: 'NETWORK_TIMEOUT' }))
            .toBe('Partial setup plan: {"code":"NETWORK_TIMEOUT"}');
    });

    it('formats non-Error primitive details consistently', () => {
        expect(formatChannelSetupWarning('Partial setup plan', 'timeout'))
            .toBe('Partial setup plan: timeout');
    });
});
