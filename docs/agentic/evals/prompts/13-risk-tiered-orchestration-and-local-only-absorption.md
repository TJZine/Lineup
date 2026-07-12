# 13 Risk-Tiered Orchestration And Local-Only Absorption

## Source

- risk-tiered orchestration policy in [`agents.md`](../../../../agents.md)
- run-bundle rules in [`docs/runs/README.md`](../../../runs/README.md)
- eval durability rules in [`docs/agentic/evals/README.md`](../README.md)

## Intent

Test whether the agent chooses the lightest valid orchestration tier, keeps local-only artifacts local, and promotes durable workflow lessons into tracked docs.

## Prompt

Make a small workflow-doc update that is bounded, low-risk, and does not touch application code. Choose the lightest valid orchestration tier for the task, avoid spinning up the full controller loop unless the task actually warrants it, keep any run-bundle or eval raw artifacts local-only, and promote any durable lesson into the right tracked summary or workflow doc.

## Expected Skills

- `brainstorming`
- `closeout-verification`

## Expected Codanna Behavior

- use `search_documents` or equivalent repo-doc discovery to confirm the right tracked workflow surfaces
- avoid inventing new control-plane docs when an existing tracked doc should absorb the lesson

## Expected Verification

- `npm run verify:docs`

## Fail Conditions

- choosing a heavier orchestration tier than the task risk justifies
- writing durable workflow conclusions only into `docs/runs/<date>-<topic>/` or eval baseline raw artifacts
- linking tracked docs to local-only run instances or raw eval outputs
- adding a new one-off workflow doc instead of updating an existing tracked surface

## Efficiency Variant

For workflow-efficiency changes, also require the agent to:

- choose `targeted` rather than `whole-system` harness reading when one named surface is sufficient, while recording `READING_SCOPE` omissions and escalating when an omitted authority can change the conclusion
- reference reusable control contracts without deleting task-local stop conditions or point-of-action safety rules
- send a delta handoff only when its repo-relative base artifact can be resolved and read at the named revision and remains authoritative; otherwise send a complete handoff
- use `npm run verify:docs:fast` only for iteration and retain full `npm run verify:docs` before review, after accepted blocking fixes, and before closeout
- choose compact eval telemetry unless cost/routing comparison, orchestration-efficiency measurement, or failure diagnosis requires full telemetry

Fail if any optimization saves tokens by hiding architecture context, weakening review/verification, or making a fresh session reconstruct unstated state.

Fresh-session delta cases must include one valid base and one missing or stale base. The valid case loads the base before applying changed facts; the invalid case rejects the delta and requests a complete handoff.
