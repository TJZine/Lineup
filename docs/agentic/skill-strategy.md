# Agent Skill Strategy

> Established 2026-03-05. Updated 2026-05-20 for the `.agents/skills/` default.

This document defines the Lineup skill topology for Codex and Antigravity.

## Goals

- Use `.agents/skills/` as the single tracked repo-local skill home for both Codex and Antigravity discovery.
- Keep `.codex/config.toml` and `.codex/agents/*.toml` as the tracked Codex role-configuration surface.
- Avoid generated legacy skill mirrors, sync scripts, and duplicate skill copies that can drift.
- Encode repo-specific architectural, UI, persistence, and Plex boundaries to reduce future tech debt and AI slop.
- Keep Lineup's multi-agent, planning, debugging, review, and closeout discipline repo-local when the repo needs stricter guidance than generic global skills provide.
- Fit skills into the control plane without turning them into a second source of truth for workflow policy.

## Research Takeaways

The skill layout and workflow in this repo are based on recurring patterns from primary-source guidance:

- OpenAI, [Harness Engineering](https://openai.com/index/harness-engineering/): agent performance depends heavily on repo legibility, explicit commands, readable docs, and active cleanup of stale context and dead files.
- OpenAI, [Building an AI-Native Engineering Team](https://developers.openai.com/codex/guides/build-ai-native-engineering-team): agents are strongest on well-specified work with explicit plans, stable policy rules, evaluation loops, and human ownership of architecture and review.
- OpenAI, [Agent Skills](https://developers.openai.com/codex/skills): keep skills narrow, searchable, and progressive-disclosure friendly; do not overload one skill with unrelated responsibilities.
- OpenAI Cookbook, [Long Horizon Tasks with Codex](https://github.com/openai/openai-cookbook/blob/main/examples/codex/long_horizon_tasks.md): durable project memory works best when spec, plan, execution instructions, and status live in files the agent can revisit.
- Anthropic, [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents): prefer simple composed workflows, add orchestration only when a single loop stops being reliable, and use evaluator/optimizer patterns for quality control rather than more prompt text.
- OpenAI, [Demystifying Evals for Agents](https://openai.com/index/demystifying-evals-for-agents/): agent workflows should be measured with small, high-signal regression tasks instead of relying on anecdotal success.

## Resulting Repo Policy

- `.agents/skills/` is the canonical tracked home for Lineup-only skills.
- `.codex/config.toml` plus `.codex/agents/*.toml` are tracked Codex multi-agent role surfaces for this repo.
- `.agent/` is legacy local state and must not be a repo workflow surface.
- `docs/agentic/skills/` is not a steady-state skill source or fallback policy surface.
- Global skills that already exist in an agent's global skill home should not be duplicated into this repo unless the repo intentionally owns a Lineup-specific adaptation.
- Repo-specific skills should stay local to this repo unless they become broadly reusable enough to justify promotion to a global skill home.
- Lineup's preferred subagent patterns should live in repo-local skills when the tracked workflow needs stricter delegation rules than generic global defaults.
- The broader document/control-plane structure is defined in [`docs/AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles`](../AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles).
- Keep the repo-defined role set conservative: read-only evidence/review/docs/monitor roles plus bounded `planner` and `planner_deep` roles for planning artifacts, one general Sol `worker` role for implementation, one lower-cost `worker_luna` role only for approved bounded exact cheap-to-verify execution units, and one cleanup-loop-specific `cleanup_worker` role for approved Tier 3 cleanup-loop implementation passes, with explicit fallback roles instead of assumed automatic failover.
- Stable entrypoint doc: `agents.md`.
- Stable workflow doc: `docs/AGENTIC_DEV_WORKFLOW.md`.

## Policy Ownership Boundaries

Keep global workflow policy in one owner and boundary-specific judgment in the smallest relevant skill:

- [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md) owns document precedence, task-family routing, tiering, memory surfaces, verification command routing, and multi-agent defaults.
- [`docs/agentic/session-prompts/README.md`](./session-prompts/README.md) owns launcher routing, launcher inventory, and which tracked role should run each launcher.
- [`docs/agentic/plan-authoring-standard.md`](./plan-authoring-standard.md) owns required structure for active serious plans; `execution-plan-authoring` owns judgment about how much detail a plan or light execution brief should include.
- `verification-strategy` owns proof-mode selection; the runbook should keep only high-level command routing.
- `debugging-remediation` owns root-cause investigation and remediation seam selection when a Lineup symptom, regression, or failing test has an unclear cause.
- `review-request` owns the packet shape and routing for asking a read-only reviewer to inspect a bounded artifact.
- `review-adjudication` owns accept/modify/reject/defer/validate decisions for review feedback after it is received.
- `closeout-verification` owns final evidence checks, diff audit, and branch/commit/PR readiness before completion claims.
- `model-selection` owns model maps and reasoning-effort guidance; the runbook owns only when a handoff should include `MODEL_SUGGESTION`.
- Boundary skills (`architecture-boundaries`, `persistence-boundaries`, `plex-integration-boundaries`, and `ui-composition-patterns`) own Lineup-specific boundary constraints and should not duplicate global routing/tiering rules except where those rules affect the boundary decision itself.
- Delegation skills (`parallel-sidecars` and `bounded-worker-execution`) own optional sidecar and bounded-worker decision gates; the runbook owns the broader multi-agent default posture.

When a rule appears in multiple places, prefer moving the detailed version to the owner above and leaving only a short pointer elsewhere. Do not prune narrow boundary reminders merely because the current model is stronger; those reminders encode Lineup production constraints, not only model limitations.

## Current Skill Inventory

### Repo-Local Skills

- `architecture-boundaries`
- `bounded-worker-execution`
- `closeout-verification`
- `debugging-remediation`
- `execution-plan-authoring`
- `lineup-cleanup-implement`
- `lineup-cleanup-loop`
- `lineup-cleanup-plan`
- `lineup-cleanup-review`
- `lineup-feature-implement`
- `lineup-feature-plan`
- `lineup-feature-review`
- `lineup-workflow-harness-review`
- `model-selection`
- `parallel-sidecars`
- `persistence-boundaries`
- `plex-integration-boundaries`
- `repo-production-review`
- `review-adjudication`
- `review-request`
- `ui-composition-patterns`
- `verification-strategy`

These are the source-of-truth Lineup skills. They are authored and reviewed in `.agents/skills/`.

### Optional Local Code-Health Skill

`desloppify` may exist locally in the ignored repo skill area for code-health workflow. It is not part of the tracked repo-local skill set, and it must not become always-on policy. Use it only when the task explicitly targets code-health scanning, technical debt, cleanup planning, or desloppify workflow.

## Tracked Vs Local

Tracked in git:

- `.agents/skills/`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- control-plane docs
- eval definitions such as prompts and rubric
- validators

Local-only by default:

- `.agent/`
- eval baseline outputs under `docs/agentic/evals/baselines/*.md`
- concrete long-horizon run instances under `docs/runs/<date>-<topic>/`

## Why These Skills

- `architecture-boundaries`: protects composition roots and hotspot decomposition.
- `bounded-worker-execution`: keeps worker delegation limited to approved, disjoint plan slices with local controller integration and verification.
- `closeout-verification`: keeps completion, branch, commit, push, PR, and handoff claims tied to fresh observed evidence and intended diffs.
- `debugging-remediation`: keeps unclear bugs and regressions rooted in reproduction, source evidence, owner seams, and verification instead of intuition patches.
- `execution-plan-authoring`: keeps Lineup plans decision-complete at seam/scope/verification level without inheriting generic pseudo-code-heavy planning defaults.
- `verification-strategy`: makes verification explicit and risk-matched without turning every change into fail-first TDD or brittle-test scaffolding.
- `ui-composition-patterns`: pairs global UI design skills with Lineup's TV-specific design language and focus rules.
- `persistence-boundaries`: keeps storage ownership centralized and typed.
- `plex-integration-boundaries`: keeps Plex transport/policy complexity out of unrelated modules.
- `parallel-sidecars`: keeps optional multi-agent usage shallow, role-disciplined, and off the immediate critical path.
- `repo-production-review`: invokes the global production-review suite with Lineup's local workflow reads, read-only boundary, and role constraints.
- `review-adjudication`: calibrates reviewer feedback against current Lineup evidence, plan scope, and boundary ownership before implementation.
- `review-request`: standardizes bounded packets for reviewer agents and launcher reviews without passing unbounded session history.
- `model-selection`: keeps Lineup session-to-session model advice explicit, cheap by default, and only auto-emitted for high-risk handoffs.

## Tracked Codex Role Routing

- `planner`: `gpt-5.6-sol medium`; default write-capable planning role for bounded planning artifacts and execution-ready handoffs.
- `planner_deep`: `gpt-5.6-sol xhigh`; write-capable planning role for Tier 3, hotspot, priority-exit, cross-boundary, unresolved architecture/product seam, and security-adjacent planning; not product-code implementation.
- `worker`: `gpt-5.6-sol medium`; default implementation role.
- `worker_luna`: `gpt-5.6-luna xhigh`; lower-cost write-capable role only for approved, bounded, exact, cheap-to-verify execution units that explicitly declare eligibility and stop/escalate on ambiguity, plan contradiction, scope expansion, unexpected cross-boundary coupling, or verification failure needing diagnosis.
- `cleanup_worker`: `gpt-5.6-sol medium`; Tier 3 cleanup-loop implementation default.
- `reviewer`: `gpt-5.6-sol high`; normal read-only adversarial review.
- `maintainability_reviewer`: `gpt-5.6-sol xhigh`; read-only code-health, slop, file-shape, test-brittleness, and maintainability review with no style-only blocking.
- `architecture_reviewer`: `gpt-5.6-sol xhigh`; read-only hotspot, owner-seam, cross-module coupling, persistence, Plex, UI composition/focus/navigation, public contract, priority-exit, and security-adjacent architecture review.
- `docs_researcher`: `gpt-5.6-luna high`; read-only external documentation and source-backed research.
- `explorer`: `gpt-5.3-codex-spark xhigh`; latency-sensitive code exploration.
- `explorer_fallback`: `gpt-5.6-luna xhigh`.
- `monitor`: `gpt-5.3-codex-spark low`; latency-sensitive waits and polling.
- `monitor_fallback`: `gpt-5.6-luna low`.

## Repo-Local Subagent Policy

- Generic global subagent skills may still be installed for Codex, but they are not the authoritative Lineup workflow.
- Generic global planning skills may still exist for Codex, but they are not the authoritative Lineup planner surface.
- For this repo, prefer repo-local subagent skills:
  - `parallel-sidecars` for optional exploration/review/docs/wait sidecars
  - `bounded-worker-execution` for approved-plan worker slices with disjoint write scopes
- For plan authoring, prefer repo-local skills:
  - `verification-strategy` to choose the proof mode and avoid brittle verification
  - `execution-plan-authoring` to freeze the execution seam without pseudo-code bloat
- For debugging, review, and closeout, prefer repo-local skills:
  - `debugging-remediation` for unclear symptoms, regressions, and failing tests
  - `review-request` for bounded reviewer packets
  - `review-adjudication` for acting on review feedback
  - `closeout-verification` before completion, commit, push, PR, or handoff claims

## UI Skill Recommendation

For UI work, the default stack should be:

1. Choose one global UI skill based on intent:
   - `interface-design` for product interfaces (dashboards/admin/settings/tools/data-heavy UI)
   - `frontend-design` for marketing/landing pages and other brand-forward surfaces
2. Repo-local `ui-composition-patterns` for Lineup-specific TV composition, focus, motion, and cleanup rules.
3. Repo-local `architecture-boundaries` when UI work starts changing ownership or expanding hotspot classes.

Keep the set minimal: two global UI skills with a clear boundary is preferable to many overlapping design skills.

## Future Recommendations

- Add lightweight eval tasks for the most important workflows:
  - refactor in hotspot without growing responsibility
  - add storage-backed setting without raw `localStorage`
  - modify overlay without breaking focus cleanup
  - change Plex stream logic without leaking transport policy into callers
- Use [`docs/agentic/evals-roadmap.md`](./evals-roadmap.md) as the first evaluation layer and tighten it during the phase-2 transition in [`docs/agentic/phase-2-steady-state-plan.md`](./phase-2-steady-state-plan.md).
- Promote a Lineup skill to global only after it proves broadly reusable outside this repo.
