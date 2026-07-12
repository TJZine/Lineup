class JestSummaryReporter {
    onRunComplete(_contexts, results) {
        for (const suite of results.testResults) {
            for (const test of suite.testResults) {
                if (test.status !== 'failed') continue;
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
