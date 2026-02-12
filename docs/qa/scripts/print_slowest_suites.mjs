import fs from 'node:fs';
import path from 'node:path';

const RESULTS_PATH = '/tmp/jest-results.json';

const raw = fs.readFileSync(RESULTS_PATH, 'utf8');
const parsed = JSON.parse(raw);
const testResults = Array.isArray(parsed.testResults) ? parsed.testResults : [];

const rows = testResults.map((entry) => {
    const suitePath = typeof entry?.name === 'string' ? entry.name : '(unknown suite)';
    const durationMs =
        typeof entry?.startTime === 'number' && typeof entry?.endTime === 'number'
            ? Math.max(0, entry.endTime - entry.startTime)
            : 0;
    const relativePath = path.relative(process.cwd(), suitePath).replace(/\\/g, '/');

    return { durationMs, relativePath };
});

rows.sort((a, b) => {
    if (a.durationMs !== b.durationMs) {
        return b.durationMs - a.durationMs;
    }
    return a.relativePath.localeCompare(b.relativePath);
});

for (const row of rows.slice(0, 20)) {
    console.log(`${row.durationMs}ms  ${row.relativePath}`);
}
