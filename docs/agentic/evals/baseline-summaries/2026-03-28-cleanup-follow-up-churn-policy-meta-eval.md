# Eval Baseline Summary

## Date

2026-03-28

## Operator / Agent Surface

- Operator: Codex (GPT-5) in repo workspace
- Agent surface: direct workflow/control-plane doc maintenance in the active Lineup session

## Session Metadata

- fresh-session run: `no`
- session id / launcher: existing repo session following P1-W5 implementation review and workflow-policy follow-up request
- repo state note (clean branch/worktree or exception): dirty worktree due unrelated tracked and untracked user files outside this workflow-doc change

## Prompts Run

- [`13-risk-tiered-orchestration-and-local-only-absorption`](../prompts/13-risk-tiered-orchestration-and-local-only-absorption.md)
- scenario: cleanup workflow/control-plane docs were updated to stop repeated `split follow-up` churn when current-code proof retires a slice-owned rationale but detector wording remains stale or broader than the slice

## Codanna Fallback Log

- fallback used: `no`

## Fresh-Session Deviations

- This was not scored from a fresh launcher-only eval session. The operator performed the workflow/control-plane change directly in the active repo session, then recorded the durable workflow lesson in this tracked summary as required by the eval README.
- No raw baseline transcript was promoted. Only this tracked summary was added.

## Outcome Summary

- Result: `pass`
- The change stayed within the lightest valid tier for bounded docs-only workflow work.
- Durable workflow conclusions were absorbed into existing tracked workflow surfaces instead of a new one-off doc.
- Local-only artifact boundaries were preserved; no tracked doc now points at local run bundles or raw eval outputs.
- The updated workflow now distinguishes stale detector residue from live residual debt, keeps one intended final owner for broad imported issue envelopes, and repositions `P#-EXIT` as a reconciliation gate rather than a routine follow-up factory.

## Recurring Misses

- Prior workflow wording let agents treat an unchanged detector issue id as sufficient evidence for another `split follow-up`, even when current code showed the slice-owned rationale was retired.
- Broad imported issue envelopes were not forced to declare one intended final owner early enough, which encouraged repeated reassignment into later exit passes.

## Workflow / Docs / Skills Changed In Response

- Updated workflow routing and closeout guidance:
  - [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../AGENTIC_DEV_WORKFLOW.md)
- Updated serious-plan closeout rules and anti-pattern guidance:
  - [`docs/agentic/plan-authoring-standard.md`](../../plan-authoring-standard.md)
- Updated cleanup checklist execution template and exit policy:
  - [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- Updated cleanup session prompts so planning, implementation, and review treat stale detector residue separately from live residual debt:
  - [`docs/agentic/session-prompts/cleanup-plan.md`](../../session-prompts/cleanup-plan.md)
  - [`docs/agentic/session-prompts/cleanup-implement.md`](../../session-prompts/cleanup-implement.md)
  - [`docs/agentic/session-prompts/cleanup-review.md`](../../session-prompts/cleanup-review.md)

## Durable Lessons Absorbed

- Current-code source audit must outrank stale detector wording when deciding whether a cleanup slice actually retired the rationale it owned.
- Each imported cleanup issue envelope needs one intended final owner before narrow slice work begins.
- `P#-EXIT` should reconcile proof and stale detector output; it should not become the default place to mint another follow-up for the same issue envelope.

## Intentionally Local-Only Artifacts

- Raw operator reasoning, transient terminal output, and this session transcript remain local/session-only.

## Next Follow-Up

- Run a fresh-session adversarial review against the committed workflow/control-plane changes to confirm the new wording resists repeated `split follow-up` churn without encouraging over-broad issue closure.
