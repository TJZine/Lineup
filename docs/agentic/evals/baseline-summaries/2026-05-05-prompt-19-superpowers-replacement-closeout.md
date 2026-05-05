# Eval Baseline Summary

## Date

- `2026-05-05`

## Operator / Agent Surface

- operator: Codex worker subagent
- eval run surface: trigger-based manual closeout review of the staged multi-agent/repo-local skill routing change replacing legacy Superpowers workflow dependencies with repo-local Codex-native skills

## Session Metadata

- fresh-session run: `no`
- session id / launcher: bounded worker subagent closeout for prompt `19-multi-agent-role-selection-and-delegation-discipline`
- repo state note (clean branch/worktree or exception): dirty worktree exception; unrelated pre-existing tracked and untracked changes were present, and scoring was scoped to the staged workflow/control-plane diff plus the prompt-19 eval surface

## Prompts Run

- `19-multi-agent-role-selection-and-delegation-discipline`

## Codanna Fallback Log

- fallback used: `yes`
- exact invocation: `mcp__codanna__.search_documents` with query `workflow control-plane repo-local skills replace Superpowers closeout verification review request mirror allowlist eval prompt 13 19 delegation discipline`
- condition: Codanna returned unrelated plan/user-guide results and did not surface the multi-agent role policy, eval prompt, mirror-policy owner docs, or staged repo-local skill changes needed to score this closeout.
- fallback evidence captured: `git diff --staged`, targeted reads of `docs/agentic/evals/README.md`, `docs/agentic/evals/rubric.md`, `docs/agentic/evals/baseline-summary-template.md`, prompt `19`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/skill-strategy.md`, `docs/agentic/skill-mirror-allowlist.txt`, `tools/harness-docs-lib.mjs`, and relevant verifier/test diffs.

## Fresh-Session Deviations

- This was not an independent fresh session started with only prompt `19`; it was a dispatched closeout worker evaluating the current staged diff after parent verification.
- The deviation is recorded because the parent explicitly requested trigger-based closeout evidence for the staged change under a dirty-worktree exception.
- No raw baseline transcript or `docs/runs/*` bundle was promoted.

## Outcome Summary

- outcome: `pass`
- The staged change preserves conservative multi-agent discipline:
  - `docs/AGENTIC_DEV_WORKFLOW.md` still says multi-agent support is optional and only valid when it improves reliability, throughput, or both.
  - optional sidecars remain owned by `parallel-sidecars`.
  - bounded implementation slices remain owned by `bounded-worker-execution`.
  - new `review-request` guidance keeps adversarial review packets bounded and read-only.
  - `review-adjudication` keeps reviewer feedback from silently widening scope or crossing Lineup owner boundaries.
- The repo-local skill inventory now includes `closeout-verification`, `debugging-remediation`, `review-adjudication`, and `review-request`, replacing generic Superpowers workflow dependencies without changing tracked role semantics.
- The mirror policy now rejects `superpowers:*` entries mechanically, which prevents Antigravity mirror state from becoming an implicit dependency on removed workflow skills.
- Prompt `19` now expects `closeout-verification` and `review-request` when an adversarial sidecar/reviewer pass is requested, matching the staged workflow update.
- Parent-reported verification before this worker dispatch:
  - `scripts/sync_agent_skills.sh` passed.
  - `npm run docs:sync` passed.
  - `npm run verify:docs` passed.
  - `npx jest --config jest.tools.config.js --runInBand src/__tests__/tools/syncAgentSkills.test.ts` passed after the negative `superpowers:*` entry test was added.

## Recurring Misses

- Codanna document search was insufficient for this specific role-routing closeout and required explicit fallback to staged diff plus targeted file reads.
- The only material reviewer issue reported by the parent was missing manual eval evidence; this summary supplies that evidence for prompt `19`.

## Workflow / Docs / Skills Changed In Response

- No additional workflow docs, skills, scripts, tests, or plans were changed by this closeout worker.
- Baseline evidence was added in `docs/agentic/evals/baseline-summaries/2026-05-05-prompt-19-superpowers-replacement-closeout.md`.

## Durable Lessons Absorbed

- Replacing legacy workflow dependencies with repo-local skills should keep delegation ownership split: sidecars, bounded workers, reviewer packet requests, review adjudication, and closeout verification remain separate responsibilities.
- Role/delegation eval evidence should mention both policy text and mechanical enforcement when mirror or inventory logic changes.
- Codanna fallback logging matters for prompt `19` because role-selection mistakes are easy to hide behind broad direct reads unless the insufficient discovery path is explicit.

## Intentionally Local-Only Artifacts

- No raw eval transcript was committed.
- No `docs/runs/*` bundle was promoted.
- Unrelated dirty files and untracked plan artifacts outside `docs/agentic/evals/baseline-summaries/` were left untouched.

## Next Follow-Up

- none required for prompt `19` unless review asks for independent fresh-session raw transcripts in addition to this tracked closeout summary
