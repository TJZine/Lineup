import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
    captureSourceProvenance,
    writeBuildProvenance,
} from '../build-provenance.mjs';

function git(cwd, args) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('build provenance fingerprints tracked and untracked build inputs', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-build-provenance-test-'));
    try {
        mkdirSync(path.join(tempRoot, 'src'), { recursive: true });
        writeFileSync(path.join(tempRoot, 'src', 'input.ts'), 'export const value = 1;\n', 'utf8');
        git(tempRoot, ['init', '--quiet']);
        git(tempRoot, ['config', 'user.email', 'test@example.com']);
        git(tempRoot, ['config', 'user.name', 'Lineup Test']);
        git(tempRoot, ['add', 'src/input.ts']);
        git(tempRoot, ['commit', '--quiet', '-m', 'fixture']);

        const clean = captureSourceProvenance(tempRoot);
        assert.equal(clean.relevant_dirty_summary, '');

        writeFileSync(path.join(tempRoot, 'src', 'input.ts'), 'export const value = 2;\n', 'utf8');
        const trackedChange = captureSourceProvenance(tempRoot);
        assert.notEqual(trackedChange.source_fingerprint_sha256, clean.source_fingerprint_sha256);

        writeFileSync(path.join(tempRoot, 'src', 'new-input.ts'), 'export const added = true;\n', 'utf8');
        const untrackedChange = captureSourceProvenance(tempRoot);
        assert.notEqual(untrackedChange.source_fingerprint_sha256, trackedChange.source_fingerprint_sha256);

        const written = writeBuildProvenance({
            cwd: tempRoot,
            distDir: path.join(tempRoot, 'dist'),
            buildProfile: 'lean',
        });
        const manifest = JSON.parse(readFileSync(
            path.join(tempRoot, 'dist', 'build-provenance.json'),
            'utf8'
        ));
        assert.deepEqual(manifest, written);
        assert.equal(manifest.build_profile, 'lean');
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});
