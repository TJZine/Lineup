# Eval Baseline Summary

## Date

- `2026-04-14`

## Operator / Agent Surface

- operator: Codex main session coordinating fresh subagents
- eval run surface: fresh spawned subagent (`Newton`)

## Session Metadata

- fresh-session run: `yes`
- session id / launcher: spawned fresh eval subagent for prompt `13-risk-tiered-orchestration-and-local-only-absorption`
- repo state note (clean branch/worktree or exception): isolated worktree at `control-plane-authority-simplification`; docs-only branch with narrow in-flight authority-simplification edits plus one pre-existing verifier-unblock plan conformance repair

## Prompts Run

- `13-risk-tiered-orchestration-and-local-only-absorption`
- scenario adaptation from the then-active authority-simplification execution plan:
  - real task: cleanup-only control-plane authority simplification with no runtime code changes
  - distractors: one feature/design task and one mixed docs-plus-runtime task
  - local-only artifact absorption note included explicitly

## Codanna Fallback Log

- fallback used: `no`
- if yes: exact invocation, condition, and evidence captured

## Fresh-Session Deviations

- used a fresh spawned subagent rather than a separate human-launched Codex session; scored as a fresh-session proxy because the agent started with only the eval prompt/context for this run
- tool-by-tool transcript was not preserved separately as a raw baseline artifact; scoring is based on the subagent’s explicit routing/output and the repo evidence it surfaced

## Outcome Summary

- result: `pass`
- the eval agent correctly chose `cleanup/refactor` rather than feature/design or mixed
- the eval agent chose `Tier 1`, which matches the lightest valid tier for a small bounded docs/workflow slice
- the eval agent did not treat `docs/agentic/document-map.md` as a primary authority surface
- the eval agent preserved tracked-vs-local absorption discipline by keeping raw `docs/runs/*` / eval artifacts local-only and promoting only durable lessons into tracked docs or tracked eval summaries
- the eval agent also surfaced one additional live tracked consumer that the current implementation plan had missed: one older retained `P2-W4` cleanup plan still required `document-map.md` in its read order

## Recurring Misses

- plan-side consumer inventories can still miss older active tracked plans even when the top-level control-plane surfaces and launcher docs are already aligned

## Workflow / Docs / Skills Changed In Response

- updated remaining stale authority consumers to point at `docs/AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles`:
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - `docs/agentic/skill-strategy.md`
  - the older retained `P2-W4` cleanup plan that still routed through `document-map.md`
- recorded this eval summary:
  - `docs/agentic/evals/baseline-summaries/2026-04-14-workflow-authority-simplification-meta-eval.md`

## Durable Lessons Absorbed

- for authority-simplification work, do not stop after top-level docs and launcher surfaces; sweep active tracked plans for stale `document-map.md` authority hops too
- prompt `13` is useful as a routing/meta-discipline gate for control-plane simplification because it catches both over-tiering and missed tracked-vs-local promotion rules

## Intentionally Local-Only Artifacts

- no tracked raw eval transcript committed
- no `docs/runs/*` artifact promoted as tracked truth in this pass

## Next Follow-Up

- none required for this slice beyond normal review/merge flow
