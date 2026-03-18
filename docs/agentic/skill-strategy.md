# Agent Skill Strategy

> Established 2026-03-05. This document defines the Lineup skill topology for Codex and Antigravity.

## Goals

- Give Codex access to global reusable skills without duplicating them locally.
- Give Antigravity access to the same critical workflow skills through actual copied folders in `.agent/skills/`.
- Add only Lineup-specific skills to `.codex/skills/`.
- Encode repo-specific architectural, UI, persistence, and Plex boundaries to reduce future tech debt and "AI slop."
- Fit the skill system into a smaller control plane rather than letting skills become a second source of truth for workflow policy.

## Research Takeaways

The skill layout and workflow in this repo are based on a small set of recurring patterns from current primary-source guidance:

- OpenAI, [Harness Engineering](https://openai.com/index/harness-engineering/): agent performance depends heavily on repo legibility, explicit commands, readable docs, and active cleanup of stale context and dead files.
- OpenAI, [Building an AI-Native Engineering Team](https://developers.openai.com/codex/guides/build-ai-native-engineering-team): agents are strongest on well-specified work with explicit plans, `AGENTS.md` rules, evaluation loops, and human ownership of architecture and review.
- OpenAI, [Agent Skills](https://developers.openai.com/codex/skills): keep skills narrow, searchable, and progressive-disclosure friendly; do not overload one skill with many unrelated responsibilities.
- OpenAI Cookbook, [Long Horizon Tasks with Codex](https://github.com/openai/openai-cookbook/blob/main/examples/codex/long_horizon_tasks.md): durable project memory works best when spec, plan, execution instructions, and status live in files the agent can revisit.
- Anthropic, [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents): prefer simple composed workflows, add orchestration only when a single loop stops being reliable, and use evaluator/optimizer patterns for quality control rather than more prompt text.
- OpenAI, [Demystifying Evals for Agents](https://openai.com/index/demystifying-evals-for-agents/): agent workflows should be measured with small, high-signal regression tasks instead of relying on anecdotal success.

## Resulting Repo Policy

- `.codex/skills/` is for Lineup-only skills.
- `.codex/config.toml` plus `.codex/agents/*.toml` are tracked Codex multi-agent role surfaces for this repo.
- `.agent/skills/` is a generated local mirror for Antigravity and contains actual copies, not symlinks.
- Global Codex skills that already exist for Codex should not be duplicated into `.codex/skills/`.
- The exact global mirror set is pinned in [`docs/agentic/skill-mirror-allowlist.txt`](./skill-mirror-allowlist.txt); `scripts/sync_agent_skills.sh` reads that file directly.
- Repo-specific skills should stay local to this repo unless they become broadly reusable enough to justify promotion to a global skill home.
- The broader document/control-plane structure is defined in [`docs/agentic/document-map.md`](./document-map.md).
- Keep the repo-defined role set conservative: read-only evidence/review/docs/monitor roles plus a bounded `worker` role, with explicit fallback roles instead of assumed automatic failover.

## Current Skill Inventory

### Repo-Local Codex Skills

- `architecture-boundaries`
- `model-selection`
- `ui-composition-patterns`
- `persistence-boundaries`
- `plex-integration-boundaries`

These are the source-of-truth Lineup skills. They are authored in `.codex/skills/` and mirrored into `.agent/skills/`.

### Mirrored Global Skills For Antigravity

- The exact mirrored set is pinned in [`docs/agentic/skill-mirror-allowlist.txt`](./skill-mirror-allowlist.txt) for `superpowers` skills and resolved from `${CODEX_HOME:-$HOME/.codex}/skills/` for global skills.
- Maintainers should update only `skill-mirror-allowlist.txt` when the pinned mirror set changes.

These are mirrored into `.agent/skills/` because the repo workflow depends on them and the allowlist keeps the Antigravity surface reproducible.

## Tracked Vs Local

Tracked in git:

- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.codex/skills/`
- control-plane docs
- eval definitions such as prompts and rubric
- sync scripts and validators

Local-only by default:

- `.agent/skills/`
- eval baseline outputs under `docs/agentic/evals/baselines/*.md`
- concrete long-horizon run instances under `docs/runs/<date>-<topic>/`

## Why These Skills

- `architecture-boundaries`: protects composition roots and hotspot decomposition.
- `ui-composition-patterns`: pairs global UI design skills with Lineup's TV-specific design language and focus rules.
- `persistence-boundaries`: keeps storage ownership centralized and typed.
- `plex-integration-boundaries`: keeps Plex transport/policy complexity out of unrelated modules.
- `model-selection`: keeps Lineup session-to-session model advice explicit, cheap by default, and only auto-emitted for high-risk handoffs.
- `frontend-design`: marketing/brand-forward UI generation (landing pages, posters, high-aesthetic surfaces) aligned with anti-slop goals.
- `interface-design`: product interface design skill for dashboards/admin/settings/tools and other data-heavy UIs.
- `desloppify`: useful for recurring debt audits and cleanup planning as the architecture cleanup continues.

## UI Skill Recommendation

For UI work, the default stack should be:

1. Choose one global UI skill based on intent:
   - `interface-design` for product interfaces (dashboards/admin/settings/tools/data-heavy UI)
   - `frontend-design` for marketing/landing pages and other brand-forward surfaces
2. Repo-local `ui-composition-patterns` for Lineup-specific TV composition, focus, motion, and cleanup rules.
3. Repo-local `architecture-boundaries` when UI work starts changing ownership or expanding hotspot classes.

Keep the set minimal: two global UI skills with a clear boundary is preferable to many overlapping “design” skills.

## Copy / Refresh Commands

Use actual copies. Do not use symlinks. Materialize the local mirror with the tracked sync script and keep the allowlist as the only place where the mirrored global set is edited.

```bash
scripts/sync_agent_skills.sh
```

## Future Recommendations

- Add lightweight eval tasks for the most important workflows:
  - refactor in hotspot without growing responsibility
  - add storage-backed setting without raw `localStorage`
  - modify overlay without breaking focus cleanup
  - change Plex stream logic without leaking transport policy into callers
- Use [`docs/agentic/evals-roadmap.md`](./evals-roadmap.md) as the first evaluation layer and tighten it during the phase-2 transition in [`docs/agentic/phase-2-steady-state-plan.md`](./phase-2-steady-state-plan.md).
- Keep the mirror set pinned and reviewable. If a global skill is not helping Antigravity in practice, remove it from [`docs/agentic/skill-mirror-allowlist.txt`](./skill-mirror-allowlist.txt) rather than relying on machine-local installs.
- Promote a Lineup skill to global only after it proves broadly reusable outside this repo.
