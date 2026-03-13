# 20 Skill Routing Interface-vs-Frontend

## Source

- routing defaults in [`agents.md`](../../../../agents.md)
- workflow routing in [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../AGENTIC_DEV_WORKFLOW.md)
- skill topology in [`docs/agentic/skill-strategy.md`](../../skill-strategy.md)
- feature prompt routing in [`docs/agentic/session-prompts/feature-plan.md`](../../session-prompts/feature-plan.md), [`docs/agentic/session-prompts/feature-implement.md`](../../session-prompts/feature-implement.md), and [`docs/agentic/session-prompts/feature-review.md`](../../session-prompts/feature-review.md)
- mirror allowlist in [`docs/agentic/skill-mirror-allowlist.txt`](../../skill-mirror-allowlist.txt)
- mirror sync script in [`scripts/sync_agent_skills.sh`](../../../../scripts/sync_agent_skills.sh)
- TV UI pairing rules in [`.codex/skills/ui-composition-patterns/SKILL.md`](../../../../.codex/skills/ui-composition-patterns/SKILL.md)

## Intent

Test whether the workflow and prompt templates route UI requests to the correct global UI design skill, and whether Antigravity mirrors the correct global skills.

## Prompt

Adversarially review the tracked repo workflow surfaces for skill routing and mirroring. Treat contradictions across tracked docs or prompt templates as failures, not as tie-breakers.

1) Validate the routing boundary is explicit and non-overlapping:
   - `interface-design` is used for product interfaces (dashboards/admin/settings/tools/data-heavy UI)
   - `frontend-design` is used for marketing/landing pages and other brand-forward surfaces
   - ambiguity is treated as a stop condition / clarifying-question trigger, not a guess
   - every tracked routing surface agrees on that split; no tracked doc defaults all UI creation/redesign to `frontend-design`

2) Validate the mirroring mechanism is correct and reproducible:
   - `docs/agentic/skill-mirror-allowlist.txt` includes both `global:frontend-design` and `global:interface-design`
   - `scripts/sync_agent_skills.sh` will fail loudly if a pinned global skill is missing
   - after running the sync, `.agent/skills/interface-design/` and `.agent/skills/frontend-design/` exist and contain `SKILL.md` and `LICENSE.txt`
   - `git status --porcelain` does not show tracked changes under `.agent/skills/`

3) Validate Lineup UI work still layers TV constraints correctly:
   - `.codex/skills/ui-composition-patterns/SKILL.md` pairs with the correct global UI skill and still points to `docs/design/ui-design-language.md`

Report findings ordered by severity. If you find a routing ambiguity, propose a concrete doc or prompt-template patch to remove it.

## Expected Skills

- `using-superpowers`
- `verification-before-completion`

## Expected Codanna Behavior

- run at least two targeted `search_documents` queries with concrete anchors for routing and mirroring surfaces
- if the top Codanna hits do not include the target files, explicitly log Codanna as insufficient and fall back to `rg`

## Expected Evidence Commands

- Codanna-first repo-doc discovery (example query): `skill mirror allowlist interface-design frontend-design`
- Codanna-first routing query (example query): `feature-plan ui-composition-patterns interface-design frontend-design`
- Fallback grep: `rg -n "\\b(frontend-design|interface-design)\\b" agents.md docs .codex/skills -S`
- `sed -n '1,80p' agents.md`
- `sed -n '20,60p' docs/AGENTIC_DEV_WORKFLOW.md`
- `sed -n '70,95p' docs/agentic/skill-strategy.md`
- `sed -n '1,120p' docs/agentic/skill-mirror-allowlist.txt`
- `sed -n '1,140p' scripts/sync_agent_skills.sh`
- `sed -n '1,60p' .codex/skills/ui-composition-patterns/SKILL.md`
- `bash scripts/sync_agent_skills.sh`
- `ls -la .agent/skills/interface-design .agent/skills/frontend-design`
- `git status --porcelain` (must not show tracked changes under `.agent/skills/`)

## Expected Verification

- `npm run verify:docs`

## Output Contract

- findings first, ordered by severity
- each finding names the exact file path, why it violates the prompt intent, and a concrete patch recommendation
- if no material findings exist, say so explicitly and note any residual risk
- end with an overall rubric verdict (`pass` / `soft-fail` / `fail`) plus short per-dimension justification

## Fail Conditions

- any tracked workflow or prompt surface still routes all UI creation/redesign to `frontend-design` instead of the product-vs-marketing split
- `frontend-design` or `interface-design` is missing from the mirror allowlist or missing after sync
- `.codex/skills/ui-composition-patterns/SKILL.md` still hard-codes `frontend-design` as the only pairing
- review claims success without showing the evidence commands and results
- committing or referencing `.agent/skills/` in tracked docs (local-only leakage)
