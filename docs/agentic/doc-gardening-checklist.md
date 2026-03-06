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
- stale decision index entries are removed or fixed
- completed sections or standout archived plans are reviewed for updates to `docs/agentic/historical-plan-corpus-review.md`

## Skill Mirror Checks

- `.codex/skills` remains Lineup-only
- `.agent/skills` remains the curated mirror set after `scripts/sync_agent_skills.sh`
- no repo-local skill drift has appeared between Codex source and Antigravity mirror expectations

## Eval Review Checks

- prompt definitions still reflect current repo risks
- rubric and scorecard still match the workflow the repo expects
- local-only baseline outputs are not creeping into tracked docs
- recurring eval misses are folded back into tracked workflow docs when warranted
