import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ACTIVE_PLAN_MARKER,
    buildHarnessIngestionReport,
    buildChecklistPlanPathMessages,
    checkArchiveSectionSummaryConformance,
    classifyChecklistPlanPathStatus,
    checkPlanConformance,
    EVAL_PROMPT_INVENTORY,
    extractHarnessIngestionTriage,
    extractChecklistPlanPaths,
    REQUIRED_REPO_LOCAL_SKILL_FILES,
    REQUIRED_REPO_LOCAL_SKILLS,
    renderEvalPromptInventory,
    renderSessionPromptSet,
    replaceManagedSection,
    SESSION_PROMPT_INVENTORY,
} from '../harness-docs-lib.mjs';

function buildSingleSlicePackageDecomposition({
    readyNowSlice = 'P6-W1-S1',
    readyNowExecutionUnit = readyNowSlice,
} = {}) {
    return `
## Package Decomposition

- \`package_id\`: \`pkg_example_cleanup\`
- \`checklist_token\`: \`P6-W1\`
- \`package_issue_ids\`:
  - \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
- \`slice_table\`:

### \`${readyNowSlice}\` Example Slice

- \`goal\`: retire the package-owned seam without widening scope
- \`areas/files\`:
  - \`docs/agentic/plan-authoring-standard.md\`
- \`exact_issue_ids\`:
  - \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
- \`verification\`:
  - \`npm run verify:docs\`
- \`dependencies\`: none
- \`stop_condition\`: stop if the approved seam widens
- \`handoff_condition\`: hand off once review is clean
- \`serial_only\`: true
- \`parallel_justification\`: keep the execution unit serial
- \`coverage_check\`:
  - every existing package issue is mapped to one slice-owned execution path
- \`recommended_slice_order\`:
  1. \`${readyNowSlice}\`
- \`ready_now_slice\`: \`${readyNowSlice}\`
- \`ready_now_execution_unit\`: \`${readyNowExecutionUnit}\`
- \`parallel_execution_policy\`: serial
`;
}

function buildWaveScopedPackageDecomposition() {
    return `
## Package Decomposition

- \`package_id\`: \`pkg_example_cleanup\`
- \`checklist_token\`: \`P6-W1\`
- \`package_issue_ids\`:
  - \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
  - \`review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation\`
- \`slice_table\`:

### \`P6-W1-S1\` First Slice

- \`goal\`: retire the first approved seam
- \`areas/files\`:
  - \`docs/agentic/plan-authoring-standard.md\`
- \`exact_issue_ids\`:
  - \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
- \`verification\`:
  - \`npm run verify:docs\`
- \`dependencies\`: none
- \`stop_condition\`: stop if the approved seam widens
- \`handoff_condition\`: hand off once review is clean
- \`serial_only\`: true
- \`parallel_justification\`: wave stays in one verification envelope

### \`P6-W1-S2\` Second Slice

- \`goal\`: retire the second approved seam
- \`areas/files\`:
  - \`docs/AGENTIC_DEV_WORKFLOW.md\`
- \`exact_issue_ids\`:
  - \`review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation\`
- \`verification\`:
  - \`npm run verify:docs\`
- \`dependencies\`: \`P6-W1-S1\`
- \`stop_condition\`: stop if the approved seam widens
- \`handoff_condition\`: hand off once review is clean
- \`serial_only\`: true
- \`parallel_justification\`: wave stays in one verification envelope

- \`coverage_check\`:
  - every existing package issue is mapped to one slice-owned execution path
- \`coverage_ledger\`:
  - \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
    - \`slice_id\`: \`P6-W1-S1\`
    - \`execution_unit\`: \`W1\`
    - \`default survivor disposition / final owner\`: \`P6-W1\`
  - \`review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation\`
    - \`slice_id\`: \`P6-W1-S2\`
    - \`execution_unit\`: \`W1\`
    - \`default survivor disposition / final owner\`: \`P6-W1\`
- \`execution_waves\`:
  - \`wave_id\`: \`W1\`
  - \`slice_ids\`:
    - \`P6-W1-S1\`
    - \`P6-W1-S2\`
  - \`completion_condition\`: both approved slices are implemented and wave review is clean
  - \`absorb_now_scope\`: absorb only same-owner residue that stays inside the approved execution-unit goal, seam/files, verification envelope, and final-owner accounting
  - \`replan_triggers\`:
    - new owner
    - changed execution-unit membership
- \`recommended_slice_order\`:
  1. \`P6-W1-S1\`
  2. \`P6-W1-S2\`
- \`ready_now_slice\`: \`P6-W1-S1\`
- \`ready_now_execution_unit\`: \`W1\`
- \`parallel_execution_policy\`: serial-in-wave
`;
}

function buildFcpSingleSlicePackageDecomposition() {
    return `
## Package Decomposition

- \`package_id\`: \`pkg_fcp_architecture_handoff\`
- \`checklist_token\`: \`FCP-1\`
- \`source_finding_ids\`:
  - \`FCP-1-SF1\`
- \`slice_table\`:

### \`FCP-1-S1\` Architecture Handoff Slice

- \`goal\`: retire the source-backed handoff seam without widening scope
- \`areas/files\`:
  - \`src/core/orchestrator/AppOrchestrator.ts\`
- \`source_finding_ids\`:
  - \`FCP-1-SF1\`
- \`verification\`:
  - \`npm run verify\`
- \`dependencies\`: none
- \`stop_condition\`: stop if the source audit finds a different owner seam
- \`handoff_condition\`: hand off once review is clean
- \`serial_only\`: true
- \`parallel_justification\`: keep the execution unit serial
- \`coverage_check\`:
  - every approved source finding is mapped to one slice-owned execution path
- \`recommended_slice_order\`:
  1. \`FCP-1-S1\`
- \`ready_now_slice\`: \`FCP-1-S1\`
- \`ready_now_execution_unit\`: \`FCP-1-S1\`
- \`parallel_execution_policy\`: serial
`;
}

function buildActiveCleanupPlan(packageDecomposition, extraSections = '') {
    return `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No unrelated runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Files In Scope

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${packageDecomposition}

${extraSections}
`;
}

test('required repo-local skill inventory includes the canonical planner and verification skills', () => {
    assert.ok(REQUIRED_REPO_LOCAL_SKILLS.includes('closeout-verification'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILLS.includes('debugging-remediation'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILLS.includes('execution-plan-authoring'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILLS.includes('review-adjudication'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILLS.includes('review-request'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILLS.includes('verification-strategy'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILL_FILES.includes('.agents/skills/closeout-verification/SKILL.md'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILL_FILES.includes('.agents/skills/debugging-remediation/SKILL.md'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILL_FILES.includes('.agents/skills/execution-plan-authoring/SKILL.md'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILL_FILES.includes('.agents/skills/review-adjudication/SKILL.md'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILL_FILES.includes('.agents/skills/review-request/SKILL.md'));
    assert.ok(REQUIRED_REPO_LOCAL_SKILL_FILES.includes('.agents/skills/verification-strategy/SKILL.md'));
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

test('extractChecklistPlanPaths reads mini-record Plan fields case-insensitively', () => {
    const paths = extractChecklistPlanPaths(`
### [ ] \`FCP-1\` Architecture And Handoff Coherence

- Status: not started
- Plan: docs/plans/fcp.md
- Handoff: pending

### [x] \`P6-W1\`

- plan: docs/archive/plans/legacy.md
    `);

    assert.deepEqual(paths, ['docs/plans/fcp.md', 'docs/archive/plans/legacy.md']);
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
    assert.equal(SESSION_PROMPT_INVENTORY[3].file, 'cleanup-loop.md');
    assert.equal(
        SESSION_PROMPT_INVENTORY[3].description,
        'Tier 3 cleanup/refactor/remediation-only session for package-scoped planning/closeout and execution-unit orchestration',
    );
    assert.equal(SESSION_PROMPT_INVENTORY[5].file, 'feature-implement.md');
    assert.equal(
        SESSION_PROMPT_INVENTORY[5].description,
        'approved feature/design implementer session; Tier 2 default, reusable in Tier 3 when a run bundle already exists',
    );
    assert.equal(SESSION_PROMPT_INVENTORY.at(-1)?.file, 'workflow-harness-review.md');
    assert.equal(EVAL_PROMPT_INVENTORY[0].file, '01-app-container-extraction-no-ui-drift.md');
    assert.equal(EVAL_PROMPT_INVENTORY.at(-1)?.file, '23-reviewer-specialization-effectiveness.md');
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

**Plan Status:** active

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
    assert.deepEqual(result.errors, [
        'missing required plan classification field: **Task family:**',
        'verification commands section must contain substantive content',
        'required skills section must include `execution-plan-authoring` for active serious plans',
        'verification commands section must classify verification strategy with one exact plan-standard marker',
        'verification commands section must contain at least one command-looking `Run:` line',
        'verification commands section must contain at least one expected-result `Expected:` line',
    ]);
});

test('checkPlanConformance accepts the tracked section variants used by older and newer plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: `# Example Implementation Plan

**Plan Status:** active

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
    assert.deepEqual(result.errors, [
        'missing required plan classification field: **Task family:**',
        'planner self-check section must contain substantive content',
        'architecture seam decision gate section must contain substantive content',
        'verification commands section must contain substantive content',
        'files in scope section must contain at least one concrete entry',
        'files out of scope section must contain at least one concrete entry',
        'required skills section must include `execution-plan-authoring` for active serious plans',
        'verification commands section must classify verification strategy with one exact plan-standard marker',
        'verification commands section must contain at least one command-looking `Run:` line',
        'verification commands section must contain at least one expected-result `Expected:` line',
    ]);
});

test('checkPlanConformance accepts valid feature-plan classification and substantive sections', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-feature-example.md',
        content: `# Feature Example

**Plan Status:** active
**Task family:** feature/design

## Goal

Ship a narrow feature workflow improvement.

## Non-Goals

- No cleanup routing changes.

## Parent Architecture Alignment

- Keep one authority doc.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- \`search_documents\`: confirmed the workflow surfaces.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Planner Self-Check

- No hidden seam remains.

## Architecture Seam Decision Gate

- Chosen seam: scoped doc-anchor realignment only.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- Revert the scoped anchor split if feature launchers become ambiguous.

## Commit Checkpoints

- \`docs(workflow): realign feature plan references\`
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.missingSections, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.taskFamily, 'feature/design');
    assert.equal(result.cleanupSubtype, null);
});

test('checkPlanConformance requires execution-plan-authoring in active serious plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-feature-example.md',
        content: `# Feature Example

**Plan Status:** active
**Task family:** feature/design

## Goal

Ship a narrow feature workflow improvement.

## Non-Goals

- No cleanup routing changes.

## Parent Architecture Alignment

- Keep one authority doc.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`architecture-boundaries\`

## Codanna Discovery

- \`search_documents\`: confirmed the workflow surfaces.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Planner Self-Check

- No hidden seam remains.

## Architecture Seam Decision Gate

- Chosen seam: scoped doc-anchor realignment only.

## Verification Commands

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- Revert the scoped anchor split if feature launchers become ambiguous.

## Commit Checkpoints

- \`docs(workflow): realign feature plan references\`
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.missingSections, []);
    assert.ok(
        result.errors.includes(
            'required skills section must include `execution-plan-authoring` for active serious plans'
        )
    );
});

test('checkPlanConformance requires a verification classification marker in active serious plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-feature-example.md',
        content: `# Feature Example

**Plan Status:** active
**Task family:** feature/design

## Goal

Ship a narrow feature workflow improvement.

## Non-Goals

- No cleanup routing changes.

## Parent Architecture Alignment

- Keep one authority doc.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- \`search_documents\`: confirmed the workflow surfaces.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Planner Self-Check

- No hidden seam remains.

## Architecture Seam Decision Gate

- Chosen seam: scoped doc-anchor realignment only.

## Verification Commands

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- Revert the scoped anchor split if feature launchers become ambiguous.

## Commit Checkpoints

- \`docs(workflow): realign feature plan references\`
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.missingSections, []);
    assert.ok(
        result.errors.includes(
            'verification commands section must classify verification strategy with one exact plan-standard marker'
        )
    );
});

test('checkPlanConformance rejects multiple verification classification markers even when one is valid', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-feature-example.md',
        content: `# Feature Example

**Plan Status:** active
**Task family:** feature/design

## Goal

Ship a narrow feature workflow improvement.

## Non-Goals

- No cleanup routing changes.

## Parent Architecture Alignment

- Keep one authority doc.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- \`search_documents\`: confirmed the workflow surfaces.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Planner Self-Check

- No hidden seam remains.

## Architecture Seam Decision Gate

- Chosen seam: scoped doc-anchor realignment only.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`
- Verification classification: \`no new automated test needed\`
- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- Revert the scoped anchor split if feature launchers become ambiguous.

## Commit Checkpoints

- \`docs(workflow): realign feature plan references\`
`,
    });

    assert.equal(result.isSerious, true);
    assert.ok(
        result.errors.includes(
            'verification commands section must classify verification strategy with one exact plan-standard marker'
        )
    );
});

test('checkPlanConformance accepts inline Required Skills blocks for active serious plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-feature-example.md',
        content: `# Feature Example

**Plan Status:** active
**Task family:** feature/design

## Goal

Ship a narrow feature workflow improvement.

## Non-Goals

- No cleanup routing changes.

## Parent Architecture Alignment

- Keep one authority doc.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

**Required Skills:**
- \`execution-plan-authoring\`

## Codanna Discovery

- \`search_documents\`: confirmed the workflow surfaces.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Planner Self-Check

- No hidden seam remains.

## Architecture Seam Decision Gate

- Chosen seam: scoped doc-anchor realignment only.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`
- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- Revert the scoped anchor split if feature launchers become ambiguous.

## Commit Checkpoints

- \`docs(workflow): realign feature plan references\`
`,
    });

    assert.equal(result.isSerious, true);
    assert.ok(!result.missingSections.includes('required skills'));
    assert.ok(
        !result.errors.includes(
            'required skills section must include `execution-plan-authoring` for active serious plans'
        )
    );
});

test('checkPlanConformance rejects cleanup subtype on feature plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-feature-example.md',
        content: `# Feature Example

**Plan Status:** active
**Task family:** feature/design
**Cleanup subtype:** checklist-linked

## Goal

Ship a narrow feature workflow improvement.

## Non-Goals

- No cleanup routing changes.

## Parent Architecture Alignment

- Keep one authority doc.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- \`search_documents\`: confirmed the workflow surfaces.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Planner Self-Check

- No hidden seam remains.

## Architecture Seam Decision Gate

- Chosen seam: scoped doc-anchor realignment only.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- Revert the scoped anchor split if feature launchers become ambiguous.

## Commit Checkpoints

- \`docs(workflow): realign feature plan references\`
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, ['feature/design plans must not declare **Cleanup subtype:**']);
    assert.equal(result.taskFamily, 'feature/design');
    assert.equal(result.cleanupSubtype, 'checklist-linked');
});

test('checkPlanConformance treats cleanup subtype as invalid when task family is malformed', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-unknown-example.md',
        content: `# Unknown Example

**Plan Status:** active
**Task family:** migration
**Cleanup subtype:** checklist-linked

## Goal

Ship a narrow workflow improvement.

## Non-Goals

- No cleanup routing changes.

## Parent Architecture Alignment

- Keep one authority doc.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- \`search_documents\`: confirmed the workflow surfaces.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`ARCHITECTURE_CLEANUP_CHECKLIST.md\`

## Planner Self-Check

- No hidden seam remains.

## Architecture Seam Decision Gate

- Chosen seam: scoped doc-anchor realignment only.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- Revert the scoped anchor split if feature launchers become ambiguous.

## Commit Checkpoints

- \`docs(workflow): realign feature plan references\`
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, [
        'invalid task family classification: migration (expected one of: feature/design, cleanup/refactor)',
        '**Cleanup subtype:** is only valid when **Task family:** is cleanup/refactor',
    ]);
});

test('checkPlanConformance accepts numbered and starred list markers in plan sections', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** standalone remediation

## Goal

Do the cleanup.

## Non-Goals

* No runtime changes.

## Parent Architecture Alignment

* Keep the control plane small.

## Required Reading

1. \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

* \`execution-plan-authoring\`

## Codanna Discovery

* fallback: direct reads only.

## Impact Snapshot

1. \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

1. \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

* \`src/App.ts\`

## Planner Self-Check

* resolved.

## Architecture Seam Decision Gate

* explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

Run: \`npm run verify:docs\`
Expected: \`Documentation verification passed.\`

## Rollback Notes

* revert.

## Commit Checkpoints

1. \`docs: update plan rules\`
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.missingSections, []);
    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance enforces cleanup subtype, verification shape, and priority-exit readiness structure', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor

## Goal

Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

## Priority-Exit Readiness

- \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
- note: missing disposition, owner, and security gate details
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.missingSections, []);
    assert.deepEqual(result.errors, [
        'cleanup/refactor plans must declare **Cleanup subtype:**',
        'verification commands section must contain at least one command-looking `Run:` line',
        'priority-exit readiness section must record exact disposition tokens for mapped imported issues',
        'priority-exit readiness section must record a P0/security-gate disposition before the next priority advances',
        'priority-exit readiness section must name the blocking next-priority or P#-EXIT gate',
    ]);
    assert.equal(result.taskFamily, 'cleanup/refactor');
});

test('checkPlanConformance requires one final owner and revisit trigger for deferred priority-exit items', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

## Priority-Exit Readiness

- \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
  - expected disposition: split follow-up
- Security gate:
  - list the exact issue ids if any remain
- no \`P6\` work starts while \`P5-EXIT\` is unresolved

${buildSingleSlicePackageDecomposition()}
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, [
        'priority-exit readiness must assign exactly one final owner to each deferred or split imported issue',
        'priority-exit readiness must include a revisit trigger for each deferred or split imported issue',
        'priority-exit readiness section must record a P0/security-gate disposition before the next priority advances',
    ]);
});

test('checkPlanConformance accepts semantically complete priority-exit readiness sections', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

1. Run: \`npm run verify:docs\`
1. Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

## Priority-Exit Readiness

### Imported issue dispositions by exact id

- \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
  - expected disposition: split follow-up
  - residual final owner: \`P10-W1 residual mechanical detector owner\`
  - reason: one broader residual package remains outside this slice
  - revisit trigger: rerun the exact residual audit before \`P10-EXIT\`
- \`review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation\`
  - expected disposition: stale-proven
  - reason: the detector wording no longer matches current source
- \`review::.::holistic::workflow_coherence::accepted-cleanup-residue\`
  - expected disposition: accepted residue
  - reason: the remaining residue is low-value on current source
  - revisit trigger: rerun if the owner seam changes before \`P6-EXIT\`

### Security gate

- expected outcome: \`no open P0 security findings\`
- if security output still shows open issues, record the exact issue ids and their current owner before allowing \`P6\`

### Next-priority gate

- no \`P6\` plan or implementation starts while \`P5-EXIT\` is unresolved

${buildSingleSlicePackageDecomposition()}
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance rejects priority-exit dispositions that add suffix text beyond exact tokens', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

1. Run: \`npm run verify:docs\`
1. Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

## Priority-Exit Readiness

### Imported issue dispositions by exact id

- \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
  - expected disposition: split follow-up later
  - residual final owner: \`P10-W1 residual mechanical detector owner\`
  - reason: one broader residual package remains outside this slice
  - revisit trigger: rerun the exact residual audit before \`P10-EXIT\`
- \`review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation\`
  - expected disposition: stale-proven-extra
  - reason: the detector wording no longer matches current source
- \`review::.::holistic::workflow_coherence::accepted-cleanup-residue\`
  - expected disposition: accepted residue later
  - reason: the remaining residue is low-value on current source
  - revisit trigger: rerun if the owner seam changes before \`P6-EXIT\`

### Security gate

- expected outcome: \`no open P0 security findings\`
- if security output still shows open issues, record the exact issue ids and their current owner before allowing \`P6\`

### Next-priority gate

- no \`P6\` plan or implementation starts while \`P5-EXIT\` is unresolved

${buildSingleSlicePackageDecomposition()}
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, [
        'priority-exit readiness section must record exact disposition tokens for mapped imported issues',
    ]);
});

test('checkPlanConformance accepts priority-exit readiness sections with tab-indented nested bullets', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

## Priority-Exit Readiness

- \`review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes\`
\t- expected disposition: split follow-up
\t- final owner: \`P6-W1\`
\t- revisit trigger: rerun \`npm run verify:docs\`
- Security gate:
\t- none open
- no \`P6\` work starts while \`P5-EXIT\` is unresolved

${buildSingleSlicePackageDecomposition()}
`,
    });

    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance accepts approved priority-exit wording variants and plain issue ids', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

## Priority-Exit Readiness

1. review::.::holistic::api_surface_coherence::plex_fetch_helper_shape_drift
   - expected disposition at P6-EXIT: resolved by P6-W1
2. smells::src/modules/plex/library/PlexLibrary.ts::hardcoded_url
   - planned disposition: owned follow-up
   - owned follow-up: P10-W1 residual mechanical detector owner
   - revisit trigger: rerun the residual audit before P10-EXIT

* security triage: none open, or list the exact open/deferred P0 security issue ids
* priority-exit review blocks P7 while P6-EXIT is unresolved

${buildSingleSlicePackageDecomposition()}
`,
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance accepts FCP checklist-linked plans with source_finding_ids', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(buildFcpSingleSlicePackageDecomposition()),
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance accepts PQR checklist-linked plans with source_finding_ids', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-05-17-pqr-1-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition()
                .replaceAll('FCP-1-SF1', 'PQR-1-SF1')
                .replaceAll('FCP-1-S1', 'PQR-1-S1')
                .replace('`checklist_token`: `FCP-1`', '`checklist_token`: `PQR-1`')
        ),
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance accepts PQR-EXIT checklist-linked plans with source_finding_ids', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-05-17-pqr-exit-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition()
                .replaceAll('FCP-1-SF1', 'PQR-EXIT-SF1')
                .replaceAll('FCP-1-S1', 'PQR-EXIT-S1')
                .replace('`checklist_token`: `FCP-1`', '`checklist_token`: `PQR-EXIT`')
        ),
    });

    assert.equal(result.isSerious, true);
    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance accepts legacy non-FCP checklist tokens such as S9-W1', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-19-s9-inline-style-bootstrap-cleanup.md',
        content: buildActiveCleanupPlan(
            buildSingleSlicePackageDecomposition({ readyNowSlice: 'S9-W1-S1' })
                .replace('`checklist_token`: `P6-W1`', '`checklist_token`: `S9-W1`')
                .replaceAll('P6-W1-S1', 'S9-W1-S1')
        ),
    });

    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance accepts DCR checklist-linked package slice ids', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md',
        content: buildActiveCleanupPlan(
            buildSingleSlicePackageDecomposition({ readyNowSlice: 'DCR-10-S1' })
                .replace('`package_id`: `pkg_example_cleanup`', '`package_id`: `DCR-10`')
                .replace('`checklist_token`: `P6-W1`', '`checklist_token`: `DCR-10`')
                .replaceAll(
                    'review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes',
                    'DCR-10-A1'
                )
        ),
    });

    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance accepts DCR wave-scoped execution_waves slice ids', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md',
        content: buildActiveCleanupPlan(
            buildWaveScopedPackageDecomposition()
                .replace('`package_id`: `pkg_example_cleanup`', '`package_id`: `DCR-10`')
                .replace('`checklist_token`: `P6-W1`', '`checklist_token`: `DCR-10`')
                .replaceAll('P6-W1-S1', 'DCR-10-S1')
                .replaceAll('P6-W1-S2', 'DCR-10-S2')
        ),
    });

    assert.strictEqual(result.isSerious, true);
    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance rejects legacy issue fields in FCP checklist-linked plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition()
                .replace('- `source_finding_ids`:\n  - `FCP-1-SF1`', '- `package_issue_ids`:\n  - `review::.::holistic::design_coherence::old_issue`')
                .replace('- `source_finding_ids`:\n  - `FCP-1-SF1`', '- `exact_issue_ids`:\n  - `review::.::holistic::design_coherence::old_issue`')
        ),
    });

    assert.ok(result.errors.includes('source-backed checklist plans must use `source_finding_ids`, not `package_issue_ids`'));
    assert.ok(result.errors.includes('source-backed checklist plans must use `source_finding_ids`, not `exact_issue_ids`'));
    assert.ok(result.errors.includes('checklist-linked plans must include `source_finding_ids` in `## Package Decomposition`'));
    assert.ok(result.errors.includes('FCP-1-S1 in `slice_table` must include `source_finding_ids`'));
});

test('checkPlanConformance rejects imported ids in FCP coverage_check text', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition().replace(
                'every approved source finding is mapped to one slice-owned execution path',
                'review::.::holistic::design_coherence::old_issue is mapped to one slice-owned execution path'
            )
        ),
    });

    assert.ok(result.errors.includes('source-backed checklist plans must not include detector/imported issue ids, package-map evidence, or Desloppify evidence in `## Package Decomposition`'));
});

test('checkPlanConformance rejects Desloppify commands in FCP package decomposition', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition().replace(
                'every approved source finding is mapped to one slice-owned execution path',
                'desloppify status maps every approved source finding to one slice-owned execution path'
            )
        ),
    });

    assert.ok(result.errors.includes('source-backed checklist plans must not include detector/imported issue ids, package-map evidence, or Desloppify evidence in `## Package Decomposition`'));
});

test('checkPlanConformance rejects package-map evidence in FCP package decomposition', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition().replace(
                'every approved source finding is mapped to one slice-owned execution path',
                'package-map evidence maps every approved source finding to one slice-owned execution path'
            )
        ),
    });

    assert.ok(result.errors.includes('source-backed checklist plans must not include detector/imported issue ids, package-map evidence, or Desloppify evidence in `## Package Decomposition`'));
});

test('checkPlanConformance rejects detector-shaped source_finding_ids in FCP plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition()
                .replaceAll('FCP-1-SF1', 'review::.::holistic::design_coherence::old_issue')
        ),
    });

    assert.ok(result.errors.includes('source-backed checklist plans must use source_finding_ids matching `FCP-1-SF#`'));
    assert.ok(result.errors.includes('FCP-1-S1 in `slice_table` must use source_finding_ids matching `FCP-1-SF#`'));
});

test('checkPlanConformance rejects source_finding_ids from a different FCP checklist token', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition()
                .replaceAll('FCP-1-SF1', 'FCP-2-SF1')
        ),
    });

    assert.ok(result.errors.includes('source-backed checklist plans must use source_finding_ids matching `FCP-1-SF#`'));
    assert.ok(result.errors.includes('FCP-1-S1 in `slice_table` must use source_finding_ids matching `FCP-1-SF#`'));
});

test('checkPlanConformance accepts FCP priority-exit readiness with source findings and FCP gate', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition(),
            `
## Priority-Exit Readiness

- \`FCP-1-SF1\`
  - disposition: resolved
  - final owner: \`FCP-1\`
  - revisit trigger: rerun the source audit if the owner seam changes
- security triage: no open P0 security findings
- priority-exit review blocks FCP-(n+1) until FCP-n is completed
`
        ),
    });

    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance accepts PQR priority-exit readiness with source findings and PQR gate', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-05-17-pqr-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition()
                .replaceAll('FCP-1-SF1', 'PQR-1-SF1')
                .replaceAll('FCP-1-S1', 'PQR-1-S1')
                .replace('`checklist_token`: `FCP-1`', '`checklist_token`: `PQR-1`'),
            `
## Priority-Exit Readiness

- \`PQR-1-SF1\`
  - disposition: resolved
  - final owner: \`PQR-1\`
  - revisit trigger: rerun the source audit if the owner seam changes
- security triage: no open P0 security findings
- priority-exit review blocks PQR-(n+1) until PQR-n is completed
`
        ),
    });

    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance uses source-backed wording for empty PQR priority-exit readiness', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-05-17-pqr-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition()
                .replaceAll('FCP-1-SF1', 'PQR-1-SF1')
                .replaceAll('FCP-1-S1', 'PQR-1-S1')
                .replace('`checklist_token`: `FCP-1`', '`checklist_token`: `PQR-1`'),
            `
## Priority-Exit Readiness

- security triage: no open P0 security findings
- priority-exit review blocks PQR-(n+1) until PQR-n is completed
`
        ),
    });

    assert.ok(result.errors.includes(
        'priority-exit readiness section must name each mapped source finding id (FCP-* or PQR-*)'
    ));
    assert.ok(!result.errors.some((error) => error.includes('mapped FCP source_finding_id')));
});

test('checkPlanConformance rejects imported issue ids in FCP priority-exit readiness', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition(),
            `
## Priority-Exit Readiness

- \`review::.::holistic::design_coherence::old_issue\`
  - disposition: resolved
  - final owner: \`FCP-1\`
  - revisit trigger: rerun the source audit if the owner seam changes
- security triage: no open P0 security findings
- priority-exit review blocks FCP-(n+1) until FCP-n is completed
`
        ),
    });

    assert.ok(result.errors.includes('source-backed priority-exit readiness must use declared source_finding_id headers, not imported issue ids'));
});

test('checkPlanConformance rejects imported ids in nested FCP priority-exit proof text', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition(),
            `
## Priority-Exit Readiness

- \`FCP-1-SF1\`
  - disposition: resolved
  - final owner: \`FCP-1\`
  - proof: source audit independently resolved review::.::holistic::design_coherence::old_issue
  - revisit trigger: rerun the source audit if the owner seam changes
- security triage: no open P0 security findings
- priority-exit review blocks FCP-(n+1) until FCP-n is completed
`
        ),
    });

    assert.ok(result.errors.includes('source-backed priority-exit readiness must not include detector/imported issue ids, package-map evidence, or Desloppify evidence'));
});

test('checkPlanConformance rejects Desloppify paths in nested FCP priority-exit proof text', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition(),
            `
## Priority-Exit Readiness

- \`FCP-1-SF1\`
  - disposition: resolved
  - final owner: \`FCP-1\`
  - proof: source audit compared against .desloppify/state-typescript.json
  - revisit trigger: rerun the source audit if the owner seam changes
- security triage: no open P0 security findings
- priority-exit review blocks FCP-(n+1) until FCP-n is completed
`
        ),
    });

    assert.ok(result.errors.includes('source-backed priority-exit readiness must not include detector/imported issue ids, package-map evidence, or Desloppify evidence'));
});

test('checkPlanConformance rejects package-map proof in FCP priority-exit readiness', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition(),
            `
## Priority-Exit Readiness

- \`FCP-1-SF1\`
  - disposition: resolved
  - final owner: \`FCP-1\`
  - proof: source audit compared against package map reconciliation
  - revisit trigger: rerun the source audit if the owner seam changes
- security triage: no open P0 security findings
- priority-exit review blocks FCP-(n+1) until FCP-n is completed
`
        ),
    });

    assert.ok(result.errors.includes('source-backed priority-exit readiness must not include detector/imported issue ids, package-map evidence, or Desloppify evidence'));
});

test('checkPlanConformance rejects undeclared FCP source_finding_id closeout headers', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-28-fcp-example.md',
        content: buildActiveCleanupPlan(
            buildFcpSingleSlicePackageDecomposition(),
            `
## Priority-Exit Readiness

- \`FCP-1-SF2\`
  - disposition: resolved
  - final owner: \`FCP-1\`
  - revisit trigger: rerun the source audit if the owner seam changes
- security triage: no open P0 security findings
- priority-exit review blocks FCP-(n+1) until FCP-n is completed
`
        ),
    });

    assert.ok(result.errors.includes('source-backed priority-exit readiness must use declared source_finding_id headers, not imported issue ids'));
});

test('checkPlanConformance requires ready_now_execution_unit for checklist-linked package plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildSingleSlicePackageDecomposition({ readyNowExecutionUnit: '' }).replace(
    "- `ready_now_execution_unit`: ``\n",
    ''
)}
`,
    });

    assert.deepEqual(result.errors, [
        'checklist-linked plans must include `ready_now_execution_unit` in `## Package Decomposition`',
    ]);
});

test('checkPlanConformance requires ready_now scalar fields to stay inline', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildSingleSlicePackageDecomposition()
    .replace('- `ready_now_slice`: `P6-W1-S1`', '- `ready_now_slice`:')
    .replace('- `ready_now_execution_unit`: `P6-W1-S1`', '- `ready_now_execution_unit`:')}
`,
    });

    assert.deepEqual(result.errors, [
        '`ready_now_slice` must be an inline scalar value in `## Package Decomposition`',
        '`ready_now_execution_unit` must be an inline scalar value in `## Package Decomposition`',
    ]);
});

test('checkPlanConformance allows blocked active plans to expose no ready-now execution unit', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: buildActiveCleanupPlan(
            buildWaveScopedPackageDecomposition()
                .replace('- `ready_now_slice`: `P6-W1-S1`', '- `ready_now_slice`: `none`')
                .replace('- `ready_now_execution_unit`: `W1`', '- `ready_now_execution_unit`: `none`') +
                [
                    '- `ready_now_state`: blocked; no execution unit is approved.',
                    '- `blocked_until`: the prerequisite package closes.',
                    '- `next_action`: launch the prerequisite package.',
                ].join('\n')
        ),
    });

    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance rejects blocked active plans with mixed ready-now none pointers', () => {
    const blockedReadyNowMarkers = [
        '- `ready_now_state`: blocked; no execution unit is approved.',
        '- `blocked_until`: the prerequisite package closes.',
        '- `next_action`: launch the prerequisite package.',
    ].join('\n');
    const mixedPointerPackages = [
        buildWaveScopedPackageDecomposition()
            .replace('- `ready_now_slice`: `P6-W1-S1`', '- `ready_now_slice`: `none`'),
        buildWaveScopedPackageDecomposition()
            .replace('- `ready_now_execution_unit`: `W1`', '- `ready_now_execution_unit`: `none`'),
        buildSingleSlicePackageDecomposition()
            .replace('- `ready_now_slice`: `P6-W1-S1`', '- `ready_now_slice`: `none`'),
        buildSingleSlicePackageDecomposition()
            .replace('- `ready_now_execution_unit`: `P6-W1-S1`', '- `ready_now_execution_unit`: `none`'),
    ];

    for (const packageDecomposition of mixedPointerPackages) {
        const result = checkPlanConformance({
            filePath: 'docs/plans/2026-04-14-cleanup-example.md',
            content: buildActiveCleanupPlan(`${packageDecomposition}\n${blockedReadyNowMarkers}`),
        });

        assert.deepEqual(result.errors, [
            'blocked ready-now plans must set both `ready_now_slice` and `ready_now_execution_unit` to `none`',
        ]);
    }
});

test('checkPlanConformance rejects none ready-now fields without blocked state', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: buildActiveCleanupPlan(
            buildSingleSlicePackageDecomposition()
                .replace('- `ready_now_slice`: `P6-W1-S1`', '- `ready_now_slice`: `none`')
                .replace('- `ready_now_execution_unit`: `P6-W1-S1`', '- `ready_now_execution_unit`: `none`')
        ),
    });

    assert.deepEqual(result.errors, [
        '`ready_now_slice` may be `none` only when `ready_now_state` is blocked and `blocked_until` is set',
        '`ready_now_execution_unit` may be `none` only when `ready_now_state` is blocked and `blocked_until` is set',
    ]);
});

test('checkPlanConformance requires wave scaffolding when ready_now_execution_unit does not point at ready_now_slice', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildSingleSlicePackageDecomposition({
    readyNowSlice: 'P6-W1-S1',
    readyNowExecutionUnit: 'W1',
})}
`,
    });

    assert.deepEqual(result.errors, [
        'checklist-linked plans without `execution_waves` must point `ready_now_execution_unit` at the same slice as `ready_now_slice`',
    ]);
});

test('checkPlanConformance requires coverage_ledger and per-wave markers for wave-scoped checklist-linked plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildWaveScopedPackageDecomposition()
    .replace(/- `coverage_ledger`:[\s\S]*?- `execution_waves`:/u, '- `execution_waves`:')
    .replace('- `absorb_now_scope`:', '- `wave_scope`:')}
`,
    });

    assert.deepEqual(result.errors, [
        'each `execution_waves` entry must record `absorb_now_scope` and `replan_triggers`',
        'wave-scoped checklist-linked plans must include `coverage_ledger` in `## Package Decomposition`',
    ]);
});

test('checkPlanConformance requires slice_table rows to keep execution-ready fields', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildSingleSlicePackageDecomposition().replace(
    "- `verification`:\n  - `npm run verify:docs`\n",
    ''
)}
`,
    });

    assert.deepEqual(result.errors, [
        'P6-W1-S1 in `slice_table` must include `verification`',
    ]);
});

test('checkPlanConformance requires ready_now_slice to reference a declared slice_table slice', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildSingleSlicePackageDecomposition().replace(
    '- `ready_now_slice`: `P6-W1-S1`',
    '- `ready_now_slice`: `P6-W1-S9`'
).replace(
    '- `ready_now_execution_unit`: `P6-W1-S1`',
    '- `ready_now_execution_unit`: `P6-W1-S9`'
)}
`,
    });

    assert.deepEqual(result.errors, [
        '`ready_now_slice` must reference a declared `slice_table` slice',
    ]);
});

test('checkPlanConformance requires execution_waves slice_ids to reference declared slice_table slices', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildWaveScopedPackageDecomposition().replace(
    ['  - `slice_ids`:', '    - `P6-W1-S1`', '    - `P6-W1-S2`'].join('\n'),
    ['  - `slice_ids`:', '    - `P6-W1-S1`', '    - `P6-W1-S9`'].join('\n')
)}
`,
    });

    assert.deepEqual(result.errors, [
        '`execution_waves` slice_ids must reference declared `slice_table` slices',
    ]);
});

test('checkPlanConformance rejects slice_table rows that declare both serial_only and parallel_group', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildSingleSlicePackageDecomposition().replace(
    '- `parallel_justification`: keep the execution unit serial',
    ['- `parallel_group`: `wave-a`', '- `parallel_justification`: keep the execution unit serial'].join('\n')
)}
`,
    });

    assert.deepEqual(result.errors, [
        'P6-W1-S1 in `slice_table` cannot include both `serial_only` and `parallel_group`',
    ]);
});

test('checkPlanConformance requires wave-scoped ready_now_execution_unit to match a declared wave_id', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildWaveScopedPackageDecomposition().replace(
    '- `ready_now_execution_unit`: `W1`',
    '- `ready_now_execution_unit`: `W2`'
)}
`,
    });

    assert.deepEqual(result.errors, [
        '`ready_now_execution_unit` must match one declared `wave_id` when `execution_waves` are present',
    ]);
});

test('checkPlanConformance validates each execution_waves entry individually', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildWaveScopedPackageDecomposition().replace(
    '  - `replan_triggers`:\n    - new owner\n    - changed execution-unit membership\n',
    '  - `wave_id`: `W2`\n  - `slice_ids`:\n    - `P6-W1-S2`\n  - `completion_condition`: second wave completes\n  - `absorb_now_scope`: stay inside second-wave scope\n'
)}
`,
    });

    assert.deepEqual(result.errors, [
        'each `execution_waves` entry must record `absorb_now_scope` and `replan_triggers`',
    ]);
});

test('checkPlanConformance accepts starred execution_waves entries', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildWaveScopedPackageDecomposition()
    .replace(/^\s+- `wave_id`:/mu, '  * `wave_id`:')
    .replace(/^\s+- `slice_ids`:/mu, '  * `slice_ids`:')
    .replace(/^\s+- `completion_condition`:/mu, '  * `completion_condition`:')
    .replace(/^\s+- `absorb_now_scope`:/mu, '  * `absorb_now_scope`:')
    .replace(/^\s+- `replan_triggers`:/mu, '  * `replan_triggers`:')}
`,
    });

    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance requires ready_now_slice to match the first slice in the selected wave', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildWaveScopedPackageDecomposition().replace(
    '- `ready_now_slice`: `P6-W1-S1`',
    '- `ready_now_slice`: `P6-W1-S2`'
)}
`,
    });

    assert.deepEqual(result.errors, [
        '`ready_now_slice` must match the first declared `slice_id` in the selected `ready_now_execution_unit` wave',
    ]);
});

test('checkPlanConformance accepts wave-scoped checklist-linked package plans with execution-unit coverage', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildWaveScopedPackageDecomposition()}
`,
    });

    assert.deepEqual(result.errors, []);
});

test('checkPlanConformance enforces ready_now_slice ordering when execution_waves uses inline slice_ids', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-04-14-cleanup-example.md',
        content: `# Cleanup Example

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

- Do the cleanup.

## Non-Goals

- No runtime changes.

## Parent Architecture Alignment

- Keep the control plane small.

## Required Reading

- \`docs/AGENTIC_DEV_WORKFLOW.md\`

## Required Skills

- \`execution-plan-authoring\`

## Codanna Discovery

- fallback: direct reads only.

## Impact Snapshot

- \`docs/agentic/plan-authoring-standard.md\`

## Files In Scope

- \`docs/agentic/plan-authoring-standard.md\`

## Files Out Of Scope

- \`src/App.ts\`

## Planner Self-Check

- resolved.

## Architecture Seam Decision Gate

- explicit.

## Verification Commands

- Verification classification: \`existing coverage sufficient\`

- Run: \`npm run verify:docs\`
- Expected: \`Documentation verification passed.\`

## Rollback Notes

- revert.

## Commit Checkpoints

- \`docs: update plan rules\`

${buildWaveScopedPackageDecomposition()
    .replace(
        ['  - `slice_ids`:', '    - `P6-W1-S1`', '    - `P6-W1-S2`'].join('\n'),
        '  - `slice_ids`: `P6-W1-S1`, `P6-W1-S2`'
    )
    .replace('- `ready_now_slice`: `P6-W1-S1`', '- `ready_now_slice`: `P6-W1-S2`')}
`,
    });

    assert.deepEqual(result.errors, [
        '`ready_now_slice` must match the first declared `slice_id` in the selected `ready_now_execution_unit` wave',
    ]);
});

test('checkPlanConformance skips non-plan artifacts such as risk registers', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-03-04-epg-performance-risk-register.md',
        content: '# EPG Performance Risk Register',
    });

    assert.equal(result.isSerious, false);
    assert.deepEqual(result.missingSections, []);
});

test('checkPlanConformance skips unmarked tracked plans and archive readmes', () => {
    const unmarkedPlan = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: '# Example Implementation Plan\n\n**Goal:** Do the thing.\n',
    });

    assert.equal(unmarkedPlan.isSerious, false);
    assert.deepEqual(unmarkedPlan.missingSections, []);

    const result = checkPlanConformance({
        filePath: 'docs/archive/plans/README.md',
        content: '# Archived Plans',
    });

    assert.equal(result.isSerious, false);
    assert.deepEqual(result.missingSections, []);
});

test('checkPlanConformance only accepts the exact active marker before the first section heading', () => {
    const blockQuotedMarker = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: [
            '# Example Implementation Plan',
            '',
            `> ${ACTIVE_PLAN_MARKER}`,
            '',
            '**Goal:** Do the thing.',
            '',
        ].join('\n'),
    });

    assert.equal(blockQuotedMarker.isSerious, false);
    assert.deepEqual(blockQuotedMarker.missingSections, []);

    const postSectionMarker = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: [
            '# Example Implementation Plan',
            '',
            '## Non-Goals',
            '',
            ACTIVE_PLAN_MARKER,
            '',
            '**Goal:** Do the thing.',
            '',
        ].join('\n'),
    });

    assert.equal(postSectionMarker.isSerious, false);
    assert.deepEqual(postSectionMarker.missingSections, []);

    const fencedMarker = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: [
            '# Example Implementation Plan',
            '',
            '```md',
            ACTIVE_PLAN_MARKER,
            '```',
            '',
            '**Goal:** Do the thing.',
            '',
        ].join('\n'),
    });

    assert.equal(fencedMarker.isSerious, false);
    assert.deepEqual(fencedMarker.missingSections, []);

    const tildeFencedMarker = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: [
            '# Example Implementation Plan',
            '',
            '~~~md',
            ACTIVE_PLAN_MARKER,
            '~~~',
            '',
            '**Goal:** Do the thing.',
            '',
        ].join('\n'),
    });

    assert.equal(tildeFencedMarker.isSerious, false);
    assert.deepEqual(tildeFencedMarker.missingSections, []);

    const indentedMarker = checkPlanConformance({
        filePath: 'docs/plans/2026-03-06-example-implementation.md',
        content: [
            '# Example Implementation Plan',
            '',
            `    ${ACTIVE_PLAN_MARKER}`,
            '',
            '**Goal:** Do the thing.',
            '',
        ].join('\n'),
    });

    assert.equal(indentedMarker.isSerious, false);
    assert.deepEqual(indentedMarker.missingSections, []);
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
