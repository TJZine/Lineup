import { RetainedOperationContext } from '../../../utils/RetainedOperationContext';
import { ChannelTuningOperationContext } from '../ChannelTuningOperationContext';

describe('ChannelTuningOperationContext', () => {
    it('allows repeated suspension without replacing the first abort reason', () => {
        const owner = new ChannelTuningOperationContext();

        owner.suspend();
        owner.suspend();

        expect(() => owner.capture()).toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
    });

    it('releases its retained scope when caller-context construction fails', () => {
        const owner = new ChannelTuningOperationContext();
        const reason = new DOMException('caller superseded', 'AbortError');
        const controller = new AbortController();
        controller.abort(reason);
        const scopeLeaseReleases: jest.Mock[] = [];
        const originalRetain = RetainedOperationContext.prototype.retain;
        const retainSpy = jest.spyOn(RetainedOperationContext.prototype, 'retain')
            .mockImplementation(function retainWithObservableRelease(
                this: RetainedOperationContext,
                label: string
            ) {
                const lease = originalRetain.call(this, label);
                if (label !== 'channel-tune') return lease;
                const release = jest.fn(lease.release);
                scopeLeaseReleases.push(release);
                return { ...lease, release };
            });

        try {
            expect(() => owner.capture(controller.signal)).toThrow(reason);
            expect(scopeLeaseReleases).toHaveLength(1);
            expect(scopeLeaseReleases[0]).toHaveBeenCalledTimes(1);
        } finally {
            retainSpy.mockRestore();
        }
    });
});
