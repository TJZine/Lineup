import test from 'node:test';
import assert from 'node:assert/strict';

import {
    checkPlanConformance,
    extractChecklistPlanPaths,
    parseSkillMirrorManifest,
} from '../harness-docs-lib.mjs';

test('parseSkillMirrorManifest reads tracked allowlist entries and ignores comments', () => {
    const entries = parseSkillMirrorManifest(`
# comment
superpowers:using-superpowers

superpowers:brainstorming
global:frontend-design
    `);

    assert.deepEqual(entries, [
        { source: 'superpowers', skill: 'using-superpowers' },
        { source: 'superpowers', skill: 'brainstorming' },
        { source: 'global', skill: 'frontend-design' },
    ]);
});

test('parseSkillMirrorManifest throws on invalid allowlist entries', () => {
    assert.throws(
        () =>
            parseSkillMirrorManifest(`
superpowers:using-superpowers
oops:not valid
            `),
        /Invalid skill mirror manifest entry: oops:not valid/
    );
});

test('extractChecklistPlanPaths returns every checklist-linked tracked plan path', () => {
    const paths = extractChecklistPlanPaths(`
- [x] P4-W1 (done 2026-03-05; plan: docs/plans/example-plan.md)
- [x] P4-W2 (done 2026-03-06; plan: docs/archive/plans/example-archived-plan.md)
    `);

    assert.deepEqual(paths, [
        'docs/plans/example-plan.md',
        'docs/archive/plans/example-archived-plan.md',
    ]);
});

test('extractChecklistPlanPaths ignores placeholders and non-plan values', () => {
    const paths = extractChecklistPlanPaths(`
- [x] P4-W1 (done 2026-03-05; plan: docs/plans/example-plan.md)
- [ ] Placeholder item (plan: docs/plans/<fill-me>.md)
- [ ] Notes only (plan: TBD)
- [ ] Missing suffix (plan: docs/plans/not-a-plan)
    `);

    assert.deepEqual(paths, ['docs/plans/example-plan.md']);
});

test('checkPlanConformance reports missing required sections for serious active plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: `# Example Implementation Plan

**Goal:** Do the thing.

## Non-Goals

## Required Skills

## Verification Commands
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.missingSections, [
        'parent alignment',
        'required reading',
        'Codanna discovery',
        'impact snapshot',
        'files in scope',
        'files out of scope',
        'planner self-check',
        'architecture seam decision gate',
        'rollback notes',
        'commit checkpoints',
    ]);
});

test('checkPlanConformance accepts the tracked section variants used by older and newer plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: `# Example Implementation Plan

**Goal:** Do the thing.

**Architecture:** Keep the boundary explicit.

## Non-Goals

## Required Reading

## Required Skills

## Codanna Discovery

## Evidence To Preserve

## Allowed File Changes

## Files Out Of Scope

## Planner Self-Check

## Architecture Seam Decision Gate

## Verification Commands

## Rollback Notes

## Commit Checkpoints
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.missingSections, []);
});

test('checkPlanConformance skips non-plan artifacts such as risk registers', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-03-04-epg-performance-risk-register.md',
        content: '# EPG Performance Risk Register',
    });

    assert.equal(result.isSerious, false);
    assert.deepEqual(result.missingSections, []);
});

test('checkPlanConformance skips archive readmes and other non-serious artifacts', () => {
    const result = checkPlanConformance({
        filePath: 'docs/archive/plans/README.md',
        content: '# Archived Plans',
    });

    assert.equal(result.isSerious, false);
    assert.deepEqual(result.missingSections, []);
});
