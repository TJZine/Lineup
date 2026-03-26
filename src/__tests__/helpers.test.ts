/**
 * @jest-environment jsdom
 */

import { advanceTimersUntil } from './helpers';

describe('advanceTimersUntil', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves when the assertion becomes true exactly at the timeout boundary', async () => {
        let ready = false;

        setTimeout(() => {
            ready = true;
        }, 100);

        await expect(
            advanceTimersUntil(() => {
                expect(ready).toBe(true);
            }, {
                stepMs: 25,
                timeoutMs: 100,
            })
        ).resolves.toBeUndefined();
    });

    it('does not advance timers beyond the configured timeout budget', async () => {
        await expect(
            advanceTimersUntil(() => {
                expect(false).toBe(true);
            }, {
                stepMs: 25,
                timeoutMs: 100,
            })
        ).rejects.toThrow('advanceTimersUntil timed out after 100ms');

        expect(Date.now()).toBe(100);
    });

    it('uses the final assertion message in the timeout error', async () => {
        await expect(
            advanceTimersUntil(() => {
                expect('current state').toBe('ready state');
            }, {
                stepMs: 20,
                timeoutMs: 60,
            })
        ).rejects.toThrow(
            'advanceTimersUntil timed out after 60ms. Last assertion: expect(received).toBe(expected)'
        );
    });

    it('supports timeout values that are not divisible by stepMs', async () => {
        await expect(
            advanceTimersUntil(() => {
                expect(false).toBe(true);
            }, {
                stepMs: 25,
                timeoutMs: 60,
            })
        ).rejects.toThrow('advanceTimersUntil timed out after 60ms');

        expect(Date.now()).toBe(60);
    });

    it('throws when stepMs is not positive', async () => {
        await expect(
            advanceTimersUntil(() => {
                expect(true).toBe(true);
            }, {
                stepMs: 0,
                timeoutMs: 100,
            })
        ).rejects.toThrow('advanceTimersUntil requires stepMs > 0 (received 0).');
    });

    it('throws when timeoutMs is not positive', async () => {
        await expect(
            advanceTimersUntil(() => {
                expect(true).toBe(true);
            }, {
                stepMs: 25,
                timeoutMs: 0,
            })
        ).rejects.toThrow('advanceTimersUntil requires timeoutMs > 0 (received 0).');
    });
});
