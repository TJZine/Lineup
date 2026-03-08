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

## Current Readiness Snapshot (2026-03-08)

The explicit review checkpoint has already been triggered, but it should be treated as **open**, not complete:

- the first tracked eval baseline summary landed on 2026-03-06
- Priority 4 is already stable enough to live as one archived section summary instead of five long tracked plans
- Priority 5 already adds new durable harness signal from `P5-W1` through `P5-W5`, even though `P5-W6` remains open in the active checklist

Strong readiness signals:

- task-family routing and local-only absorption already have one passing tracked meta-eval
- the control plane is stable enough that future harness work should be incremental, not another rewrite
- the historical corpus is now strong across UI decomposition, orchestration seams, and Plex integration-boundary cleanup

Remaining blockers before executing the full Phase 2 pass:

- active cleanup work still exists in later priorities, so steady-state feature mode is not yet clearly dominant
- a clean checkout currently fails `npm run verify:docs` because the checklist points at plan files that are still local/untracked in the active workspace; Phase 2 should not start until clean-checkout docs verification is green again
- only one tracked eval baseline summary exists so far; the recurring eval routine is not yet established

Immediate pre-Phase-2 actions:

- absorb the reusable Priority 5 lessons into the tracked corpus/eval surfaces without reintroducing five bulky archived plans
- restore clean-checkout docs verification before tightening steady-state wording or deleting cleanup-era guidance
- rerun eval prompt `13-risk-tiered-orchestration-and-local-only-absorption` if any workflow/control-plane change materially alters routing, tracked-vs-local policy, or orchestration guidance

## Phase 2 Work Items

### 1. Tighten The Skills

- update `architecture-boundaries` to reference final ownership rules instead of mostly hotspot warnings
- update `persistence-boundaries` and `plex-integration-boundaries` with steady-state module invariants
- after Priority 5 lessons are absorbed, tighten `plex-integration-boundaries` around auditable URL/token handling, transport-vs-policy separation, and no persistence/settings leakage into playback compatibility policy
- keep `ui-composition-patterns` aligned with the durable design language and focus rules

### 2. Re-check The Control Plane

- confirm the current document map still reflects how the repo is actually used
- archive or delete workflow/docs that became temporary during cleanup
- prefer section summaries and curated corpus updates over keeping long archived execution-plan sets once a cleanup section is complete
- use [`docs/agentic/doc-gardening-checklist.md`](./doc-gardening-checklist.md) as the recurring maintenance baseline before tightening or deleting workflow docs
- keep the control plane small; do not let new one-off docs become new drift sources

### 3. Formalize Evals

- turn the phase-1 eval roadmap into a recurring regression set
- add the next small set of P5-derived integration-boundary evals only after the durable section lessons are captured
- track failures that indicate workflow/skill drift
- use failures to improve prompts/skills/docs before adding more process

### 4. Prune The Antigravity Mirror

- remove mirrored global skills from `.agent/skills` if they are not actually useful in practice
- keep parity only for the skills Antigravity meaningfully benefits from

## Explicit Review Checkpoint

Run a concrete phase-2 review checkpoint after the first tracked eval baseline summary lands or after Priority 4 stabilizes, whichever comes first.

Status as of 2026-03-08: this checkpoint has already triggered and should now be worked as a readiness review rather than deferred as a future idea.

That checkpoint must decide:

- whether the allowlisted Antigravity mirror still needs every mirrored global skill
- whether the risk-tiered orchestration policy can be tightened further
- which cleanup-era skill wording should become steady-state invariant wording
- whether clean-checkout verification and eval coverage are strong enough to let the repo remove cleanup-era wording without losing safety

## Trigger To Revisit This Plan

Revisit this document after a major cleanup milestone lands or when the team agrees the repo is in “steady-state feature mode” rather than “active structural remediation mode.”
