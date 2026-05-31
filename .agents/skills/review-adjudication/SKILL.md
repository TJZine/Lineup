---
name: review-adjudication
description: Use when Lineup receives code review comments, PR suggestions, reviewer findings, or external feedback that must be accepted, modified, rejected, deferred, or validated.
---

# Review Adjudication

## Overview

Use this skill to decide what to do with review feedback.

The goal is technical judgment: verify the claim, calibrate severity to Lineup, choose an action, and avoid both blind acceptance and reflexive rejection.

## Relationship To `suggestion-review`

If the user explicitly invokes `suggestion-review`, or asks for a full PR suggestion adjudication report, use the global `suggestion-review` skill when available. It owns the detailed report format for broad PR suggestion batches.

Use this repo-local skill for Lineup-specific review handling, especially:

- adjudicating `reviewer` agent findings
- deciding whether implementation feedback blocks a Lineup plan or slice
- checking whether a suggestion conflicts with repo-local boundary skills
- turning accepted feedback into a scoped fix plus verification plan

If `suggestion-review` is unavailable, use the verdict and priority model below.

## Use This Skill For

- PR review suggestions
- AI reviewer findings
- human review feedback
- implementation-review follow-up
- conflicting reviewer comments
- feedback that may be valid but too broad for the current Lineup slice

## Do Not Use This Skill For

- requesting a fresh review; use `review-request`
- debugging a symptom before review validity can be judged; use `debugging-remediation`
- broad repo health audits; use the matching review launcher or `desloppify`
- implementing accepted feedback; use this first, then execute the scoped fix

## Evidence Standard

Classify each important claim:

- `Observed`: direct code, diff, test, config, docs, or command output
- `Inferred`: reasonable conclusion from observed evidence
- `Unknown`: not established

Evidence hierarchy:

1. current code and diff behavior
2. fresh test or reproduction output
3. tracked Lineup docs, plans, verifier rules, and config
4. official framework/vendor docs for external behavior
5. established best practices
6. style preference

Do not reject feedback without stronger counter-evidence than the feedback itself.

## Verdicts

Use exactly one:

- `Accept`: concern is correct and the proposed fix is appropriate
- `Accept with modification`: concern is real, but proposed fix, scope, owner, or severity needs adjustment
- `Reject`: current evidence shows the concern is wrong, inapplicable, or harmful
- `Defer`: valid but should not block this task or merge
- `Needs validation`: plausible and decision-relevant, but missing evidence could change the verdict

Use `Needs validation` narrowly and name the exact evidence needed.

## Priority

Score urgency separately from validity:

| Score | Meaning | Merge Guidance |
|---|---|---|
| 8-10 | security, data loss, outage, severe correctness, breaking contract | block or strongly block |
| 6-7 | serious bug risk, missing safeguard, high-risk boundary drift | fix before merge recommended |
| 4-5 | maintainability, moderate reliability, weak typing/error handling | fix if low effort or track follow-up |
| 1-3 | style, naming, minor docs, local cleanup | optional or defer |

Adjust upward when the feedback touches Plex transport, playback, selected server state, focus/navigation, composition roots, public contracts, persistent data, or checklist/priority-exit gates.

Adjust downward when the code is isolated, temporary, already being retired, or the suggested fix would create disproportionate complexity.

## Adjudication Sequence

1. Normalize and cluster comments by underlying concern.
2. Identify the affected files and owner boundary.
3. Load matching Lineup boundary skills when implicated.
4. Verify the reviewer claim against current source and tests.
5. Separate the concern from the proposed implementation.
6. Assign verdict, priority, category, and confidence.
7. Choose one action:
   - implement now
   - implement modified fix
   - ask for validation data
   - create follow-up
   - reject with evidence
8. Choose verification using `verification-strategy`.

## Output Shape

For small feedback sets:

```text
REVIEW_ADJUDICATION
ITEM:
VERDICT:
PRIORITY:
EVIDENCE:
REASONING:
ACTION:
VERIFICATION:
RESIDUAL_RISK:
```

For broad PR suggestion batches, prefer `suggestion-review`'s full report format.

## Pushback Rules

Push back when:

- the suggestion moves behavior to the wrong owner
- the fix widens scope beyond the approved plan or execution unit
- the reviewer is optimizing for generic best practice over Lineup's actual seam
- the suggestion adds compatibility/fallback paths without approval
- current tests or source behavior disprove the claim
- the issue is valid but belongs to a separate task or checklist owner

When pushing back, cite concrete evidence and offer the narrower valid alternative if one exists.

## Common Mistakes

- treating every reviewer comment as blocking
- treating every low-priority comment as wrong
- implementing multiple feedback items before clarifying conflicting ones
- allowing a reviewer to redefine task scope without updating the plan
- using "best practice" as a substitute for current Lineup evidence
- skipping verification because the change came from review
