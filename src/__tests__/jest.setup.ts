const shouldAllowConsoleOutput = process.env.RETUNE_TEST_CONSOLE === '1';
const shouldSilenceWarningsAndErrors = process.env.RETUNE_TEST_CONSOLE_SILENT === '1';

if (!shouldAllowConsoleOutput) {
    let consoleDebugSpy: ReturnType<typeof jest.spyOn> | null = null;
    let consoleLogSpy: ReturnType<typeof jest.spyOn> | null = null;
    let consoleInfoSpy: ReturnType<typeof jest.spyOn> | null = null;
    let consoleWarnSpy: ReturnType<typeof jest.spyOn> | null = null;
    let consoleErrorSpy: ReturnType<typeof jest.spyOn> | null = null;

    beforeEach(() => {
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

        if (shouldSilenceWarningsAndErrors) {
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        }
    });

    afterEach(() => {
        consoleDebugSpy?.mockRestore();
        consoleLogSpy?.mockRestore();
        consoleInfoSpy?.mockRestore();
        consoleWarnSpy?.mockRestore();
        consoleErrorSpy?.mockRestore();

        consoleDebugSpy = null;
        consoleLogSpy = null;
        consoleInfoSpy = null;
        consoleWarnSpy = null;
        consoleErrorSpy = null;
    });
}
