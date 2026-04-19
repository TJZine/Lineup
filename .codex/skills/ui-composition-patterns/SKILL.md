---
name: ui-composition-patterns
description: Use when building or refactoring screens, overlays, focus flows, or TV-facing UI behavior in Lineup, especially when layout, motion, timers, or D-pad navigation are involved.
---

# UI Composition Patterns

## Overview

Use this skill to adapt global UI-generation skills to Lineup's actual TV UI constraints.

For net-new visual direction or major redesigns, pair this with a global UI design skill first:

- Use `interface-design` for product interfaces (dashboards/admin/settings/tools/data-heavy UI).
- Use `frontend-design` for marketing/landing pages and other brand-forward surfaces.

This skill defines how Lineup UI should be composed and constrained once implementation starts.

## Design Source Of Truth

- [`docs/design/ui-design-language.md`](../../../docs/design/ui-design-language.md)
- [`docs/design/css-governance.md`](../../../docs/design/css-governance.md)
- [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md)
- [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../docs/AGENTIC_DEV_WORKFLOW.md)
- [`src/modules/ui/common/ScreenShell.ts`](../../../src/modules/ui/common/ScreenShell.ts)
- [`src/modules/ui/common/OverlayPrimitives.ts`](../../../src/modules/ui/common/OverlayPrimitives.ts)

## Boundary Routing

- If UI work starts changing ownership, hotspots, or composition roots, also load `architecture-boundaries`.
- If a screen or overlay owns storage-backed preferences/session state, also load `persistence-boundaries`.
- If the surface renders Plex-driven policy, stream state, or subtitle behavior, also load `plex-integration-boundaries`.

## Discovery Pattern

1. Run a Codanna-first evidence sweep before changing a shared screen, overlay, or focus path.
   - start with `semantic_search_with_context`
   - use `search_documents` when design or workflow docs matter
   - run `analyze_impact` before touching shared/public UI coordinators or primitives
   - fall back to `rg` only when Codanna is insufficient, and note the fallback
2. Confirm the screen's current owner and adjacent collaborators before editing.
3. Decide which layer owns each concern:
   - rendering/view composition
   - focus state and remote interaction
   - async workflow coordination
   - persistence-backed preferences
   - domain translation from Plex/scheduler/runtime data

## Core Rules

- Preserve the edge-integrated visual language. Avoid floating-card regressions, opaque glass slabs, hard dividers, and surface box-shadows.
- Match animation direction to anchor direction. Respect `prefers-reduced-motion`.
- Keep screens and overlays bounded. `show()` should not hide network waits or large setup side effects.
- Hidden UI must release timers, listeners, and transient focus state.
- Separate view rendering from async coordination, persistence, and focus orchestration when the class starts carrying all three.
- Reuse shared primitives before inventing new wrappers or styling patterns.
- Keep D-pad focus ownership explicit. Preserve `data-action` hooks, status roles, and predictable cleanup paths.
- Preserve ARIA/status semantics and remote-driven usability while refactoring.
- Keep domain logic out of view classes. UI should shape display state, not own Plex policy, storage parsing, or orchestration fallback logic.
- Prefer explicit coordinators/presenters/view-model shapers over UI classes that quietly absorb runtime policy.

## Composition Heuristics

- If a screen owns rendering, focus, persistence, and async loading, split at least one concern out.
- If an overlay grows conditional DOM assembly, move view-model shaping into a coordinator or presenter.
- If focus logic becomes stateful or reusable, extract a focus coordinator similar to [`src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`](../../../src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts).
- If styling starts diverging from the design language, update the design doc first or explicitly justify the exception.
- If `show()` or `hide()` starts coordinating network work, storage writes, or multi-step runtime policy, extract a controller/coordinator.
- If a shared primitive starts accumulating feature-specific conditions, move that feature policy back up into the owning screen/coordinator.

## Verification

- Run `npm run verify` for UI, navigation, Orchestrator, or Plex-facing UI changes.
- Re-test the exact remote/focus path touched by the change.
- Confirm the hidden state leaves no stray timer, event listener, or stale focus target.
- Confirm `prefers-reduced-motion`, `role="status"`, and required `data-action` hooks remain intact where relevant.
- Update [`docs/design/ui-design-language.md`](../../../docs/design/ui-design-language.md) when you intentionally change a reusable visual rule rather than quietly drifting implementation.
- Update [`docs/design/css-governance.md`](../../../docs/design/css-governance.md) when you intentionally change repo-wide CSS decision rules, reuse policy, or exception-routing guidance.

## Common Mistakes

- Letting `show()` become a do-everything workflow
- Mixing storage or Plex parsing into UI classes
- Reintroducing floating-card aesthetics the current design language removed
- Adding focus hacks instead of fixing explicit ownership
- Letting a presenter/coordinator become a second screen class with hidden DOM ownership
- Treating manual visual QA as a substitute for focus/lifecycle verification
