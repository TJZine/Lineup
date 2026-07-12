---
name: lineup-feature-plan
description: Explicit launcher for planning a Lineup feature or behavior change; do not invoke implicitly.
---

# Lineup Feature Plan

Read `AGENTS.md`, the runbook, and only relevant boundary docs. Produce the
smallest decision-complete plan: goal, non-goals, owner seam, files, invariants,
public contracts, verification, and stop conditions. Use a tracked plan only for
durable cross-session memory. For a tracked plan, also declare active status and
`**Task family:** feature/design` as required by
`docs/agentic/plan-authoring-standard.md`. Load `execution-plan-authoring` or
`verification-strategy` only when the owner seam, proof depth, or durable handoff
remains non-trivial.
