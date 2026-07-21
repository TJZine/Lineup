import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageWebosPath = path.resolve(testDir, '..', 'package-webos.mjs');

for (const [option, followingOption] of [
    ['--ares-package', '--dist-dir'],
    ['--dist-dir', '--output-dir'],
    ['--output-dir', '--dist-dir'],
]) {
    test(`rejects ${followingOption} as a missing value for ${option}`, () => {
        const result = spawnSync(process.execPath, [packageWebosPath, option, followingOption], {
            encoding: 'utf8',
        });

        assert.equal(result.status, 1);
        assert.match(result.stderr, new RegExp(`Missing value for ${option}\\.`, 'u'));
    });
}
