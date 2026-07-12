# Workflow Entry Points

Repo-local skills under `.agents/skills/` are the reusable workflow entry points.
The former duplicated Markdown launchers were removed to keep one executable source
of workflow guidance.

Use these explicit skills when a reusable launcher is helpful:

- `lineup-feature-plan`, `lineup-feature-implement`, `lineup-feature-review`
- `lineup-cleanup-plan`, `lineup-cleanup-implement`, `lineup-cleanup-review`
- `lineup-cleanup-loop` only for high-risk repeated cleanup that cannot be handled
  safely by one agent
- `lineup-workflow-harness-review` for control-plane audits

Launcher skills are explicit-only. Ordinary requests should route through
`AGENTS.md`, the runbook, and the smallest matching boundary/process skills without
activating a launcher automatically.
