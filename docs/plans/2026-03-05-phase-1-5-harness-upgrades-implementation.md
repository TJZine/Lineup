# Phase 1.5 Harness Upgrades Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the next high-value harness upgrades for Lineup: a standardized 4-file major-task run bundle, a plan-authoring standard with Codanna impact gates, a 12-prompt eval starter set with scoring artifacts, and a recurring doc-gardening checklist.

**Architecture:** Keep the existing control plane small. Do not add another general workflow doc. Extend the current control plane with one reusable run-bundle location (`docs/runs/`), one explicit plan-authoring standard, one concrete eval harness directory under `docs/agentic/evals/`, and one recurring doc-gardening checklist. Preserve Codanna as the default discovery/intelligence layer and make its usage more mechanical inside plans and evals.

**Tech Stack:** Markdown documentation, existing Codanna MCP workflow, existing `npm run verify:docs` documentation check, repo-local skills, Antigravity skill mirrors.

---

## Execution Rules

This plan is intentionally zero-decision-point. Execute it exactly as written unless a file/path in this repo has changed since the plan was written.

If a file/path has changed:

1. Stop.
2. Update the plan first.
3. Then continue.

Do not introduce extra workflow docs outside the file list below.

## Fresh-Session Bootstrap

Assume the session starts with no context.

### Required reading order before any edits

1. `agents.md`
2. `docs/agentic/document-map.md`
3. `docs/AGENTIC_DEV_WORKFLOW.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/agentic/skill-strategy.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
8. `docs/agentic/evals-roadmap.md`
9. `docs/agentic/phase-2-steady-state-plan.md`
10. `docs/development/testing.md`

### Required shell checks before any edits

Run:

```bash
git status --short
npm run verify:docs
find .codex/skills .agent/skills -maxdepth 2 -name SKILL.md | sort
```

Expected:

- `git status --short` shows either a clean worktree or only the changes intentionally being worked on.
- `npm run verify:docs` prints `Documentation verification passed.`
- `.codex/skills/` contains only Lineup-specific skills.
- `.agent/skills/` contains the mirrored Lineup-specific skills plus the curated global mirror set.

If any expected result is false, stop and fix that first.

### Preflight rule for existing doc failures

If `npm run verify:docs` fails before Task 1 starts:

1. Treat that as a preflight remediation task.
2. Fix the reported documentation issue(s) first.
3. Commit that fix separately.
4. Re-run `npm run verify:docs`.
5. Only continue once it passes.

Do not continue into Task 1 with a failing docs baseline.

## Locked Decisions

These are not open for debate during implementation:

- Use a 4-file long-horizon run bundle only for major structural or multi-session work.
- Put those bundles under `docs/runs/`.
- Add one plan-authoring standard doc instead of modifying global Superpowers skills.
- Build exactly 12 starter eval prompts.
- Source those prompts from a mixed pool:
  - current cleanup backlog items
  - real current-state hotspots
  - existing repo docs/plans when present
  - adversarial trap prompts that test shortcut resistance
- Keep Codanna mandatory for discovery on eval-worthy tasks.
- Keep the current control-plane docs authoritative; do not create parallel policy docs.

## Non-Goals

- Do not add a repo-local `CODEX.md`.
- Do not add new generic skills.
- Do not add Slack or external workflow tooling.
- Do not automate the full eval harness yet.
- Do not add directory-local override docs yet.

## Desired End State

At the end of this plan:

- major structural work has a documented 4-file bundle standard
- serious implementation plans have a mandatory Codanna/impact/docs/verification structure
- the repo has a concrete 12-prompt eval starter set with scoring templates
- the eval set is grounded in real Lineup cleanup risk, not toy examples
- doc drift is managed through a recurring checklist plus existing `verify:docs`
- the control plane remains small and documented

---

### Task 1: Add the major-task run bundle standard

**Files:**
- Create: `docs/runs/README.md`
- Create: `docs/runs/_template/Prompt.md`
- Create: `docs/runs/_template/Plan.md`
- Create: `docs/runs/_template/Implement.md`
- Create: `docs/runs/_template/Documentation.md`
- Modify: `docs/agentic/document-map.md`
- Modify: `docs/AGENTIC_DEV_WORKFLOW.md`
- Modify: `tools/verify-docs.mjs`

**Step 1: Create the run-bundle root guide**

Write `docs/runs/README.md` with these sections and no extras:

- `# Long-Horizon Run Bundles`
- `When to use`
- `When not to use`
- `Required file set`
- `Run bundle lifecycle`
- `Relationship to docs/plans/*`

Required guidance:

- Use for architecture-affecting, multi-milestone, or multi-session work.
- Do not use for routine one-session fixes.
- `Prompt.md` freezes scope.
- `Plan.md` holds milestones and validations.
- `Implement.md` is the execution runbook.
- `Documentation.md` is the live status/audit log.

**Step 2: Create `docs/runs/_template/Prompt.md`**

Use this exact section order:

```md
# <Task Name> Prompt

## Goal

## Non-Goals

## Constraints

## Required Reading

## Required Skills

## Done When

## Risks To Avoid
```

Required content notes:

- `Required Reading` must include the control-plane docs plus task-specific docs.
- `Required Skills` must list process skill(s) first, then repo-local boundary skills.
- `Done When` must be concrete and testable.

**Step 3: Create `docs/runs/_template/Plan.md`**

Use this exact section order:

```md
# <Task Name> Plan

## Milestones

## Codanna Discovery

## Impact Snapshot

## Files To Touch

## Verification

## Rollback

## Commit Checkpoints
```

Required content notes:

- `Codanna Discovery` must record queries, symbol IDs, and relevant document hits.
- `Impact Snapshot` must summarize `analyze_impact` for risky/shared symbols.
- `Verification` must include exact commands and expected results.

**Step 4: Create `docs/runs/_template/Implement.md`**

Use this exact section order:

```md
# <Task Name> Implement

## Operating Rules

## Milestone Execution Order

## Stop-And-Fix Conditions

## Verification Discipline

## Documentation Update Rules
```

Required content notes:

- `Stop-And-Fix Conditions` must explicitly forbid moving to the next milestone with failing verification.
- `Documentation Update Rules` must require updating `Documentation.md` after each milestone.

**Step 5: Create `docs/runs/_template/Documentation.md`**

Use this exact section order:

```md
# <Task Name> Documentation

## Current Status

## Completed Milestones

## Decisions Made

## Verification Log

## Open Risks / Follow-Ups
```

Required content notes:

- `Verification Log` entries must include command, date, and observed result.
- `Decisions Made` must be short and dated.

**Step 6: Wire the new run-bundle standard into the control plane**

Update `docs/agentic/document-map.md` so `docs/runs/` is explicitly classified as a long-horizon task-memory surface separate from `docs/plans/*`.

Update `docs/AGENTIC_DEV_WORKFLOW.md` to say:

- routine multi-step work uses `docs/plans/*`
- major structural/multi-session work uses `docs/runs/<date>-<topic>/`

**Step 7: Extend the doc verifier to cover `docs/runs/`**

Modify `tools/verify-docs.mjs` so the markdown roots include `docs/runs`.

Run:

```bash
npm run verify:docs
```

Expected:

```text
Documentation verification passed.
```

**Step 8: Commit**

```bash
git add docs/runs docs/agentic/document-map.md docs/AGENTIC_DEV_WORKFLOW.md tools/verify-docs.mjs
git commit -m "docs: add long-horizon run bundle standard"
```

---

### Task 2: Add the plan-authoring standard for fresh-session work

**Files:**
- Create: `docs/agentic/plan-authoring-standard.md`
- Modify: `agents.md`
- Modify: `docs/AGENTIC_DEV_WORKFLOW.md`
- Modify: `docs/agentic/document-map.md`
- Modify: `tools/verify-docs.mjs`

**Step 1: Create the standard**

Write `docs/agentic/plan-authoring-standard.md` with these exact sections:

```md
# Plan Authoring Standard

## When This Applies

## Required Sections

## Codanna Requirements

## Verification Requirements

## Rollback Requirements

## Fresh-Session Requirements

## Anti-Patterns
```

`Required Sections` must explicitly require:

- Goal
- Non-Goals
- Reading order
- Required skills
- Codanna discovery
- Impact snapshot
- Files to touch
- Verification commands
- Rollback commands
- Commit checkpoints

`Codanna Requirements` must explicitly require:

- `semantic_search_with_context`
- `search_documents` when repo docs are relevant
- `analyze_impact` before risky/shared edits

**Step 2: Add the standard to stable policy and workflow**

Update `agents.md` so serious plans are required to follow `docs/agentic/plan-authoring-standard.md`.

Update `docs/AGENTIC_DEV_WORKFLOW.md` so plan-authoring references this doc instead of relying on memory or implied style.

Update `docs/agentic/document-map.md` to classify this as a standards/reference doc, not a policy doc.

**Step 3: Verify**

Modify `tools/verify-docs.mjs` so `docs/agentic/plan-authoring-standard.md` is treated as a required control-plane/standards file.

Then run:

```bash
npm run verify:docs
rg -n "plan-authoring-standard" agents.md docs
```

Expected:

- docs verification passes
- `rg` shows references from the control-plane docs

**Step 4: Commit**

```bash
git add docs/agentic/plan-authoring-standard.md agents.md docs/AGENTIC_DEV_WORKFLOW.md docs/agentic/document-map.md
git commit -m "docs: add plan authoring standard"
```

---

### Task 3: Create the eval harness structure and scoring artifacts

**Files:**
- Create: `docs/agentic/evals/README.md`
- Create: `docs/agentic/evals/rubric.md`
- Create: `docs/agentic/evals/scorecard-template.md`
- Create: `docs/agentic/evals/baselines/README.md`
- Modify: `docs/agentic/evals-roadmap.md`
- Modify: `docs/development/testing.md`
- Modify: `docs/agentic/document-map.md`
- Modify: `tools/verify-docs.mjs`

**Step 1: Create the eval harness root**

Write `docs/agentic/evals/README.md` with these sections:

- `# Agent Evals`
- `Purpose`
- `Directory layout`
- `How to run a manual eval`
- `Scoring model`
- `When to update prompts`

`Directory layout` must describe:

- `prompts/`
- `baselines/`
- `rubric.md`
- `scorecard-template.md`

**Step 2: Create the scoring rubric**

Write `docs/agentic/evals/rubric.md` with these exact scored dimensions:

- Discovery quality
- Codanna usage quality
- Boundary/skill selection
- Verification selection
- Slop resistance
- Documentation/update discipline

Use three outcomes only:

- `pass`
- `soft-fail`
- `fail`

**Step 3: Create the scorecard template**

Write `docs/agentic/evals/scorecard-template.md` with these exact sections:

```md
# Eval Run Scorecard

## Prompt ID

## Date

## Agent / Surface

## Outcome

## Dimension Scores

## Evidence

## Failure Notes

## Follow-Up
```

**Step 4: Create the baselines guide**

Write `docs/agentic/evals/baselines/README.md` to explain that baseline run reports are historical records, not policy.

**Step 5: Wire the eval harness into existing docs**

Update:

- `docs/agentic/evals-roadmap.md` to point at the new `docs/agentic/evals/` directory
- `docs/development/testing.md` to mention manual agent-workflow evals as a separate concern from unit/integration testing
- `docs/agentic/document-map.md` to classify the eval directory as an evaluation surface

**Step 6: Extend the doc verifier**

Modify `tools/verify-docs.mjs` so the markdown roots include `docs/agentic/evals`.

**Step 7: Verify**

Run:

```bash
npm run verify:docs
find docs/agentic/evals -maxdepth 2 -type f | sort
```

Expected:

- docs verification passes
- the four expected eval harness files exist before prompt creation begins

**Step 8: Commit**

```bash
git add docs/agentic/evals docs/agentic/evals-roadmap.md docs/development/testing.md docs/agentic/document-map.md tools/verify-docs.mjs
git commit -m "docs: add eval harness structure"
```

---

### Task 4: Author the 12-prompt starter set from real Lineup work

**Files:**
- Create: `docs/agentic/evals/prompts/01-orchestrator-hotspot-extraction.md`
- Create: `docs/agentic/evals/prompts/02-app-shell-responsibility-split.md`
- Create: `docs/agentic/evals/prompts/03-settings-storage-boundary.md`
- Create: `docs/agentic/evals/prompts/04-server-selection-storage-boundary.md`
- Create: `docs/agentic/evals/prompts/05-channel-persistence-boundary.md`
- Create: `docs/agentic/evals/prompts/06-settings-screen-split.md`
- Create: `docs/agentic/evals/prompts/07-epg-bounded-extraction.md`
- Create: `docs/agentic/evals/prompts/08-channel-setup-orchestration-split.md`
- Create: `docs/agentic/evals/prompts/09-plex-subtitle-policy.md`
- Create: `docs/agentic/evals/prompts/10-plex-url-token-boundary.md`
- Create: `docs/agentic/evals/prompts/11-architecture-doc-refresh.md`
- Create: `docs/agentic/evals/prompts/12-private-probe-reduction.md`

**Step 1: Use the exact source hierarchy below**

Use these sources in this order:

1. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
2. `docs/architecture/CURRENT_STATE.md`
3. `docs/agentic/codanna-playbook.md`
4. `docs/agentic/evals-roadmap.md`
5. existing tracked `docs/plans/*` files when relevant

Do not invent prompts disconnected from the repo.

**Step 2: Use the exact prompt file format**

Every prompt file must use this exact section order:

```md
# <Prompt ID and Title>

## Source

## Intent

## Prompt

## Expected Skills

## Expected Codanna Behavior

## Expected Verification

## Fail Conditions
```

**Step 3: Use the exact source mapping below**

Use this mapping exactly:

- `01-orchestrator-hotspot-extraction`
  - source: `P1` cleanup direction + current hotspot list
- `02-app-shell-responsibility-split`
  - source: `P2` cleanup direction + `src/App.ts` current role
- `03-settings-storage-boundary`
  - source: `P3-W1` pattern + `SettingsStore`
- `04-server-selection-storage-boundary`
  - source: `P3-W3` pattern + `ServerSelectionStore`
- `05-channel-persistence-boundary`
  - source: `P3-W4`/`P6` direction + `ChannelPersistenceStore`/`ChannelManager`
- `06-settings-screen-split`
  - source: `P4-W1`
- `07-epg-bounded-extraction`
  - source: `P4-W2`
- `08-channel-setup-orchestration-split`
  - source: `P4-W3`
- `09-plex-subtitle-policy`
  - source: `P5-W3`
- `10-plex-url-token-boundary`
  - source: `P5-W2`
- `11-architecture-doc-refresh`
  - source: `P7-W1`/`P7-W2`
- `12-private-probe-reduction`
  - source: `P8-W1`

**Step 4: Make 3 of the prompts deliberately adversarial**

The following prompt files must include urgency/minimal-diff pressure in the prompt text while still expecting correct boundaries:

- `03-settings-storage-boundary.md`
- `07-epg-bounded-extraction.md`
- `09-plex-subtitle-policy.md`

The fail conditions in those files must explicitly mention shortcut behavior.

**Step 5: Verify**

Run:

```bash
npm run verify:docs
find docs/agentic/evals/prompts -maxdepth 1 -type f | sort
```

Expected:

- docs verification passes
- exactly 12 prompt files exist

**Step 6: Commit**

```bash
git add docs/agentic/evals/prompts
git commit -m "docs: add starter eval prompt set"
```

---

### Task 5: Run the first manual baseline and capture results

**Files:**
- Create: `docs/agentic/evals/baselines/2026-03-05-initial-manual-baseline.md`

**Step 1: Define the baseline run order**

Use this exact order:

1. `01-orchestrator-hotspot-extraction`
2. `03-settings-storage-boundary`
3. `06-settings-screen-split`
4. `09-plex-subtitle-policy`
5. `11-architecture-doc-refresh`
6. `12-private-probe-reduction`

Run only 6 prompts in the first baseline. Do not run all 12 on the first pass.

**Step 2: Use the exact manual run protocol**

For each of the 6 prompts:

1. start a fresh session with no carried thread context
2. start from the repo root
3. give the agent only the prompt file content plus normal repo context
4. do not reuse previous prompt threads
5. record the agent surface used (Codex CLI, IDE, or Antigravity)
6. record whether the agent consulted Codanna and the expected skills

Keep the same agent surface for all 6 prompts in this first baseline if possible.

**Step 3: Use the scorecard template structure inside the baseline file**

For each prompt:

- record the prompt ID
- record surface/agent used
- record `pass`, `soft-fail`, or `fail`
- record evidence and failure notes

**Step 4: Add a summary section at the bottom**

Use these exact headings:

- `## Summary`
- `## Recurring Failure Patterns`
- `## Immediate Doc/Skill Follow-Ups`

**Step 5: Verify**

Run:

```bash
npm run verify:docs
```

Expected:

```text
Documentation verification passed.
```

**Step 6: Commit**

```bash
git add docs/agentic/evals/baselines/2026-03-05-initial-manual-baseline.md
git commit -m "docs: record initial agent eval baseline"
```

---

### Task 6: Add the recurring doc-gardening loop

**Files:**
- Create: `docs/agentic/doc-gardening-checklist.md`
- Modify: `docs/AGENTIC_DEV_WORKFLOW.md`
- Modify: `docs/agentic/document-map.md`
- Modify: `docs/agentic/phase-2-steady-state-plan.md`
- Modify: `tools/verify-docs.mjs`

**Step 1: Create the checklist**

Write `docs/agentic/doc-gardening-checklist.md` with these exact sections:

```md
# Doc Gardening Checklist

## Cadence

## Control Plane Checks

## Architecture Truth Checks

## Decision / Plan Hygiene

## Skill Mirror Checks

## Eval Review Checks
```

`Cadence` must say:

- run every 2-4 weeks
- run after major cleanup milestones

`Control Plane Checks` must include:

- stale workflow duplication
- stale current-state claims
- broken links
- missing decision index entries

`Skill Mirror Checks` must include:

- `.codex/skills` remains Lineup-only
- `.agent/skills` remains the curated mirror set

**Step 2: Wire the checklist into the workflow**

Update:

- `docs/AGENTIC_DEV_WORKFLOW.md`
- `docs/agentic/document-map.md`
- `docs/agentic/phase-2-steady-state-plan.md`

to reference the new checklist as the recurring maintenance loop.

Modify `tools/verify-docs.mjs` so `docs/agentic/doc-gardening-checklist.md` is treated as a required maintained doc.

**Step 3: Verify**

Run:

```bash
npm run verify:docs
rg -n "doc-gardening-checklist" docs
```

Expected:

- docs verification passes
- the new checklist is referenced from the control-plane docs

**Step 4: Commit**

```bash
git add docs/agentic/doc-gardening-checklist.md docs/AGENTIC_DEV_WORKFLOW.md docs/agentic/document-map.md docs/agentic/phase-2-steady-state-plan.md tools/verify-docs.mjs
git commit -m "docs: add doc gardening loop"
```

---

### Task 7: Final topology verification and handoff

**Files:**
- Review only

**Step 1: Verify docs**

Run:

```bash
npm run verify:docs
```

Expected:

```text
Documentation verification passed.
```

**Step 2: Verify the new directories exist**

Run:

```bash
find docs/runs -maxdepth 2 -type f | sort
find docs/agentic/evals -maxdepth 3 -type f | sort
```

Expected:

- the run-bundle root plus four template files exist
- the eval harness root files, 12 prompts, and at least one baseline file exist

**Step 3: Verify skill topology is still clean**

Run:

```bash
find .codex/skills .agent/skills -maxdepth 2 -name SKILL.md | sort
```

Expected:

- `.codex/skills` still contains only:
  - `architecture-boundaries`
  - `ui-composition-patterns`
  - `persistence-boundaries`
  - `plex-integration-boundaries`
- `.agent/skills` still contains the Lineup-specific mirrors plus the curated global mirror set

**Step 4: Record the final handoff note**

In the final response of the implementation session, include:

- what files were created/modified
- whether `npm run verify:docs` passed
- whether the 12 prompt files and initial baseline were created
- any residual risks

**Step 5: Final commit**

```bash
git add docs/runs docs/agentic agents.md docs/AGENTIC_DEV_WORKFLOW.md docs/development/testing.md tools/verify-docs.mjs
git commit -m "docs: add phase 1.5 harness upgrades"
```

---

## Reference Guidance Used For This Plan

- OpenAI, `Harness Engineering`
- OpenAI, `Building an AI-Native Engineering Team`
- OpenAI, `Agent Skills`
- OpenAI Cookbook, `Long Horizon Tasks with Codex`
- OpenAI, `Demystifying Evals for Agents`
- Anthropic, `Building Effective Agents`
- Codanna repo/workflow guidance, especially semantic search, impact analysis, and document search

## Why This Plan Is Structured This Way

- It uses real repo risks and cleanup work as the eval source material.
- It keeps the control plane small instead of multiplying guidance docs.
- It turns Codanna from “recommended” into “mechanically expected.”
- It adds durable memory for long-horizon tasks without forcing that overhead on every small task.
- It delays heavy automation until the repo has real eval failures worth automating around.
