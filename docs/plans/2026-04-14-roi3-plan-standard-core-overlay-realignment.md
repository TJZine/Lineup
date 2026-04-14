# ROI 3 Plan Standard Core/Overlay Realignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify `docs/agentic/plan-authoring-standard.md` without reducing workflow effectiveness by splitting universal serious-plan rules from cleanup-only closeout rules, realigning adjacent workflow surfaces, and strengthening the checker before trimming prose.

**Architecture:** Keep one tracked plan-authoring standard doc as the single authority surface. Separate it internally into `Universal Plan Core` and `Cleanup Overlay`, then realign workflow/launcher/checker ownership in the same pass so the split reduces duplicate doctrine instead of just moving it around.

**Tech Stack:** Markdown workflow docs, tracked session launchers, Node `.mjs` verifier helpers, Jest + Node test harness, manual workflow eval summaries.

---

**Plan Status:** active

## Goal

- Land a narrow ROI 3 control-plane improvement that preserves or improves planning/review/implementation quality while reducing default planning drag.
- Keep one authority doc for plan authoring; do not create a second standards doc.
- Make the future split safe by:
  - defining exactly when cleanup-only rules apply
  - moving duplicated cleanup law to the right owner surfaces in the same pass
  - strengthening conformance checks before trimming explanatory prose
  - rerunning the workflow eval gates that cover routing and plan-quality regression risk

## Non-Goals

- No launcher-family collapse or prompt-family redesign.
- No new always-on read order.
- No new standards doc, appendix doc, or doctrine-only sidecar surface.
- No broad rewrite of feature or cleanup workflow routing.
- No attempt to fully automate semantic plan quality beyond light, reliable checks.
- No change to product/runtime architecture, app behavior, or non-workflow code outside the docs verifier/test surface.

## Parent Architecture Alignment

- This plan advances GPT Pro ROI item 3 in a constrained way: reduce doctrine-heavy plan-standard surface only where workflow effectiveness is preserved or strengthened.
- The intended end state is:
  - `docs/agentic/plan-authoring-standard.md` remains the single plan-standard authority surface
  - universal planning law is easier for feature and cleanup work to scan
  - cleanup-specific closeout discipline remains explicit and complete for cleanup workflows
  - the checker/test surface proves more than heading presence for critical sections
- Task family: `cleanup/refactor`
- Cleanup subtype: `standalone remediation`
  - this is control-plane/workflow hardening with no checklist-linked cleanup owner
  - implementation must not invent checklist linkage or `P#-W#` progress claims
- Expected orchestration tier: `Tier 2`
  - planner -> reviewer -> implementer -> reviewer
  - do not escalate to `cleanup-loop` unless review finds a new cross-surface risk that a bounded Tier 2 pass cannot safely absorb

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/plan-authoring-standard.md`
4. `docs/agentic/session-prompts/README.md`
5. `docs/agentic/session-prompts/cleanup-plan.md`
6. `docs/agentic/session-prompts/cleanup-review.md`
7. `docs/agentic/session-prompts/cleanup-implement.md`
8. `docs/agentic/session-prompts/cleanup-loop.md`
9. `docs/agentic/session-prompts/feature-plan.md`
10. `docs/agentic/session-prompts/feature-review.md`
11. `docs/agentic/session-prompts/feature-implement.md`
12. `docs/agentic/evals/README.md`
13. `docs/agentic/evals/prompts/13-risk-tiered-orchestration-and-local-only-absorption.md`
14. `docs/agentic/evals/prompts/18-detect-unresolved-seam-before-freezing-plan.md`
15. `docs/agentic/session-prompts/workflow-harness-review.md`
16. `docs/plans/README.md`
17. `tools/harness-docs-lib.mjs`
18. `tools/verify-docs.mjs`
19. `tools/report-plan-conformance.mjs`
20. `tools/__tests__/harness-docs-lib.test.mjs`
21. `src/__tests__/tools/verifyDocs.test.ts`

## Required Skills

1. `using-superpowers`
2. `brainstorming`
3. `writing-plans`
4. `verification-before-completion`
5. `review-context-loader` only if repo review context is needed to validate adjacent workflow drift before edits
6. `model-selection` only for the outgoing implementation/review handoff if the user asks or the risk trigger applies

## Codanna Discovery

### `search_documents`

- Query: `plan authoring standard cleanup review cleanup implement feature plan workflow contract realignment priority exit readiness plan conformance`
  - useful hits:
    - `docs/agentic/session-prompts/feature-plan.md`
    - `docs/agentic/phase-2-steady-state-plan.md`
    - representative recent tracked plans under `docs/plans/`
  - planning implication:
    - the current workflow already distributes plan-quality rules across the standard, workflow doc, and session prompts; this slice must realign those owners in one pass.

### `semantic_search_with_context`

- Query: `plan conformance checker active plan marker required sections priority exit readiness cleanup plan docs verifier`
  - result: no usable semantic matches
  - conclusion: semantic search was insufficient for the docs/checker side of this slice.

### Direct reads / `rg` fallback

- Deterministic fallback was required for the real owner map:
  - `docs/agentic/plan-authoring-standard.md`
  - `docs/AGENTIC_DEV_WORKFLOW.md`
  - `docs/agentic/session-prompts/cleanup-plan.md`
  - `docs/agentic/session-prompts/cleanup-review.md`
  - `docs/agentic/session-prompts/cleanup-implement.md`
  - `docs/agentic/session-prompts/cleanup-loop.md`
  - `docs/agentic/session-prompts/feature-plan.md`
  - `docs/agentic/session-prompts/feature-review.md`
  - `docs/agentic/session-prompts/feature-implement.md`
  - `docs/agentic/evals/README.md`
  - `docs/agentic/evals/prompts/18-detect-unresolved-seam-before-freezing-plan.md`
  - `tools/harness-docs-lib.mjs`
  - `tools/verify-docs.mjs`
  - `tools/report-plan-conformance.mjs`
  - `tools/__tests__/harness-docs-lib.test.mjs`
  - `src/__tests__/tools/verifyDocs.test.ts`
- Current-source findings that shape this plan:
  - the checker currently enforces the active marker and required section presence, but not substantive section content
  - cleanup-closeout semantics are currently duplicated across the standard, workflow doc, and cleanup planner/reviewer/implementer prompts
  - feature planner/reviewer surfaces still consume the whole standard rather than a scoped subsection
  - prompt `18` is the main tracked eval guarding hidden seam / fake execution-plan regressions
  - tracked plan inventory currently contains:
    - `docs/plans/2026-03-04-epg-performance-risk-register.md`
    - `docs/plans/2026-04-04-epg-video-layer-stability-plan.md`
    - `docs/plans/README.md`
  - there are no additional tracked active serious plans currently in the blocking `plans:check` path beyond this new plan, so rollout can stay narrow if the tracked inventory does not change before implementation

## Impact Snapshot

- Main impacted surfaces:
  - `docs/agentic/plan-authoring-standard.md`
  - `docs/AGENTIC_DEV_WORKFLOW.md`
  - `docs/agentic/session-prompts/cleanup-plan.md`
  - `docs/agentic/session-prompts/cleanup-review.md`
  - `docs/agentic/session-prompts/cleanup-implement.md`
  - `docs/agentic/session-prompts/cleanup-loop.md`
  - `docs/agentic/session-prompts/feature-plan.md`
  - `docs/agentic/session-prompts/feature-review.md`
  - `docs/agentic/session-prompts/feature-implement.md`
  - `tools/harness-docs-lib.mjs`
  - `tools/verify-docs.mjs`
  - `tools/report-plan-conformance.mjs`
  - `tools/__tests__/harness-docs-lib.test.mjs`
  - `src/__tests__/tools/verifyDocs.test.ts`
  - one or more new tracked eval baseline summaries under `docs/agentic/evals/baseline-summaries/`
- Risk notes:
  - the main failure mode is not syntax drift; it is silent loss of workflow completeness for cleanup work
  - feature workflows could also regress if the split is conceptual only and launchers continue to depend on the whole standard implicitly
  - checker strengthening must stay light and reliable; pseudo-semantic automation would overbuild this slice

## Files In Scope

- `docs/agentic/plan-authoring-standard.md`
- `docs/AGENTIC_DEV_WORKFLOW.md`
- `docs/agentic/session-prompts/cleanup-plan.md`
- `docs/agentic/session-prompts/cleanup-review.md`
- `docs/agentic/session-prompts/cleanup-implement.md`
- `docs/agentic/session-prompts/cleanup-loop.md`
- `docs/agentic/session-prompts/feature-plan.md`
- `docs/agentic/session-prompts/feature-review.md`
- `docs/agentic/session-prompts/feature-implement.md`
- `docs/agentic/session-prompts/workflow-harness-review.md`
- `docs/agentic/evals/README.md`
- `docs/agentic/evals/prompts/18-detect-unresolved-seam-before-freezing-plan.md`
- `docs/plans/README.md`
- `tools/harness-docs-lib.mjs`
- `tools/verify-docs.mjs`
- `tools/report-plan-conformance.mjs`
- `tools/__tests__/harness-docs-lib.test.mjs`
- `src/__tests__/tools/verifyDocs.test.ts`
- `docs/agentic/evals/baseline-summaries/2026-04-14-*.md` for the required manual eval closeout

## Files Out Of Scope

- `docs/agentic/session-prompts/README.md` unless anchor/read-order references must change to stay truthful
- `docs/agentic/historical-plan-corpus-review.md` beyond reference updates strictly required by the split
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.codex/skills/`
- `.agent/skills/`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- all product/runtime source under `src/` except docs-verifier tests already listed above
- prompt inventories beyond the exact eval/launcher surfaces named above

## Task Breakdown

### Task 1: Freeze The Contract Split And Rule Owner Map

**Files:**
- Modify: `docs/agentic/plan-authoring-standard.md`
- Modify: `docs/AGENTIC_DEV_WORKFLOW.md`
- Reference-check: `docs/agentic/session-prompts/cleanup-plan.md`
- Reference-check: `docs/agentic/session-prompts/cleanup-review.md`
- Reference-check: `docs/agentic/session-prompts/cleanup-implement.md`
- Reference-check: `docs/agentic/session-prompts/feature-plan.md`
- Reference-check: `docs/agentic/session-prompts/feature-review.md`

**Step 1: Decide the exact split boundary**

- `Universal Plan Core` must own:
  - serious-plan applicability
  - active marker
  - required structure
  - fresh-session rules
  - planner self-check
  - architecture seam decision gate
  - evidence / fallback logging
  - scope / invariants
  - verification / rollback
- `Cleanup Overlay` must own:
  - cleanup subtype
  - final-slice closeout rules
  - `Priority-Exit Readiness`
  - imported-issue disposition
  - detector-vs-source-audit reconciliation
  - `P0` security gate rules

**Step 2: Define the hard overlay trigger**

- Add explicit plan-classification fields to the future standard without creating a new top-level section:
  - `**Task family:** feature/design` or `cleanup/refactor`
  - `**Cleanup subtype:** checklist-linked` or `standalone remediation` whenever `Task family` is `cleanup/refactor`
- Minimum safe rule:
  - every serious tracked plan must declare `**Task family:**`
  - every serious tracked `cleanup/refactor` plan must satisfy `Universal Plan Core + Cleanup Overlay`
  - every serious tracked `feature/design` plan must satisfy `Universal Plan Core` and must not rely on cleanup-overlay-only sections
- Narrower overlay rules inside the cleanup section:
  - `Priority-Exit Readiness` is required only for final `P#-W#` or `P#-EXIT` closeout work
  - mixed work must split cleanup into a separate cleanup plan instead of relying on one ambiguous mixed-plan overlay trigger

**Step 3: Produce a one-owner rule map**

- Freeze this owner map before editing:
  - `docs/agentic/plan-authoring-standard.md`
    - primary owner for normative plan-authoring law:
      - universal serious-plan contract
      - cleanup-overlay applicability
      - cleanup-overlay required content
  - `docs/AGENTIC_DEV_WORKFLOW.md`
    - primary owner for routing/orchestration law:
      - task-family routing
      - tier selection
      - cross-surface verification and eval-trigger expectations
    - may reference standard anchors, but must not re-own detailed cleanup closeout doctrine
  - `docs/agentic/session-prompts/cleanup-plan.md`
    - primary owner for cleanup planner-session behavior and output contract
  - `docs/agentic/session-prompts/cleanup-review.md`
    - primary owner for cleanup review vocabulary and approval criteria:
      - `deferred`
      - `split follow-up`
      - `owned follow-up`
      - `security triage`
      - `priority-exit review`
  - `docs/agentic/session-prompts/cleanup-implement.md`
    - primary owner for execution/closeout behavior after an approved cleanup plan exists
  - `docs/agentic/session-prompts/feature-plan.md`, `feature-review.md`, `feature-implement.md`
    - primary owners for feature-session behavior and scoped references to the universal core
  - `docs/agentic/session-prompts/workflow-harness-review.md`
    - primary owner for whole-harness audit read order and benchmark framing; it must stay aligned with the split
- Supporting surfaces may summarize another owner's rules briefly, but must stop short of re-narrating the full doctrine.

**Step 4: Keep a short critical anti-pattern list in the universal core**

- Retain at least:
  - hidden seam
  - contradictory scope
  - weak evidence / fallback logging
  - weak verification
  - local-only dependency leakage
- Move only longer cleanup-era or archive-derived examples out of the main always-on authoring surface.

### Task 2: Realign Planner / Reviewer / Implementer Workflow Surfaces

**Files:**
- Modify: `docs/AGENTIC_DEV_WORKFLOW.md`
- Modify: `docs/agentic/session-prompts/cleanup-plan.md`
- Modify: `docs/agentic/session-prompts/cleanup-review.md`
- Modify: `docs/agentic/session-prompts/cleanup-implement.md`
- Modify: `docs/agentic/session-prompts/cleanup-loop.md`
- Modify: `docs/agentic/session-prompts/feature-plan.md`
- Modify: `docs/agentic/session-prompts/feature-review.md`
- Modify: `docs/agentic/session-prompts/feature-implement.md`
- Modify: `docs/agentic/session-prompts/workflow-harness-review.md`
- Modify only if needed: `docs/agentic/session-prompts/README.md`

**Step 1: Realign feature surfaces**

- Make feature planner/reviewer references point to the universal core section explicitly.
- Do not claim feature workflows depend “only” on the universal core unless the read/use contract actually changes to that scoped section.

**Step 2: Realign cleanup surfaces**

- Make cleanup planner/reviewer/implementer/controller references point to:
  - `Universal Plan Core`
  - `Cleanup Overlay`
- Preserve explicit `checklist-linked` vs `standalone remediation` discipline in the cleanup planner and implementer surfaces.

**Step 3: Realign the harness-review surface**

- Update `workflow-harness-review.md` if the standard split or retained anti-pattern list changes what a whole-harness audit must read and judge.
- Keep it as a live production-readiness audit surface, not a stale snapshot of the pre-split standard.

**Step 4: Remove only duplicated cleanup-closeout narration**

- Remove repetition from workflow/launchers only after the standard clearly owns the same rule.
- Keep workflow-level routing and cross-surface invariants in `docs/AGENTIC_DEV_WORKFLOW.md`; do not move routing law into the plan standard.

**Step 5: Re-check mixed-work routing**

- Confirm mixed feature+cleanup work still reads correctly:
  - feature slice follows universal core + feature-specific prompts
  - cleanup slice still carries cleanup overlay requirements

### Task 3: Strengthen The Checker Before Trimming More Prose

**Files:**
- Modify: `docs/plans/README.md`
- Modify: `tools/harness-docs-lib.mjs`
- Modify: `tools/verify-docs.mjs`
- Modify if necessary: `tools/report-plan-conformance.mjs`
- Test: `tools/__tests__/harness-docs-lib.test.mjs`
- Test: `src/__tests__/tools/verifyDocs.test.ts`

**Step 1: Add light substantive checks for critical sections**

- Require non-empty content for:
  - `Planner Self-Check`
  - `Architecture Seam Decision Gate`
  - `Verification Commands`
- Require `Files In Scope` and `Files Out Of Scope` to contain at least one concrete entry.

**Step 2: Strengthen verification-shape checks**

- Require at least one command-looking line in `Verification Commands`.
- Require at least one expected-result line in `Verification Commands`.
- Do not attempt to prove verification adequacy semantically; keep the check structural and reliable.

**Step 3: Add only safe cleanup-overlay checks**

- Require `**Task family:** feature/design|cleanup/refactor` for every serious tracked plan.
- Require `**Cleanup subtype:** checklist-linked|standalone remediation` whenever `Task family` is `cleanup/refactor`.
- Require non-empty `Priority-Exit Readiness` when that section is present.
- For checklist-linked tracked plans discovered from `ARCHITECTURE_CLEANUP_CHECKLIST.md`, require `**Task family:** cleanup/refactor` and `**Cleanup subtype:** checklist-linked`.
- Do not add heuristic cleanup detection beyond these explicit plan fields and checklist-linked references.

**Step 4: Freeze the rollout strategy**

- Update `docs/plans/README.md` in the same pass so the operator-facing active-plan contract stays truthful.
- Immediate rollout rule:
  - the new classification fields become blocking for active serious tracked plans in this slice
  - this is safe only because the current tracked inventory has no other active serious plans in the blocker path beyond this new plan
- If tracked active-plan inventory changes before merge:
  - either migrate the newly blocking tracked plan(s) in the same pass
  - or narrow the checker rule before merge so the rollout remains truthful and bounded
- Do not widen scope by migrating unrelated local-untracked draft plans under `docs/plans/`; they remain outside the tracked blocker surface until intentionally promoted.

**Step 5: Keep the checker small**

- Do not build a semantic linter for plan quality.
- Prefer a few high-value, low-ambiguity checks over a broad rule engine.

### Task 4: Re-verify Workflow Quality And Record Tracked Proof

**Files:**
- Modify/Create: `docs/agentic/evals/baseline-summaries/2026-04-14-*.md`
- Modify only if trigger wording changes: `docs/agentic/evals/README.md`

**Step 1: Run the docs/conformance verification**

- Run the exact docs-verifier commands named below and confirm they pass before any success claim.

**Step 2: Run the required manual eval gates**

- Fresh-session prompt `13-risk-tiered-orchestration-and-local-only-absorption`
  - reason: tracked workflow/control-plane guidance changed materially
  - required scenario: use the feature/design workflow meta-eval scenario from `docs/agentic/evals/README.md` because this slice changes feature-side scoped standard usage as well as cleanup guidance
- Fresh-session prompt `18-detect-unresolved-seam-before-freezing-plan`
  - reason: plan-standard seam/self-check contract changed materially

**Step 3: Record tracked summaries**

- Write the required baseline summary files under `docs/agentic/evals/baseline-summaries/`.
- Keep raw artifacts local-only.

**Step 4: Close out truthfully**

- If prompt `13` or `18` soft-fails/fails, fix the underlying workflow issue before claiming the split improved effectiveness.

## Planner Self-Check

- **Is there any unresolved architecture seam, ownership seam, or collaborator boundary hidden inside the task?**
  - The main seam is already identified: one authority doc with an internal split versus a doc-only heading shuffle. This plan chooses the one-doc split plus owner realignment.
- **Does the plan depend on adjacent files needing contract or type changes that are not in scope?**
  - Only the named workflow docs, prompts, verifier helpers, and verifier tests may change. If another surface becomes necessary, update scope first.
- **Am I declaring any file out of scope that implementation will still rely on?**
  - `docs/agentic/session-prompts/README.md` and `docs/agentic/evals/README.md` are intentionally “modify only if needed” because reference drift may require small truth-surface updates.
- **Did I record the full evidence path plus fallback reads?**
  - Yes. Codanna search plus direct-read fallback are both recorded above.
- **Am I assigning the work to the repo-preferred owner, or quietly growing a hotspot?**
  - Yes. The owner map above freezes the standard as the normative plan-law owner, the workflow doc as routing owner, the launchers as session-behavior owners, and the harness-review prompt as the whole-harness audit owner.
- **Would a fresh session have to invent anything important to finish this safely?**
  - No. The owner map, overlay trigger, feature-side scoped references, and harness-review alignment are now fixed in the plan.
- **Is this truly an execution-grade plan, or does it still hide a design decision?**
  - No hidden design decision remains. The explicit plan-classification fields and rule-owner map replace the earlier ambiguous trigger.

## Architecture Seam Decision Gate

- **Chosen seam:** one tracked standard doc with an internal split plus cross-surface owner realignment.
- **Why this seam is safe:**
  - it separates universal plan law from cleanup-only closeout law
  - it avoids creating a second standards doc
  - it lets feature workflows consume a lighter plan contract without losing cleanup rigor where it matters
- **Rejected seam choices:**
  - doc-only heading cleanup with no launcher/workflow/checker realignment
  - creating a second plan-standard doc or cleanup-standard doc
  - moving all anti-pattern guidance out of the standard with no feature-side replacement
  - adding a large semantic rule engine to the checker
  - leaving cleanup-overlay applicability implicit or reviewer-only
  - trimming cleanup-closeout prose before deciding the rule owner map
- **Stop and re-plan if:**
  - the owner map shows the standard cannot become the primary cleanup-rule owner without making the workflow doc incomplete
  - cleanup-overlay applicability cannot be stated clearly without introducing a second doctrine surface
  - checker strengthening would require brittle heuristics rather than small reliable rules

## Verification Commands

- Run: `npm run plans:check`
  - Expected: `Serious active plan conformance passed.`
- Run: `npm run verify:docs`
  - Expected: `Documentation verification passed.` with passing `test:harness-docs` and `test:verify-docs-contracts`.
- Run: fresh-session manual eval prompt `13-risk-tiered-orchestration-and-local-only-absorption`
  - Expected: `pass`, or a clearly justified fix loop before closeout.
- Run: fresh-session manual eval prompt `18-detect-unresolved-seam-before-freezing-plan`
  - Expected: `pass`, or a clearly justified fix loop before closeout.

## Rollback Notes

- If the split reduces clarity or makes cleanup rules feel optional, revert to the pre-split standard shape and keep only the checker improvements that remain clearly valuable on their own.
- If the checker additions prove noisy or heuristic-driven, keep only the low-ambiguity checks:
  - non-empty critical sections
  - command-looking verification lines
  - expected-result verification lines
- If feature-side prompts become less clear after scoped references, restore whole-standard references before closeout rather than landing a conceptual split that the launchers do not actually support.

## Commit Checkpoints

1. `docs(workflow): split plan standard into universal core and cleanup overlay`
   - standard + workflow/launcher owner realignment only
2. `test(docs): strengthen plan conformance checks`
   - verifier/test surface only
3. `docs(evals): record roi3 workflow-quality summaries`
   - tracked baseline summaries only after prompts `13` and `18` pass
