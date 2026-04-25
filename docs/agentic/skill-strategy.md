# Agent Skill Strategy

> Established 2026-03-05. This document defines the Lineup skill topology for Codex and Antigravity.

## Goals

- Give Codex access to global reusable skills without duplicating them locally.
- Give Antigravity access to the same critical workflow skills through actual copied folders in `.agent/skills/`.
- Add only Lineup-specific skills to `.codex/skills/`.
- Encode repo-specific architectural, UI, persistence, and Plex boundaries to reduce future tech debt and "AI slop."
- Keep Lineup's multi-agent patterns repo-local when the repo needs tighter delegation discipline than generic global skills provide.
- Keep serious-plan authoring repo-local when the repo needs stricter planning depth and verification rules than generic global planner skills provide.
- Fit the skill system into a smaller control plane rather than letting skills become a second source of truth for workflow policy.

## Research Takeaways

The skill layout and workflow in this repo are based on a small set of recurring patterns from current primary-source guidance:

- OpenAI, [Harness Engineering](https://openai.com/index/harness-engineering/): agent performance depends heavily on repo legibility, explicit commands, readable docs, and active cleanup of stale context and dead files.
- OpenAI, [Building an AI-Native Engineering Team](https://developers.openai.com/codex/guides/build-ai-native-engineering-team): agents are strongest on well-specified work with explicit plans, stable policy rules, evaluation loops, and human ownership of architecture and review.
- OpenAI, [Agent Skills](https://developers.openai.com/codex/skills): keep skills narrow, searchable, and progressive-disclosure friendly; do not overload one skill with many unrelated responsibilities.
- OpenAI Cookbook, [Long Horizon Tasks with Codex](https://github.com/openai/openai-cookbook/blob/main/examples/codex/long_horizon_tasks.md): durable project memory works best when spec, plan, execution instructions, and status live in files the agent can revisit.
- Anthropic, [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents): prefer simple composed workflows, add orchestration only when a single loop stops being reliable, and use evaluator/optimizer patterns for quality control rather than more prompt text.
- OpenAI, [Demystifying Evals for Agents](https://openai.com/index/demystifying-evals-for-agents/): agent workflows should be measured with small, high-signal regression tasks instead of relying on anecdotal success.

## Resulting Repo Policy

- `.codex/skills/` is the canonical tracked home for Lineup-only skills.
- `.codex/config.toml` plus `.codex/agents/*.toml` are tracked Codex multi-agent role surfaces for this repo.
- `.agent/skills/` is a generated local mirror for Antigravity and contains actual copies, not symlinks.
- `docs/agentic/skills/` is not a steady-state skill source or fallback policy surface.
- Global Codex skills that already exist for Codex should not be duplicated into `.codex/skills/`.
- For Codex, global skills are resolved from `${CODEX_HOME:-$HOME/.codex}/skills/` first; the repo does not expect duplicate tracked copies under `.codex/skills/`.
- The exact global mirror set is pinned in [`docs/agentic/skill-mirror-allowlist.txt`](./skill-mirror-allowlist.txt); `scripts/sync_agent_skills.sh` reads that file directly.
- A missing `.agent/skills/<skill>/` path means the Antigravity mirror is absent or stale in that checkout/worktree, not that the global skill is missing overall.
- Repo-specific skills should stay local to this repo unless they become broadly reusable enough to justify promotion to a global skill home.
- Lineup's preferred subagent patterns should live in repo-local skills when the tracked workflow needs stricter delegation rules than the generic global defaults.
- The broader document/control-plane structure is defined in [`docs/AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles`](../AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles).
- Keep the repo-defined role set conservative: read-only evidence/review/docs/monitor roles plus one bounded `planner` role for planning artifacts, one general bounded `worker` role for implementation, and one cleanup-loop-specific `cleanup_worker` role for approved Tier 3 cleanup-loop implementation passes, with explicit fallback roles instead of assumed automatic failover.
- Stable entrypoint doc: `AGENTS.md`
- Stable workflow doc: `docs/AGENTIC_DEV_WORKFLOW.md`

## Policy Ownership Boundaries

Keep global workflow policy in one owner and boundary-specific judgment in the smallest relevant skill:

- [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md) owns document precedence, task-family routing, tiering, memory surfaces, verification command routing, and multi-agent defaults.
- [`docs/agentic/session-prompts/README.md`](./session-prompts/README.md) owns launcher routing, launcher inventory, and which tracked role should run each launcher.
- [`docs/agentic/plan-authoring-standard.md`](./plan-authoring-standard.md) owns required structure for active serious plans; `execution-plan-authoring` owns judgment about how much detail a plan or light execution brief should include.
- `verification-strategy` owns proof-mode selection; the runbook should keep only high-level command routing.
- `model-selection` owns model maps and reasoning-effort guidance; the runbook owns only when a handoff should include `MODEL_SUGGESTION`.
- Boundary skills (`architecture-boundaries`, `persistence-boundaries`, `plex-integration-boundaries`, and `ui-composition-patterns`) own Lineup-specific boundary constraints and should not duplicate global routing/tiering rules except where those rules affect the boundary decision itself.
- Delegation skills (`parallel-sidecars` and `bounded-worker-execution`) own optional sidecar and bounded-worker decision gates; the runbook owns the broader multi-agent default posture.

When a rule appears in multiple places, prefer moving the detailed version to the owner above and leaving only a short pointer elsewhere. Do not prune narrow boundary reminders merely because the current model is stronger; those reminders encode Lineup production constraints, not only model limitations.

## Current Skill Inventory

### Repo-Local Codex Skills

- `architecture-boundaries`
- `bounded-worker-execution`
- `execution-plan-authoring`
- `model-selection`
- `parallel-sidecars`
- `persistence-boundaries`
- `plex-integration-boundaries`
- `ui-composition-patterns`
- `verification-strategy`

These are the source-of-truth Lineup skills. They are authored in `.codex/skills/` and mirrored into `.agent/skills/`.

### Mirrored Global Skills For Antigravity

- The exact mirrored set is pinned in [`docs/agentic/skill-mirror-allowlist.txt`](./skill-mirror-allowlist.txt) for both `superpowers` and `global` skills.
- Maintainers should update only `skill-mirror-allowlist.txt` when the pinned mirror set changes.

These are mirrored into `.agent/skills/` because the repo workflow depends on them and the allowlist keeps the Antigravity surface reproducible. The mirror is a convenience/materialization layer for Antigravity, not the canonical Codex source of a global skill.

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
- `bounded-worker-execution`: keeps worker delegation limited to approved, disjoint plan slices with local controller integration and verification.
- `execution-plan-authoring`: keeps Lineup plans decision-complete at seam/scope/verification level without inheriting generic pseudo-code-heavy planning defaults.
- `verification-strategy`: makes verification explicit and risk-matched without turning every change into fail-first TDD or brittle-test scaffolding.
- `ui-composition-patterns`: pairs global UI design skills with Lineup's TV-specific design language and focus rules.
- `persistence-boundaries`: keeps storage ownership centralized and typed.
- `plex-integration-boundaries`: keeps Plex transport/policy complexity out of unrelated modules.
- `parallel-sidecars`: keeps optional multi-agent usage shallow, role-disciplined, and off the immediate critical path.
- `model-selection`: keeps Lineup session-to-session model advice explicit, cheap by default, and only auto-emitted for high-risk handoffs.
- `brainstorming`: lightweight ambiguity-resolution across projects without inheriting the old superpowers spec-writing and planner-coupling workflow.
- `frontend-design`: marketing/brand-forward UI generation (landing pages, posters, high-aesthetic surfaces) aligned with anti-slop goals.
- `interface-design`: product interface design skill for dashboards/admin/settings/tools and other data-heavy UIs.
- `desloppify`: useful for recurring debt audits and cleanup planning as the architecture cleanup continues.

## Repo-Local Subagent Policy

- Generic global subagent skills may still be installed for Codex, but they are not the authoritative Lineup workflow.
- Generic global planning skills may still exist for Codex, but they are not the authoritative Lineup planner surface.
- For this repo, prefer repo-local subagent skills:
  - `parallel-sidecars` for optional exploration/review/docs/wait sidecars
  - `bounded-worker-execution` for approved-plan worker slices with disjoint write scopes
- For plan authoring, prefer repo-local skills:
  - `verification-strategy` to choose the proof mode and avoid brittle verification
  - `execution-plan-authoring` to freeze the execution seam without pseudo-code bloat
- If a mirrored global subagent skill stops being useful for Antigravity, remove it from [`docs/agentic/skill-mirror-allowlist.txt`](./skill-mirror-allowlist.txt) instead of encoding negative routing rules in the main workflow docs.

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
