# 20 Skill Routing Interface-vs-Frontend

## Source

- routing defaults in [`AGENTS.md`](../../../../AGENTS.md)
- workflow routing in [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../AGENTIC_DEV_WORKFLOW.md)
- skill topology in [`docs/agentic/skill-strategy.md`](../../skill-strategy.md)
- explicit feature workflow skills: `lineup-feature-plan`, `lineup-feature-implement`, and `lineup-feature-review`
- tracked skill topology in [`.agents/skills/`](../../../../.agents/skills/)
- TV UI pairing rules in [`.agents/skills/ui-composition-patterns/SKILL.md`](../../../../.agents/skills/ui-composition-patterns/SKILL.md)

## Intent

Test whether the workflow and prompt templates route UI requests to the correct global UI design skill, and whether repo-local skills remain discoverable from the tracked `.agents/skills/` topology.

## Prompt

Adversarially review the tracked repo workflow surfaces for skill routing and skill topology. Treat contradictions across tracked docs or prompt templates as failures, not as tie-breakers.

1) Validate the routing boundary is explicit and non-overlapping:
   - `interface-design` is used for product interfaces (dashboards/admin/settings/tools/data-heavy UI)
   - `frontend-design` is used for marketing/landing pages and other brand-forward surfaces
   - ambiguity is treated as a stop condition / clarifying-question trigger, not a guess
   - every tracked routing surface agrees on that split; no tracked doc defaults all UI creation/redesign to `frontend-design`

2) Validate the skill topology is correct and reproducible:
   - repo-local Lineup skills live under `.agents/skills/`
   - the legacy singular-agent mirror and other obsolete repo-local skill-source directories are not treated as active repo skill sources
   - global UI skills are referenced as global skills, not copied into the repo as Lineup-owned duplicates
   - the verification flow does not leave tracked skill-topology churn behind (`git status --porcelain` stays clean for tracked files)

3) Validate Lineup UI work still layers TV constraints correctly:
   - `.agents/skills/ui-composition-patterns/SKILL.md` pairs with the correct global UI skill and still points to `docs/design/ui-design-language.md`

Report findings ordered by severity. If you find a routing ambiguity, propose a concrete doc or prompt-template patch to remove it.

## Expected Skills

- `ui-composition-patterns`
- `closeout-verification`

## Expected Codanna Behavior

- run at least two targeted `search_documents` queries with concrete anchors for routing and skill-topology surfaces
- if the top Codanna hits do not include the target files, explicitly log Codanna as insufficient and fall back to `rg`

## Expected Evidence Commands

- Codanna-first repo-doc discovery (example query): `skill topology .agents/skills interface-design frontend-design`
- Codanna-first routing query (example query): `feature-plan ui-composition-patterns interface-design frontend-design`
- Fallback grep: `rg -n "\\b(frontend-design|interface-design)\\b" AGENTS.md docs .agents/skills -S`
- `sed -n '1,80p' AGENTS.md`
- `sed -n '20,60p' docs/AGENTIC_DEV_WORKFLOW.md`
- `sed -n '70,95p' docs/agentic/skill-strategy.md`
- `git ls-files '.agents/skills/**/SKILL.md' | sort`
- `test -z "$(git ls-files .agent)"`
- `sed -n '1,60p' .agents/skills/ui-composition-patterns/SKILL.md`
- `git status --porcelain` (must not show tracked changes introduced by the verification flow)

## Expected Verification

- `npm run verify:docs`
- pass requires exit code `0`
- fail on any non-zero exit code
- fail if the verifier reports broken links, unresolved tracked doc references, or managed prompt/docs inventory drift
- Source section entries must resolve to existing tracked files; any missing-path or broken-link report is a failed eval run

## Output Contract

- findings first, ordered by severity
- each finding names the exact file path, why it violates the prompt intent, and a concrete patch recommendation
- include an `Evidence` section that lists the exact commands/tools used and the observed result for each item (for example: `rg ...` -> matched files, `sed ...` -> reviewed section, `git status --porcelain` -> clean/dirty)
- if no material findings exist, say so explicitly and note any residual risk
- end with an overall rubric verdict (`pass` / `soft-fail` / `fail`) plus short per-dimension justification

## Fail Conditions

- any tracked workflow or prompt surface still routes all UI creation/redesign to `frontend-design` instead of the product-vs-marketing split
- `frontend-design` or `interface-design` is treated as a Lineup-owned repo-local duplicate instead of a global skill
- `.agents/skills/ui-composition-patterns/SKILL.md` still hard-codes `frontend-design` as the only pairing
- review omits the required `Evidence` section, or claims success without showing the evidence commands/tools and observed results
- the eval depends on mutating local-only mirror output during the eval run, or treats the legacy singular-agent mirror or another obsolete repo-local skill-source directory as an active repo skill source
