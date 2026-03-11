import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHarnessIngestionReport,
    buildChecklistPlanPathMessages,
    checkArchiveSectionSummaryConformance,
    classifyChecklistPlanPathStatus,
    checkPlanConformance,
    EVAL_PROMPT_INVENTORY,
    extractHarnessIngestionTriage,
    extractChecklistPlanPaths,
    parseSkillMirrorManifest,
    renderEvalPromptInventory,
    renderSessionPromptSet,
    replaceManagedSection,
    SESSION_PROMPT_INVENTORY,
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

test('classifyChecklistPlanPathStatus distinguishes tracked, untracked, and missing plan refs', () => {
    assert.equal(classifyChecklistPlanPathStatus({ exists: true, tracked: true }), 'tracked');
    assert.equal(classifyChecklistPlanPathStatus({ exists: true, tracked: false }), 'untracked');
    assert.equal(classifyChecklistPlanPathStatus({ exists: false, tracked: true }), 'missing-tracked');
    assert.equal(classifyChecklistPlanPathStatus({ exists: false, tracked: false }), 'missing-untracked');
});

test('buildChecklistPlanPathMessages warns for untracked plan refs in strict mode', () => {
    const result = buildChecklistPlanPathMessages(
        [
            { relativePath: 'docs/plans/tracked.md', status: 'tracked' },
            { relativePath: 'docs/plans/untracked.md', status: 'untracked' },
            { relativePath: 'docs/plans/missing-tracked.md', status: 'missing-tracked' },
            { relativePath: 'docs/plans/missing-untracked.md', status: 'missing-untracked' },
        ],
        { mode: 'strict' }
    );

    assert.deepEqual(result.errors, ['Checklist references missing tracked plan path: docs/plans/missing-tracked.md']);
    assert.deepEqual(result.warnings, [
        'Checklist references untracked plan path: docs/plans/untracked.md (exists locally but is not tracked)',
        'Checklist references untracked plan path: docs/plans/missing-untracked.md (missing from workspace and not tracked)',
    ]);
});

test('buildChecklistPlanPathMessages downgrades missing tracked plan refs to warnings in workspace mode', () => {
    const result = buildChecklistPlanPathMessages(
        [
            { relativePath: 'docs/plans/untracked.md', status: 'untracked' },
            { relativePath: 'docs/plans/missing-tracked.md', status: 'missing-tracked' },
            { relativePath: 'docs/plans/missing-untracked.md', status: 'missing-untracked' },
        ],
        { mode: 'workspace' }
    );

    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, [
        'Checklist references untracked plan path: docs/plans/untracked.md (exists locally but is not tracked)',
        'Checklist references missing tracked plan path: docs/plans/missing-tracked.md',
        'Checklist references untracked plan path: docs/plans/missing-untracked.md (missing from workspace and not tracked)',
    ]);
});

test('buildChecklistPlanPathMessages deduplicates repeated checklist refs for the same plan path', () => {
    const result = buildChecklistPlanPathMessages(
        [
            { relativePath: 'docs/archive/plans/shared-summary.md', status: 'missing-tracked' },
            { relativePath: 'docs/archive/plans/shared-summary.md', status: 'missing-tracked' },
            { relativePath: 'docs/plans/draft.md', status: 'untracked' },
            { relativePath: 'docs/plans/draft.md', status: 'untracked' },
        ],
        { mode: 'workspace' }
    );

    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, [
        'Checklist references missing tracked plan path: docs/archive/plans/shared-summary.md',
        'Checklist references untracked plan path: docs/plans/draft.md (exists locally but is not tracked)',
    ]);
});

test('SESSION_PROMPT_INVENTORY and EVAL_PROMPT_INVENTORY drive expected file order', () => {
    assert.equal(SESSION_PROMPT_INVENTORY[0].file, 'cleanup-plan.md');
    assert.equal(SESSION_PROMPT_INVENTORY[5].file, 'feature-implement.md');
    assert.equal(
        SESSION_PROMPT_INVENTORY[5].description,
        'approved feature/design implementer session; Tier 2 default, reusable in Tier 3 when a run bundle already exists',
    );
    assert.equal(SESSION_PROMPT_INVENTORY.at(-1)?.file, 'workflow-harness-review.md');
    assert.equal(EVAL_PROMPT_INVENTORY[0].file, '01-app-container-extraction-no-ui-drift.md');
    assert.equal(EVAL_PROMPT_INVENTORY.at(-1)?.file, '19-multi-agent-role-selection-and-delegation-discipline.md');
});

test('renderSessionPromptSet renders the managed launcher inventory from manifest data', () => {
    const rendered = renderSessionPromptSet([
        {
            file: 'cleanup-plan.md',
            linkText: 'cleanup-plan.md',
            description: 'Tier 2 planner session for writing or refreshing a serious cleanup plan',
        },
        {
            file: 'feature-review.md',
            linkText: 'feature-review.md',
            description: 'reusable adversarial review session for feature/design plans and implementations',
        },
    ]);

    assert.equal(
        rendered,
        [
            '- [`cleanup-plan.md`](./cleanup-plan.md)',
            '  - Tier 2 planner session for writing or refreshing a serious cleanup plan',
            '- [`feature-review.md`](./feature-review.md)',
            '  - reusable adversarial review session for feature/design plans and implementations',
        ].join('\n')
    );
});

test('renderEvalPromptInventory renders the managed eval inventory from manifest data', () => {
    const rendered = renderEvalPromptInventory([
        {
            file: '11-plex-subtitle-policy.md',
            linkText: '11-plex-subtitle-policy',
            title: '11 Plex Subtitle Policy',
        },
        {
            file: '18-detect-unresolved-seam-before-freezing-plan.md',
            linkText: '18-detect-unresolved-seam-before-freezing-plan',
            title: '18 Detect Unresolved Seam Before Freezing Plan',
        },
    ]);

    assert.equal(
        rendered,
        [
            '- [`11-plex-subtitle-policy`](./prompts/11-plex-subtitle-policy.md)',
            '  - 11 Plex Subtitle Policy',
            '- [`18-detect-unresolved-seam-before-freezing-plan`](./prompts/18-detect-unresolved-seam-before-freezing-plan.md)',
            '  - 18 Detect Unresolved Seam Before Freezing Plan',
        ].join('\n')
    );
});

test('replaceManagedSection replaces content between explicit markers', () => {
    const content = [
        'before',
        '<!-- BEGIN MANAGED BLOCK -->',
        'old',
        '<!-- END MANAGED BLOCK -->',
        'after',
    ].join('\n');

    const result = replaceManagedSection(content, {
        startMarker: '<!-- BEGIN MANAGED BLOCK -->',
        endMarker: '<!-- END MANAGED BLOCK -->',
        replacement: 'new',
    });

    assert.equal(
        result,
        ['before', '<!-- BEGIN MANAGED BLOCK -->', 'new', '<!-- END MANAGED BLOCK -->', 'after'].join('\n')
    );
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

test('extractHarnessIngestionTriage reads a valid deferred triage block', () => {
    const triage = extractHarnessIngestionTriage(`
# Priority 7 Section Summary

## Harness Ingestion Triage

- status: \`deferred\`
- recommended action: \`targeted-eval\`
- why: One work unit hinted at an eval gap, but the signal is still single-occurrence.
- tracked follow-up: \`none\`
- local-only holding note: \`docs/runs/<date>-harness-ingestion-triage/Documentation.md\`
- revisit trigger: after the next completed priority block touching the same workflow seam
`);

    assert.equal(triage.status, 'deferred');
    assert.equal(triage.recommendedAction, 'targeted-eval');
    assert.equal(
        triage.localOnlyHoldingNote,
        'docs/runs/<date>-harness-ingestion-triage/Documentation.md'
    );
    assert.equal(triage.trackedFollowUp, 'none');
    assert.equal(triage.errors.length, 0);
});

test('checkArchiveSectionSummaryConformance reports missing triage guidance for archived section summaries', () => {
    const result = checkArchiveSectionSummaryConformance({
        filePath: 'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
        content: '# Priority 7 Section Summary\n',
    });

    assert.equal(result.isSectionSummary, true);
    assert.deepEqual(result.errors, [
        'missing required section: Harness Ingestion Triage',
    ]);
});

test('checkArchiveSectionSummaryConformance rejects deferred triage without a local-only holding note and revisit trigger', () => {
    const result = checkArchiveSectionSummaryConformance({
        filePath: 'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
        content: `# Priority 7 Section Summary

## Harness Ingestion Triage

- status: \`deferred\`
- recommended action: \`targeted-eval\`
- why: Interesting, but not durable yet.
- tracked follow-up: \`none\`
- local-only holding note: \`none\`
- revisit trigger: \`none\`
`,
    });

    assert.equal(result.isSectionSummary, true);
    assert.deepEqual(result.errors, [
        'deferred harness-ingestion triage must point at the local-only holding-note convention under docs/runs/<date>-harness-ingestion-triage/',
        'deferred harness-ingestion triage must name a non-`none` revisit trigger',
    ]);
});

test('checkArchiveSectionSummaryConformance accepts uppercase tracked follow-up doc paths', () => {
    const result = checkArchiveSectionSummaryConformance({
        filePath: 'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
        content: `# Priority 7 Section Summary

## Harness Ingestion Triage

- status: \`absorbed\`
- recommended action: \`historical-corpus\`
- why: Durable lessons were absorbed into tracked docs.
- tracked follow-up: \`docs/AGENTIC_DEV_WORKFLOW.md\`, \`docs/architecture/CURRENT_STATE.md\`
- local-only holding note: \`none\`
- revisit trigger: \`none\`
`,
    });

    assert.equal(result.isSectionSummary, true);
    assert.deepEqual(result.errors, []);
});

test('buildHarnessIngestionReport lists only archived section summaries with actionable triage decisions', () => {
    const report = buildHarnessIngestionReport([
        {
            filePath: 'docs/archive/plans/2026-03-08-priority-5-plex-stream-policy-section-summary.md',
            status: 'absorbed',
            recommendedAction: 'historical-corpus',
            why: 'No new harness lesson.',
            trackedFollowUp: 'docs/agentic/historical-plan-corpus-review.md',
            localOnlyHoldingNote: 'none',
            revisitTrigger: 'none',
        },
        {
            filePath: 'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
            status: 'pending',
            recommendedAction: 'targeted-eval',
            why: 'The same workflow miss appeared twice.',
            trackedFollowUp: 'docs/agentic/evals/baseline-summaries/',
            localOnlyHoldingNote: 'none',
            revisitTrigger: 'none',
        },
    ]);

    assert.equal(
        report,
        [
            'Pending harness-ingestion follow-up:',
            '- docs/archive/plans/2026-03-11-priority-7-example-section-summary.md :: pending :: targeted-eval :: docs/agentic/evals/baseline-summaries/',
            '  Why: The same workflow miss appeared twice.',
        ].join('\n')
    );
});
