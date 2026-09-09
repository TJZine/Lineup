---
name: architecture-boundaries
description: Use when changing module ownership, composition roots, named or line-count hotspots, cross-module wiring, or any refactor that could expand responsibilities across Lineup's architecture.
---

# Architecture Boundaries

Keep ownership cohesive, dependency direction honest, and composition roots thin.
Neither extraction nor accretion is the default; choose the smallest design that
owns the present requirement without mixing independent responsibilities.

## Required Context

Read relevant sections of [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md),
the affected owner/callers, and the runbook's risk and verification rules. Expand
when lifecycle, invariants, or contracts remain unclear. Load the cleanup
checklist only for checklist-linked work and load other boundary skills only when
their surfaces are actually involved.

## Cohesion Decision

1. Name the behavior and its current owner. State that owner's responsibility in
   one sentence.
2. Keep the change in that owner when it shares the same invariants, state,
   lifecycle, dependency direction, and reason to change.
3. Extract only for a distinct present-day responsibility, lifecycle/resource
   owner, trust boundary, policy, cross-module translation, or real current
   consumer—or when domain policy has entered a composition root.
4. Make an extraction transfer meaningful behavior and a clear contract. Do not
   create forwarding wrappers, one-method services, utility dumping grounds, or
   interfaces for hypothetical implementations.
5. Do not extract for line count alone, test convenience, speculative reuse,
   symmetry with another module, or a preferred pattern. Do not keep unrelated
   work together merely to avoid a new file.

Tests should use stable public seams. A private probe is evidence to reassess
ownership, not automatic justification for another collaborator.

## Apply Design Principles

- Apply DRY to shared business knowledge and invariants. Reuse the owner of a
  scheduling or persistence rule; similar syntax alone does not justify coupling
  callers that have different reasons to change.
- Use small interfaces at real boundaries. SOLID does not require an interface
  per class, inheritance, or extension points for hypothetical features. Prefer
  composition and explicit collaborators; substitutes must preserve failure,
  ordering, cancellation, and cleanup contracts as well as successful results.
- Apply KISS to readability and total maintenance cost, not minimum lines or
  files. Follow existing conventions before introducing configurable machinery.
- Apply YAGNI to speculative capabilities. Scoped refactoring and meaningful
  regression coverage keep current code safe to change and are not speculative
  features. Remove obsolete paths replaced by the change; report concrete
  remaining debt and its consequence without expanding into unrelated cleanup.

Use these as decision criteria within the current task, not an additional review
pass. They interpret the maintainer's
[SOLID/DRY/KISS reference](https://scalastic.io/en/solid-dry-kiss/) alongside
[Fowler's YAGNI clarification](https://martinfowler.com/bliki/Yagni.html) and
[Google's design/complexity guidance](https://google.github.io/eng-practices/review/reviewer/looking-for.html).

## Architecture Attention

- When a change adds or moves responsibilities, record a compact disposition:

  ```text
  Owner:
  Existing responsibility:
  New behavior:
  Decision: cohesive growth | extract
  Evidence:
  ```

- Large files, composition roots, and named hotspots warrant attention to the
  affected lifecycle, callers, and invariants; read the whole owner when needed.
  The 500/800 thresholds do not themselves require a disposition, independent
  reviewer, or split, prohibit cohesive growth, or fail verification.
- Use the runbook's Review criteria when a consequential risk needs a second
  assessment. File size or location alone does not require a reviewer.
- Re-review only after a material finding or material review-surface change.

Use current source and `CURRENT_STATE.md` for the affected ownership surface and
hotspot status; completed cleanup packages do not define current hotspots.

## Invariants

- Keep `src/App.ts` and `src/Orchestrator.ts` at composition/public-entry concerns;
  keep feature policy, persistence parsing, DOM assembly, and long async workflows
  in their documented owners.
- Keep UI independent of Plex transport details, Plex independent of DOM/focus,
  and persistence out of screens/controllers.
- Preserve startup order, listener/timer cleanup, focus behavior, append order,
  storage ownership, and playback/navigation lifecycle contracts.
- Reuse existing owners and primitives. Do not add dependencies, compatibility
  paths, fallback APIs, flags, factories, registries, retries, or edge-case paths
  without a demonstrated reachable requirement.
- Preserve the existing ESLint architecture rules and update current ownership docs
  when public ownership actually changes.

Run risk-matched proof from the runbook, inspect the affected owner surface and diff
(expanding to the complete owner when needed), and confirm that the result neither
accumulates a second responsibility nor fragments
one responsibility across pass-through files.
