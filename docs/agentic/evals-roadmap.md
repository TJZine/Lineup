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

- the agent uses the correct global UI skill for the surface:
  - `interface-design` for product interfaces, overlays, settings, tools, and other product-facing UI
  - `frontend-design` for marketing, landing pages, and other brand-forward surfaces
- `ui-composition-patterns` is loaded as a supporting Lineup-specific TV UI skill when the task touches screens, overlays, focus, motion, or cleanup behavior
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

### 7. Multi-Agent Role Selection And Delegation Discipline

Prompt shape:

- use a workflow/control-plane task that could be done locally but has optional sidecars
- force an explicit decision on whether multi-agent is justified at all
- require explicit role selection from the tracked `.codex/config.toml` role set

Pass conditions:

- keeps critical-path work local unless delegation is clearly justified
- selects read-only roles for read-only work and keeps them read-only
- uses `worker` only for bounded disjoint write scopes
- uses `explorer_fallback` / `monitor_fallback` only when primary spark roles are unavailable or constrained
- avoids unnecessary worker fan-out, deep nesting, and unnecessary waiting

### 8. Model-Role Routing And Cost Effectiveness

Prompt shape:

- present small planning, implementation, and review decisions where heavier surfaces are tempting but not always justified
- require the operator to record ROLE / MODEL / REASONING_EFFORT, task family, tier, risk score, verification result, review finding counts, rework rounds, wall time, and observed token/credit/cost data when available
- keep model identity and reasoning effort as prompt-driven/operator-recorded evidence, not mechanically verified telemetry

Pass conditions:

- ordinary Tier 2 planning uses `planner` on the `gpt-5.6-sol` medium reasoning surface
- Tier 3, hotspot, priority-exit, or unresolved-seam planning escalates to `planner_deep`
- critique and maintainability-review roles remain advisory or review-only rather than default authoritative planning
- routine bounded implementation uses `worker`; `worker_terra` is reserved for explicitly eligible exact units with cheap direct verification and stop/escalation rules
- normal correctness review uses `reviewer`, maintainability/code-health review uses `maintainability_reviewer`, and hotspot/boundary/security-adjacent review uses `architecture_reviewer`
- no extra roles or sidecars are added without concrete evidence that they improve outcome quality

### 9. Staged A/B Comparisons

Comparison shape:

- run exact implementation units with `worker_terra` versus `worker`
- run matched planning surfaces with `planner` medium versus `planner_deep` xhigh
- run maintainability/code-health diffs with `maintainability_reviewer` versus general `reviewer`
- run hotspot/boundary diffs with `architecture_reviewer` versus general `reviewer`

Pass conditions:

- compare accepted findings, blocking findings, rework rounds, verification outcomes, wall time, and observed cost/credit data
- use the lighter role by default when quality is equivalent
- justify the heavier role only when it materially improves accepted findings, reduces rework, or catches blocking risk the lighter role missed
- keep raw transcripts and comparison artifacts local-only by default; track only short durable summaries when the result changes workflow policy

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

## Priority 5 Integration-Boundary Expansion Set

Use the reviewed Priority 5 section as the next source of eval pressure when validating agent behavior around external-service policy pipelines.

### P5-A. Auditable URL/Token Helper Without Cross-Boundary Leakage

Prompt shape:

- ask the agent to extract or modify Plex playback URL/token handling under time pressure

Pass conditions:

- auth and URL construction stay inside Plex-facing modules
- the agent resists turning one extraction into a shared cross-module helper without evidence
- token/audit concerns stay explicit instead of being buried inside unrelated playback policy code

### P5-B. Compatibility Policy Extraction Without Persistence Leakage

Prompt shape:

- ask the agent to split HDR/audio/direct-play compatibility rules out of `PlexStreamResolver`

Pass conditions:

- compatibility rules move into a focused policy owner
- settings or persistence ownership does not get pulled into the new compatibility helper by shortcut
- the agent preserves the distinction between orchestration inputs and policy decisions

### P5-C. Resolver Cleanup Pass Only After Policy Owners Are Proven

Prompt shape:

- ask the agent to remove transitional resolver wrappers and duplicate branches after a sequence of Plex policy extractions

Pass conditions:

- cleanup removes glue only after the extracted policy owners are treated as stable
- no fresh policy logic is smuggled into the cleanup pass
- verification stays focused on regression risk around playback/subtitle behavior

### P5-D. Codanna Fallback Discipline When Discovery Is Weak

Prompt shape:

- ask the agent to plan or review a risky Plex-boundary change in a session where semantic/doc search is weak, noisy, or times out

Pass conditions:

- the agent records `get_index_info` before declaring Codanna insufficient
- fallback evidence is logged explicitly instead of hand-waved
- weak semantic results are not treated as proof that a symbol or ownership path does not exist

## How To Use

- Use the tracked eval harness definitions under [`docs/agentic/evals/`](./evals/README.md) for prompts, scoring, and baseline handling.
- Run these prompts in a clean worktree or clean branch.
- Run each prompt in a fresh session (no carried prior user/agent context) and record session metadata in the scorecard.
- Document Codanna fallback usage with exact invocation, acceptable condition, and why Codanna-first discovery was unavailable or insufficient.
- Score each run as `pass`, `soft-fail`, or `fail` only when the run is fresh-session compliant or explicitly marked as a Codanna-fallback run.
- Write a tracked baseline summary after each manual baseline run and keep the raw artifacts local-only.
- In the baseline summary, record whether Codanna fallback was used and any deviations from fresh-session policy.
- Capture what the agent missed and update workflow docs or skills only when the miss is recurring.
- Run prompt `19-multi-agent-role-selection-and-delegation-discipline` whenever tracked multi-agent role guidance or `.codex/config.toml` role declarations change materially.
- Run prompts `21-model-role-routing-cost-effectiveness`, `22-planner-escalation-and-plan-critique-boundaries`, and/or `23-reviewer-specialization-effectiveness` whenever tracked role/model routing, reasoning-effort guidance, or cost-effectiveness policy changes materially.
- Keep eval prompt definitions tracked, but keep most eval baseline outputs local-only unless one is intentionally promoted as a durable reference.

## Promotion To Phase 2

Promote these evals into a more formal harness after the cleanup reaches the steady-state criteria in [`docs/agentic/phase-2-steady-state-plan.md`](./phase-2-steady-state-plan.md).
