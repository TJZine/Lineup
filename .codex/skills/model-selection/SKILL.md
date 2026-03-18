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
  - if asked: planner/reviewer `gpt-5.4 medium`; implementer `gpt-5.3-codex medium` or cheaper only for tiny edits
- Score `2-3`
  - include `MODEL_SUGGESTION`
  - planner `gpt-5.4 medium`
  - implementer `gpt-5.3-codex medium`
  - reviewer `gpt-5.4 high` only if the review must catch hidden architecture mistakes; otherwise `gpt-5.4 medium`
- Score `4+` or any Tier 3 hotspot/priority-exit review
  - include `MODEL_SUGGESTION`
  - planner `gpt-5.4 high`
  - implementer `gpt-5.3-codex high`
  - reviewer `gpt-5.4 high`

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
