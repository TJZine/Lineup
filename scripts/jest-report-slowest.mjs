import fs from 'node:fs';

const file = process.argv[2];

if (!file) {
    console.error('Usage: node scripts/jest-report-slowest.mjs <jest-json-file>');
    process.exit(1);
}

const results = JSON.parse(fs.readFileSync(file, 'utf8'));

const suites = results.testResults
    .map((suite) => ({
        file: suite.name,
        durationMs: suite.endTime - suite.startTime,
        testCount: suite.assertionResults.length,
    }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

console.log('Top 10 slowest Jest suites');
for (const suite of suites) {
    console.log(`${String(suite.durationMs).padStart(5)}ms  ${String(suite.testCount).padStart(3)} tests  ${suite.file}`);
}
