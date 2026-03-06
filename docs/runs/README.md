# Local Run Artifacts

`docs/runs/` is the local-only workspace for major-task execution bundles and per-run artifacts.

Tracked here:

- this README
- the reusable templates under [`docs/runs/_template/`](./_template)

Local-only by default:

- `docs/runs/<date>-<topic>/Prompt.md`
- `docs/runs/<date>-<topic>/Plan.md`
- `docs/runs/<date>-<topic>/Implement.md`
- `docs/runs/<date>-<topic>/Documentation.md`

Use this directory when a major structural or multi-session task needs durable local execution memory without adding high-churn artifacts to the main repo history.

If one of those local artifacts becomes durable repo guidance, promote the useful content into:

- `docs/plans/` for tracked implementation plans
- `docs/architecture/` for current-state truth
- `docs/agentic/` for workflow or harness guidance

Do not treat `docs/runs/` as a source-of-truth surface for repo policy.
