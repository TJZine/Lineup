import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_RESULTS_PATH = process.platform === 'win32'
    ? path.join(os.tmpdir(), 'jest-results.json')
    : '/tmp/jest-results.json';
const RESULTS_PATH = process.env.JEST_RESULTS_PATH ?? DEFAULT_RESULTS_PATH;

let parsed;
try {
    const raw = fs.readFileSync(RESULTS_PATH, 'utf8');
    parsed = JSON.parse(raw);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Retune][QA] Failed to read Jest results from ${RESULTS_PATH}: ${message}`);
    process.exit(1);
}
const testResults = Array.isArray(parsed.testResults) ? parsed.testResults : [];

const rows = testResults.map((entry) => {
    const hasName = typeof entry?.name === 'string';
    const suitePath = hasName ? entry.name : '(unknown suite)';
    const durationMs = (() => {
        if (typeof entry?.startTime === 'number' && typeof entry?.endTime === 'number') {
            return Math.max(0, entry.endTime - entry.startTime);
        }
        if (typeof entry?.perfStats?.start === 'number' && typeof entry?.perfStats?.end === 'number') {
            return Math.max(0, entry.perfStats.end - entry.perfStats.start);
        }
        return 0;
    })();
    const relativePath = hasName
        ? path.relative(process.cwd(), suitePath).replace(/\\/g, '/')
        : suitePath;

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
