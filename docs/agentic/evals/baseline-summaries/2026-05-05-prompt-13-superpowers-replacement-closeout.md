# Eval Baseline Summary

## Date

- `2026-05-05`

## Operator / Agent Surface

- operator: Codex worker subagent
- eval run surface: trigger-based manual closeout review of the staged workflow/control-plane change replacing legacy Superpowers workflow dependencies with repo-local Codex-native skills

## Session Metadata

- fresh-session run: `no`
- session id / launcher: bounded worker subagent closeout for prompt `13-risk-tiered-orchestration-and-local-only-absorption`
- repo state note (clean branch/worktree or exception): dirty worktree exception; unrelated pre-existing tracked and untracked changes were present, and scoring was scoped to the staged workflow/control-plane diff plus the prompt-13 eval surface

## Prompts Run

- `13-risk-tiered-orchestration-and-local-only-absorption`

## Codanna Fallback Log

- fallback used: `yes`
- exact invocation: `mcp__codanna__.search_documents` with query `workflow control-plane repo-local skills replace Superpowers closeout verification review request mirror allowlist eval prompt 13 19 delegation discipline`
- condition: Codanna returned unrelated plan/user-guide results and did not surface the eval README, prompt definitions, staged workflow diff, or mirror-policy owner docs needed to score this closeout.
- fallback evidence captured: `git diff --staged`, targeted reads of `docs/agentic/evals/README.md`, `docs/agentic/evals/rubric.md`, `docs/agentic/evals/baseline-summary-template.md`, prompt `13`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/skill-strategy.md`, `docs/agentic/skill-mirror-allowlist.txt`, `scripts/sync_agent_skills.sh`, and relevant verifier/test diffs.

## Fresh-Session Deviations

- This was not an independent fresh session started with only prompt `13`; it was a dispatched closeout worker evaluating the current staged diff after parent verification.
- The deviation is recorded because the parent explicitly requested trigger-based closeout evidence for the staged change under a dirty-worktree exception.
- No raw baseline transcript or `docs/runs/*` bundle was promoted.

## Outcome Summary

- outcome: `pass`
- The staged change remains bounded to workflow/control-plane, skill, docs, script, and verifier-test surfaces; no application code is touched.
- The change uses the lightest valid orchestration path for prompt `13`: a bounded worker closeout plus manual eval evidence, not a full controller loop or new run bundle.
- Durable workflow lessons were absorbed into existing tracked surfaces:
  - `docs/AGENTIC_DEV_WORKFLOW.md` now points completion and review discipline at repo-local `closeout-verification`, `review-request`, and `review-adjudication`.
  - `docs/agentic/skill-strategy.md` makes debugging, review, and closeout discipline repo-local and removes generic Superpowers coupling language.
  - `docs/agentic/skill-mirror-allowlist.txt`, `scripts/sync_agent_skills.sh`, and `tools/harness-docs-lib.mjs` make the mirror policy global-only and reject `superpowers:*`.
  - prompt `13` now expects `closeout-verification`.
- Parent-reported verification before this worker dispatch:
  - `scripts/sync_agent_skills.sh` passed.
  - `npm run docs:sync` passed.
  - `npm run verify:docs` passed.
  - `npx jest --config jest.tools.config.js --runInBand src/__tests__/tools/syncAgentSkills.test.ts` passed after the negative `superpowers:*` entry test was added.

## Recurring Misses

- Codanna document search was insufficient for this workflow-control closeout and required explicit fallback to staged diff plus targeted file reads.
- The only material reviewer issue reported by the parent was missing manual eval evidence; this summary supplies that evidence for prompt `13`.

## Workflow / Docs / Skills Changed In Response

- No additional workflow docs, skills, scripts, tests, or plans were changed by this closeout worker.
- Baseline evidence was added in `docs/agentic/evals/baseline-summaries/2026-05-05-prompt-13-superpowers-replacement-closeout.md`.

## Durable Lessons Absorbed

- Replacing generic workflow skills with repo-local Codex-native skills should be validated as a control-plane change, even when automated docs verification already passes.
- Mirror-policy changes that remove a source class need both mechanical rejection coverage and prompt `13` evidence that durable lessons stayed in tracked workflow surfaces rather than local-only artifacts.
- Codanna insufficiency must be logged concretely; a broad "used Codanna" claim is not enough when the returned documents do not support the eval decision.

## Intentionally Local-Only Artifacts

- No raw eval transcript was committed.
- No `docs/runs/*` bundle was promoted.
- Unrelated dirty files and untracked plan artifacts outside `docs/agentic/evals/baseline-summaries/` were left untouched.

## Next Follow-Up

- none required for prompt `13` unless review asks for independent fresh-session raw transcripts in addition to this tracked closeout summary
