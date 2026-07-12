# Agent Skill Strategy

`.agents/skills/` is Lineup's single tracked repo-local skill home. Skills use
progressive disclosure: their name and description support routing; full instructions
load only when selected.

## Rules

- Keep each skill focused on one task or one production boundary.
- Prefer one process skill plus only the boundary skills required by the change.
- Put global workflow policy in `docs/AGENTIC_DEV_WORKFLOW.md`; skills should not
  restate tiering, commands, generic quality principles, or the full role catalog.
- Explicit-only launcher skills must declare
  `policy.allow_implicit_invocation: false`.
- Preserve an old skill name as a tiny compatibility entrypoint only while a current
  tracked executable entrypoint still references it. Remove the compatibility entrypoint
  once tracked inbound references are zero and the migration is complete; compatibility
  entrypoints own no policy.
- Do not add a skill without a recurring failure or workflow that cannot be handled
  clearly by the runbook and an existing skill.
- Prefer instructions to scripts unless deterministic tooling is genuinely required.

## Inventory Shape

Process skills cover planning, debugging, verification, review lifecycle,
delegation, closeout, and explicit feature/cleanup launchers. Boundary skills cover
architecture, TypeScript production quality, test design, persistence, Plex, and UI
composition. The global production-review suite has one thin Lineup wrapper.

`.codex/config.toml` owns the role catalog. The compact `model-selection` skill owns
task-specific cost/capability routing; retain a distinct role only while that routing
boundary is explicit and useful.

## Maintenance

During harness review, inspect descriptions for overlap, measure selected-skill
context, and remove duplicated instructions. Test representative prompts for both
under-triggering and over-triggering. Do not preserve stale skill topology through
verifier assertions.
