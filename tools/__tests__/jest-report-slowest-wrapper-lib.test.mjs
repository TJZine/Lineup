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

test('runJestReportSlowestWrapper resolves the config path from cwd and passes cwd to both child processes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-wrapper-test-'));
    const spawnCalls = [];
    const fakeCwd = '/tmp/fake-lineup';
    const spawnResults = [
        { status: 0 },
        { status: 0 },
    ];

    runJestReportSlowestWrapper({
        surface: 'unit',
        configPath: 'configs/jest.config.js',
        cwd: fakeCwd,
        spawnSyncImpl: (...args) => {
            spawnCalls.push(args);
            return spawnResults.shift();
        },
        makeTempDir: () => tempDir,
        removeTempDir: (dir) => fs.rmSync(dir, { recursive: true, force: true }),
        execPath: process.execPath,
    });

    assert.equal(spawnCalls.length, 2);
    assert.deepEqual(
        spawnCalls[0],
        [
            process.execPath,
            [
                path.join(fakeCwd, 'node_modules/jest/bin/jest.js'),
                '--config',
                path.join(fakeCwd, 'configs/jest.config.js'),
                '--runInBand',
                '--json',
                '--outputFile',
                path.join(tempDir, 'unit.json'),
            ],
            {
                cwd: fakeCwd,
                stdio: 'inherit',
            },
        ]
    );
    assert.deepEqual(
        spawnCalls[1],
        [
            process.execPath,
            [
                path.join(fakeCwd, 'scripts/jest-report-slowest.mjs'),
                path.join(tempDir, 'unit.json'),
                'unit',
            ],
            {
                cwd: fakeCwd,
                stdio: 'inherit',
            },
        ]
    );
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

test('runJestReportSlowestWrapper rethrows spawn errors and still cleans up', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-wrapper-test-'));
    const removed = [];
    const spawnError = new Error('spawn failed before exec');

    assert.throws(
        () =>
            runJestReportSlowestWrapper({
                surface: 'unit',
                configPath: 'jest.config.js',
                cwd: '/tmp/fake-lineup',
                spawnSyncImpl: () => ({ status: null, error: spawnError }),
                makeTempDir: () => tempDir,
                removeTempDir: (dir) => {
                    removed.push(dir);
                    fs.rmSync(dir, { recursive: true, force: true });
                },
                execPath: process.execPath,
            }),
        spawnError
    );

    assert.deepEqual(removed, [tempDir]);
    assert.equal(fs.existsSync(tempDir), false);
});

test('runJestReportSlowestWrapper rethrows report-step spawn errors and still cleans up', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-wrapper-test-'));
    const removed = [];
    const spawnError = new Error('report spawn failed before exec');
    const spawnResults = [
        { status: 0 },
        { status: null, error: spawnError },
    ];

    assert.throws(
        () =>
            runJestReportSlowestWrapper({
                surface: 'unit',
                configPath: 'jest.config.js',
                cwd: '/tmp/fake-lineup',
                spawnSyncImpl: () => spawnResults.shift(),
                makeTempDir: () => tempDir,
                removeTempDir: (dir) => {
                    removed.push(dir);
                    fs.rmSync(dir, { recursive: true, force: true });
                },
                execPath: process.execPath,
            }),
        spawnError
    );

    assert.deepEqual(removed, [tempDir]);
    assert.equal(fs.existsSync(tempDir), false);
});
