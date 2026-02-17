/* eslint-disable no-console */

const shouldAllowConsoleOutput =
    typeof process !== 'undefined' && process.env.RETUNE_TEST_CONSOLE === '1';

if (!shouldAllowConsoleOutput) {
    const original = {
        debug: console.debug,
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
    };

    console.debug = (..._args: unknown[]): void => undefined;
    console.log = (..._args: unknown[]): void => undefined;
    console.info = (..._args: unknown[]): void => undefined;
    console.warn = (..._args: unknown[]): void => undefined;
    console.error = (..._args: unknown[]): void => undefined;

    afterAll(() => {
        console.debug = original.debug;
        console.log = original.log;
        console.info = original.info;
        console.warn = original.warn;
        console.error = original.error;
    });
}
