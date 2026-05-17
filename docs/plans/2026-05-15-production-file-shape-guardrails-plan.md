# Production File-Shape Guardrails Plan

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** standalone remediation

## Goal

Add a Lineup-specific production file-shape guard as a regression brake. The guard baselines today's oversized production files, blocks unreviewed growth beyond those baselines, and requires reviewed rationale plus decomposition triggers for any new production file over threshold.

This is tooling, verification, and architecture-guidance work. Product runtime behavior must not change.

## Non-Goals

- Do not refactor oversized production files as part of this plan.
- Do not include oversized tests in V1 scope.
- Do not update `.desloppify` state, `scorecard.png`, cleanup checklist status, or unrelated plan artifacts.
- Do not exclude `src/**/build/**` from production counting unless a separate source-backed review proves those files are generated.
- Do not hand-copy stale aggregate counts into architecture documentation.

## Parent Architecture Alignment

This standalone remediation advances the steady-state guardrail that hotspot files must not absorb new responsibility without explicit review. It adds a mechanical production-source size guard that complements, but does not replace, architecture review and source-backed cleanup planning.

No `ARCHITECTURE_CLEANUP_CHECKLIST.md` item is being updated.

## Required Reading

- `AGENTS.md`
- `docs/AGENTIC_DEV_WORKFLOW.md`
- `docs/agentic/codanna-playbook.md`
- `docs/agentic/plan-authoring-standard.md`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/README.md`
- `docs/development/testing.md`
- `package.json`

Freshness gate: immediately before landing, generate the initial allowlist from `tools/verify-maintainability.mjs` using its own counting logic. If the current oversized-file set differs from assumptions made during implementation, update the allowlist and rerun the targeted verifier/tests before closeout.

## Required Skills

- `architecture-boundaries`, because the new guard codifies hotspot growth policy.
- `verification-strategy`, because the proof surface is an integration/tooling workflow rather than product runtime behavior.
- `execution-plan-authoring`, because this tracked plan is the active durable handoff surface.
- `closeout-verification`, before claiming completion.

## Codanna Discovery

- `get_index_info`: index contained 12,601 symbols across 812 files; semantic search was enabled and updated 35 minutes before planning.
- `semantic_search_with_context` query `verify docs architecture scripts package verify architecture maintainability guard` found `tools/architecture-rules/lineupArchitectureRules.mjs` plus Jest/tool config anchors. The result established the existing architecture-verification/tooling area but was not precise enough for script wiring.
- `search_documents` query `verify architecture docs testing plan authoring standard file shape guardrails` returned existing active plan and docs hits but no existing file-shape guardrail document. Direct reads of `package.json`, `docs/plans/README.md`, and adjacent docs are the deterministic fallback for exact command and doc-inventory edits.
- `analyze_impact`: not available in the surfaced Codanna toolset for this session. Impact is handled by exact script/doc reads and the verification commands below.

## Impact Snapshot

- `package.json` currently defines `verify:architecture` as `eslint src`, and `npm run verify` runs `verify:architecture` transitively.
- `npm run verify:docs` runs `tools/verify-docs.mjs`, `npm run test:harness-docs`, and `npm run test:verify-docs-contracts`.
- `tools/__tests__/*.test.mjs` is the existing Node harness-doc test surface used by `npm run test:harness-docs`.
- The new guard should be owned by `tools/verify-maintainability.mjs` and documented under `docs/architecture/file-shape-guardrails.md`.
- The initial allowlist is data owned by the new guardrail document. The verifier must fail stale rows, malformed rows, baseline growth, missing rows, deleted/renamed non-production paths, and allowlisted files that shrink back to `<=500` lines.

## Files In Scope

- `tools/verify-maintainability.mjs`
- `tools/__tests__/verify-maintainability.test.mjs`
- `package.json`
- `docs/architecture/file-shape-guardrails.md`
- `docs/architecture/README.md`
- `docs/architecture/CURRENT_STATE.md`
- `docs/development/testing.md`
- `docs/AGENTIC_DEV_WORKFLOW.md`
- `docs/agentic/plan-authoring-standard.md`
- `tools/verify-docs.mjs` and related docs tests only if the new document or command inventory requires mechanical enforcement updates
- this plan file

## Files Out Of Scope

- `src/**` product runtime changes, except read-only line counting by the verifier.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.desloppify/**`
- `scorecard.png`
- Unrelated active plans, archived plans, run logs, package maps, and eval summaries.
- Generated build artifacts outside `src/**`.

## Planner Self-Check

- No unresolved architecture seam remains: this work adds a guardrail tool and docs; it does not move runtime ownership or product behavior.
- Adjacent contract changes are limited to package scripts and docs-verifier inventory if required.
- Files out of scope are not needed for implementation. Production files under `src/**` are read by the verifier but not edited.
- Codanna evidence and deterministic fallbacks are recorded above.
- The work assigns ownership to the repo tooling and architecture-doc surfaces rather than growing product hotspots.
- A fresh session should not need to invent threshold policy, counted extensions, exclusions, stale-row behavior, verification depth, or script wiring.
- The plan is execution-grade; no product or architecture design decision remains open.

## Architecture Seam Decision Gate

Implement one execution unit: `PRODUCTION-FILE-SHAPE-GUARD`.

Required policy:

- Count production files under `src/**` with `.ts`, `.tsx`, `.css`, and `.html` extensions.
- Exclude tests via `__tests__` path segments and `*.test.*` filenames.
- Count `src/**/build/**` as production source.
- Files over 500 lines require an allowlist row with path, baseline lines, rationale, and growth/decomposition trigger.
- Files over 800 lines require an explicit decomposition/revisit trigger.
- Fail if a file grows beyond its recorded baseline.
- Fail if an allowlist row points to a deleted, renamed, or non-production path.
- Fail if an allowlisted file shrinks to `<=500` lines.
- Generate the initial allowlist using the verifier's own counting logic immediately before landing.

Stop and replan if:

- Current production-source shape cannot be counted deterministically from Node without adding a dependency.
- The docs format cannot be parsed without brittle prose scraping; in that case, introduce a narrow structured block in `docs/architecture/file-shape-guardrails.md` and document it.
- Wiring `verify:maintainability` into `verify:architecture` would create a circular or duplicated command path.
- `verify-docs` requires broad new doc-governance policy beyond inventory awareness for the new architecture doc or command.
- Initial counting proves that a large path is generated source and should be excluded; require separate source-backed review before changing the V1 policy.

Debt-regression gate: this plan directly addresses hotspot growth. The diff must not increase responsibilities inside production hotspots, add compatibility shims, or create a second guardrail owner. Proof is the new verifier tests, script wiring, and final diff audit.

## Verification Commands

- Verification classification: `broader integration/manual proof required`

Why: this is a tooling/control-plane change. The verifier requires targeted contract tests, while the script wiring and docs updates need integration proof through existing docs and architecture verification.

- Run: `npm run test:harness-docs`
- Expected: passes, including `tools/__tests__/verify-maintainability.test.mjs`.
- Run: `npm run verify:docs`
- Expected: passes for the new architecture/control-plane docs.
- Run: `npm run verify:maintainability`
- Expected: passes against the generated current allowlist.
- Run: `npm run verify:architecture`
- Expected: runs ESLint and the maintainability verifier.
- Run: `npm run verify`
- Expected: enforces the maintainability guard transitively.

New tests are required because the guard's behavior is a new repo contract. Cover missing rows, malformed rows, baseline growth, stale/deleted paths, stale rows after shrink, test exclusion, hard-overage triggers, and `src/**/build/*.ts` being counted.

## Rollback Notes

If the guard blocks legitimate current production source because of a verifier bug, revert the verifier, its tests, package-script wiring, and the file-shape guardrail doc together, then rerun `npm run verify:docs` and `npm run verify:architecture`.

If only the initial allowlist is wrong, regenerate it from the verifier's counting logic and rerun `npm run verify:maintainability`, `npm run verify:architecture`, and `npm run verify:docs`.

## Commit Checkpoints

- Checkpoint 1: active tracked plan created and `npm run plans:check` / docs verification issues addressed if the plan itself fails validation.
- Checkpoint 2: verifier and tests pass with a temporary fixture corpus.
- Checkpoint 3: initial allowlist generated from current source and architecture/testing docs updated.
- Checkpoint 4: full verification commands pass and final diff audit confirms only intended tooling/docs/script changes.
