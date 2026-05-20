---
name: review-request
description: Use when Lineup needs an adversarial review of a plan, implementation diff, workflow artifact, skill, launcher, or completed work before closeout or handoff.
---

# Review Request

## Overview

Use this skill to request the right review with bounded context.

The goal is to give a reviewer enough evidence to find real defects without handing them an unbounded session history or letting them change task ownership.

## Use This Skill For

- plan review before implementation
- implementation review before closeout
- workflow/control-plane, launcher, skill, or role-surface review
- priority-exit or checklist-linked cleanup review
- adversarial review after worker or cleanup_worker changes
- review of risky local changes before staging, committing, or handoff

## Do Not Use This Skill For

- adjudicating feedback already received; use `review-adjudication`
- broad exploratory research; use `parallel-sidecars` or the relevant launcher
- review that would need write access
- style-only checking where verifier/lint already owns the concern

## Review Routing

- Use tracked `reviewer` for normal adversarial review.
- Use tracked `maintainability_reviewer` for code-health, slop, file-shape, test-brittleness, or maintainability-only review. Do not block on style-only preferences.
- Use tracked `architecture_reviewer` for hotspot, owner-seam, cross-module coupling, persistence, Plex, UI composition/focus/navigation, public contract, priority-exit, or security-adjacent architecture risk.
- Use `cleanup-review.md` for cleanup/refactor plans and implementations.
- Use `feature-review.md` for feature/design plans and implementations.
- Use `workflow-harness-review.md` for whole workflow/control-plane, skill topology, eval surface, or review-loop audits; optionally add `maintainability_reviewer` only when prompt bloat or slop is a specific review target.
- Use a narrow reviewer sidecar only when the review target is smaller than a launcher session.

Keep reviewers read-only. If the reviewer needs implementation, return to the owning session with adjudicated findings.

## Context Packet

Pass a bounded packet, not full history:

```text
REVIEW_REQUEST
TASK:
TASK_FAMILY:
TIER:
REVIEW_TARGET:
PLAN_OR_ARTIFACT:
FILES_IN_SCOPE:
FILES_OUT_OF_SCOPE:
KEY_INVARIANTS:
VERIFICATION_RUN:
KNOWN_RISKS:
WHAT_TO_PRIORITIZE:
OUTPUT_EXPECTATION:
```

For diffs, include:

- base and head refs when available
- `git diff --stat`
- exact files changed
- commands run and observed results
- any user decisions that constrain valid fixes

For plans, include:

- task family and cleanup subtype if applicable
- chosen seam and non-goals
- ready execution unit or review surface
- stop-and-replan triggers

For skills/workflow docs, include:

- triggering examples
- non-triggering examples
- owner doc or verifier rule affected
- expected verification command, usually `npm run verify:docs`

## Reviewer Prompt Rules

Ask the reviewer to:

- lead with findings ordered by severity
- cite exact files and lines where possible
- separate blockers from optional improvements
- identify missing tests or insufficient verification
- check scope creep and owner-boundary violations
- avoid style-only commentary unless it hides a defect
- say explicitly when no blocking findings are found

Do not ask the reviewer to rewrite the work unless the task is explicitly a planning or docs review.

## Defect Checklist

For every review, explicitly scan for:

- correctness bugs and behavioral regressions
- security, privacy, data-loss, or persistence risks
- architecture ownership drift, boundary leakage, hotspot growth, and new coupling
- maintainability issues: misleading names, dead code, debug leftovers, unnecessary indirection, premature abstraction, harmful duplication
- performance, async, lifecycle, cleanup, and resource-leak risks
- missing or weak tests, brittle tests, and insufficient verification
- UX, accessibility, focus, and motion regressions when UI is touched
- docs, checklist, plan, workflow, or generated artifact drift
- diff hygiene: unrelated changes, local-only artifacts, stale paths, and scope creep

## After Review

Use `review-adjudication` before implementing findings:

1. cluster findings
2. accept, modify, reject, defer, or validate each one
3. fix accepted blocking items first
4. rerun the relevant verification
5. request re-review only when the finding was blocking, risky, or the fix changed the review surface materially

## Common Mistakes

- giving the reviewer the entire conversation instead of the artifact
- asking for "thoughts" instead of a concrete review contract
- letting a reviewer use write access
- failing to pass verification evidence
- treating reviewer output as automatically correct
- skipping re-review after changing the reviewed seam
