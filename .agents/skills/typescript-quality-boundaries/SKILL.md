---
name: typescript-quality-boundaries
description: Use when changing Lineup production TypeScript, shared types, async workflows, error handling, event/timer lifecycles, or typed seams between UI, Plex, persistence, scheduler, lifecycle, and orchestration modules.
---

# TypeScript Quality Boundaries

Keep production states and ownership explicit enough that a bounded worker cannot
silently widen the design:

- narrow `unknown` at the boundary; do not use `any`, double assertions, broad
  `Record<string, unknown>` bags, or non-null assertions to bypass an unresolved
  state model;
- use discriminated unions or focused result types when callers must handle distinct
  success, unavailable, retryable, cancelled, and fatal outcomes;
- translate Plex, storage, DOM, and platform payloads once at their owner boundary;
- keep composition roots and views dependent on small typed intents/results rather
  than collaborator bags or raw external payloads;
- preserve error causes while exposing sanitized, actionable application errors;
- give timers, listeners, subscriptions, abort signals, and stale async completions
  one explicit owner and cleanup path;
- prefer an existing focused owner over a generic helper, base class, service
  registry, compatibility adapter, or speculative abstraction;
- add a dependency only when the task proves existing platform and repository tools
  cannot meet the requirement.

Before finishing, run focused behavior proof, `npm run typecheck`, relevant lint,
and the runbook-required gate. Stop and resolve the seam when the change requires a
new public shape, crosses domain ownership, or cannot represent its states without
casts or fallback branches. Load the matching architecture, persistence, Plex, or UI
boundary skill when those surfaces are involved.
