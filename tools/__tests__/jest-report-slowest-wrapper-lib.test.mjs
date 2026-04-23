import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    deriveSpawnExitCode,
    runJestReportSlowestWrapper,
} from '../../scripts/jest-report-slowest-wrapper-lib.mjs';

test('deriveSpawnExitCode treats signals and errors as failures', () => {
    assert.equal(deriveSpawnExitCode({ status: 0 }), 0);
    assert.equal(deriveSpawnExitCode({ status: 2 }), 2);
    assert.equal(deriveSpawnExitCode({ status: null, signal: 'SIGTERM' }), 1);
    assert.equal(deriveSpawnExitCode({ status: null, error: new Error('spawn failed') }), 1);
});

test('runJestReportSlowestWrapper skips the report step after a signaled Jest run and still cleans up', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-wrapper-test-'));
    const removed = [];
    const spawnCalls = [];

    const exitCode = runJestReportSlowestWrapper({
        surface: 'tools',
        configPath: 'jest.tools.config.js',
        cwd: '/tmp/fake-lineup',
        spawnSyncImpl: (...args) => {
            spawnCalls.push(args);
            return { status: null, signal: 'SIGTERM' };
        },
        makeTempDir: () => tempDir,
        removeTempDir: (dir) => {
            removed.push(dir);
            fs.rmSync(dir, { recursive: true, force: true });
        },
        execPath: process.execPath,
    });

    assert.equal(exitCode, 1);
    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(removed, [tempDir]);
    assert.equal(fs.existsSync(tempDir), false);
});

test('runJestReportSlowestWrapper returns the report exit code after a successful Jest run', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-wrapper-test-'));
    const spawnResults = [
        { status: 0 },
        { status: null, signal: 'SIGINT' },
    ];

    const exitCode = runJestReportSlowestWrapper({
        surface: 'unit',
        configPath: 'jest.config.js',
        cwd: '/tmp/fake-lineup',
        spawnSyncImpl: () => spawnResults.shift(),
        makeTempDir: () => tempDir,
        removeTempDir: (dir) => fs.rmSync(dir, { recursive: true, force: true }),
        execPath: process.execPath,
    });

    assert.equal(exitCode, 1);
    assert.equal(fs.existsSync(tempDir), false);
});
