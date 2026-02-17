const shouldAllowConsoleOutput = process.env.RETUNE_TEST_CONSOLE === '1';
const shouldSilenceWarningsAndErrors = process.env.RETUNE_TEST_CONSOLE_SILENT === '1';

if (!shouldAllowConsoleOutput) {
    beforeEach(() => {
        jest.spyOn(console, 'debug').mockImplementation(() => undefined);
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'info').mockImplementation(() => undefined);

        if (shouldSilenceWarningsAndErrors) {
            jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
}
