/**
 * @jest-environment jsdom
 */

import {
    advanceTimersUntil,
    createDeferred,
    createBodyAppendedTestContainer,
    setDevBuildForTest,
    setDocumentReadyStateForTest,
    flushPromises,
    flushPromisesAndMacrotask,
    flushPromisesAndTimers,
    sharedConsoleOutputGuard,
    TestConsoleOutputGuard,
} from './helpers';

describe('flushPromises', () => {
    it('drains nested promise work with the default rounds', async () => {
        const steps: string[] = [];

        void Promise.resolve()
            .then(() => {
                steps.push('first');
                return Promise.resolve().then(() => {
                    steps.push('second');
                });
            });

        await flushPromises();

        expect(steps).toEqual(['first', 'second']);
    });
});

describe('createDeferred', () => {
    it('lets tests control when async work resolves', async () => {
        const deferred = createDeferred<string>();
        let state = 'pending';

        void deferred.promise.then((value) => {
            state = value;
        });

        await flushPromises();
        expect(state).toBe('pending');

        deferred.resolve('resolved');
        await flushPromises();

        expect(state).toBe('resolved');
        await expect(deferred.promise).resolves.toBe('resolved');
    });
});

describe('test environment descriptor helpers', () => {
    it('sets and restores __LINEUP_DEV_BUILD__ without leaving an own-property override behind', () => {
        const hadOwnProperty = Object.prototype.hasOwnProperty.call(globalThis, '__LINEUP_DEV_BUILD__');
        const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__LINEUP_DEV_BUILD__');

        const restore = setDevBuildForTest(false);

        expect((globalThis as typeof globalThis & { __LINEUP_DEV_BUILD__?: boolean }).__LINEUP_DEV_BUILD__).toBe(false);

        restore();

        if (hadOwnProperty && originalDescriptor) {
            expect(Object.getOwnPropertyDescriptor(globalThis, '__LINEUP_DEV_BUILD__')).toEqual(originalDescriptor);
        } else {
            expect(Object.prototype.hasOwnProperty.call(globalThis, '__LINEUP_DEV_BUILD__')).toBe(false);
        }
    });

    it('sets and restores document.readyState without changing the suite-level descriptor owner', () => {
        const hadOwnProperty = Object.prototype.hasOwnProperty.call(document, 'readyState');
        const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'readyState');
        const originalReadyState = document.readyState;

        const restore = setDocumentReadyStateForTest('loading');

        expect(document.readyState).toBe('loading');

        restore();

        expect(document.readyState).toBe(originalReadyState);
        if (hadOwnProperty && originalDescriptor) {
            expect(Object.getOwnPropertyDescriptor(document, 'readyState')).toEqual(originalDescriptor);
        } else {
            expect(Object.prototype.hasOwnProperty.call(document, 'readyState')).toBe(false);
        }
    });
});

describe('createBodyAppendedTestContainer', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('creates a fresh anonymous div and appends it to document.body', () => {
        const container = createBodyAppendedTestContainer();

        expect(container.tagName).toBe('DIV');
        expect(container.id).toBe('');
        expect(container.className).toBe('');
        expect(document.body.lastElementChild).toBe(container);
    });

    it('returns a distinct appended div on each call', () => {
        const first = createBodyAppendedTestContainer();
        const second = createBodyAppendedTestContainer();

        expect(second).not.toBe(first);
        expect(document.body.children).toHaveLength(2);
        expect(Array.from(document.body.children)).toEqual([first, second]);
    });
});

describe('flushPromisesAndTimers', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('flushes promise work on both sides of a fake-timer pass', async () => {
        const steps: string[] = [];
        setTimeout(() => {
            steps.push('timer-pass');
            void Promise.resolve().then(() => {
                steps.push('post-timer-pass');
            });
        }, 0);

        void Promise.resolve().then(() => {
            steps.push('pre-pass');
        });

        await flushPromisesAndTimers(2, 1);

        expect(steps).toEqual([
            'pre-pass',
            'timer-pass',
            'post-timer-pass',
        ]);
    });
});

describe('flushPromisesAndMacrotask', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('flushes promise work on both sides of the macrotask turn', async () => {
        const steps: string[] = [];

        jest.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, _delay?: number) => {
            steps.push('macrotask');
            if (typeof handler === 'function') {
                handler();
            }
            void Promise.resolve().then(() => {
                steps.push('post-macrotask-promise');
            });
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as unknown as typeof globalThis.setTimeout);

        void Promise.resolve().then(() => {
            steps.push('pre-macrotask-promise');
        });

        await flushPromisesAndMacrotask();

        expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
        expect(steps).toEqual([
            'pre-macrotask-promise',
            'macrotask',
            'post-macrotask-promise',
        ]);
    });
});

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

    it.each([
        ['global', /stateful warning/g],
        ['sticky', /'stateful warning'/y],
    ])('matches repeated console calls with a %s regex without stateful false negatives', (_label, matcher) => {
        const localConsole = {
            warn: jest.fn(),
            error: jest.fn(),
        };
        const guard = new TestConsoleOutputGuard(localConsole);
        guard.install();
        guard.resetForTest();

        const warning = guard.expect('warn', matcher, { times: 2 });

        localConsole.warn('stateful warning');
        localConsole.warn('stateful warning');

        expect(warning.getCalls()).toEqual([
            ['stateful warning'],
            ['stateful warning'],
        ]);
        expect(matcher.lastIndex).toBe(0);
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

    it('fails fast when expectations are registered while LINEUP_TEST_CONSOLE passthrough is enabled', () => {
        const guard = new TestConsoleOutputGuard(
            {
                warn: console.warn,
                error: console.error,
            },
            { allowConsoleOutput: true }
        );

        expect(() => guard.expect('warn', 'unexpected passthrough expectation')).toThrow(
            'TestConsoleOutputGuard expectations are unavailable when LINEUP_TEST_CONSOLE=1 because install() keeps console passthrough enabled.'
        );
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

    it('returns captured calls from a local guard for matched warning output', () => {
        const localConsole = {
            warn: jest.fn(),
            error: jest.fn(),
        };
        const guard = new TestConsoleOutputGuard(localConsole);
        guard.install();
        guard.resetForTest();

        const warning = guard.expect('warn', [
            'shared guard warning',
            expect.objectContaining({ marker: 'present' }),
        ]);

        try {
            localConsole.warn('shared guard warning', { marker: 'present', extra: true });

            expect(warning.getLastCall()).toEqual([
                'shared guard warning',
                { marker: 'present', extra: true },
            ]);
        } finally {
            guard.uninstall();
        }
    });
});
