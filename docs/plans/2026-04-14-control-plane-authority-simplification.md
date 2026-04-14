# Control Plane Authority Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Plan Status:** active

**Goal:** Simplify the Lineup control plane by making `docs/AGENTIC_DEV_WORKFLOW.md` the only operating authority surface, shrinking `agents.md` into a true entrypoint map, and reducing `docs/agentic/document-map.md` to compatibility-only status without weakening workflow quality protections.

**Architecture:** Preserve the durable harness shape: one short entrypoint map, one operating runbook, one current architecture truth surface, one active cleanup/live-status surface, explicit tracked-vs-local rules, explicit risk-tiered routing, and mechanical verification/eval gates. Apply OpenAI guidance as hard constraints (`AGENTS.md` is a map, repo docs are the system of record, progressive disclosure beats duplicate manuals, mechanical validation matters) and Anthropic guidance as hard constraints (use the simplest composable workflow that works, keep routing transparent, add complexity only when it materially improves outcomes).

**Tech Stack:** tracked markdown control-plane docs, session launcher docs, `tools/verify-docs.mjs`, `src/__tests__/tools/verifyDocs.test.ts`, manual workflow meta-evals, Codanna discovery

---

## Goal

- Remove duplicated control-plane authority across `agents.md`, `docs/AGENTIC_DEV_WORKFLOW.md`, and lingering `document-map.md` references.
- Keep fresh-session routing and read order explicit while reducing ceremony and extra authority hops.
- Preserve the mechanisms that actually protect production-level code quality, architectural discipline, anti-tech-debt behavior, and future portability.

## Non-Goals

- Do not collapse the cleanup/feature launcher family in this slice.
- Do not reduce the eval prompt inventory in this slice.
- Do not redesign `.codex/config.toml` or `.codex/agents/*.toml`.
- Do not change product/runtime code.
- Do not create a new tracked doc to explain the simplified authority model.
- Do not weaken `npm run verify:docs`, manual eval triggers, tracked-vs-local rules, or risk-tiered routing.

## Acceptance Criteria

### Control-plane shape

- `agents.md` is a true map:
  - it keeps hard defaults and where-truth-lives pointers
  - it does not define read order, document precedence, workflow steps, launcher routing, or document-role taxonomy
  - it does not send readers to `docs/agentic/document-map.md` as an authority hop
- `docs/AGENTIC_DEV_WORKFLOW.md` is the single operating runbook for:
  - read order
  - document precedence
  - document-role taxonomy
  - where-to-look-next
  - tracked-vs-local memory tiers
  - risk-tiered routing and launcher usage
- `docs/agentic/document-map.md` remains only a compatibility stub/redirect; it does not restate policy in a second authority surface.

### Same-pass consumer coverage

- Every tracked doc that still treats `document-map.md` as authority is handled in the same implementation pass.
- Based on current reads, the remaining stale same-pass consumers are:
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - `docs/agentic/skill-strategy.md`
  - active tracked plans still routing through `document-map.md`, including `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`
- Session launcher surfaces are not allowed to drift silently:
  - `docs/agentic/session-prompts/README.md`
  - `docs/agentic/session-prompts/cleanup-plan.md`
  - `docs/agentic/session-prompts/cleanup-implement.md`
  - `docs/agentic/session-prompts/cleanup-review.md`
  - `docs/agentic/session-prompts/cleanup-loop.md`
  - `docs/agentic/session-prompts/feature-plan.md`
  - `docs/agentic/session-prompts/feature-implement.md`
  - `docs/agentic/session-prompts/feature-review.md`
  - `docs/agentic/session-prompts/workflow-harness-review.md`
- If those launcher surfaces already satisfy the simplified authority model, leave them unchanged and record that they were validated rather than edited.

### Quality protections preserved

- `docs/architecture/CURRENT_STATE.md` remains the current architecture truth surface.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` remains the active cleanup/live-status truth surface.
- Tracked-vs-local memory rules remain explicit, including `docs/runs/` and raw eval baselines staying local-only by default.
- Serious tracked plan quality remains explicit through `docs/agentic/plan-authoring-standard.md`.
- Eval triggers remain explicit, including prompt `13` for material workflow/control-plane changes.
- `npm run verify:docs` remains a real gate, and the authority model remains mechanically checked.
- Cleanup vs feature vs mixed routing remains explicit and task-family-first.
- Fresh-session launcher docs stay usable without ambiguity after `document-map.md` becomes compatibility-only.
- The document-role taxonomy still exists in one authoritative tracked location after this slice.

### External-guidance translation

- OpenAI map-not-encyclopedia guidance becomes a hard doc constraint on `agents.md`, not a vague aspiration.
- OpenAI repo-docs-as-system-of-record guidance becomes a hard ownership rule for `docs/AGENTIC_DEV_WORKFLOW.md`.
- OpenAI progressive-disclosure guidance becomes a hard ban on keeping `document-map.md` as a second authority layer.
- OpenAI mechanical-validation guidance becomes a hard requirement that `verify-docs` and its tests still enforce the final authority split.
- Anthropic simplest-workflow guidance becomes a hard ban on adding new docs, new workflow layers, or new launcher families in this slice.
- Anthropic transparency guidance becomes a hard requirement that routing, tiering, and local-vs-tracked promotion stay explicit in the surviving docs.

## Parent Alignment

- Aligns with the repo goal that workflow surfaces should improve actual implementation quality rather than accumulate cleanup-era ritual.
- Advances GPT Pro ROI item 1 only: simplify the control-plane authority split without broadening into launcher-family consolidation, eval reduction, or role-catalog work.

## Required Reading

Read these first in the implementation session before touching files:

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/document-map.md`
4. `docs/agentic/session-prompts/README.md`
5. `docs/agentic/evals/README.md`
6. `docs/agentic/evals/prompts/13-risk-tiered-orchestration-and-local-only-absorption.md`
7. `docs/agentic/plan-authoring-standard.md`
8. `docs/plans/README.md`
9. `tools/verify-docs.mjs`
10. `src/__tests__/tools/verifyDocs.test.ts`

## Same-Pass Authority Consumers To Inspect

Inspect these in the same pass because they either still cite `document-map.md` as authority or enforce the contract mechanically:

1. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
2. `docs/agentic/skill-strategy.md`
3. `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`
4. `docs/agentic/session-prompts/cleanup-plan.md`
5. `docs/agentic/session-prompts/cleanup-implement.md`
6. `docs/agentic/session-prompts/cleanup-review.md`
7. `docs/agentic/session-prompts/cleanup-loop.md`
8. `docs/agentic/session-prompts/feature-plan.md`
9. `docs/agentic/session-prompts/feature-implement.md`
10. `docs/agentic/session-prompts/feature-review.md`
11. `docs/agentic/session-prompts/workflow-harness-review.md`

## Preservation References

Read these as preservation references when checking invariants and wording, not as mandatory first-hop operating context:

1. `docs/architecture/CURRENT_STATE.md`

## Required Skills

- `using-superpowers`
- `brainstorming`
- `writing-plans`
- `verification-before-completion`

Repo-local boundary skills are not required unless the slice unexpectedly starts changing architecture truth, persistence policy, UI composition policy, or Plex boundaries. That should not happen in this plan.

## Current-State Evidence

- `docs/agentic/document-map.md` is already reduced to a compatibility stub and points to `docs/AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles`.
- `docs/agentic/session-prompts/README.md` already states that authority, read order, and document precedence live in `docs/AGENTIC_DEV_WORKFLOW.md`.
- The tracked launcher prompt files listed above already read `agents.md` plus `docs/AGENTIC_DEV_WORKFLOW.md` without requiring `document-map.md`.
- `tools/verify-docs.mjs` and `src/__tests__/tools/verifyDocs.test.ts` already enforce:
  - `agents.md` must point to `docs/AGENTIC_DEV_WORKFLOW.md`
  - `agents.md` must not route authority through `document-map.md`
  - `document-map.md` must remain a compatibility stub
  - session prompts must not require `document-map.md` in read order
- The remaining observed stale authority references are:
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`: still says “Per `docs/agentic/document-map.md`...”
  - `docs/agentic/skill-strategy.md`: still says the broader control-plane structure is defined in `docs/agentic/document-map.md`
  - `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`: still requires `docs/agentic/document-map.md` in required reading

## Codanna Discovery

- `search_documents` was used first for repo-doc discovery and confirmed that `document-map.md`/workflow authority relationships were still part of the control-plane surface.
- Codanna was not precise enough to enumerate the exact remaining consumers, so bounded `rg` fallback plus direct tracked-doc reads were required.
- Evidence trail for this plan revision:
  - `semantic_search_with_context`: not used; this is a doc-authority slice rather than a symbol-ownership/code-path slice
  - `search_documents`: confirmed repo-doc relevance of the authority split
  - `analyze_impact`: not applicable for this doc-only authority slice
  - direct reads / `rg` fallback:
    - confirmed current launcher prompt files no longer require `document-map.md`
    - confirmed `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/agentic/skill-strategy.md`, and one active tracked plan still cited `document-map.md` as authority
    - confirmed `tools/verify-docs.mjs` and `src/__tests__/tools/verifyDocs.test.ts` already encode the simplified authority model

Fallback note:

- `rg` was used only because exact inbound authority references and verifier markers needed literal-string inspection that Codanna did not provide cleanly.

## Impact Snapshot

Primary edit surfaces for execution should be:

- `agents.md`
- `docs/AGENTIC_DEV_WORKFLOW.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `docs/agentic/skill-strategy.md`
- `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`

Validation-only or conditional edit surfaces:

- `docs/agentic/document-map.md`
- `docs/agentic/session-prompts/README.md`
- `docs/agentic/session-prompts/cleanup-plan.md`
- `docs/agentic/session-prompts/cleanup-implement.md`
- `docs/agentic/session-prompts/cleanup-review.md`
- `docs/agentic/session-prompts/cleanup-loop.md`
- `docs/agentic/session-prompts/feature-plan.md`
- `docs/agentic/session-prompts/feature-implement.md`
- `docs/agentic/session-prompts/feature-review.md`
- `docs/agentic/session-prompts/workflow-harness-review.md`
- `tools/verify-docs.mjs`
- `src/__tests__/tools/verifyDocs.test.ts`

Create only after a real manual eval run:

- `docs/agentic/evals/baseline-summaries/<date>-workflow-authority-simplification-meta-eval.md`

This remains a workflow/control-plane slice only. No runtime application code should change.

## Files In Scope

- Modify:
  - `agents.md`
  - `docs/AGENTIC_DEV_WORKFLOW.md`
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - `docs/agentic/skill-strategy.md`
  - `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`
- Modify only if the final wording or anchors require it:
  - `docs/agentic/document-map.md`
  - `docs/agentic/session-prompts/README.md`
  - `docs/agentic/session-prompts/cleanup-plan.md`
  - `docs/agentic/session-prompts/cleanup-implement.md`
  - `docs/agentic/session-prompts/cleanup-review.md`
  - `docs/agentic/session-prompts/cleanup-loop.md`
  - `docs/agentic/session-prompts/feature-plan.md`
  - `docs/agentic/session-prompts/feature-implement.md`
  - `docs/agentic/session-prompts/feature-review.md`
  - `docs/agentic/session-prompts/workflow-harness-review.md`
  - `tools/verify-docs.mjs`
  - `src/__tests__/tools/verifyDocs.test.ts`
- Create after a valid manual eval run:
  - `docs/agentic/evals/baseline-summaries/<date>-workflow-authority-simplification-meta-eval.md`

## Files Out Of Scope

- `docs/architecture/CURRENT_STATE.md`
- `docs/agentic/plan-authoring-standard.md`
- `docs/agentic/evals/prompts/*`
- `docs/agentic/evals-roadmap.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- launcher-family consolidation beyond wording/read-order coherence checks
- product/runtime code

## Invariants / Preservation Contracts

- `agents.md` stays first and stays short; it must not become a second runbook again.
- `docs/AGENTIC_DEV_WORKFLOW.md` remains the only operating runbook and document-precedence home.
- `docs/agentic/document-map.md` stays compatibility-only unless a later slice proves it can be removed safely.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` remains the active cleanup/live-status truth.
- `docs/architecture/CURRENT_STATE.md` remains the current architecture truth.
- The document-role taxonomy currently reachable through the workflow doc must continue to cover:
  - tool playbook
  - tracked launcher routing
  - active tracked plans
  - archived plans
  - local execution artifacts
  - skill topology
  - eval roadmap and baseline summaries
  - historical corpus review
  - standards/reference surfaces
  - steady-state transition
  - recurring maintenance
- Tracked-vs-local memory rules must remain at least as explicit as they are now.
- `docs/runs/` and raw eval baseline outputs stay local-only by default.
- Serious tracked plan quality remains explicit and discoverable.
- `npm run verify:docs` remains the mechanical closeout gate for this slice.
- No new doc may be introduced just to narrate the simplified control plane.

## Verification Commands

### Task 1: Decide verification class

- `Broader verification is enough`
- This slice changes tracked workflow/control-plane docs and possibly their mechanical verification markers, not product runtime behavior.

### Task 2: Mechanical docs verification

Run:

```bash
npm run verify:docs
```

Expected:

- PASS

### Task 3: Prompt inventory sync if managed sections changed

Run only if managed prompt/readme sections changed:

```bash
npm run docs:sync
npm run verify:docs
```

Expected:

- managed sections updated cleanly
- docs verifier PASS

### Task 4: Required workflow meta-eval

Run prompt `13-risk-tiered-orchestration-and-local-only-absorption` in a fresh session using the stronger feature/design workflow meta-eval shape from `docs/agentic/evals/README.md`.

Required scenario for this slice:

- present three candidate framings in the prompt context:
  - the real task: cleanup-only control-plane authority simplification with no product/runtime code changes
  - a feature/design distractor: a hypothetical future UI/settings redesign that is explicitly not in scope for the session
  - a mixed-work distractor: a hypothetical request to simplify docs while also fixing a runtime bug
- include a local-only artifact note:
  - a raw `docs/runs/...` or eval-baseline artifact changed the workflow conclusion and must be absorbed correctly
- require the agent to:
  - choose task family first (`cleanup/refactor` for the real slice)
  - choose the lightest valid tier second
  - follow launcher/read-order behavior that uses `agents.md` plus `docs/AGENTIC_DEV_WORKFLOW.md` without treating `document-map.md` as a required authority surface
  - keep raw run/eval artifacts local-only while promoting only the durable workflow conclusion into a tracked doc or tracked eval summary

Expected:

- the agent routes the real slice as `cleanup/refactor`
- the agent does not misroute the slice through feature launchers just because the meta-eval includes feature/mixed distractors
- the agent treats `document-map.md` as compatibility-only, not required primary authority
- the agent preserves tracked-vs-local absorption discipline
- a tracked baseline summary is recorded before claiming the workflow change is production-ready

## Rollback Notes

- If the simplified wording makes fresh-session routing less explicit, restore the prior clarity before cutting more text.
- If shrinking `agents.md` hides a hard default instead of relocating it clearly, restore that default and move only the explanatory detail.
- If `ARCHITECTURE_CLEANUP_CHECKLIST.md` or `docs/agentic/skill-strategy.md` become less clear after removing `document-map.md` references, point them directly to the exact workflow section instead of inventing a new summary surface.
- If launcher docs are already correct, do not churn them unnecessarily.
- If workflow wording changes require new verifier markers, update `tools/verify-docs.mjs` and `src/__tests__/tools/verifyDocs.test.ts` in the same pass rather than leaving the authority contract partially enforced.

## Commit Checkpoints

1. After `docs/AGENTIC_DEV_WORKFLOW.md` and `agents.md` reflect the final authority split
2. After the remaining stale same-pass consumers (`ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/agentic/skill-strategy.md`, `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`, and any conditional surfaces that needed edits) are aligned
3. After `npm run verify:docs` passes and the required prompt `13` baseline summary is recorded

## Priority-Exit Readiness

- Not a cleanup priority-closeout plan.
- No `P#-EXIT` gate applies in this slice.

## Planner Self-Check

1. The architecture truth surface is preserved as `docs/architecture/CURRENT_STATE.md`; it is not merged into the workflow doc.
2. The cleanup/live-status surface is preserved as `ARCHITECTURE_CLEANUP_CHECKLIST.md`; it is not merged into the workflow doc.
3. The plan now covers the real stale authority consumers that still cite `document-map.md`, not just the top-level docs.
4. Launcher prompt files are explicitly validated but not forced into unnecessary edits when they already satisfy the new authority model.
5. Mechanical enforcement surfaces (`tools/verify-docs.mjs` and `src/__tests__/tools/verifyDocs.test.ts`) are explicitly in conditional scope so the final authority contract cannot drift unverified.
6. Prompt `13` is no longer a generic “run the eval” note; the required scenario now tests routing, tiering, read order after `document-map.md` becomes compatibility-only, and tracked-vs-local absorption.
7. The plan distinguishes first-hop reading from preservation references so the execution session does not carry broader doc gravity than this slice needs.
8. This plan still does not collapse launcher families, reduce eval inventory, or redesign role defaults.

## Architecture Seam Decision Gate

- The seam being changed here is tracked documentation authority, not runtime architecture.
- The target seam is locked:
  - `agents.md` = short entrypoint map plus hard defaults only
  - `docs/AGENTIC_DEV_WORKFLOW.md` = single operating runbook and document-role home
  - `docs/agentic/document-map.md` = compatibility stub only
  - other tracked docs = consumers that point directly at the workflow doc when they need control-plane authority
- Do not broaden this slice into launcher-family redesign, eval-inventory pruning, skill-topology redesign, or phase-2 cleanup policy changes.

## Task Breakdown

### Task 1: Lock the exact authority-consumer matrix

**Files:**
- Read/Modify: `agents.md`
- Read/Modify: `docs/AGENTIC_DEV_WORKFLOW.md`
- Read/Modify: `docs/agentic/document-map.md`
- Read/Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- Read/Modify: `docs/agentic/skill-strategy.md`
- Read/Modify: `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`
- Read/Validate: `docs/agentic/session-prompts/README.md`
- Read/Validate:
  - `docs/agentic/session-prompts/cleanup-plan.md`
  - `docs/agentic/session-prompts/cleanup-implement.md`
  - `docs/agentic/session-prompts/cleanup-review.md`
  - `docs/agentic/session-prompts/cleanup-loop.md`
  - `docs/agentic/session-prompts/feature-plan.md`
  - `docs/agentic/session-prompts/feature-implement.md`
  - `docs/agentic/session-prompts/feature-review.md`
  - `docs/agentic/session-prompts/workflow-harness-review.md`
- Read/Validate:
  - `tools/verify-docs.mjs`
  - `src/__tests__/tools/verifyDocs.test.ts`

**Step 1: Classify every consumer**

- classify each surface as one of:
  - `core rewrite`
  - `same-pass stale consumer`
  - `validation-only / no edit unless drift appears`
  - `preservation reference only`

**Step 2: Freeze the keep/cut/no-op set**

- record that the current expected classification is:
  - `core rewrite`: `agents.md`, `docs/AGENTIC_DEV_WORKFLOW.md`
  - `same-pass stale consumer`: `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/agentic/skill-strategy.md`, `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`
  - `validation-only`: `docs/agentic/document-map.md`, session prompt README, launcher prompt files, verifier/test authority markers
  - `preservation reference`: `docs/architecture/CURRENT_STATE.md`

Expected outcome:

- the implementation session knows exactly which files must change, which files must only be validated, and which files are preservation-only

### Task 2: Make the workflow doc the only operating authority surface

**Files:**
- Modify: `docs/AGENTIC_DEV_WORKFLOW.md`

**Step 1: Keep the authority taxonomy complete**

- ensure the workflow doc remains the single home for:
  - read order
  - authority and document roles
  - document precedence
  - where to look next
  - tracked-vs-local memory tiers
  - launcher/routing references

**Step 2: Keep progressive disclosure honest**

- do not bloat the workflow doc with duplicated launcher prose or checklist internals
- keep current architecture truth and cleanup truth as linked truth surfaces, not absorbed content

Expected outcome:

- fresh sessions can understand the control plane from `agents.md` then `docs/AGENTIC_DEV_WORKFLOW.md` without needing a third authority doc

### Task 3: Shrink `agents.md` into a true entrypoint map

**Files:**
- Modify: `agents.md`

**Step 1: Keep only hard defaults and truth pointers**

- preserve only the high-value defaults that belong at the stable entrypoint:
  - planning authority
  - Codanna-first discovery
  - evidence accuracy
  - risk-tiered workflow summary
  - conservative multi-agent-role summary
  - verification gate summary
  - architecture/current-truth pointers
  - boundary-skill loading rule
  - local artifact absorption rule

**Step 2: Remove operational duplication**

- do not keep:
  - read order
  - document precedence
  - launcher routing
  - document-role taxonomy
  - procedural workflow steps
  - any dependency on `document-map.md`

Expected outcome:

- `agents.md` reads like a short map and policy header, not a compressed second runbook

### Task 4: Update the remaining stale consumers and compatibility surfaces

**Files:**
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- Modify: `docs/agentic/skill-strategy.md`
- Modify: `docs/plans/2026-03-11-p2-w4-app-shell-transitional-cleanup.md`
- Modify only if needed:
  - `docs/agentic/document-map.md`
  - `docs/agentic/session-prompts/README.md`
  - `docs/agentic/session-prompts/cleanup-plan.md`
  - `docs/agentic/session-prompts/cleanup-implement.md`
  - `docs/agentic/session-prompts/cleanup-review.md`
  - `docs/agentic/session-prompts/cleanup-loop.md`
  - `docs/agentic/session-prompts/feature-plan.md`
  - `docs/agentic/session-prompts/feature-implement.md`
  - `docs/agentic/session-prompts/feature-review.md`
  - `docs/agentic/session-prompts/workflow-harness-review.md`
  - `tools/verify-docs.mjs`
  - `src/__tests__/tools/verifyDocs.test.ts`

**Step 1: Remove stale `document-map.md` authority wording**

- update checklist, skill strategy, and any active tracked plan still using `document-map.md` for control-plane authority so they point directly to the workflow doc instead
- preserve each file’s actual role

**Step 2: Touch conditional surfaces only when needed**

- if workflow anchors, wording, or verifier markers changed, update the compatibility stub, launcher surfaces, and tests in the same pass
- if those surfaces already satisfy the contract, leave them unchanged and record that they were validated

Expected outcome:

- no tracked doc still presents `document-map.md` as a live authority source
- no already-correct launcher or verifier surface is churned unnecessarily

### Task 5: Verify mechanically and run the required meta-eval

**Files:**
- Create after real eval run:
  - `docs/agentic/evals/baseline-summaries/<date>-workflow-authority-simplification-meta-eval.md`

**Step 1: Run docs verification**

- `npm run verify:docs`

**Step 2: Run prompt `13` with the concrete scenario above**

- use a fresh session
- score it against the feature/design workflow meta-eval expectations from `docs/agentic/evals/README.md`
- fail the slice if the run:
  - misroutes the real task family
  - chooses an unjustifiably heavy tier
  - treats `document-map.md` as required primary authority
  - promotes raw `docs/runs/...` or raw eval artifacts into tracked truth

**Step 3: Record the tracked baseline summary**

- write one tracked summary under `docs/agentic/evals/baseline-summaries/`
- keep raw run artifacts local-only

Expected outcome:

- the simplified authority model is backed by fresh mechanical verification and the required workflow meta-eval before it is claimed ready
