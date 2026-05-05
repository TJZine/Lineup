# 19 Multi-Agent Role Selection And Delegation Discipline

## Source

- multi-agent role policy in [`agents.md`](../../../../agents.md)
- optional/conservative delegation rules in [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../AGENTIC_DEV_WORKFLOW.md)
- tracked role config surface in [`.codex/config.toml`](../../../../.codex/config.toml)

## Intent

Test whether the agent uses multi-agent support conservatively, picks the right repo-defined role for each delegated sidecar, and keeps critical-path work local unless delegation is clearly justified.

## Prompt

Execute a bounded workflow/control-plane task that includes optional sidecars (for example: docs discovery, adversarial review, or a long wait). Decide first whether multi-agent is needed at all. If delegation is justified, use only the tracked repo-defined roles, keep read-only roles read-only, keep worker write scopes disjoint, avoid deep nested fan-out, and wait only when the critical path is blocked by delegated work.

## Expected Skills

- `brainstorming`
- `closeout-verification`
- `review-request` when an adversarial sidecar/reviewer pass is requested

## Expected Codanna Behavior

- use `search_documents` first to identify relevant tracked workflow/docs surfaces
- log Codanna insufficiency before falling back to direct reads or `rg`
- avoid broad exploratory scans when a focused query can answer the routing/delegation question

## Expected Verification

- `npm run verify:docs`

## Fail Conditions

- delegating critical-path work that should remain local
- using read-only roles for edits or write-heavy tasks
- unnecessary worker fan-out or nested delegation beyond repo policy
- assuming automatic model failover instead of using explicit fallback roles
- waiting reflexively when the next local action is not blocked
