# Repo Review Context

Schema-Version: 1
Profile-Status: explicit
Last-Updated: 2026-07-09
Repo-Name: Lineup
Default-Branch: main
Profile-Scope: review-suggestion-adjudication and pr-commit-review
Profile-Basis: code-health branch workflow/config inspection

## Precedence

This file is the primary repo profile for:
- `suggestion-review`
- `pr-commit-review`

Current code, current diff, config, CI, and successfully executed commands outrank stale profile content.
Generated cache files under `.codex/cache/` are optional aids only and must not outrank this profile.

## Technical Stack

- Languages: TypeScript, CSS
- Runtime/platform: webOS-focused Plex virtual channels web application
- Build/tooling: Node, Vite, TypeScript, Jest, ESLint, Stylelint
- Package scripts: use `package.json` as command source of truth
- Node: repo declares `>=22.12.0`; CI also tests Node 22/24 in the code-health branch
- Key risk libraries/areas: Plex integration, TV/D-pad UI, browser/webOS lifecycle, localStorage/persistence, scheduler/channel management

## Product / Domain

- Product type: webOS Plex virtual channels application
- Data sensitivity: Medium; Plex auth/token, server-selection, playback URL, and persistence behaviors can be sensitive
- Operational criticality: User-facing media playback app
- Public surfaces: runtime behavior, settings/persistence, Plex API behavior, UI/focus/navigation, docs/control-plane workflow where agent behavior depends on docs
- Compliance/security notes: Treat auth/token, playback URL, Plex transport, local storage, and persistence behavior as elevated risk

## Authority Surfaces

Current truth:
- `agents.md`
- `docs/AGENTIC_DEV_WORKFLOW.md`
- `docs/architecture/CURRENT_STATE.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `docs/design/ui-design-language.md`
- `docs/design/css-governance.md`
- `docs/api/plex-integration.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.codex/skills/**`
- `docs/agentic/session-prompts/**`

Historical/reference only:
- `docs/archive/**`
- completed/superseded `docs/plans/**`
- local/raw `docs/runs/**` instances unless explicitly promoted into tracked docs

## Control-Plane / Config Paths

Do not treat these as pure docs/assets:
- `agents.md`
- `.codex/config.toml`
- `.codex/agents/**`
- `.codex/skills/**`
- `docs/AGENTIC_DEV_WORKFLOW.md`
- `docs/agentic/**`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.github/workflows/**`
- `.coderabbit.yaml`
- `package.json`
- test/tooling/verifier files

## High-Risk Paths

Trigger architecture/deep review:
- `src/App.ts`
- `src/Orchestrator.ts`
- `src/bootstrap.ts`
- `src/modules/ui/**`
- `src/modules/plex/**`
- `src/modules/player/**`
- `src/modules/lifecycle/**`
- `src/modules/scheduler/**`
- `src/core/server-selection/**`
- `src/platform/**`
- production files over guardrail thresholds or hotspot files named in architecture docs
- `.codex/**` and `docs/agentic/**` when workflow/control-plane behavior changes

## High-Risk Domains

- Plex auth, discovery, library, stream, subtitle, playback URL policy
- localStorage, settings, selected server, channel persistence
- UI focus, remote/D-pad behavior, overlays, timers/listeners, hidden UI cleanup
- Orchestrator/App composition root responsibility growth
- startup/lifecycle/platform assumptions
- public contract drift, dual API shapes, compatibility shims
- workflow/control-plane role routing, model selection, repo-local skills, verifier rules
- cleanup checklist/priority-exit state and imported-issue disposition

## Verification Commands

Bootstrap:
```bash
npm ci
```

Fast/local sanity:
```bash
npm run typecheck
npm test
```

Logic verification:
```bash
npm run typecheck
npm test
npm run test:contracts
```

Full verification:
```bash
npm run verify
```

Docs/control-plane verification:
```bash
npm run docs:sync   # when managed prompt inventories or generated docs change
npm run verify:docs
```

Maintainability/file-shape verification:
```bash
npm run verify:maintainability
```

CSS verification:
```bash
npm run lint:css
```

Bundle/startup verification:
```bash
npm run verify:bundle
npm run build
```

## Subagent Roles

Preferred roles when available:
- reviewer: normal correctness/regression/security/test review
- maintainability_reviewer: code-health, file-shape, brittle tests, slop, unnecessary indirection, harmful duplication
- architecture_reviewer: hotspots, owner seams, Plex/persistence/navigation/platform/control-plane risk
- worker_terra: lower-cost exact, bounded, testable fixes with no unresolved owner/product/architecture decision
- worker: ambiguous or high-risk implementation/fix work
- cleanup_worker: only for approved Tier 3 cleanup-loop execution units
- docs_researcher: official docs/API/framework behavior checks

Fallback rule:
- If a named role is unavailable, use the closest available default subagent and pass the intended role instructions explicitly.
- Preserve read-only reviewer vs write-capable worker boundaries.

## Model Policy

- Use GPT-5.6 Terra medium through `worker_terra` for explicitly eligible exact, bounded, cheap-to-verify implementation.
- Use GPT-5.6 Sol medium for normal planning and implementation.
- Use GPT-5.6 Sol high/xhigh for architecture, security, hotspot, priority-exit, long-context, or hard debugging/review tasks.
- Do not default every review subagent to GPT-5.6 Sol high; use the tracked reviewer specialization that matches the risk surface.

## Pure Docs / Assets Exclusion Rule

Only exclude commits from adversarial subagent review when they change docs/assets with no effect on runtime behavior, public contracts, CI/release behavior, architecture/workflow/control-plane policy, tests, generated outputs, security, persistence, or data handling.

Never auto-exclude Lineup control-plane docs, architecture docs, design/API docs, `.codex/**`, `agents.md`, `.coderabbit.yaml`, CI files, package scripts, or verifier/tooling files.

## Suggestion Review Calibration

Priority bumps:
- +2 for auth/token/playback URL/persistence/security-sensitive behavior
- +1/+2 for Orchestrator/App/hotspot responsibility growth
- +1 for public contract, verifier, CI, or workflow-control-plane drift
- +1 for brittle tests that weaken public-seam behavior proof

Priority reductions:
- style-only comments that do not hide a concrete defect
- isolated naming/readability issues outside hotspots
- existing debt not worsened by the diff

Common false-positive patterns:
- generic DRY suggestions that would create premature abstraction
- compatibility/fallback suggestions contrary to repo policy
- reviewer attempts to move behavior to the wrong owner
- treating stale detector wording as live debt without current-source proof

Common true-positive patterns:
- hidden dual ownership
- hotspot growth
- raw storage access outside owner modules
- missing verification for UI/navigation/Plex/persistence changes
- workflow doc drift not reflected in verifier/tests

## PR Commit Review Calibration

Grouping hints:
- Group commits by feature slice, cleanup package, control-plane change, or runtime owner.
- Group later fix commits with the earlier commit they amend when they address the same logical issue.
- Use architecture review for Plex/persistence/navigation/platform/hotspot/control-plane groups.
- Use maintainability review for cleanup/refactor/code-health/test-shape groups.

Final net-diff sanity check priorities:
- cross-group ownership drift
- doc/code mismatch
- missing verification caused by group boundaries
- accidental local-only artifact inclusion
- inconsistent checklist/plan/control-plane state
