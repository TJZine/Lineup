# Eval Baseline Summary

**Summary mode:** `full telemetry`

## Date

2026-07-11

## Operator / Agent Surface

Codex desktop main session, RP-02 replay against the revised cleanup-loop diff.

## Session Metadata

- fresh-session run: `yes`
- session id / launcher: bounded fresh prompt-24 eval subagent
- repo state note: existing unrelated dirty files were preserved; no product code changed
- ROLE / MODEL / REASONING_EFFORT: primary agent / runtime identity not exposed / high
- task family / tier / risk score: cleanup/refactor protocol meta-eval / Tier 3 / architecture risk 4
- telemetry note: exact reasoning-token telemetry was not exposed

## Prompts Run

- `24-cleanup-loop-review-budget-and-boundary-sweep`

## Verification Commands / Results

- command: source review of the local RP-02 remediation-program and execution-plan artifacts plus commit `ff9cfc422f39bf7c9973065ab9a828e57a171a13`
- observed result: the program brief scoped RP-02 mainly to auth, while the final fix required 20 files spanning auth, initialization, Orchestrator tests, and API/architecture docs
- command: protocol scenario replay against the revised launcher
- observed result: consolidated nested-validation/startup/server-metadata findings consume one revision; a later second cross-boundary startup flaw enters `scope-reset`; mechanical-only corrections preserve review state; override preserves implementation gates

## Review / Rework Telemetry

- review findings count: 3 consolidated architecture/seam findings plus 2 mechanical findings in the injected case
- blocking findings count: 3 architecture/seam findings
- accepted findings count: 5
- rework rounds: 1 normal revision, then scope reset in the high-risk variant; 1 mechanical closure in the control variant
- wall time: observed in the active session, not separately instrumented
- observed token / credit / cost data when available: unavailable

## Codanna Fallback Log

- fallback used: `yes`
- if yes: Codanna was not exposed; direct file reads, `rg`, commit inspection, and diff review supplied the source/caller/side-effect evidence

## Fresh-Session Deviations

- Runtime role/model identity was not exposed; no Luna identity is claimed.
- Codanna was unavailable, so focused `rg` and direct authoritative reads were logged as fallback.

## Outcome Summary

Pass with logged deviation. The revised state machine preserves RP-02-class discovery through a mandatory matrix-shaped holistic sweep and consolidated initial review, while eliminating duplicate package-master-plan authorship, serial mechanical rereviews, and default double-clean gates for both unchanged plan and implementation artifacts. Material public-contract or reviewed-surface implementation changes still require one fresh final reviewer.

## Recurring Misses

- Current verifier enforcement is marker-based; behavioral protection remains primarily in prompt 24 and adversarial review.

## Workflow / Docs / Skills Changed In Response

- Workflow and launcher now define program-plan authority, compact addenda, holistic sweep, finding classes, one normal revision, scope reset, closure selection, override semantics, and sequential package closeout.
- Review and planning skills carry the same packet and adjudication rules.
- Verifier and eval inventory enforce presence and regression coverage.

## Durable Lessons Absorbed

- RP-02 needed broader first-pass discovery, not a larger package plan or more serial reviewers.

## Intentionally Local-Only Artifacts

- The detailed RP-02 plan and remediation program remain local run-bundle evidence.

## Next Follow-Up

- Apply the revised protocol to RP-03 only in a separate sequential package session after maintainer selection.
