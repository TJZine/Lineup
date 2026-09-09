# Doc Gardening Checklist

## Cadence

- run every 2-4 weeks
- run after major cleanup milestones

## Control Plane Checks

- stale workflow duplication is removed or archived
- current workflow docs still match actual practice
- feature and cleanup work still route through the shared runbook; historical
  launcher references do not reintroduce removed skills or gates
- broken links are fixed
- required maintained docs still exist

## Architecture Truth Checks

- `docs/architecture/CURRENT_STATE.md` still reflects the current code
- hotspot ownership is still documented honestly
- aspirational future-state claims are not written as current fact

## Decision And Plan Hygiene

- stale plan references are updated
- active-vs-archived plan placement is still correct
- `npm run verify:docs` still passes for active control-plane structure
- run `npm run plans:stale` to review active-plan archive candidates without auto-archiving them
- stale decision index entries are removed or fixed
- completed sections or standout archived plans are reviewed for updates to `docs/agentic/historical-plan-corpus-review.md`
- promote only durable lessons from archived work; do not create a mandatory ingestion loop

## Skill Topology Checks

- `.agents/skills` remains the tracked repo-local skill home
- no legacy singular-agent mirror or `.codex/skills` source has reappeared
- repo-local skill references in the workflow docs, launchers, and verifier still point to `.agents/skills`

## Eval Review Checks

- prompt definitions still reflect current repo risks
- trigger-based eval requirements in `docs/agentic/evals/README.md` still match the current workflow, launcher, skill, and role surfaces
- rubric and scorecard still match the workflow the repo expects
- local-only baseline outputs are not creeping into tracked docs
- tracked baseline summaries exist for completed baseline runs
- local run bundles and eval baselines that changed workflow conclusions were absorbed into the right tracked docs
- recurring eval misses are folded back into tracked workflow docs when warranted
