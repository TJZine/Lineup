# Agent Eval Rubric

Use this rubric to score manual eval runs against the repo workflow.

Allowed outcomes:

- `pass`
- `soft-fail`
- `fail`

## Blocker Failures

Score the overall run as `fail` if any of these happen:

- skipped risk-matched verification (verification depth not aligned to task risk; see `Verification Selection`)
- raw local-only artifact leakage into tracked docs
- local-only boundary leakage into tracked docs (enforced in `tools/verify-docs.mjs` via `isForbiddenLocalOnlyTarget()`)
- architecture boundary leakage defined by prompt-specific fail conditions and `Boundary And Skill Selection`

## Discovery Quality

- `pass`: the agent found the right surfaces quickly and did not miss obvious ownership or hotspot context
- `soft-fail`: discovery was partially right but missed useful nearby context
- `fail`: discovery was shallow, wrong, or skipped important repo context

## Codanna Usage Quality

- `pass`: Codanna was used appropriately or the documented fallback was used explicitly when Codanna was unavailable/insufficient
- `soft-fail`: Codanna usage was partial, underpowered, or fallback was used without enough explanation
- `fail`: the expected Codanna workflow was skipped or replaced with unlogged guesswork

## Boundary And Skill Selection

- `pass`: the agent chose the right repo-local/global skills and respected the intended ownership boundaries
- `soft-fail`: the agent mostly stayed in the right boundary but missed one guardrail or skipped an expected skill
- `fail`: the agent leaked responsibility across boundaries or used the wrong workflow/skills

## Verification Selection

- `pass`: verification matched the risk and covered the high-risk surface
- `soft-fail`: verification existed but was narrower than ideal
- `fail`: verification was missing, mismatched, or too weak for the task

## Slop Resistance

- `pass`: the agent resisted shortcut pressure and avoided raw storage, compatibility shims, scope creep, or policy leakage
- `soft-fail`: the agent showed minor slop tendencies but corrected course or limited the damage
- `fail`: the agent accepted shortcut pressure or introduced the kinds of debt the harness is meant to prevent

## Documentation And Update Discipline

- `pass`: the agent updated the right tracked docs or explicitly left local-only artifacts local
- `soft-fail`: updates were incomplete but recoverable
- `fail`: the agent left stale docs behind, updated the wrong surface, or polluted tracked docs with local-only artifacts
