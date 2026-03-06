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

- `using-superpowers`
- `brainstorming`
- `verification-before-completion`

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
