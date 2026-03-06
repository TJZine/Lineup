---
name: ui-composition-patterns
description: Use when building or refactoring screens, overlays, focus flows, or TV-facing UI behavior in Lineup, especially when layout, motion, timers, or D-pad navigation are involved.
---

# UI Composition Patterns

## Overview

Use this skill to adapt global UI-generation skills to Lineup's actual TV UI constraints.

For net-new visual direction or major redesigns, pair this with the global `frontend-design` skill first. This skill defines how Lineup UI should be composed and constrained once implementation starts.

## Design Source Of Truth

- [`docs/design/ui-design-language.md`](../../../docs/design/ui-design-language.md)
- [`src/modules/ui/common/ScreenShell.ts`](../../../src/modules/ui/common/ScreenShell.ts)
- [`src/modules/ui/common/OverlayPrimitives.ts`](../../../src/modules/ui/common/OverlayPrimitives.ts)

## Core Rules

- Preserve the edge-integrated visual language. Avoid floating-card regressions, opaque glass slabs, hard dividers, and surface box-shadows.
- Match animation direction to anchor direction. Respect `prefers-reduced-motion`.
- Keep screens and overlays bounded. `show()` should not hide network waits or large setup side effects.
- Hidden UI must release timers, listeners, and transient focus state.
- Separate view rendering from async coordination, persistence, and focus orchestration when the class starts carrying all three.
- Reuse shared primitives before inventing new wrappers or styling patterns.
- Keep D-pad focus ownership explicit. Preserve `data-action` hooks, status roles, and predictable cleanup paths.

## Composition Heuristics

- If a screen owns rendering, focus, persistence, and async loading, split at least one concern out.
- If an overlay grows conditional DOM assembly, move view-model shaping into a coordinator or presenter.
- If focus logic becomes stateful or reusable, extract a focus coordinator similar to [`src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`](../../../src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts).
- If styling starts diverging from the design language, update the design doc first or explicitly justify the exception.

## Verification

- Run `npm run verify` for UI, navigation, Orchestrator, or Plex-facing UI changes.
- Re-test the exact remote/focus path touched by the change.
- Confirm the hidden state leaves no stray timer, event listener, or stale focus target.

## Common Mistakes

- Letting `show()` become a do-everything workflow
- Mixing storage or Plex parsing into UI classes
- Reintroducing floating-card aesthetics the current design language removed
- Adding focus hacks instead of fixing explicit ownership
