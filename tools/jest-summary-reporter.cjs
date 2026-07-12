class JestSummaryReporter {
    onRunComplete(_contexts, results) {
        for (const suite of results.testResults) {
            const failedTests = suite.testResults.filter((test) => test.status === 'failed');
            const individualFailureMessages = failedTests.flatMap((test) => test.failureMessages);
            const suiteFailureMessage = suite.failureMessage?.trim();
            const suiteFailureAlreadyReported = individualFailureMessages.some(
                (message) => message.trim() === suiteFailureMessage
            );

            if (suiteFailureMessage && !suiteFailureAlreadyReported) {
                console.error(`FAIL ${suite.testFilePath}`);
                console.error(suiteFailureMessage);
            }

            for (const test of failedTests) {
                console.error(`FAIL ${suite.testFilePath}: ${test.fullName}`);
                for (const message of test.failureMessages) console.error(message);
            }
        }

        const skipped = results.numPendingTests + results.numTodoTests;
        console.log(
            `Jest: ${results.numPassedTestSuites}/${results.numTotalTestSuites} suites; ` +
                `${results.numPassedTests} passed, ${results.numFailedTests} failed, ${skipped} skipped.`
        );
    }
}

module.exports = JestSummaryReporter;
