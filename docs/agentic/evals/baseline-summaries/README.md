# Eval Baseline Summaries

This directory holds the tracked summaries for manual agent-eval baseline runs.

Keep raw scorecards, transcripts, and comparison notes local-only under [`docs/agentic/evals/baselines/`](../baselines/README.md).

Add one tracked summary file per baseline run when the run is complete.

Each summary must include:

- date
- operator / agent surface
- session metadata (fresh-session status, launcher/session id, and repo-state note)
- prompts run
- Codanna fallback log (used or not, and exact invocation/condition/evidence path when used)
- fresh-session deviations, if any
- outcome summary
- recurring misses
- workflow/docs/skills changed in response
- durable lessons absorbed
- intentionally local-only artifacts
- next required follow-up, if any

Use [`docs/agentic/evals/baseline-summary-template.md`](../baseline-summary-template.md) as the default starting point.
