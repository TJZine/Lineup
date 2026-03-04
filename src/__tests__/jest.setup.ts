/* eslint-disable no-console */
const shouldAllowConsoleOutput = process.env.LINEUP_TEST_CONSOLE === '1';
const shouldSilenceWarningsAndErrors = process.env.LINEUP_TEST_CONSOLE_SILENT === '1';

const originalConsole = {
    debug: console.debug,
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
};

const noop = (): void => undefined;

if (!shouldAllowConsoleOutput) {
    beforeAll(() => {
        console.debug = noop;
        console.log = noop;
        console.info = noop;

        if (shouldSilenceWarningsAndErrors) {
            console.warn = noop;
            console.error = noop;
        }
    });

    afterAll(() => {
        console.debug = originalConsole.debug;
        console.log = originalConsole.log;
        console.info = originalConsole.info;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
    });
}
/* eslint-enable no-console */
