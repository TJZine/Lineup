import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const JestSummaryReporter = require('../jest-summary-reporter.cjs');

function captureConsole(run) {
    const errors = [];
    const logs = [];
    const originalError = console.error;
    const originalLog = console.log;
    console.error = (...values) => errors.push(values.join(' '));
    console.log = (...values) => logs.push(values.join(' '));
    try {
        run();
    } finally {
        console.error = originalError;
        console.log = originalLog;
    }
    return { errors, logs };
}

test('prints suite-level failures when no individual test result exists', () => {
    const output = captureConsole(() => {
        new JestSummaryReporter().onRunComplete(null, {
            testResults: [{
                testFilePath: '/repo/broken.test.ts',
                testResults: [],
                failureMessage: 'SyntaxError: parse failed',
            }],
            numPendingTests: 0,
            numTodoTests: 0,
            numPassedTestSuites: 0,
            numTotalTestSuites: 1,
            numPassedTests: 0,
            numFailedTests: 0,
        });
    });

    assert.deepEqual(output.errors, [
        'FAIL /repo/broken.test.ts',
        'SyntaxError: parse failed',
    ]);
    assert.deepEqual(output.logs, ['Jest: 0/1 suites; 0 passed, 0 failed, 0 skipped.']);
});

test('prints a distinct suite diagnostic alongside per-test failure output', () => {
    const output = captureConsole(() => {
        new JestSummaryReporter().onRunComplete(null, {
            testResults: [{
                testFilePath: '/repo/failing.test.ts',
                failureMessage: 'aggregated suite output',
                testResults: [{
                    status: 'failed',
                    fullName: 'fails clearly',
                    failureMessages: ['expected true to be false'],
                }],
            }],
            numPendingTests: 0,
            numTodoTests: 0,
            numPassedTestSuites: 0,
            numTotalTestSuites: 1,
            numPassedTests: 0,
            numFailedTests: 1,
        });
    });

    assert.deepEqual(output.errors, [
        'FAIL /repo/failing.test.ts',
        'aggregated suite output',
        'FAIL /repo/failing.test.ts: fails clearly',
        'expected true to be false',
    ]);
});

test('does not duplicate a suite failure already reported by an individual test', () => {
    const output = captureConsole(() => {
        new JestSummaryReporter().onRunComplete(null, {
            testResults: [{
                testFilePath: '/repo/failing.test.ts',
                failureMessage: 'expected true to be false',
                testResults: [{
                    status: 'failed',
                    fullName: 'fails clearly',
                    failureMessages: ['expected true to be false'],
                }],
            }],
            numPendingTests: 0,
            numTodoTests: 0,
            numPassedTestSuites: 0,
            numTotalTestSuites: 1,
            numPassedTests: 0,
            numFailedTests: 1,
        });
    });

    assert.deepEqual(output.errors, [
        'FAIL /repo/failing.test.ts: fails clearly',
        'expected true to be false',
    ]);
});
