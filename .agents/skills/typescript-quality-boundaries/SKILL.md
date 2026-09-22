---
name: typescript-quality-boundaries
description: Use when changing Lineup production TypeScript, shared types, async workflows, error handling, event/timer lifecycles, or typed seams between UI, Plex, persistence, scheduler, lifecycle, and orchestration modules.
---

# TypeScript Quality Boundaries

Keep production states and ownership explicit at Lineup's typed boundaries:

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
- reuse the affected owner's operation authority, receipt, or generation contract;
  preserve currentness at publication and error boundaries, including synchronous
  listener re-entry. A caller abort and superseded work may have different outcomes;
  preserve their documented precedence rather than adding a generic stale guard;
- prefer an existing focused owner over a generic helper, base class, service
  registry, compatibility adapter, or speculative abstraction;
- add a dependency only when the task proves existing platform and repository tools
  cannot meet the requirement.

Resolve typing and ownership from current contracts and source. Escalate only a
consequential decision outside the authorized scope that remains unresolved.
Use the runbook's behavior-matched verification and reuse still-current results.
Consult the matching architecture, persistence, Plex, or UI guidance when the
changed boundary needs information beyond existing task context.
