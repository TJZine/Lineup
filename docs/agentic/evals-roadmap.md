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

### 5. Harness Choice And Local-Only Absorption

Prompt shape:

- ask the agent to make a bounded workflow/control-plane update and choose the lightest valid orchestration tier

Pass conditions:

- the agent does not escalate to the full controller loop without real risk
- raw run-bundle or eval artifacts remain local-only
- any durable workflow lesson is promoted into the right tracked doc or tracked eval summary

### 6. Feature-vs-Cleanup Routing And Tier Selection

Prompt shape:

- use a workflow/control-plane task that could be misrouted as cleanup
- force explicit routing among cleanup/refactor, feature/design, and mixed
- require tier choice after routing, not before

Pass conditions:

- the agent routes task family correctly before selecting tier
- feature/design work uses `feature-plan`/`feature-review` guidance rather than defaulting to cleanup prompts
- mixed tasks keep cleanup prompts scoped only to the cleanup slice
- optional global launcher convenience does not become tracked success criteria

## Priority 4 Expansion Set

Use the archived Priority 4 section and the P4 addendum in [`docs/agentic/historical-plan-corpus-review.md`](./historical-plan-corpus-review.md) to extend the eval surface when validating large-UI decomposition behavior.

### 7. EPG Info-Panel Orchestration Without Host Drift

Prompt shape:

- ask the agent to extract bounded info-panel orchestration from `EPGComponent`

Pass conditions:

- host switching between overlay/classic stays correct
- immediate and deferred info-panel updates preserve current behavior
- timer cleanup remains explicit on hide, placeholder focus, and destroy

### 8. Channel Setup Session Owner Without Step-Controller Bleed

Prompt shape:

- ask the agent to split session state and async orchestration out of `ChannelSetupScreen`

Pass conditions:

- the agent detects and resolves any seam involving step-controller contracts before freezing execution
- no dual ownership remains between screen and session controller
- step-view collaborators do not absorb session-policy responsibilities by shortcut

### 9. Shared UI Primitives Without Policy Centralization

Prompt shape:

- ask the agent to extract repeated focus/render helpers into shared UI primitives

Pass conditions:

- shared helpers stay narrow
- caller-specific focus policy remains with the caller
- the agent resists widening scope into unrelated UI modules

### 10. Cleanup Pass Only After Stable Owners Exist

Prompt shape:

- ask the agent to remove transitional UI glue after an extraction sequence

Pass conditions:

- cleanup only removes bridges after the stable owner path is proven
- no new long-lived collaborators are introduced
- the agent preserves async/focus correctness while deleting glue

### 11. Detect Unresolved Seams Before Freezing The Plan

Prompt shape:

- ask the agent to draft a serious tracked plan for an extraction that appears bounded but still hides an ownership or contract seam

Pass conditions:

- the agent names the unresolved seam instead of hiding it in a “0-decision” plan
- the agent either expands scope explicitly or stops and resolves the seam first
- the evidence block and required-skill order match the tracked workflow

## How To Use

- Use the tracked eval harness definitions under [`docs/agentic/evals/`](./evals/README.md) for prompts, scoring, and baseline handling.
- Run these prompts in a clean worktree or clean branch.
- Run each prompt in a fresh session (no carried prior user/agent context) and record session metadata in the scorecard.
- Document Codanna fallback usage with exact invocation, acceptable condition, and why Codanna-first discovery was unavailable or insufficient.
- Score each run as `pass`, `soft-fail`, or `fail` only when the run is fresh-session compliant or explicitly marked as a Codanna-fallback run.
- Write a tracked baseline summary after each manual baseline run and keep the raw artifacts local-only.
- In the baseline summary, record whether Codanna fallback was used and any deviations from fresh-session policy.
- Capture what the agent missed and update workflow docs or skills only when the miss is recurring.
- Keep eval prompt definitions tracked, but keep most eval baseline outputs local-only unless one is intentionally promoted as a durable reference.

## Promotion To Phase 2

Promote these evals into a more formal harness after the cleanup reaches the steady-state criteria in [`docs/agentic/phase-2-steady-state-plan.md`](./phase-2-steady-state-plan.md).
