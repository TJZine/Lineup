# Priority 4 UI Decomposition Section Summary

## Purpose

This file preserves the durable historical memory from the completed Priority 4 cleanup section without keeping five long step-by-step implementation plans in the tracked repo.

Use this summary when you need:

- the completed shape of the Priority 4 section
- the stable owner split reached by each work unit
- the preservation contracts that matter for future work
- the main harness lessons that came out of the section

Do not treat this file as an active execution plan.

For reusable planning patterns and anti-patterns derived from this section, use:

- [`docs/agentic/historical-plan-corpus-review.md`](../../agentic/historical-plan-corpus-review.md)
- [`docs/agentic/plan-authoring-standard.md`](../../agentic/plan-authoring-standard.md)

## Section Scope

Priority 4 focused on decomposing the largest UI classes without changing user-visible behavior.

Completed work units:

- `P4-W1` split `SettingsScreen` into state/persistence ownership vs view/focus ownership
- `P4-W2` split bounded info-panel orchestration out of `EPGComponent`
- `P4-W3` split session state and async orchestration out of `ChannelSetupScreen`
- `P4-W4` consolidated repeated focus/render helpers into shared UI primitives
- `P4-W5` removed transitional glue after the earlier splits were stable

## End-State Snapshot

### `P4-W1` Settings screen state/view-focus split

- Result:
  - `SettingsScreen` remains the exported UI surface
  - state/persistence logic moved behind a dedicated controller
  - focus, dropdown lifecycle, DOM rendering, and navigation stayed in the screen
- Stable boundaries:
  - persistence remains behind `SettingsStore`
  - no DOM or navigation ownership moved into the controller
- Preservation contracts:
  - no UI redesign
  - preserve focus cleanup and category/detail behavior
  - preserve subtitle-dependent invalidation and rerender behavior
- Durable lesson:
  - state/view extraction is safe when persistence, invalidation, and focus preservation are made explicit instead of mixed into one hotspot class

### `P4-W2` EPG info-panel orchestration split

- Result:
  - `EPGComponent` remains the exported EPG surface
  - one focused coordinator owns info-panel presentation-mode sync, host switching, immediate update, deferred full update, and cleanup
- Stable boundaries:
  - navigation, grid state, layout behavior, and public component API remain in `EPGComponent`
  - the coordinator does not absorb navigation, DOM creation, or styling responsibility
- Preservation contracts:
  - preserve classic vs overlay host switching
  - preserve immediate fast updates and deferred full updates
  - preserve cleanup on hide, placeholder focus, schedule clear, and destroy
- Durable lesson:
  - orchestration extraction works best when the collaborator API is locked up front and the hotspot replacement map is explicit

### `P4-W3` Channel setup session-flow split

- Result:
  - `ChannelSetupScreen` remains the owner of DOM, focus, D-pad handling, and step-view rendering
  - one session controller owns session state, config shaping, preview/review/build orchestration, and stale-result protection
- Stable boundaries:
  - step controllers remain presentational collaborators
  - focus ownership stays with the screen and focus coordinator
- Preservation contracts:
  - preserve async stale-result guards and abort cleanup
  - preserve fast-path build/review routing
  - preserve Step 2 focus and D-pad semantics
- Durable lesson:
  - this work unit exposed a key harness failure mode: a plan can look explicit while still hiding an unresolved ownership or contract seam
  - future plans must resolve seam decisions before freezing execution-grade scope

### `P4-W4` Shared focus/render primitives

- Result:
  - repeated focus-registration bookkeeping and capped-warning rendering moved into shared UI primitives
  - caller-specific focus policy stayed with the caller
- Stable boundaries:
  - common helpers stay narrow
  - `SettingsScreen` keeps current-focus and stale-category behavior
  - `ChannelSetupFocusCoordinator` keeps preferred-or-first semantics and Step 2 policy
- Preservation contracts:
  - preserve D-pad adjacency and focus restore behavior
  - preserve warning wording, DOM classes, and capping behavior
- Durable lesson:
  - shared helpers are safe only when they centralize mechanics, not caller policy

### `P4-W5` Priority 4 cleanup pass

- Result:
  - transitional wrappers, dead refs, and temporary glue introduced during `P4-W2` through `P4-W4` were removed after the stable owners were already in place
- Stable boundaries:
  - `EPGInfoPanelCoordinator` remains the info-panel owner
  - `ChannelSetupSessionController` remains the session/async owner
  - step controllers remain render-focused
- Preservation contracts:
  - preserve Channel Setup review/build flow and Step 2 focus graph
  - preserve EPG info-panel host behavior
  - do not introduce new long-lived collaborators during cleanup
- Durable lesson:
  - cleanup passes should remove bridges only after the stable owner path is already proven

## Why The Detailed Plans Were Pruned

The original archived P4 plans were useful during the transition from active work to durable history, but they added several thousand tracked lines while duplicating information now preserved in:

- this section summary
- [`docs/agentic/historical-plan-corpus-review.md`](../../agentic/historical-plan-corpus-review.md)
- the P4-derived eval prompts under [`docs/agentic/evals/prompts/`](../../agentic/evals/prompts)
- the completed checklist entries in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

The repo keeps the durable lessons and reference points, but drops the long step-by-step execution directives that are no longer needed for active handoff.

## Future Use

Use this summary as the historical reference surface for:

- checklist completion references for Priority 4
- eval prompt sources for P4-derived regression tasks
- section-level review of what Priority 4 changed

If a future task needs line-by-line implementation recovery for one of these work units, reconstruct it from git history rather than keeping the full execution plans permanently tracked.
