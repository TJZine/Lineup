---
name: ui-composition-patterns
description: Build or change Lineup screens, overlays, and TV interaction, including layout, motion, D-pad navigation, focus restoration, and UI lifecycle fixes.
---

# UI Composition Patterns

## Overview

Use this skill to adapt global UI-generation skills to Lineup's actual TV UI constraints.

For net-new visual direction or major redesigns, pair this with a global UI design skill first:

- Use `interface-design` for product interfaces (dashboards/admin/settings/tools/data-heavy UI).
- Use `frontend-design` for marketing/landing pages and other brand-forward surfaces.

This skill defines how Lineup UI should be composed and constrained once implementation starts.

## Design Source Of Truth

Read relevant sections and affected owners first; expand when a material design,
contract, or lifecycle question remains. The design-language document below is the
agreed UI authority recognized by `interface-design`; no duplicate `system.md` is
needed. Collaborate on new direction and material departures from approved design.

- [`docs/design/ui-design-language.md`](../../../docs/design/ui-design-language.md)
- [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md)
- [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../docs/AGENTIC_DEV_WORKFLOW.md)
- [`src/modules/ui/common/ScreenShell.ts`](../../../src/modules/ui/common/ScreenShell.ts)
- [`src/modules/ui/common/OverlayPrimitives.ts`](../../../src/modules/ui/common/OverlayPrimitives.ts)

## Boundary Routing

- If UI work starts changing ownership, hotspots, or composition roots, consult relevant guidance in `architecture-boundaries`.
- Consult `persistence-boundaries` when changing persisted state, write outcomes,
  or storage scope; displaying an existing preference does not itself cross that boundary.
- Consult `plex-integration-boundaries` when changing Plex policy, transport,
  credentials, or subtitle delivery; formatting an existing display result does
  not itself require Plex context.

## Discovery Pattern

1. Find the screen, focus owner, lifecycle cleanup, and shared callers with exact
   search and direct reads. Use Codanna semantic or impact tools when available and
   useful for an unknown or shared UI seam.
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
- On hide, cancel visibility-scoped timers and pending UI publication, detach active
  remote subscriptions, and unregister hidden focus targets. Retained DOM handlers
  may live until destroy; release all instance-owned resources on destroy.
- Preserve navigation-owned screen/modal focus memory across hide and registration
  cleanup. Restore only eligible targets; preserve fallback groups/priorities and
  generation checks on delayed restoration.
- Reuse shared primitives before inventing new wrappers or styling patterns.
- Keep D-pad focus ownership explicit. Preserve `data-action` hooks, status roles, and predictable cleanup paths.
- Preserve ARIA/status semantics and remote-driven usability while refactoring.
- Keep domain logic out of view classes. UI should shape display state, not own Plex policy, storage parsing, or orchestration fallback logic.
- Prefer explicit coordinators/presenters/view-model shapers over UI classes that quietly absorb runtime policy.

## Composition Heuristics

- Mixed rendering, focus, persistence, and async loading warrant the cohesion test
  in `architecture-boundaries`. Conditional DOM assembly or stateful focus alone
  does not require extraction; move a distinct responsibility or resource lifecycle.
- Reuse the current focus owner. For a distinct focus lifecycle, the existing
  [`ChannelSetupFocusCoordinator`](../../../src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts)
  is an example, not a required shape for every screen.
- Agree on material departures from approved design before implementation, then
  record the reusable rule or surface-local exception in its designated authority.
- Keep network/storage/runtime policy behind its existing owner when `show()` or
  `hide()` initiates it; bounded UI coordination can remain with the screen.
- If a shared primitive starts accumulating feature-specific conditions, move that feature policy back up into the owning screen/coordinator.

## Verification

- Use the [runbook's verification gate](../../../docs/AGENTIC_DEV_WORKFLOW.md#verification),
  including its nonbehavioral exception and reuse of current proof.
- Re-test the exact remote/focus path touched by the change.
- When lifecycle behavior changes, check show → hide → show, destroy, and late async
  completion. Hidden UI must not capture remote input, regain focus, or publish
  stale results. Exercise dropdown/modal Back restoration when affected; retained
  handlers must work on reopen without duplicate registration.
- Confirm `prefers-reduced-motion`, `role="status"`, and required `data-action` hooks remain intact where relevant.
- Update [`docs/design/ui-design-language.md`](../../../docs/design/ui-design-language.md) when you intentionally change a reusable visual rule rather than quietly drifting implementation.

## Common Mistakes

- Letting `show()` become a do-everything workflow
- Mixing storage or Plex parsing into UI classes
- Reintroducing floating-card aesthetics the current design language removed
- Adding focus hacks instead of fixing explicit ownership
- Letting a presenter/coordinator become a second screen class with hidden DOM ownership
- Treating manual visual QA as a substitute for focus/lifecycle verification
