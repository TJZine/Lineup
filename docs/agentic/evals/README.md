# Agent Evals

## Purpose

This directory defines the tracked regression surface for judging whether the Lineup agent workflow is still producing the behavior the repo expects.

These evals are intentionally lightweight:

- prompt-driven
- repo-specific
- focused on high-signal failure modes

They are not a replacement for product tests. They are a workflow-quality check.

## Seed Sources

Build and refresh eval prompts from:

1. [`docs/agentic/historical-plan-corpus-review.md`](../historical-plan-corpus-review.md)
2. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
3. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md)
4. adversarial shortcut-pressure prompts that test whether agents resist slop under urgency

## Directory Layout

- `prompts/`
  - tracked eval prompt definitions
- `baselines/`
  - local-only baseline run outputs by default
- `baseline-summaries/`
  - tracked baseline summaries only
- [`rubric.md`](./rubric.md)
  - tracked scoring rubric
- [`scorecard-template.md`](./scorecard-template.md)
  - tracked template for manual scoring
- [`baseline-summary-template.md`](./baseline-summary-template.md)
  - tracked template for baseline summaries

## Prompt Inventory

<!-- BEGIN MANAGED EVAL PROMPT INVENTORY -->
- [`01-app-container-extraction-no-ui-drift`](./prompts/01-app-container-extraction-no-ui-drift.md)
  - 01 App Container Extraction No UI Drift
- [`02-lazy-screen-registry-no-dual-ownership`](./prompts/02-lazy-screen-registry-no-dual-ownership.md)
  - 02 Lazy Screen Registry No Dual Ownership
- [`03-overlay-toast-extraction-no-timer-leaks`](./prompts/03-overlay-toast-extraction-no-timer-leaks.md)
  - 03 Overlay Toast Extraction No Timer Leaks
- [`04-diagnostics-surface-isolation-no-storage-slop`](./prompts/04-diagnostics-surface-isolation-no-storage-slop.md)
  - 04 Diagnostics Surface Isolation No Storage Slop
- [`05-app-shell-cleanup-no-behavior-regression`](./prompts/05-app-shell-cleanup-no-behavior-regression.md)
  - 05 App Shell Cleanup No Behavior Regression
- [`06-orchestrator-hotspot-extraction`](./prompts/06-orchestrator-hotspot-extraction.md)
  - 06 Orchestrator Hotspot Extraction
- [`07-settings-storage-boundary`](./prompts/07-settings-storage-boundary.md)
  - 07 Settings Storage Boundary
- [`08-server-selection-storage-boundary`](./prompts/08-server-selection-storage-boundary.md)
  - 08 Server Selection Storage Boundary
- [`09-channel-persistence-boundary`](./prompts/09-channel-persistence-boundary.md)
  - 09 Channel Persistence Boundary
- [`10-settings-screen-split`](./prompts/10-settings-screen-split.md)
  - 10 Settings Screen Split
- [`11-plex-subtitle-policy`](./prompts/11-plex-subtitle-policy.md)
  - 11 Plex Subtitle Policy
- [`12-architecture-doc-refresh`](./prompts/12-architecture-doc-refresh.md)
  - 12 Architecture Doc Refresh
- [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md)
  - 13 Risk-Tiered Orchestration And Local-Only Absorption
- [`14-epg-info-panel-orchestration-no-host-drift`](./prompts/14-epg-info-panel-orchestration-no-host-drift.md)
  - 14 EPG Info-Panel Orchestration No Host Drift
- [`15-channel-setup-session-owner-no-step-controller-bleed`](./prompts/15-channel-setup-session-owner-no-step-controller-bleed.md)
  - 15 Channel Setup Session Owner No Step-Controller Bleed
- [`16-shared-ui-primitives-no-policy-centralization`](./prompts/16-shared-ui-primitives-no-policy-centralization.md)
  - 16 Shared UI Primitives No Policy Centralization
- [`17-priority-4-cleanup-pass-no-premature-glue-removal`](./prompts/17-priority-4-cleanup-pass-no-premature-glue-removal.md)
  - 17 Priority 4 Cleanup Pass No Premature Glue Removal
- [`18-detect-unresolved-seam-before-freezing-plan`](./prompts/18-detect-unresolved-seam-before-freezing-plan.md)
  - 18 Detect Unresolved Seam Before Freezing Plan
- [`19-multi-agent-role-selection-and-delegation-discipline`](./prompts/19-multi-agent-role-selection-and-delegation-discipline.md)
  - 19 Multi-Agent Role Selection And Delegation Discipline
- [`20-skill-routing-interface-vs-frontend`](./prompts/20-skill-routing-interface-vs-frontend.md)
  - 20 Skill Routing Interface-vs-Frontend
- [`21-model-role-routing-cost-effectiveness`](./prompts/21-model-role-routing-cost-effectiveness.md)
  - 21 Model Role Routing Cost Effectiveness
- [`22-planner-escalation-and-plan-critique-boundaries`](./prompts/22-planner-escalation-and-plan-critique-boundaries.md)
  - 22 Planner Escalation And Plan Critique Boundaries
- [`23-reviewer-specialization-effectiveness`](./prompts/23-reviewer-specialization-effectiveness.md)
  - 23 Reviewer Specialization Effectiveness
<!-- END MANAGED EVAL PROMPT INVENTORY -->

## How To Run A Manual Eval

1. Start from a clean worktree or clean branch.
2. Use one prompt file as the task input.
3. Start a fresh session for each prompt you score.
4. Record the agent surface used.
5. Record ROLE / MODEL / REASONING_EFFORT, task family, tier, risk score, verification results, review finding counts, rework rounds, wall time, and observed token/credit/cost data when available.
6. Treat exact model and reasoning-effort entries as observed/operator-recorded evidence only; do not claim mechanical verification unless the surface actually exposes it.
7. Record whether the expected skills and Codanna workflow were actually used.
8. If Codanna fallback is used, log the exact invocation, acceptable condition, and fallback evidence path.
9. Score only fresh-session runs or explicitly logged Codanna-fallback runs.
10. Score the run with [`rubric.md`](./rubric.md) and [`scorecard-template.md`](./scorecard-template.md).
11. Write one tracked summary file under [`docs/agentic/evals/baseline-summaries/`](./baseline-summaries/README.md) using [`baseline-summary-template.md`](./baseline-summary-template.md), including fallback usage and fresh-session deviations.
12. Keep raw baseline artifacts local-only unless they are intentionally promoted later.

For the first manual baseline, run only these prompts in this order:

1. [`01-app-container-extraction-no-ui-drift`](./prompts/01-app-container-extraction-no-ui-drift.md)
2. [`03-overlay-toast-extraction-no-timer-leaks`](./prompts/03-overlay-toast-extraction-no-timer-leaks.md)
3. [`04-diagnostics-surface-isolation-no-storage-slop`](./prompts/04-diagnostics-surface-isolation-no-storage-slop.md)
4. [`07-settings-storage-boundary`](./prompts/07-settings-storage-boundary.md)
5. [`11-plex-subtitle-policy`](./prompts/11-plex-subtitle-policy.md)
6. [`12-architecture-doc-refresh`](./prompts/12-architecture-doc-refresh.md)

Do not run all tracked prompts in the first baseline.

Run [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md) whenever the workflow/control-plane changes materially.

Run [`19-multi-agent-role-selection-and-delegation-discipline`](./prompts/19-multi-agent-role-selection-and-delegation-discipline.md) whenever tracked multi-agent role guidance, repo-local subagent routing guidance, or `.codex/config.toml` role declarations change materially.

Run [`21-model-role-routing-cost-effectiveness`](./prompts/21-model-role-routing-cost-effectiveness.md), [`22-planner-escalation-and-plan-critique-boundaries`](./prompts/22-planner-escalation-and-plan-critique-boundaries.md), and/or [`23-reviewer-specialization-effectiveness`](./prompts/23-reviewer-specialization-effectiveness.md) whenever tracked role/model routing, reasoning-effort guidance, reviewer specialization, or cost-effectiveness policy changes materially. Combine these with [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md) for orchestration-tier policy changes and [`19-multi-agent-role-selection-and-delegation-discipline`](./prompts/19-multi-agent-role-selection-and-delegation-discipline.md) for delegation-role changes.

When workflow/control-plane changes touch settings ownership boundaries, also run [`10-settings-screen-split`](./prompts/10-settings-screen-split.md) in the same manual baseline pass.

Priority 4 prompt additions can be run as a second manual baseline when validating UI-class decomposition and cleanup-pass behavior:

- [`10-settings-screen-split`](./prompts/10-settings-screen-split.md)
- [`14-epg-info-panel-orchestration-no-host-drift`](./prompts/14-epg-info-panel-orchestration-no-host-drift.md)
- [`15-channel-setup-session-owner-no-step-controller-bleed`](./prompts/15-channel-setup-session-owner-no-step-controller-bleed.md)
- [`16-shared-ui-primitives-no-policy-centralization`](./prompts/16-shared-ui-primitives-no-policy-centralization.md)
- [`17-priority-4-cleanup-pass-no-premature-glue-removal`](./prompts/17-priority-4-cleanup-pass-no-premature-glue-removal.md)
- [`18-detect-unresolved-seam-before-freezing-plan`](./prompts/18-detect-unresolved-seam-before-freezing-plan.md)

Note: [`10-settings-screen-split`](./prompts/10-settings-screen-split.md) is an ad-hoc trigger prompt.
Run it whenever a change touches settings ownership boundaries (even outside the Priority 4 batch).
It may also be included again later as part of the Priority 4 manual baseline when you want broader UI-class decomposition validation; running it in both contexts is allowed when appropriate.

## Trigger-Based Eval Runs

Use this table as the operational trigger map for control-plane and boundary-skill maintenance work.

| Change surface | Required prompt(s) | Notes |
| --- | --- | --- |
| tracked workflow/control-plane docs change materially | [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md) | Baseline workflow gate for routing, tiering, and local-only absorption. |
| launcher routing or feature-vs-cleanup guidance changes materially | [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md) | Use the feature/design workflow meta-eval scenario below when feature launchers or routing guidance changed. |
| tracked workflow-critical skill topology changes materially | [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md) | Validates canonical repo-local skill-topology ownership under `.agents/skills/`; also run [`19-multi-agent-role-selection-and-delegation-discipline`](./prompts/19-multi-agent-role-selection-and-delegation-discipline.md) when the change affects subagent/delegation routing. |
| tracked multi-agent role guidance, repo-local subagent skill/routing guidance, skill-topology policy, or `.codex/config.toml` role declarations change materially | [`19-multi-agent-role-selection-and-delegation-discipline`](./prompts/19-multi-agent-role-selection-and-delegation-discipline.md) | Required before claiming delegation-policy or role-surface improvements. |
| tracked role/model routing, reasoning-effort, or cost-effectiveness policy changes materially | [`21-model-role-routing-cost-effectiveness`](./prompts/21-model-role-routing-cost-effectiveness.md), plus [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md) and/or [`19-multi-agent-role-selection-and-delegation-discipline`](./prompts/19-multi-agent-role-selection-and-delegation-discipline.md) when tiering or delegation also changed | Record ROLE / MODEL / REASONING_EFFORT manually from the surface used; do not treat exact model identity as mechanically verified unless exposed by the tool. |
| planner escalation, deep-planner trigger, plan-critique, or GPT-5.6 planning guidance changes materially | [`22-planner-escalation-and-plan-critique-boundaries`](./prompts/22-planner-escalation-and-plan-critique-boundaries.md), plus [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md) when orchestration tiering changed | Confirms normal Tier 2 planning stays on `planner` `gpt-5.6-sol` medium and hotspot/priority-exit/unresolved seams escalate to `planner_deep`; critique-only reviewer roles remain advisory rather than primary planning. |
| reviewer specialization or review role routing changes materially | [`23-reviewer-specialization-effectiveness`](./prompts/23-reviewer-specialization-effectiveness.md), plus [`19-multi-agent-role-selection-and-delegation-discipline`](./prompts/19-multi-agent-role-selection-and-delegation-discipline.md) when delegation-role policy also changed | Confirms maintainability/code-health review routes to `maintainability_reviewer`, hotspot/boundary/security-adjacent review routes to `architecture_reviewer`, and normal correctness review stays on `reviewer`. |
| `architecture-boundaries` changes materially | [`06-orchestrator-hotspot-extraction`](./prompts/06-orchestrator-hotspot-extraction.md) or [`12-architecture-doc-refresh`](./prompts/12-architecture-doc-refresh.md) | If the change hardens seam/planning discipline, also run [`18-detect-unresolved-seam-before-freezing-plan`](./prompts/18-detect-unresolved-seam-before-freezing-plan.md). |
| `persistence-boundaries` changes materially | one or more of [`07-settings-storage-boundary`](./prompts/07-settings-storage-boundary.md), [`08-server-selection-storage-boundary`](./prompts/08-server-selection-storage-boundary.md), [`09-channel-persistence-boundary`](./prompts/09-channel-persistence-boundary.md) | If the change touches settings ownership guidance, also run [`10-settings-screen-split`](./prompts/10-settings-screen-split.md). |
| `ui-composition-patterns` changes materially | one or more of [`03-overlay-toast-extraction-no-timer-leaks`](./prompts/03-overlay-toast-extraction-no-timer-leaks.md), [`14-epg-info-panel-orchestration-no-host-drift`](./prompts/14-epg-info-panel-orchestration-no-host-drift.md), [`16-shared-ui-primitives-no-policy-centralization`](./prompts/16-shared-ui-primitives-no-policy-centralization.md) | If the change touches global UI-skill routing guidance, also run [`20-skill-routing-interface-vs-frontend`](./prompts/20-skill-routing-interface-vs-frontend.md). |
| `plex-integration-boundaries` changes materially | [`11-plex-subtitle-policy`](./prompts/11-plex-subtitle-policy.md) | Add a broader Plex-boundary eval when a tracked prompt exists for the exact policy seam changed. |

The operator may run more prompts than the minimum trigger set. The minimum exists to make workflow-quality changes auditable, not to cap validation.

### Feature/Design Workflow Meta-Eval

This is a reusable meta-eval template. Adapt the scenario and inputs to the specific workflow/control-plane change you are validating. Dated run records belong under `baseline-summaries/`.

When routing or launcher guidance for feature/design work changes, run a targeted meta-eval in a fresh session:

1. Use prompt `13-risk-tiered-orchestration-and-local-only-absorption`.
2. Use a scenario that forces explicit routing among cleanup/refactor vs feature/design vs mixed.
3. Require the agent to choose task family first, then orchestration tier.
4. Verify success criteria focus on tracked docs/workflow behavior only:
   - correct routing choice
   - correct tier choice
   - no local-only artifact promotion mistakes
5. Treat optional launcher naming or local launcher convenience drift as out of scope for tracked success criteria (example: global launcher naming).
6. Record the result in one tracked file under [`baseline-summaries/`](./baseline-summaries/README.md) and keep raw artifacts local-only.

#### Examples

Archival records live under [`baseline-summaries/`](./baseline-summaries/README.md).

- [`baseline-summaries/2026-03-06-feature-design-workflow-rollout-meta-eval.md`](./baseline-summaries/2026-03-06-feature-design-workflow-rollout-meta-eval.md)

## Scoring Model

Use the rubric outcomes only:

- `pass`
- `soft-fail`
- `fail`

Score dimensions live in [`rubric.md`](./rubric.md).

## Tracked Vs Local

Tracked:

- prompt definitions
- rubric
- scorecard template
- baseline summary template
- baseline summary files

Local-only by default:

- most baseline outputs under `docs/agentic/evals/baselines/`
- raw run transcripts
- temporary comparison notes

Promote only short durable summaries when recurring failures justify a tracked workflow change.

Archived section summaries can also recommend eval follow-up through their `Harness Ingestion Triage` block. When a summary marks `recommended action: targeted-eval`, either absorb the lesson into a tracked baseline summary in the same pass or defer it explicitly with the local-only holding-note convention under `docs/runs/<date>-harness-ingestion-triage/`.

## Ownership And Cadence

- The operator who runs the baseline owns writing the tracked summary in the same pass.
- During active cleanup, rerun the seed baseline after a material harness/control-plane change and at least once per month.
- If a baseline changes the workflow conclusion, update the relevant tracked doc or skill guidance before closeout.
- For this meta-eval, the operator must include date, prompt(s) run, result, main misses, and workflow/docs changed in response in the tracked summary.

Manual baseline protocol:

- use a fresh session per prompt
- start from repo root each time
- do not reuse prompt threads
- log Codanna fallback usage explicitly when it happens
- treat scoring as valid only for fresh-session runs or explicitly logged fallback runs
- store raw result artifacts locally under `docs/agentic/evals/baselines/`
- do not commit raw baseline files
- close out the run by recording:
  - the durable lesson learned
  - which tracked doc absorbed it
  - which raw artifacts remain intentionally local-only
