# Phase 2 Steady-State Plan

> Established 2026-03-05. This document describes the second documentation/skill pass to run after the current architecture cleanup stabilizes.

## Purpose

The current workflow and skills are intentionally tuned for a repo that is still cleaning up hotspots, stale architecture docs, and persistence leaks.

Phase 2 is the transition from cleanup-era guardrails to steady-state invariants.

## When To Execute Phase 2

Run this phase when most of the following are true:

- the active cleanup backlog has reached a stable point, especially across current Priority 4-7 work
- the architecture docs no longer have obvious current-state mismatches
- the major hotspot files have clearer ownership and fewer temporary adapters
- raw storage access is confined to designated owners
- the team expects future work to be mostly feature work rather than structural cleanup

This does not require “everything in the checklist is complete.” It does require that the repo’s current boundaries are stable enough to document as lasting rules.

## Phase 2 Goals

- tighten repo-local skills from cleanup guidance into steady-state invariants
- remove or archive cleanup-only wording that is no longer useful
- shrink overlapping docs further once the architecture is stable
- promote the eval roadmap into a repeatable review/eval routine
- refresh the mirrored `.agent/skills` set based on actual usage

## Phase 2 Work Items

### 1. Tighten The Skills

- update `architecture-boundaries` to reference final ownership rules instead of mostly hotspot warnings
- update `persistence-boundaries` and `plex-integration-boundaries` with steady-state module invariants
- keep `ui-composition-patterns` aligned with the durable design language and focus rules

### 2. Re-check The Control Plane

- confirm the current document map still reflects how the repo is actually used
- archive or delete workflow/docs that became temporary during cleanup
- use [`docs/agentic/doc-gardening-checklist.md`](./doc-gardening-checklist.md) as the recurring maintenance baseline before tightening or deleting workflow docs
- keep the control plane small; do not let new one-off docs become new drift sources

### 3. Formalize Evals

- turn the phase-1 eval roadmap into a recurring regression set
- track failures that indicate workflow/skill drift
- use failures to improve prompts/skills/docs before adding more process

### 4. Prune The Antigravity Mirror

- remove mirrored global skills from `.agent/skills` if they are not actually useful in practice
- keep parity only for the skills Antigravity meaningfully benefits from

## Explicit Review Checkpoint

Run a concrete phase-2 review checkpoint after the first tracked eval baseline summary lands or after Priority 4 stabilizes, whichever comes first.

That checkpoint must decide:

- whether the allowlisted Antigravity mirror still needs every mirrored global skill
- whether the risk-tiered orchestration policy can be tightened further
- which cleanup-era skill wording should become steady-state invariant wording

## Trigger To Revisit This Plan

Revisit this document after a major cleanup milestone lands or when the team agrees the repo is in “steady-state feature mode” rather than “active structural remediation mode.”
