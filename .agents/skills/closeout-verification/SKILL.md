---
name: closeout-verification
description: Use when Lineup work is about to be called done, fixed, ready, staged, committed, pushed, handed off, or closed after code, docs, workflow, or review changes.
---

# Closeout Verification

## Overview

Use this skill before making completion claims or taking branch/PR closeout actions.

The goal is evidence-backed closeout: verify the right surface, inspect the diff, preserve user changes, and report the actual state without overstating success.

## Use This Skill For

- final response after edits
- claiming a bug is fixed or a plan is complete
- staging, committing, pushing, or creating a PR
- closing a worker/reviewer loop
- archiving/moving plan artifacts
- workflow/control-plane, launcher, skill, or eval changes
- handoff generation after partial or completed work

## Do Not Use This Skill For

- choosing initial verification depth; use `verification-strategy`
- debugging an unresolved symptom; use `debugging-remediation`
- reviewing someone else's feedback; use `review-adjudication`

## Closeout Gate

Before saying work is complete, answer:

1. What changed?
2. What command or manual proof verifies the changed surface?
3. Did I run it fresh in this workspace?
4. Did I read the output and exit code?
5. Does the current diff contain only intended changes?
6. Are there unrelated dirty files I must leave alone?
7. Are docs, plans, generated inventories, or eval summaries required by the workflow?
8. Is an adversarial review required or requested?

If any answer is missing, do not claim completion. State the actual status and the missing proof.

## Verification Routing

Use the repo workflow first:

- `npm run verify` for UI, navigation, Orchestrator, or Plex work
- `npm run verify:docs` for workflow, control-plane, launcher, repo-local skill, prompt, eval, or reference-doc changes
- `npm run docs:sync` before `npm run verify:docs` when prompt inventories or managed README sections changed
- targeted tests plus `npm test`/`npm run typecheck` for logic-only TypeScript changes when `npm run verify` is disproportionate

If verification fails, report failure and the first actionable failure cause. Do not bury it under unrelated passing checks.

## Diff Audit

Run or inspect the equivalent of:

```bash
git status --short
git diff --stat
git diff -- <changed-files>
```

Classify changes:

- made by this task
- pre-existing user or workspace changes
- generated inventory changes expected by workflow
- unexpected changes requiring investigation

Never revert unrelated user changes. If unrelated dirty files exist, mention that they were left untouched when relevant.

## Branch, Commit, Push, PR

Only perform branch/commit/push/PR actions when the user asked for them or the active Lineup workflow explicitly requires a commit checkpoint.

Before staging:

- verify the work or clearly state why verification is not available
- stage only intended files
- avoid `git add .`
- keep active tracked plan docs out of implementation commits unless the workflow says this is a tracked-doc commit

Before commit:

- inspect staged diff
- use conventional commits
- keep one commit focused by purpose

Before push or PR:

- confirm branch name and remote
- include verification evidence in the PR body
- do not create a PR from a dirty or unverified branch unless the user explicitly accepts that state

## Handoff Closeout

When work is incomplete or another session is expected, emit a concise handoff with:

- exact next action
- plan/artifact path
- files touched or relevant files
- verification already run
- blockers or findings
- whether reviewer feedback is still open

Do not fake a handoff when no further session is needed.

## Final Response Checklist

Include:

- concise change summary
- verification run and result
- review result when applicable
- files of interest
- remaining risks or blockers

Avoid:

- "should pass" without a command result
- broad claims from partial verification
- saying "done" when review findings remain unresolved
- hiding failed verification behind successful file edits

## Common Mistakes

- trusting a worker or reviewer success claim without local verification
- forgetting generated docs or inventory updates
- running the wrong verification command for the change class
- staging unrelated dirty files
- claiming completion before reading command output
- treating docs-only changes as no-verification changes
