import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
    ATTENTION_LINE_THRESHOLD,
    REVIEW_LINE_THRESHOLD,
    collectArchitectureAttention,
    countLogicalLines,
    isProductionSourcePath,
    parseCliArgs,
} from '../verify-maintainability.mjs';

function withTempRepo(callback) {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-maintainability-test-'));
    mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
    try {
        callback(repoRoot);
    } finally {
        rmSync(repoRoot, { recursive: true, force: true });
    }
}

function writeSource(repoRoot, relativePath, lineCount) {
    const fullPath = path.join(repoRoot, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    const content = Array.from({ length: lineCount }, (_, index) => `line${index + 1}`).join('\n');
    writeFileSync(fullPath, content, 'utf8');
}

test('classifies line counts as attention or independent-review evidence', () => {
    withTempRepo((repoRoot) => {
        writeSource(repoRoot, 'src/at-threshold.ts', ATTENTION_LINE_THRESHOLD);
        writeSource(repoRoot, 'src/attention.ts', ATTENTION_LINE_THRESHOLD + 1);
        writeSource(repoRoot, 'src/at-review-threshold.ts', REVIEW_LINE_THRESHOLD);
        writeSource(repoRoot, 'src/review.ts', REVIEW_LINE_THRESHOLD + 1);

        assert.deepEqual(collectArchitectureAttention(repoRoot), [
            { path: 'src/at-review-threshold.ts', lines: 800, reviewRequired: false },
            { path: 'src/attention.ts', lines: 501, reviewRequired: false },
            { path: 'src/review.ts', lines: 801, reviewRequired: true },
        ]);
    });
});

test('reports only supported production source paths', () => {
    for (const relativePath of [
        'src/feature.ts',
        'src/view.tsx',
        'src/styles.css',
        'src/page.html',
    ]) {
        assert.equal(isProductionSourcePath(relativePath), true, relativePath);
    }
    for (const relativePath of [
        'docs/example.ts',
        'src/__tests__/large.ts',
        'src/feature.test.ts',
        'src/data.json',
    ]) {
        assert.equal(isProductionSourcePath(relativePath), false, relativePath);
    }
});

test('counts logical lines consistently across newline forms', () => {
    assert.equal(countLogicalLines(''), 0);
    assert.equal(countLogicalLines('one'), 1);
    assert.equal(countLogicalLines('one\ntwo\n'), 2);
    assert.equal(countLogicalLines('one\r\ntwo\r\n'), 2);
});

test('parses a root and rejects unsupported options', () => {
    const repoRoot = path.join(os.tmpdir(), 'lineup-maintainability-root');
    assert.equal(parseCliArgs(['--root', repoRoot]).repoRoot, repoRoot);
    assert.equal(parseCliArgs(['--details']).details, true);
    assert.throws(() => parseCliArgs(['--unknown']), /Unknown verify-maintainability option/u);
    assert.throws(() => parseCliArgs(['--root']), /Missing value for --root/u);
});
