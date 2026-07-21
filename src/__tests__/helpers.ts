import { inspect } from 'node:util';

/**
 * Use for promise-only async boundaries when no timer advancement or extra
 * macrotask turn is part of the behavior under test.
 */
export const flushPromises = async (rounds: number = 2): Promise<void> => {
    // Two microtask ticks is a pragmatic default for many "await one promise chain" situations.
    // If a test starts under-flushing due to additional microtask layers, prefer awaiting the
    // specific async boundary (or adjust the helper locally) rather than guessing tick counts.
    for (let i = 0; i < rounds; i++) {
        await Promise.resolve();
    }
};

/**
 * Use in real-timer integration tests when a condition may become observable
 * only after both promise chains and one queued macrotask turn complete.
 *
 * Do not use this helper in fake-timer tests; prefer flushPromisesAndTimers()
 * or advanceTimersUntil() there.
 */
export const flushPromisesAndMacrotask = async (promiseRounds: number = 2): Promise<void> => {
    await flushPromises(promiseRounds);
    await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, 0);
    });
    await flushPromises(promiseRounds);
};

/**
 * Use in fake-timer suites when queued timer callbacks also schedule promise
 * work that should settle before the next assertion.
 */
export const flushPromisesAndTimers = async (
    promiseRounds: number = 2,
    timerPasses: number = 1
): Promise<void> => {
    for (let i = 0; i < timerPasses; i++) {
        await flushPromises(promiseRounds);
        await jest.advanceTimersByTimeAsync(0);
    }
    await flushPromises(promiseRounds);
};

/**
 * Use in fake-timer suites when an assertion should become true after bounded
 * timer advancement rather than after a fixed sleep.
 */
export const advanceTimersUntil = async (
    assertNow: () => void,
    options: { stepMs?: number; timeoutMs?: number } = {}
): Promise<void> => {
    const stepMs = options.stepMs ?? 25;
    const timeoutMs = options.timeoutMs ?? 5000;
    if (stepMs <= 0) {
        throw new Error(`advanceTimersUntil requires stepMs > 0 (received ${stepMs}).`);
    }
    if (timeoutMs <= 0) {
        throw new Error(`advanceTimersUntil requires timeoutMs > 0 (received ${timeoutMs}).`);
    }

    let elapsedMs = 0;
    let lastError: unknown = null;

    while (true) {
        try {
            assertNow();
            return;
        } catch (error: unknown) {
            lastError = error;
        }

        if (elapsedMs >= timeoutMs) {
            break;
        }

        const advanceMs = Math.min(stepMs, timeoutMs - elapsedMs);
        await jest.advanceTimersByTimeAsync(advanceMs);
        elapsedMs += advanceMs;
        await flushPromises();
    }

    const reason = lastError instanceof Error ? ` Last assertion: ${lastError.message}` : '';
    throw new Error(`advanceTimersUntil timed out after ${elapsedMs}ms.${reason}`);
};

/**
 * Adds a diagnostic failure bound to async test infrastructure while ensuring
 * the underlying timer is cleared when the operation settles first.
 */
export const withTestTimeout = <T>(
    operation: Promise<T>,
    options: { timeoutMs: number; errorMessage: string }
): Promise<T> => {
    const { timeoutMs, errorMessage } = options;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`withTestTimeout requires a finite timeoutMs > 0 (received ${timeoutMs}).`);
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_resolve, reject) => {
        timeoutId = globalThis.setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });

    return Promise.race([operation, timeout]).finally(() => {
        if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
    });
};

export type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
};

/**
 * Use when the test should control exactly when an async dependency settles
 * instead of waiting on ad hoc timers or implicit promise ordering.
 */
export const createDeferred = <T>(): Deferred<T> => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

type RestoreTestOverride = () => void;
const activeTestOverrides = new Set<RestoreTestOverride>();

if (typeof afterEach === 'function') {
    afterEach(() => {
        const restores = Array.from(activeTestOverrides).reverse();
        activeTestOverrides.clear();
        for (const restore of restores) {
            restore();
        }
    });
}

const overrideOwnPropertyForTest = (
    target: object,
    property: string,
    descriptor: PropertyDescriptor
): RestoreTestOverride => {
    const hadOwnProperty = Object.prototype.hasOwnProperty.call(target, property);
    const originalDescriptor = Object.getOwnPropertyDescriptor(target, property);
    let restored = false;

    Object.defineProperty(target, property, {
        configurable: true,
        ...descriptor,
    });

    const restore = (): void => {
        if (restored) {
            return;
        }
        restored = true;
        activeTestOverrides.delete(restore);

        if (hadOwnProperty && originalDescriptor) {
            Object.defineProperty(target, property, originalDescriptor);
            return;
        }

        delete (target as Record<string, unknown>)[property];
    };

    activeTestOverrides.add(restore);
    return restore;
};

export const setDevBuildForTest = (value: boolean): RestoreTestOverride =>
    overrideOwnPropertyForTest(globalThis, '__LINEUP_DEV_BUILD__', {
        value,
        writable: true,
    });

export const setDocumentReadyStateForTest = (value: DocumentReadyState): RestoreTestOverride =>
    overrideOwnPropertyForTest(document, 'readyState', {
        value,
    });

/**
 * Use when a UI test needs a plain disposable root in document.body without
 * adding suite-specific IDs or shell structure to the shared helper seam.
 */
export const createBodyAppendedTestContainer = (): HTMLDivElement => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
};

type ConsoleLevel = 'warn' | 'error';

type CapturedConsoleCall = {
    level: ConsoleLevel;
    args: unknown[];
    matchedExpectationIds: number[];
};

type ConsoleArgsPredicate = (args: readonly unknown[]) => boolean;

type ConsoleCallMatcher =
    | string
    | RegExp
    | ConsoleArgsPredicate
    | readonly unknown[];

type ConsoleExpectationOptions = {
    times?: number;
};

type ConsoleExpectation = {
    id: number;
    level: ConsoleLevel;
    matcher: ConsoleCallMatcher;
    times: number;
    matchedCalls: CapturedConsoleCall[];
};

const isAsymmetricMatcher = (value: unknown): value is { asymmetricMatch(actual: unknown): boolean } =>
    typeof value === 'object'
    && value !== null
    && typeof (value as { asymmetricMatch?: unknown }).asymmetricMatch === 'function';

const formatConsoleCall = (level: ConsoleLevel, args: readonly unknown[]): string =>
    `console.${level}(${args.map((arg) => inspect(arg, { depth: 5, breakLength: 120 })).join(', ')})`;

const matcherDescription = (matcher: ConsoleCallMatcher): string => {
    if (typeof matcher === 'string') {
        return `includes ${JSON.stringify(matcher)}`;
    }

    if (matcher instanceof RegExp) {
        return `matches ${matcher.toString()}`;
    }

    if (typeof matcher === 'function') {
        return `matches custom predicate ${matcher.name || '<anonymous>'}`;
    }

    return `matches args ${inspect(matcher, { depth: 5, breakLength: 120 })}`;
};

const formatCallArgs = (args: readonly unknown[]): string =>
    args.map((arg) => inspect(arg, { depth: 5, breakLength: 120 })).join(' ');

const matchesExpectedValue = (actual: unknown, expected: unknown): boolean => {
    if (isAsymmetricMatcher(expected)) {
        return expected.asymmetricMatch(actual);
    }

    try {
        expect(actual).toEqual(expected);
        return true;
    } catch {
        return false;
    }
};

const matchesConsoleCall = (matcher: ConsoleCallMatcher, args: readonly unknown[]): boolean => {
    if (typeof matcher === 'string') {
        return formatCallArgs(args).includes(matcher);
    }

    if (matcher instanceof RegExp) {
        return new RegExp(matcher.source, matcher.flags).test(formatCallArgs(args));
    }

    if (typeof matcher === 'function') {
        return matcher(args);
    }

    if (matcher.length !== args.length) {
        return false;
    }

    return matcher.every((expected, index) => matchesExpectedValue(args[index], expected));
};

export type ExpectedConsoleCallHandle = {
    getCalls: () => readonly (readonly unknown[])[];
    getLastCall: () => readonly unknown[] | undefined;
};

type MutableConsoleTarget = {
    warn: typeof console.warn;
    error: typeof console.error;
};

export class TestConsoleOutputGuard {
    private readonly target: MutableConsoleTarget;
    private readonly allowConsoleOutput: boolean;
    private readonly originalConsole: MutableConsoleTarget;
    private readonly guardHandlers: MutableConsoleTarget;
    private readonly passthroughHandlers: MutableConsoleTarget;
    private readonly installState: { installed: boolean } = { installed: false };
    private readonly expectations: ConsoleExpectation[] = [];
    private readonly calls: CapturedConsoleCall[] = [];
    private nextExpectationId = 1;

    constructor(target: MutableConsoleTarget = console, options: { allowConsoleOutput?: boolean } = {}) {
        this.target = target;
        this.allowConsoleOutput = options.allowConsoleOutput === true;
        this.originalConsole = {
            warn: target.warn,
            error: target.error,
        };
        this.guardHandlers = {
            warn: (...args: unknown[]): void => {
                this.recordCall('warn', args);
            },
            error: (...args: unknown[]): void => {
                this.recordCall('error', args);
            },
        };
        this.passthroughHandlers = {
            warn: (...args: unknown[]): void => {
                this.recordCall('warn', args);
                this.originalConsole.warn(...args);
            },
            error: (...args: unknown[]): void => {
                this.recordCall('error', args);
                this.originalConsole.error(...args);
            },
        };
    }

    install(): void {
        if (this.installState.installed) {
            return;
        }

        if (this.allowConsoleOutput) {
            this.target.warn = this.passthroughHandlers.warn;
            this.target.error = this.passthroughHandlers.error;
        } else {
            this.target.warn = this.guardHandlers.warn;
            this.target.error = this.guardHandlers.error;
        }
        this.installState.installed = true;
    }

    uninstall(): void {
        if (!this.installState.installed) {
            return;
        }

        this.target.warn = this.originalConsole.warn;
        this.target.error = this.originalConsole.error;
        this.installState.installed = false;
    }

    resetForTest(): void {
        this.expectations.length = 0;
        this.calls.length = 0;
        this.nextExpectationId = 1;
    }

    finalizeForTest(): void {
        const missingExpectations = this.expectations.filter((expectation) => expectation.matchedCalls.length < expectation.times);
        const unexpectedCalls = this.allowConsoleOutput
            ? []
            : this.calls.filter((call) => call.matchedExpectationIds.length === 0);

        if (missingExpectations.length === 0 && unexpectedCalls.length === 0) {
            return;
        }

        const sections: string[] = [];

        if (missingExpectations.length > 0) {
            sections.push(
                [
                    'Missing expected console output:',
                    ...missingExpectations.map((expectation) => {
                        const remainingCount = expectation.times - expectation.matchedCalls.length;
                        return `- console.${expectation.level} ${matcherDescription(expectation.matcher)} (${remainingCount} remaining)`;
                    }),
                ].join('\n')
            );
        }

        if (unexpectedCalls.length > 0) {
            sections.push(
                [
                    'Unexpected console output:',
                    ...unexpectedCalls.map((call) => `- ${formatConsoleCall(call.level, call.args)}`),
                ].join('\n')
            );
        }

        if (this.calls.length > 0) {
            sections.push(
                [
                    'Captured console output:',
                    ...this.calls.map((call) => `- ${formatConsoleCall(call.level, call.args)}`),
                ].join('\n')
            );
        }

        throw new Error(sections.join('\n\n'));
    }

    expect(level: ConsoleLevel, matcher: ConsoleCallMatcher, options: ConsoleExpectationOptions = {}): ExpectedConsoleCallHandle {
        const expectation: ConsoleExpectation = {
            id: this.nextExpectationId++,
            level,
            matcher,
            times: options.times ?? 1,
            matchedCalls: [],
        };

        this.expectations.push(expectation);
        this.matchPendingCalls();

        return {
            getCalls: (): readonly (readonly unknown[])[] =>
                expectation.matchedCalls.map((call) => [...call.args] as const),
            getLastCall: (): readonly unknown[] | undefined => {
                const lastCall = expectation.matchedCalls.at(-1);
                return lastCall ? [...lastCall.args] as const : undefined;
            },
        };
    }

    isInstalled(): boolean {
        return this.installState.installed;
    }

    getOriginalConsole(level: ConsoleLevel): typeof console.warn {
        return this.originalConsole[level];
    }

    private recordCall(level: ConsoleLevel, args: unknown[]): void {
        this.calls.push({
            level,
            args,
            matchedExpectationIds: [],
        });
        this.matchPendingCalls();
    }

    private matchPendingCalls(): void {
        for (const call of this.calls) {
            for (const expectation of this.expectations) {
                if (call.level !== expectation.level) {
                    continue;
                }

                if (call.matchedExpectationIds.includes(expectation.id)) {
                    continue;
                }

                if (expectation.matchedCalls.length >= expectation.times) {
                    continue;
                }

                if (!matchesConsoleCall(expectation.matcher, call.args)) {
                    continue;
                }

                call.matchedExpectationIds.push(expectation.id);
                expectation.matchedCalls.push(call);
                break;
            }
        }
    }
}

const shouldAllowConsoleOutput = process.env.LINEUP_TEST_CONSOLE === '1';

export const sharedConsoleOutputGuard = new TestConsoleOutputGuard(console, {
    allowConsoleOutput: shouldAllowConsoleOutput,
});

export const expectConsoleWarn = (
    matcher: ConsoleCallMatcher,
    options?: ConsoleExpectationOptions
): ExpectedConsoleCallHandle => sharedConsoleOutputGuard.expect('warn', matcher, options);

export const expectConsoleError = (
    matcher: ConsoleCallMatcher,
    options?: ConsoleExpectationOptions
): ExpectedConsoleCallHandle => sharedConsoleOutputGuard.expect('error', matcher, options);
