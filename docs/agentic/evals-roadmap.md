# Agent Evals Roadmap

> Established 2026-03-05. Defines the first small regression set for measuring whether Lineup’s workflow actually reduces debt and drift.

## Goal

Follow the eval-loop guidance from OpenAI and Anthropic without over-automating too early.

For now, these evals are prompt-driven regression tasks. They can be automated later once the cleanup stabilizes.

The first prompt seed pool should come from:

1. the curated historical corpus review in [`docs/agentic/historical-plan-corpus-review.md`](./historical-plan-corpus-review.md)
2. the active cleanup backlog in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
3. current architecture hotspots in [`docs/architecture/CURRENT_STATE.md`](../architecture/CURRENT_STATE.md)
4. adversarial shortcut-pressure prompts that test whether the workflow resists slop

## Phase 1 Eval Set

### 1. Hotspot Refactor Without Responsibility Growth

Prompt shape:

- ask the agent to change behavior near `src/Orchestrator.ts` or `src/App.ts`

Pass conditions:

- the agent identifies the hotspot
- uses `architecture-boundaries`
- prefers extraction or existing collaborators over expanding the hotspot

### 2. Storage Change Without Raw `localStorage`

Prompt shape:

- ask the agent to add or change a persisted setting or server/channel state

Pass conditions:

- the agent routes the change through the correct owner/store
- no new raw `localStorage` access appears in feature modules
- tests cover valid, invalid, default, and blocked-storage cases where applicable

### 3. Overlay Change Without Focus/Timer Leaks

Prompt shape:

- ask the agent to change a TV overlay, modal, or screen behavior

Pass conditions:

- the agent uses `frontend-design` plus `ui-composition-patterns` where appropriate
- focus ownership remains explicit
- hidden UI does not retain timers/listeners
- `npm run verify` is selected for risky UI work

### 4. Plex Policy Change Without Leakage

Prompt shape:

- ask the agent to change subtitle delivery, transcode behavior, or stream-resolution policy

Pass conditions:

- the agent uses `plex-integration-boundaries`
- policy stays inside Plex-facing modules
- no transport or URL-construction logic leaks into callers

## How To Use

- Run these prompts in a clean worktree or clean branch.
- Score each run as `pass`, `soft-fail`, or `fail`.
- Capture what the agent missed and update workflow docs or skills only when the miss is recurring.
- Keep eval prompt definitions tracked, but keep most eval baseline outputs local-only unless one is intentionally promoted as a durable reference.

## Promotion To Phase 2

Promote these evals into a more formal harness after the cleanup reaches the steady-state criteria in [`docs/agentic/phase-2-steady-state-plan.md`](./phase-2-steady-state-plan.md).
