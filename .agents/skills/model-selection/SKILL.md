---
name: model-selection
description: Use when a user asks which model or reasoning effort to use for a Lineup task, or when preparing a high-risk handoff that should include a model suggestion for the next session.
---

# Model Selection

## Overview

Use this skill to recommend the cheapest model setup that is still reliable for the next Lineup session.

Default to the tracked Sol role for normal work. Use the cheaper Luna worker
only when the execution unit is explicitly eligible, exact, bounded, and cheap
to verify.

## Use This Skill For

- Explicit asks like "what model should I use for this plan?"
- Preparing a handoff for Tier 3 work
- Preparing a handoff where architecture-risk score is `>= 2`
- Architecture-heavy planning or review around hotspots, ownership moves, or priority-exit gates

Do not use this skill for every routine handoff. Tier 1 and low-risk Tier 2 work should usually omit model advice to save tokens.

## Risk Score

Start at `0` and add `+1` for each:

- hotspot file or composition root involved
- ownership move or cross-module wiring change
- more than one repo-local boundary skill applies
- priority-exit, checklist, or merge-blocking review consequence
- mixed routing ambiguity or likely hidden dependency

## Recommendation Rules

- Score `0-1`
  - omit `MODEL_SUGGESTION` unless the user explicitly asked
  - if asked: use tracked `planner` (`gpt-5.6-sol medium`), tracked `worker` (`gpt-5.6-sol medium`), and tracked `reviewer` (`gpt-5.6-sol high`) when concrete roles are needed
  - planning default: tracked `planner` (`gpt-5.6-sol medium`)
  - implementation default: tracked `worker` (`gpt-5.6-sol medium`)
  - use `worker_luna` (`gpt-5.6-luna xhigh`) only when the approved `CURRENT_EXECUTION_PACKET` explicitly declares `IMPLEMENTER_ROLE_ELIGIBILITY: worker_luna` and the unit is exact, bounded, and cheap to verify
  - for tiny read-heavy sidecars, `gpt-5.6-luna low|medium` is acceptable when speed/cost matters more than deep reasoning
- Score `2-3`
  - include `MODEL_SUGGESTION`
  - planner `gpt-5.6-sol medium` by default
  - planner `gpt-5.6-sol high` can be recommended as a direct model override for ambiguous Tier 2 work or moderate architecture risk when `planner_deep` would be disproportionate
  - implementer `gpt-5.6-sol medium`
  - implementer `gpt-5.6-luna xhigh` through `worker_luna` only for approved, bounded, exact, cheap-to-verify units with explicit stop/escalation rules
  - reviewer `gpt-5.6-sol high` through the tracked `reviewer` role for normal adversarial review
  - use `maintainability_reviewer` (`gpt-5.6-sol xhigh`) for code-health, slop, file-shape, test-brittleness, or maintainability-only review
- Score `4+` or any Tier 3 hotspot/priority-exit review
  - include `MODEL_SUGGESTION`
  - planner `planner_deep` (`gpt-5.6-sol xhigh`) for Tier 3, hotspot, priority-exit, cross-boundary, unresolved architecture/product seam, or security-adjacent planning
  - implementer `gpt-5.6-sol medium` by default; use `gpt-5.6-sol high` when the implementation itself must resolve complex ambiguity, trace edge cases, or repair failing verification
  - reviewer `architecture_reviewer` (`gpt-5.6-sol xhigh`) for hotspot, boundary, persistence, Plex, UI composition/focus/navigation, public contract, priority-exit, or security-adjacent architecture review
  - use `maintainability_reviewer` (`gpt-5.6-sol xhigh`) for plan critique or maintainability/code-health review; do not use it as authoritative primary planning

## Model And Reasoning Notes

- Use `gpt-5.6-sol` for demanding Lineup planning, normal implementation, and review sessions.
- Use `gpt-5.6-luna xhigh` through `worker_luna` for approved, bounded, exact, cheap-to-verify execution units.
- Use `gpt-5.6-luna high` for documentation research and `gpt-5.6-luna xhigh` for the explorer fallback.
- Use `gpt-5.6-luna low` for the monitor fallback and Luna for lighter read-heavy sidecars when correctness risk is low.
- Keep `gpt-5.3-codex-spark` only for intentionally latency-sensitive, text-only explorer/monitor workflows where the tracked role config already chooses it.
- Treat reasoning effort as a task-fit knob:
  - `low` for straightforward read-only or monitoring work
  - `medium` for most bounded implementation and routine planning
  - `high` for `docs_researcher`, architecture-heavy planning, adversarial review, priority-exit review, ambiguous debugging, or edge-case tracing
  - `xhigh` for `worker_luna`, `explorer_fallback`, `planner_deep`, `architecture_reviewer`, and `maintainability_reviewer` when their explicit routing triggers apply
- Planning policy:
  - use tracked `planner` (`gpt-5.6-sol medium`) by default
  - use `gpt-5.6-sol high` only as a direct model override escalation for ambiguous Tier 2 or moderate architecture-risk planning
  - use tracked `planner_deep` (`gpt-5.6-sol xhigh`) for Tier 3, hotspot, priority-exit, cross-boundary, unresolved seam, or security-adjacent planning
  - do not use critique-only reviewer roles as authoritative primary planning
- Low-execution-ready applies only to feature/design implementation units whose `CURRENT_EXECUTION_PACKET` explicitly freezes `IMPLEMENTER_REASONING_ELIGIBILITY: low` and includes all of:
  - `LOW_ELIGIBLE_IF`
  - `ESCALATE_TO_MEDIUM_IF`
  - `STOP_AND_REPLAN_IF`
  - bounded write scope with exact files/scope
  - explicit verification
  - no unresolved product, design, or architecture decision
  - no cross-module ownership move
  - no ambiguous debugging or root-cause work
  - no security, auth, persistence, or token-sensitive change
  - no priority-exit or checklist-closeout consequence
- Escalate implementer reasoning to `medium` or `high` when the work requires local judgment, architecture seam decisions, UX/product interpretation, failing verification repair, cross-module work, Plex/navigation/Orchestrator/high-risk UI changes, cleanup/refactor execution, or scope is unclear.
- `worker_luna` eligibility requires `IMPLEMENTER_ROLE_ELIGIBILITY: worker_luna` or an eligibility set containing `worker_luna`, exact files, exact constraints, explicit verification, and stop/replan triggers; stop on ambiguity, plan contradiction, scope expansion, unexpected cross-boundary coupling, or verification failure needing diagnosis.
- Keep planner and reviewer recommendations stronger than implementer recommendations. Do not recommend `low` for adversarial review or serious planning.
- `cleanup_worker` and cleanup/refactor implementers remain `gpt-5.6-sol medium` by default; route only explicitly exact, bounded, cheap-to-verify cleanup units to `worker_luna`.
- Keep Luna `xhigh` as the tracked baseline for `worker_luna` and `explorer_fallback`, and Luna `high` for `docs_researcher`. Compare one level lower on representative tasks only when quality remains stable. Reserve `max` for measured quality-first cases where `xhigh` is insufficient; do not make `max` or host-specific `ultra` a tracked default.
- Use `gpt-5.5` at the same effort as the reliability fallback for Sol/Luna roles when GPT-5.6 is unavailable. Use `gpt-5.4-mini` only for low-risk cost-sensitive work that would otherwise use a lightweight Luna role.

## Handoff Format

  When the trigger applies, place this block immediately before `NEXT_SESSION_HANDOFF`:

  ```text
  MODEL_SUGGESTION
  PLANNER: <model or n/a>
  IMPLEMENTER: <model or n/a>
  REVIEWER: <model or n/a>
  WHY: <short reason tied to risk signals>
```

Use `n/a` for roles that are not part of the next session.

## Common Mistakes

- Emitting model advice for every handoff
- Using `high` just because work is important instead of because the reasoning problem is hard
- Recommending mini models for ambiguous architecture work only because a later review exists
- Using `worker_luna` for ordinary or ambiguous implementation only to save cost
- Using `maintainability_reviewer` as the authoritative primary planner
