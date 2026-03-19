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

For deferred harness-ingestion candidates from archived section summaries, use:

- `docs/runs/<date>-harness-ingestion-triage/Documentation.md`

Use this directory when a major structural or multi-session task needs durable local execution memory without adding high-churn artifacts to the main repo history.

If one of those local artifacts becomes durable repo guidance, promote the useful content into:

- `docs/plans/` for tracked implementation plans
- `docs/architecture/` for current-state truth
- `docs/agentic/` for workflow or harness guidance

Path hygiene rules:

- keep local run-bundle artifact paths truthful: if the file lives under `docs/runs/...`, reference it as `docs/runs/...`
- do not rewrite a local run-bundle artifact as `docs/plans/...` just because the content looks plan-like
- only switch a reference to `docs/plans/...` after the artifact has actually been promoted into a tracked plan
- when a tracked doc absorbs a durable lesson from a run bundle, record which tracked doc absorbed it instead of pretending the run artifact itself became tracked

Close out each run bundle by recording:

- the durable lesson learned
- which tracked doc absorbed it
- which run artifacts remain intentionally local-only

Do not treat `docs/runs/` as a source-of-truth surface for repo policy.
