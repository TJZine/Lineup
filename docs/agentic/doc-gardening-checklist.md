# Doc Gardening Checklist

## Cadence

- run every 2-4 weeks
- run after major cleanup milestones

## Control Plane Checks

- stale workflow duplication is removed or archived
- current workflow docs still match actual practice
- broken links are fixed
- required maintained docs still exist

## Architecture Truth Checks

- `docs/architecture/CURRENT_STATE.md` still reflects the current code
- hotspot ownership is still documented honestly
- aspirational future-state claims are not written as current fact

## Decision And Plan Hygiene

- stale plan references are updated
- active-vs-archived plan placement is still correct
- `npm run plans:check` still passes for active serious plans
- run `npm run plans:stale` to review active-plan archive candidates without auto-archiving them
- stale decision index entries are removed or fixed
- completed sections or standout archived plans are reviewed for updates to `docs/agentic/historical-plan-corpus-review.md`
- run `npm run harness:ingestion` after archiving a completed section summary and during broader doc-gardening passes

## Skill Mirror Checks

- `.codex/skills` remains Lineup-only
- `.agent/skills` still matches [`docs/agentic/skill-mirror-allowlist.txt`](./skill-mirror-allowlist.txt) after `scripts/sync_agent_skills.sh`
- no repo-local skill drift has appeared between Codex source and Antigravity mirror expectations

## Eval Review Checks

- prompt definitions still reflect current repo risks
- rubric and scorecard still match the workflow the repo expects
- local-only baseline outputs are not creeping into tracked docs
- tracked baseline summaries exist for completed baseline runs
- local run bundles and eval baselines that changed workflow conclusions were absorbed into the right tracked docs
- recurring eval misses are folded back into tracked workflow docs when warranted
