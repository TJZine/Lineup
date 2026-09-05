---
name: model-selection
description: Use when choosing a model or reasoning effort for a Lineup task or handoff.
---

# Model Selection

Use the configured role defaults and the runbook's
[delegation criteria](../../../docs/AGENTIC_DEV_WORKFLOW.md#delegation).
Revisit defaults only when current official guidance and representative independent
benchmark evidence justify a change; weigh evidence against actual Lineup tasks.

Resolve the role's `config_file` through [`.codex/config.toml`](../../../.codex/config.toml);
that TOML owns exact model, reasoning-effort, and sandbox settings. Do not infer a
filename from the role name or assume an undeclared fallback. Choose roles at
dispatch from current task risk rather than pinning a model in durable plans. Keep
delegated writes behind a clear owner boundary, direct verification, and explicit
stop conditions. Do not duplicate exact settings in plans, prompts, or workflow
prose, or add a tracked role until current guidance and representative evidence
justify the recurring need and coordination cost.
