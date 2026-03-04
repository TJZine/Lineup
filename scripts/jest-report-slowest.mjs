import fs from 'node:fs';

const file = process.argv[2];

if (!file) {
    console.error('Usage: node scripts/jest-report-slowest.mjs <jest-json-file>');
    process.exit(1);
}

let results;
try {
    results = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
    console.error(`Failed to parse Jest JSON results file: ${String(error)}`);
    process.exit(2);
}

const testResults = Array.isArray(results?.testResults) ? results.testResults : [];

const suites = testResults
    .map((suite) => {
        const startTime = Number(suite?.startTime);
        const endTime = Number(suite?.endTime);
        const durationMs = Number.isFinite(startTime) && Number.isFinite(endTime)
            ? endTime - startTime
            : 0;
        const testCount = Array.isArray(suite?.assertionResults) ? suite.assertionResults.length : 0;

        return {
            file: String(suite?.name ?? '<unknown suite>'),
            durationMs,
            testCount,
        };
    })
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

console.log('Top 10 slowest Jest suites');
for (const suite of suites) {
    console.log(`${String(suite.durationMs).padStart(5)}ms  ${String(suite.testCount).padStart(3)} tests  ${suite.file}`);
}
