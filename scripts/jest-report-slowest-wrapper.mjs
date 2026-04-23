import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const surface = process.argv[2];
const configPath = process.argv[3];

if (!surface || !configPath) {
    console.error('Usage: node scripts/jest-report-slowest-wrapper.mjs <surface> <jest-config>');
    process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-jest-results-'));
const outputFile = path.join(tempDir, `${surface}.json`);
const jestBin = path.resolve(process.cwd(), 'node_modules/jest/bin/jest.js');
const reportScript = path.resolve(process.cwd(), 'scripts/jest-report-slowest.mjs');

try {
    const jestResult = spawnSync(process.execPath, [
        jestBin,
        '--config',
        configPath,
        '--runInBand',
        '--json',
        '--outputFile',
        outputFile,
    ], {
        stdio: 'inherit',
    });

    if (jestResult.error) {
        throw jestResult.error;
    }

    if (typeof jestResult.status === 'number' && jestResult.status !== 0) {
        process.exit(jestResult.status);
    }

    const reportResult = spawnSync(process.execPath, [reportScript, outputFile, surface], {
        stdio: 'inherit',
    });

    if (reportResult.error) {
        throw reportResult.error;
    }

    process.exit(reportResult.status ?? 0);
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
