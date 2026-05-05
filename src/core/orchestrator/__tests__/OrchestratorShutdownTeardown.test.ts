import { OrchestratorShutdownTeardown } from '../runtime/OrchestratorShutdownTeardown';

describe('OrchestratorShutdownTeardown', () => {
    it('records sync failures and continues later teardown steps', () => {
        const teardown = new OrchestratorShutdownTeardown();
        const laterStep = jest.fn();

        teardown.run('first.dispose', () => {
            throw new Error('first failed');
        });
        teardown.run('second.dispose', laterStep);

        expect(laterStep).toHaveBeenCalledTimes(1);
        expect(teardown.getFailures()).toEqual([
            {
                step: 'first.dispose',
                error: expect.objectContaining({
                    name: 'Error',
                    message: 'first failed',
                }),
            },
        ]);
    });

    it('records async failures and returns a defensive failure list copy', async () => {
        const teardown = new OrchestratorShutdownTeardown();

        await teardown.runAsync('async.flush', async () => {
            throw new Error('flush failed');
        });

        const failures = teardown.getFailures();
        failures.push({ step: 'mutated', error: null });

        expect(teardown.getFailures()).toEqual([
            {
                step: 'async.flush',
                error: expect.objectContaining({
                    name: 'Error',
                    message: 'flush failed',
                }),
            },
        ]);
    });
});
