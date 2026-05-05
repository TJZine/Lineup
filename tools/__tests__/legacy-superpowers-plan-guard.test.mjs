import test from 'node:test';
import assert from 'node:assert/strict';

import { checkPlanConformance } from '../harness-docs-lib.mjs';

test('checkPlanConformance rejects legacy Superpowers skills in active serious plans', () => {
    const result = checkPlanConformance({
        filePath: 'docs/plans/2026-05-05-feature-example.md',
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
- \`superpowers:test-driven-development\`

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
    assert.ok(
        result.errors.includes(
            'required skills section must not include legacy Superpowers workflow skills for active serious plans'
        )
    );
});
