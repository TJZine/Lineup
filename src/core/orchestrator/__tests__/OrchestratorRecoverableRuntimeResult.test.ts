import {
    captureRecoverableRuntimeResult,
    captureRecoverableRuntimeResultAsync,
} from '../OrchestratorRecoverableRuntimeResult';

describe('OrchestratorRecoverableRuntimeResult', () => {
    it('captures synchronous success and failure outcomes', () => {
        expect(captureRecoverableRuntimeResult(() => 'ok')).toEqual({
            ok: true,
            value: 'ok',
        });

        const error = new Error('boom');
        expect(captureRecoverableRuntimeResult(() => {
            throw error;
        })).toEqual({
            ok: false,
            error,
        });
    });

    it('captures async success and failure outcomes', async () => {
        await expect(
            captureRecoverableRuntimeResultAsync(async () => 'ok')
        ).resolves.toEqual({
            ok: true,
            value: 'ok',
        });

        const error = new Error('async boom');
        await expect(
            captureRecoverableRuntimeResultAsync(async () => {
                throw error;
            })
        ).resolves.toEqual({
            ok: false,
            error,
        });
    });
});
