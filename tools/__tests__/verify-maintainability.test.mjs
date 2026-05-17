import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
    FILE_SHAPE_ALLOWLIST_END,
    FILE_SHAPE_ALLOWLIST_START,
    formatAllowlistMarkdown,
    parseCliArgs,
    verifyMaintainability,
} from '../verify-maintainability.mjs';

function makeTempRepo() {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-maintainability-test-'));
    mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
    mkdirSync(path.join(repoRoot, 'docs/architecture'), { recursive: true });
    return repoRoot;
}

function writeSource(repoRoot, relativePath, lineCount) {
    const fullPath = path.join(repoRoot, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    const content = Array.from({ length: lineCount }, (_, index) => `line${index + 1}`).join('\n');
    writeFileSync(fullPath, content, 'utf8');
}

function writeAllowlist(repoRoot, rows) {
    const body = [
        FILE_SHAPE_ALLOWLIST_START,
        '| Path | Baseline lines | Rationale | Growth/decomposition trigger |',
        '| --- | ---: | --- | --- |',
        ...rows,
        FILE_SHAPE_ALLOWLIST_END,
    ].join('\n');
    const allowlistPath = path.join(repoRoot, 'docs/architecture/file-shape-guardrails.md');
    writeFileSync(allowlistPath, body, 'utf8');
    return allowlistPath;
}

function row(filePath, baselineLines, trigger = 'Revisit/decomposition trigger: split before adding policy.') {
    return `| \`${filePath}\` | ${baselineLines} | Accepted current baseline. | ${trigger} |`;
}

function runFixture(callback) {
    const repoRoot = makeTempRepo();
    try {
        callback(repoRoot);
    } finally {
        rmSync(repoRoot, { recursive: true, force: true });
    }
}

function verify(repoRoot) {
    return verifyMaintainability({
        repoRoot,
        allowlistPath: path.join(repoRoot, 'docs/architecture/file-shape-guardrails.md'),
    });
}

test('fails when oversized production files are missing allowlist rows', () => {
    runFixture((repoRoot) => {
        writeSource(repoRoot, 'src/large.ts', 501);
        writeAllowlist(repoRoot, []);

        const result = verify(repoRoot);

        assert.match(result.errors.join('\n'), /src\/large\.ts is 501 lines and needs an allowlist row/u);
    });
});

test('fails malformed allowlist rows', () => {
    runFixture((repoRoot) => {
        writeSource(repoRoot, 'src/large.ts', 501);
        writeAllowlist(repoRoot, [
            '| `src/large.ts` | many | Accepted current baseline. | Revisit/decomposition trigger: split before adding policy. |',
            '| `src/prefixed.ts` | 501oops | Accepted current baseline. | Revisit/decomposition trigger: split before adding policy. |',
            '| `src/decimal.ts` | 501.5 | Accepted current baseline. | Revisit/decomposition trigger: split before adding policy. |',
            '| `src/other.ts` | 501 | Missing trigger only has three cells |',
        ]);

        const result = verify(repoRoot);
        const errors = result.errors.join('\n');

        assert.equal(errors.match(/baseline lines must be an integer greater than 500/gu)?.length, 3);
        assert.match(errors, /Malformed maintainability allowlist row 6: expected 4 columns/u);
    });
});

test('fails when production files grow beyond their recorded baseline', () => {
    runFixture((repoRoot) => {
        writeSource(repoRoot, 'src/large.ts', 502);
        writeAllowlist(repoRoot, [row('src/large.ts', 501)]);

        const result = verify(repoRoot);

        assert.match(result.errors.join('\n'), /src\/large\.ts grew beyond its baseline: 502 lines current vs 501 recorded/u);
    });
});

test('fails stale allowlist rows that point to deleted or non-production paths', () => {
    runFixture((repoRoot) => {
        writeSource(repoRoot, 'src/large.ts', 501);
        writeAllowlist(repoRoot, [
            row('src/deleted.ts', 501),
            row('docs/large.ts', 501),
            row('src/large.ts', 501),
        ]);

        const result = verify(repoRoot);
        const errors = result.errors.join('\n');

        assert.match(errors, /deleted or renamed path: src\/deleted\.ts/u);
        assert.match(errors, /non-production path: docs\/large\.ts/u);
    });
});

test('fails allowlist rows after files shrink back to the soft threshold', () => {
    runFixture((repoRoot) => {
        writeSource(repoRoot, 'src/shrunk.ts', 500);
        writeAllowlist(repoRoot, [row('src/shrunk.ts', 501)]);

        const result = verify(repoRoot);

        assert.match(result.errors.join('\n'), /src\/shrunk\.ts is stale: current line count 500 is at or below 500/u);
    });
});

test('excludes tests from production file counting', () => {
    runFixture((repoRoot) => {
        writeSource(repoRoot, 'src/__tests__/large.ts', 900);
        writeSource(repoRoot, 'src/feature/large.test.ts', 900);
        writeAllowlist(repoRoot, []);

        const result = verify(repoRoot);

        assert.deepEqual(result.errors, []);
        assert.deepEqual(result.oversizedFiles, []);
    });
});

test('requires explicit decomposition or revisit triggers for files over 800 lines', () => {
    runFixture((repoRoot) => {
        writeSource(repoRoot, 'src/huge.ts', 801);
        writeAllowlist(repoRoot, [row('src/huge.ts', 801, 'No growth without review.')]);

        const result = verify(repoRoot);

        assert.match(result.errors.join('\n'), /src\/huge\.ts is 801 lines and requires an explicit decomposition\/revisit trigger/u);
    });
});

test('counts src build files as production source', () => {
    runFixture((repoRoot) => {
        writeSource(repoRoot, 'src/runtime/build/generated.ts', 501);
        writeAllowlist(repoRoot, []);

        const result = verify(repoRoot);

        assert.match(result.errors.join('\n'), /src\/runtime\/build\/generated\.ts is 501 lines and needs an allowlist row/u);
    });
});

test('formats allowlist rows from the verifier file count shape', () => {
    const markdown = formatAllowlistMarkdown([{ path: 'src/large.ts', lines: 501 }]);

    assert.match(markdown, /\| `src\/large\.ts` \| 501 \|/u);
    assert.match(markdown, /Revisit\/decomposition trigger/u);
});

test('resolves relative allowlist paths against the final root regardless of argument order', () => {
    const repoRoot = path.join(os.tmpdir(), 'lineup-maintainability-root');
    const allowlistPath = path.join(repoRoot, 'docs/architecture/custom-guardrails.md');

    assert.equal(
        parseCliArgs(['--allowlist', 'docs/architecture/custom-guardrails.md', '--root', repoRoot]).allowlistPath,
        allowlistPath
    );
    assert.equal(
        parseCliArgs(['--root', repoRoot, '--allowlist', 'docs/architecture/custom-guardrails.md']).allowlistPath,
        allowlistPath
    );
});
