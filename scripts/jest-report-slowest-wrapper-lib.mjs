import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function deriveSpawnExitCode(result) {
    if (typeof result?.status === 'number') {
        return result.status;
    }

    if (result?.signal || result?.error) {
        return 1;
    }

    return 0;
}

export function runJestReportSlowestWrapper({
    surface,
    configPath,
    cwd = process.cwd(),
    execPath = process.execPath,
    spawnSyncImpl = spawnSync,
    makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-jest-results-')),
    removeTempDir = (tempDir) => fs.rmSync(tempDir, { recursive: true, force: true }),
} = {}) {
    const tempDir = makeTempDir();
    const outputFile = path.join(tempDir, `${surface}.json`);
    const jestBin = path.resolve(cwd, 'node_modules/jest/bin/jest.js');
    const reportScript = path.resolve(cwd, 'scripts/jest-report-slowest.mjs');

    let exitCode = 0;

    try {
        const jestResult = spawnSyncImpl(
            execPath,
            [
                jestBin,
                '--config',
                configPath,
                '--runInBand',
                '--json',
                '--outputFile',
                outputFile,
            ],
            {
                stdio: 'inherit',
            }
        );

        exitCode = deriveSpawnExitCode(jestResult);
        if (exitCode !== 0) {
            return exitCode;
        }

        const reportResult = spawnSyncImpl(execPath, [reportScript, outputFile, surface], {
            stdio: 'inherit',
        });

        return deriveSpawnExitCode(reportResult);
    } finally {
        removeTempDir(tempDir);
    }
}
