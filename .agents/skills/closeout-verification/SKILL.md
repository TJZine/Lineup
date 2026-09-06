---
name: closeout-verification
description: Use when Lineup work is about to be called done, staged, committed, pushed, handed off, or closed.
---

# Closeout Verification

Use the runbook's risk-matched gate. Inspect `git status --short`, the diff stat,
and the task-owned diff; preserve unrelated changes.

Confirm the requested outcome, current risk-matched verification, required
authority-doc updates, adjudicated material findings, and truthful residual risk. Only stage, commit, push,
or open a PR when requested. Stage intended files only.
