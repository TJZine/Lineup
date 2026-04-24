import {
    ChannelSetupWorkflowUnavailableError,
    isChannelSetupWorkflowUnavailableError,
} from '../ChannelSetupWorkflowPort';

describe('isChannelSetupWorkflowUnavailableError', () => {
    it('accepts same-realm unavailable errors with custom messages', () => {
        expect(
            isChannelSetupWorkflowUnavailableError(
                new ChannelSetupWorkflowUnavailableError('setup workflow has not been wired')
            )
        ).toBe(true);
    });

    it('accepts duck-typed unavailable errors from other realms by name', () => {
        const error = new Error('custom unavailable message');
        error.name = 'ChannelSetupWorkflowUnavailableError';

        expect(isChannelSetupWorkflowUnavailableError(error)).toBe(true);
    });

    it('rejects unrelated errors', () => {
        expect(isChannelSetupWorkflowUnavailableError(new Error('Channel setup not initialized'))).toBe(false);
    });
});
