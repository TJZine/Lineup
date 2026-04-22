/**
 * @jest-environment jsdom
 */

import {
    advanceTimersUntil,
    expectConsoleWarn,
    sharedConsoleOutputGuard,
    TestConsoleOutputGuard,
} from './helpers';

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

describe('TestConsoleOutputGuard', () => {
    it('matches expected console calls with asymmetric argument matchers', () => {
        const localConsole = {
            warn: jest.fn(),
            error: jest.fn(),
        };
        const guard = new TestConsoleOutputGuard(localConsole);
        guard.install();
        guard.resetForTest();

        const warning = guard.expect('warn', [
            'test warning',
            expect.objectContaining({ detail: 'payload' }),
        ]);

        localConsole.warn('test warning', { detail: 'payload', extra: true });

        expect(warning.getCalls()).toEqual([
            ['test warning', { detail: 'payload', extra: true }],
        ]);

        expect(() => guard.finalizeForTest()).not.toThrow();
        guard.uninstall();
    });

    it('matches expected console calls that were registered after the log was captured', () => {
        const localConsole = {
            warn: jest.fn(),
            error: jest.fn(),
        };
        const guard = new TestConsoleOutputGuard(localConsole);
        guard.install();
        guard.resetForTest();

        localConsole.warn('late registration warning', { ok: true });
        const warning = guard.expect('warn', /late registration warning/);

        expect(warning.getLastCall()).toEqual(['late registration warning', { ok: true }]);
        expect(() => guard.finalizeForTest()).not.toThrow();
        guard.uninstall();
    });

    it('fails with readable output when console.warn or console.error is unexpected', () => {
        const localConsole = {
            warn: jest.fn(),
            error: jest.fn(),
        };
        const guard = new TestConsoleOutputGuard(localConsole);
        guard.install();
        guard.resetForTest();

        localConsole.warn('unexpected warning', { code: 'warn-1' });
        localConsole.error('unexpected error', { code: 'error-1' });

        expect(() => guard.finalizeForTest()).toThrow(
            /Unexpected console output:[\s\S]*console\.warn\('unexpected warning', \{ code: 'warn-1' \}\)[\s\S]*console\.error\('unexpected error', \{ code: 'error-1' \}\)[\s\S]*Captured console output:/
        );

        guard.uninstall();
    });

    it('fails when expected console output never arrives', () => {
        const localConsole = {
            warn: jest.fn(),
            error: jest.fn(),
        };
        const guard = new TestConsoleOutputGuard(localConsole);
        guard.install();
        guard.resetForTest();

        guard.expect('error', ['expected error', expect.any(Object)]);

        expect(() => guard.finalizeForTest()).toThrow(
            'Missing expected console output:\n- console.error matches args'
        );

        guard.uninstall();
    });

    it('does not replace warn/error handlers when LINEUP_TEST_CONSOLE is enabled', () => {
        const originalWarn = console.warn;
        const originalError = console.error;
        const guard = new TestConsoleOutputGuard(
            {
                warn: originalWarn,
                error: originalError,
            },
            { allowConsoleOutput: true }
        );

        guard.install();

        expect(guard.isInstalled()).toBe(false);
        expect(guard.getOriginalConsole('warn')).toBe(originalWarn);
        expect(guard.getOriginalConsole('error')).toBe(originalError);
        expect(console.warn).toBe(originalWarn);
        expect(console.error).toBe(originalError);
    });
});

const itWithConsoleEscapeHatch = process.env.LINEUP_TEST_CONSOLE === '1' ? it : it.skip;

describe('shared console setup', () => {
    itWithConsoleEscapeHatch('LINEUP_TEST_CONSOLE keeps the shared warn/error guard disabled', () => {
        expect(process.env.LINEUP_TEST_CONSOLE).toBe('1');
        expect(sharedConsoleOutputGuard.isInstalled()).toBe(false);
        expect(console.warn).toBe(sharedConsoleOutputGuard.getOriginalConsole('warn'));
        expect(console.error).toBe(sharedConsoleOutputGuard.getOriginalConsole('error'));
    });

    it('returns captured calls from expectConsoleWarn for matched shared-guard output', () => {
        const warning = expectConsoleWarn([
            'shared guard warning',
            expect.objectContaining({ marker: 'present' }),
        ]);

        console.warn('shared guard warning', { marker: 'present', extra: true });

        expect(warning.getLastCall()).toEqual([
            'shared guard warning',
            { marker: 'present', extra: true },
        ]);
    });
});
