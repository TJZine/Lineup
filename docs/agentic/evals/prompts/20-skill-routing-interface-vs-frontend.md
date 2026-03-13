# 20 Skill Routing Interface-vs-Frontend

## Source

- Skill topology update adding `interface-design` alongside `frontend-design` (2026-03-13)

## Intent

Test whether the workflow and prompt templates route UI requests to the correct global UI design skill, and whether Antigravity mirrors the correct global skills.

## Prompt

Adversarially review the repo workflow surfaces for skill routing and mirroring.

1) Validate the routing boundary is explicit and non-overlapping:
   - `interface-design` is used for product interfaces (dashboards/admin/settings/tools/data-heavy UI)
   - `frontend-design` is used for marketing/landing pages and other brand-forward surfaces
   - ambiguity is treated as a stop condition / clarifying-question trigger, not a guess

2) Validate the mirroring mechanism is correct and reproducible:
   - `docs/agentic/skill-mirror-allowlist.txt` includes `global:interface-design`
   - `scripts/sync_agent_skills.sh` will fail loudly if a pinned global skill is missing
   - after running the sync, `.agent/skills/interface-design/` exists and contains `SKILL.md` and `LICENSE.txt`

3) Validate Lineup UI work still layers TV constraints correctly:
   - `.codex/skills/ui-composition-patterns/SKILL.md` pairs with the correct global UI skill and still points to `docs/design/ui-design-language.md`

Report findings ordered by severity. If you find a routing ambiguity, propose a concrete doc or prompt-template patch to remove it.

## Expected Skills

- `using-superpowers`
- `verification-before-completion`

## Expected Codanna Behavior

- use `search_documents` for the workflow surfaces that define skill routing and mirroring
- fall back to `rg` only if Codanna is missing or insufficient, and explicitly say so

## Expected Evidence Commands

- Codanna-first repo-doc discovery (example query): `skill mirror allowlist interface-design frontend-design`
- Fallback grep: `rg -n "\\b(frontend-design|interface-design)\\b" docs .codex/skills -S`
- `sed -n '1,120p' docs/agentic/skill-mirror-allowlist.txt`
- `bash scripts/sync_agent_skills.sh`
- `ls -la .agent/skills/interface-design`
- `git status --porcelain` (must not show tracked changes under `.agent/skills/`)

## Expected Verification

- `npm run verify:docs`

## Fail Conditions

- routing remains “frontend-design for all UI” with no product-vs-marketing boundary
- `interface-design` is installed globally but not pinned for mirroring into `.agent/skills/`
- `.codex/skills/ui-composition-patterns/SKILL.md` still hard-codes `frontend-design` as the only pairing
- review claims success without showing the evidence commands and results
- committing or referencing `.agent/skills/` in tracked docs (local-only leakage)
