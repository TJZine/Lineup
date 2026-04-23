/* eslint-disable no-console */
import { sharedConsoleOutputGuard } from './helpers';

const shouldAllowConsoleOutput = process.env.LINEUP_TEST_CONSOLE === '1';

const originalConsole = {
    debug: console.debug,
    log: console.log,
    info: console.info,
};

const noop = (): void => undefined;

if (!shouldAllowConsoleOutput) {
    console.debug = noop;
    console.log = noop;
    console.info = noop;
}

sharedConsoleOutputGuard.install();

beforeEach(() => {
    sharedConsoleOutputGuard.resetForTest();
});

afterEach(() => {
    sharedConsoleOutputGuard.finalizeForTest();
});

afterAll(() => {
    sharedConsoleOutputGuard.uninstall();
    console.debug = originalConsole.debug;
    console.log = originalConsole.log;
    console.info = originalConsole.info;
});
/* eslint-enable no-console */
