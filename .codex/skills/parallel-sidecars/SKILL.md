---
name: parallel-sidecars
description: Use when a Lineup task has optional sidecars that can run independently of the immediate critical path, such as focused exploration, adversarial review, docs verification, or long waits.
---

# Parallel Sidecars

## Overview

Use this skill to keep the main task moving locally while delegating bounded sidecars to the tracked Codex role set.

Default to no delegation. Delegate only when the sidecar is real, independent, and not the next blocking step.

## Use This Skill For

- Focused code or repo-doc discovery that does not block the next local action
- Adversarial review of a plan, diff, or workflow artifact after the main session already knows the target
- Official-doc verification through `docs_researcher` when the main session can keep working in parallel
- Long waits, polling, or status checks through `monitor`

## Do Not Use This Skill For

- The immediate next blocking task
- Tasks with overlapping write scopes
- Unresolved planning, routing, or ownership decisions
- Broad exploratory fan-out because the controller has not thought through the problem yet
- Small convenience questions that do not materially improve reliability or throughput
- Any edit that should stay local or should instead use `bounded-worker-execution`

## Decision Gate

Delegate only when all of these are true:

1. the main session already knows the exact sub-question or output it needs
2. the sidecar can finish without changing the next local step's write scope
3. the sidecar can run with one tracked role
4. delegating it will materially improve reliability, throughput, or both
5. the main session has meaningful non-overlapping work to do immediately

If any item is false, keep the work local.

## Role Routing

- `explorer`
  - focused repo discovery, symbol tracing, implementation reconnaissance
- `explorer_fallback`
  - same job as `explorer` when the primary explorer path is unavailable or constrained
- `reviewer`
  - adversarial review for correctness, regressions, security, and missing tests
- `docs_researcher`
  - official external-doc verification
- `monitor`
  - waits, polling, background verification, status checks
- `monitor_fallback`
  - same job as `monitor` when the primary monitor path is unavailable or constrained

Do not route edits through read-only roles.

If the task needs a write-capable sidecar, stop and decide whether `bounded-worker-execution` applies instead.

## Dispatch Pattern

1. Decide whether delegation is justified at all.
2. Write one exact ask.
   - one problem
   - one role
   - one concrete output
3. Pass only the context the sidecar needs.
   - relevant files
   - plan path or diff target
   - exact question to answer
4. Keep the critical path local.
5. Wait only when the next local step is blocked by the sidecar result.
6. Verify the sidecar output locally before treating it as truth.

## Prompt Shape

Use a prompt that makes the sidecar's contract explicit:

- task
- exact artifact(s) to inspect
- constraints
- expected output
- explicit read-only or no-edit reminder when the role is read-only

Example:

```text
Review this tracked workflow diff for real risks only.

Inspect:
- docs/AGENTIC_DEV_WORKFLOW.md
- docs/agentic/skill-strategy.md

Look for:
- delegation rules that normalize unnecessary spawning
- contradictions with .codex/config.toml role policy
- cases where critical-path work was pushed onto sidecars

Return:
- findings first with file references
- no style-only commentary
```

## Common Mistakes

- Delegating because multi-agent feels impressive rather than useful
- Sending a sidecar on the next blocking task and then waiting immediately
- Giving a sidecar a fuzzy brief like "look around and see what you think"
- Using multiple sidecars where one focused sidecar or local work would do
- Trusting a sidecar conclusion without checking the cited files or running the claimed verification
- Turning optional sidecars into default ceremony for routine work
