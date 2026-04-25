---
name: model-selection
description: Use when a user asks which model or reasoning effort to use for a Lineup task, or when preparing a high-risk handoff that should include a model suggestion for the next session.
---

# Model Selection

## Overview

Use this skill to recommend the cheapest model setup that is still reliable for the next Lineup session.

Default low, escalate only when risk is real.

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
  - if asked: default to the current session model; use `gpt-5.5 medium` for planner/reviewer/implementer when a concrete model is needed
  - for tiny read-heavy sidecars, `gpt-5.4-mini low|medium` is acceptable when speed/cost matters more than deep reasoning
- Score `2-3`
  - include `MODEL_SUGGESTION`
  - planner `gpt-5.5 medium`
  - implementer `gpt-5.5 medium`
  - reviewer `gpt-5.5 high` only if the review must catch hidden architecture mistakes; otherwise `gpt-5.5 medium`
  - use `gpt-5.4` as the fallback when `gpt-5.5` is unavailable in the current surface
- Score `4+` or any Tier 3 hotspot/priority-exit review
  - include `MODEL_SUGGESTION`
  - planner `gpt-5.5 high`
  - implementer `gpt-5.5 medium` by default; use `gpt-5.5 high` when the implementation itself must resolve complex ambiguity, trace edge cases, or repair failing verification
  - reviewer `gpt-5.5 high`
  - use `gpt-5.4 high` as the fallback when `gpt-5.5` is unavailable

## Model And Reasoning Notes

- Start with `gpt-5.5` when it is available for demanding Lineup planning, implementation, and review sessions.
- Use `gpt-5.4` as the fallback when `gpt-5.5` is unavailable or a surface is intentionally pinned during rollout.
- Use `gpt-5.4-mini` for lighter read-heavy sidecars such as broad scans, supporting-document summaries, or simple monitoring when correctness risk is low.
- Keep `gpt-5.3-codex-spark` only for intentionally latency-sensitive, text-only explorer/monitor workflows where the tracked role config already chooses it.
- Treat reasoning effort as a task-fit knob:
  - `low` for straightforward read-only or monitoring work
  - `medium` for most bounded implementation and routine planning
  - `high` for architecture-heavy planning, adversarial review, priority-exit review, ambiguous debugging, or edge-case tracing
  - avoid `xhigh` by default unless an eval or an explicit task need justifies the cost

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
- Forgetting that Codex-optimized models are the default implementer choice for code-heavy sessions
