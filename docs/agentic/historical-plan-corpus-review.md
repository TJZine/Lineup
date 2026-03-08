# Historical Plan Corpus Review

> Reviewed initially 2026-03-05 from a local-only imported corpus containing the full Priority 2 (`P2-W1` through `P2-W5`) implementation plans from the architecture cleanup. Expanded 2026-03-08 with a local review of the Priority 5 Plex integration-boundary plan set.

## Purpose

Capture the reusable strengths and weaknesses of the strongest historical Lineup plans so the repo can improve its plan-authoring standard and eval set without importing stale or noisy raw files into the tracked control plane.

This document is a curated reference, not an active execution plan.

## Corpus Scope

Reviewed locally from `docs/_local/plan-import/`:

- `2026-03-03-p2-w1-app-container-factory-implementation.md`
- `2026-03-03-p2-w2-screen-registry-loader-implementation.md`
- `2026-03-03-p2-w3-toast-blocking-error-overlay-presentation-extraction-implementation.md`
- `2026-03-03-p2-w4-dev-menu-diagnostics-surface-isolation-implementation.md`
- `2026-03-03-p2-w5-priority-2-app-shell-cleanup-pass-implementation.md`

These files are local source material only. This review is the tracked durable output.

Additional corpus reviewed 2026-03-06:

- `2026-03-05-p4-w1-settings-screen-state-view-focus-split-implementation.md`
- `2026-03-06-p4-w2-epg-info-panel-orchestration-split-implementation.md`
- `2026-03-06-p4-w3-channel-setup-session-flow-split-implementation.md`
- `2026-03-06-p4-w4-ui-focus-render-primitives-consolidation-implementation.md`
- `2026-03-06-p4-w5-priority-4-cleanup-pass-implementation.md`

The completed Priority 4 section is preserved as tracked historical memory in [`2026-03-06-priority-4-ui-decomposition-section-summary.md`](../archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md). The local import files remain source material only.

Additional local corpus reviewed 2026-03-08 from current workspace material:

- `2026-03-08-p5-w1-plex-stream-request-helpers.md`
- `2026-03-08-p5-w2-plex-stream-url-token-helper.md`
- `2026-03-08-p5-w3-plex-stream-subtitle-delivery-policy.md`
- `2026-03-08-p5-w4-plex-stream-media-selection-hdr-audio-compatibility-policies.md`
- `2026-03-08-p5-w5-plex-stream-cleanup-pass.md`

This Priority 5 set is currently valuable as local review material and active task memory. The durable harness output should remain curated lessons, eval seeds, and eventually a compressed section summary instead of another bulky tracked archive import.

## Why This Matters

The imported corpus is valuable because it covers a complete refactor sequence inside one architectural priority:

- bounded extraction from a hotspot
- collaborator creation without ownership drift
- preservation-heavy UI refactors
- diagnostics/persistence edge handling
- cleanup of transitional glue after extractions land
- policy-pipeline extraction inside a fragile external-service boundary without leaking auth/transport concerns across modules

That makes it stronger source material for the harness than isolated one-off plans.

## Patterns Worth Keeping

### 1. Parent-priority alignment

The strongest plans do not treat a work unit as an isolated task. They restate how that unit advances the parent cleanup target so local refactors do not fight the larger architecture.

Keep:

- explicit parent-priority alignment
- durable end-state statements
- a clear description of what ownership should look like after the change

### 2. Hard scope boundaries

The corpus repeatedly names exact files in scope and exact files out of scope. This sharply reduces accidental sprawl and makes reviews easier.

Keep:

- explicit in-scope file list
- explicit out-of-scope list
- prohibition on adjacent work units leaking into the current one

### 3. Zero-decision execution rules

The best imported plans remove ambiguity about what an implementing agent is allowed to decide. This is especially effective for multi-session or fresh-session execution.

Keep:

- locked execution rules
- exact invariants that must remain unchanged
- explicit prohibition on fallback paths, temporary adapters, or side quests

### 4. Preservation contracts for UI and runtime behavior

The imported plans are strongest where they preserve behavior with concrete contracts rather than vague “no regressions” language.

Keep:

- exact IDs, classes, ARIA roles, timing values, append order, and startup/shutdown ordering when those details matter
- explicit “do not redesign” rules for structural refactors touching UI code

### 5. Verification and rollback discipline

The corpus consistently treats verification as part of the plan, not an afterthought.

Keep:

- exact verification commands
- targeted regression tests for the extracted surface
- rollback notes for high-risk extractions

### 6. Evidence-backed planning

The strongest plans cite repo evidence before prescribing changes.

Keep:

- reviewed baseline sections
- relevant hotspot or checklist references
- Codanna discovery plus documented fallback when Codanna is insufficient

### 7. Explicit collaborator API contracts

The strongest Priority 4 plans lock the extraction seam by describing the new collaborator API before implementation starts. This is especially strong in the EPG info-panel and shared-helper plans.

Keep:

- explicit public surface for the new collaborator or helper
- caller policy that must remain local instead of being centralized
- replacement maps that show which hotspot methods/fields disappear after the extraction lands

### 8. Cleanup-pass sequencing after stable owners exist

The strongest cleanup-pass plans do not invent new seams. They remove transitional glue only after earlier extractions are already in place and explicitly preserved.

Keep:

- cleanup-pass plans that name the already-stable owners
- cleanup work that removes bridges, dead refs, and transitional callbacks only after the new owners are proven
- verification that is targeted at regression risk, not at new feature surface

### 9. Integration-boundary helpers should stay auditable and local to the boundary

The reviewed Priority 5 plans are strongest where they resist over-generalization. URL/token handling, request helpers, subtitle policy, and playback compatibility stay inside the Plex stream boundary instead of being prematurely lifted into broader app helpers.

Keep:

- one auditable responsibility per helper or policy owner
- orchestration ownership in the boundary root while extracted helpers stay narrow
- explicit statements that auth/query-param logic must not leak into callers

### 10. Discovery discipline must survive weak or noisy tool output

The Priority 5 plans add a useful harness lesson: strong plans should not pretend discovery was clean when it was not. Several plans explicitly record Codanna insufficiency, `get_index_info` snapshots, or deterministic `rg` fallback paths.

Keep:

- explicit `get_index_info` capture when expected semantic/doc results are weak
- fallback notes that explain what failed and what deterministic evidence replaced it
- plan evidence that distinguishes “tool weakness” from “symbol absent”

## Anti-Patterns To Avoid

### 1. Stale repo identity and pathing

Some imported plans still refer to `Retune`, old absolute paths, or `.agent`-specific skill paths that no longer match the current repo topology.

Do not keep:

- old repo names
- absolute local file paths in tracked plans
- instructions that depend on local-only mirror paths

### 2. Brittle line-number anchoring

Some plans overfit to exact line ranges inside volatile hotspot files. That ages poorly and makes fresh-session execution fragile.

Prefer:

- symbol names
- method names
- file-level responsibilities

Use line references only when they materially reduce ambiguity and are likely to stay stable long enough to matter.

### 3. Obsolete workflow references

Older plans refer to repo-specific workflow names that are no longer authoritative.

Do not keep:

- `retune-workflow`
- assumptions that `.agent/skills/...` is the canonical skill source
- stale instructions that bypass `agents.md`, the document map, or the Codanna playbook

### 4. Over-specified implementation mechanics without freshness guards

Exact code-shape directions can be useful, but only when paired with an explicit “stop and update the plan if the repo changed” rule.

Do not keep:

- brittle prescriptions without a freshness gate
- instructions that assume the target file still looks exactly like it did when the plan was written

### 5. Hidden seam decisions inside “0-decision” plans

One Priority 4 plan exposed a real failure mode: a plan can look explicit while still hiding an unresolved ownership or contract decision. That creates contradictory scope and invites temporary adapters or dual ownership during implementation.

Do not keep:

- plans that treat an unresolved seam as if it were already settled
- “mechanical wiring only” exceptions for adjacent files that are still declared out of scope
- execution-grade plans that still require the implementer to choose which contract must widen

### 6. Partial evidence and stale skill guidance

Some later plans were strong structurally but still drifted on evidence and process guidance.

Do not keep:

- partial Codanna evidence blocks without the required fallback note
- stale or partial skill order that conflicts with the tracked workflow
- plan-local skill guidance that bypasses the current process-first order

### 7. Cross-boundary helper ambition that outruns the seam

Priority 5 reinforces a different failure mode from the UI corpus: external-boundary extractions can look “clean” while quietly creating platform-wide helpers that were never justified by the task.

Do not keep:

- “shared” auth/url helpers that widen beyond the current Plex stream boundary without evidence
- compatibility helpers that quietly absorb settings or persistence ownership
- cleanup-pass plans that sneak fresh policy changes back into the deletion pass

## Standards To Codify From This Corpus

The future plan-authoring standard should require all of the following for serious implementation plans:

1. Goal and non-goals
2. Parent-priority or parent-architecture alignment
3. Fresh-session reading order
4. Required skills in process-first order
5. Codanna discovery summary
6. Impact snapshot for risky/shared symbols
7. Exact files in scope and out of scope
8. Invariants and preservation contracts where relevant
9. Exact verification commands and expected outcomes
10. Rollback notes for high-risk work
11. Commit checkpoints for tracked work
12. An explicit anti-slop section covering fallback paths, temporary adapters, and scope creep

## Eval Prompt Seeds From This Corpus

The imported Priority 2 sequence should seed the first eval set in these ways:

- `P2-W1`: extraction from `App` without UI shell drift
- `P2-W2`: registry ownership transfer without dual ownership
- `P2-W3`: overlay/toast extraction without timer or accessibility regressions
- `P2-W4`: diagnostics isolation without policy leakage or raw storage sprawl
- `P2-W5`: cleanup pass that removes transitional glue without behavior regressions

These are stronger than synthetic prompts because they test failure modes the repo has already had to manage in real work.

The imported Priority 4 sequence should extend the eval set in these ways:

- `P4-W2`: bounded orchestration extraction from `EPGComponent` without timer or host-switch drift
- `P4-W3`: session-state extraction from `ChannelSetupScreen` without unresolved seam or step-controller bleed
- `P4-W4`: shared focus/render primitive extraction without centralizing caller-specific focus policy
- `P4-W5`: cleanup pass that removes transitional UI glue only after the stable owners are already proven
- planning meta-eval: detect and stop on unresolved seams before freezing an execution-grade plan

The reviewed Priority 5 sequence should extend the eval set in these ways:

- `P5-W2`: auditable URL/token helper extraction without leaking auth or transport logic into callers
- `P5-W4`: playback compatibility extraction without widening into settings/persistence ownership
- `P5-W5`: cleanup pass that removes duplicate resolver-local policy branches only after extracted owners are already stable
- planning/meta-eval: when Codanna discovery is weak, record the insufficiency and deterministic fallback instead of treating weak search results as absence

## Prompt Derivation Details

Use the following tracked details when authoring prompts from this corpus in a fresh clone. These notes are intentionally specific enough that the raw local import files are not required during normal prompt creation.

### `P2-W1` app container extraction

- Target shape:
  - extract root/container DOM creation from `App`
  - keep `App` as composition root
- Invariants:
  - preserve container IDs, class names, ARIA semantics, inline styles, and append order
  - no UI redesign
  - no listener ownership migration into the factory
- Expected skills:
  - `architecture-boundaries`
  - `ui-composition-patterns`
- Expected verification:
  - targeted container/factory tests
  - `npm run verify`
- Shortcut failures:
  - redesigning the DOM creation path
  - introducing a schema/config abstraction not justified by the task
  - moving non-DOM side effects into the new helper

### `P2-W2` lazy-screen registry extraction

- Target shape:
  - move lazy-screen loading, caches, timers, and cleanup out of `App`
  - preserve `App` as top-level screen-routing owner
- Invariants:
  - no dual ownership between `App` and the registry
  - preserve prefetch timing and screen visibility behavior
  - no container, CSS, or focus changes
- Expected skills:
  - `architecture-boundaries`
  - `ui-composition-patterns`
- Expected verification:
  - targeted timer/prefetch tests
  - `npm run verify`
- Shortcut failures:
  - leaving duplicate state in both owners
  - changing prefetch timing or startup ordering
  - bundling unrelated app-shell work into the extraction

### `P2-W3` toast and blocking overlay extraction

- Target shape:
  - move presentation-only toast and blocking-overlay behavior into dedicated presenters
  - keep policy decisions in `App`
- Invariants:
  - preserve copy, ARIA roles, timing values, layout, and navigation behavior
  - timer cleanup must remain explicit
  - keep container ownership stable
- Expected skills:
  - `ui-composition-patterns`
  - `frontend-design` in preservation mode
  - `architecture-boundaries`
- Expected verification:
  - targeted presenter tests
  - targeted `App` regression tests
  - `npm run verify`
- Shortcut failures:
  - changing durations or copy
  - dropping accessibility semantics
  - leaking navigation/policy decisions into presenters or vice versa

### `P2-W4` diagnostics surface isolation

- Target shape:
  - move diagnostics-only rendering, bindings, and helper exposure into one collaborator
  - keep `App` focused on composition-root responsibilities
- Invariants:
  - preserve debug shortcuts and dev-menu behavior
  - keep storage access on safe helpers only
  - do not prematurely introduce a persistence abstraction owned by another cleanup priority
- Expected skills:
  - `architecture-boundaries`
  - `ui-composition-patterns`
  - `persistence-boundaries`
- Expected verification:
  - targeted diagnostics behavior tests
  - `npm run verify`
- Shortcut failures:
  - raw `localStorage` calls
  - leaking global listeners
  - changing visual dev-menu behavior during a structural refactor

### `P2-W5` app-shell cleanup pass

- Target shape:
  - remove temporary wrappers, dead container references, and transitional glue after extractions are stable
  - keep stable collaborators and current startup/shutdown ordering
- Invariants:
  - no behavior changes
  - no new collaborators
  - no new compatibility logic
- Expected skills:
  - `architecture-boundaries`
  - `ui-composition-patterns` for guardrail checking
- Expected verification:
  - targeted regression coverage around startup, shutdown, and screen behavior
  - `npm run verify`
- Shortcut failures:
  - deleting glue without proving the stable collaborator path is already in use
  - removing code that still encodes ordering guarantees
  - sneaking new design or feature work into a cleanup pass

## Priority 4 Prompt Derivation Details

### `P4-W2` EPG info-panel orchestration split

- Target shape:
  - extract info-panel orchestration from `EPGComponent` into one coordinator
  - keep navigation, grid state, and public `EPGComponent` surface unchanged
- Invariants:
  - preserve classic/overlay host switching
  - preserve immediate fast update plus deferred full update timing
  - preserve cleanup on hide, placeholder focus, schedule clear, and destroy
- Expected skills:
  - `architecture-boundaries`
  - `ui-composition-patterns`
  - `frontend-design` in preservation mode
- Expected verification:
  - targeted coordinator tests
  - targeted `EPGComponent` regression tests
  - `npm run verify`
- Shortcut failures:
  - host drift between classic and overlay modes
  - timer cleanup regressions
  - navigation or layout responsibilities leaking into the coordinator

### `P4-W3` channel-setup session-flow split

- Target shape:
  - move session state and async orchestration out of `ChannelSetupScreen`
  - keep DOM ownership, focus ownership, and step-view rendering in the screen and focused collaborators
- Invariants:
  - preserve async stale-result guards, abort cleanup, and fast-path build/review routing
  - preserve Step 2 D-pad semantics and focus ownership
  - keep step-controller contracts stable unless the seam is explicitly widened in scope
- Expected skills:
  - `architecture-boundaries`
  - `ui-composition-patterns`
  - `brainstorming`
- Expected verification:
  - targeted session-controller tests
  - targeted `ChannelSetupScreen` integration tests
  - `npm run verify`
- Shortcut failures:
  - hiding an unresolved seam inside the plan
  - dual ownership between screen and controller
  - widening step-controller contracts while those files are declared out of scope

### `P4-W4` shared focus and render primitives

- Target shape:
  - extract focus-registration bookkeeping and capped-warning rendering into shared helpers
  - keep caller-specific focus policy in each owning screen/coordinator
- Invariants:
  - preserve D-pad adjacency, preferred-focus semantics, and current-focus suppression behavior
  - preserve warning wording, DOM class names, and capping behavior
- Expected skills:
  - `architecture-boundaries`
  - `ui-composition-patterns`
- Expected verification:
  - targeted helper tests
  - targeted settings and channel-setup regression tests
  - `npm run verify`
- Shortcut failures:
  - centralizing caller-specific focus policy into the common helper
  - widening scope to unrelated UI modules
  - leaving dual-path helper usage alive in migrated files

### `P4-W5` Priority 4 cleanup pass

- Target shape:
  - remove placeholder wrappers, dead host refs, and transitional callback glue after `P4-W2` through `P4-W4` are already stable
  - keep existing extracted owners intact
- Invariants:
  - preserve Channel Setup review/build flow and Step 2 focus graph
  - preserve EPG info-panel host behavior
  - avoid introducing any new long-lived collaborators
- Expected skills:
  - `architecture-boundaries`
  - `ui-composition-patterns`
- Expected verification:
  - targeted channel-setup and EPG regression tests
  - `npm run verify`
- Shortcut failures:
  - removing glue before the stable path is proven
  - using cleanup as cover for a new redesign or ownership change
  - deleting behavior-preserving adapters that still guard async/focus correctness

## Research Alignment

This corpus supports the same workflow shape recommended by recent primary-source guidance:

- OpenAI, [Harness Engineering](https://openai.com/index/harness-engineering/): explicit, maintained repo context beats hidden prompt lore.
- OpenAI, [Demystifying Evals for Agents](https://openai.com/index/demystifying-evals-for-agents/): small, concrete regression tasks are a better quality loop than anecdotal confidence.
- OpenAI Cookbook, [Long Horizon Tasks with Codex](https://github.com/openai/openai-cookbook/blob/main/examples/codex/long_horizon_tasks.md): durable task memory works best when task state is written down in files the agent can revisit.
- Anthropic, [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents): keep workflows simple, then strengthen them with evaluators and clear control surfaces instead of more prompt sprawl.

The imported plans are strongest exactly where they follow those principles: explicit context, explicit invariants, narrow scope, and strong verification.

## Limits Of This Corpus

This review is no longer based on one complete cleanup priority only.

It is strong for:

- app-shell composition-root work
- Plex integration-boundary policy extraction
- UI preservation contracts
- collaborator extraction
- cleanup-pass discipline

It is weak or incomplete for:

- persistence-boundary work outside Priority 2
- cross-priority persistence-boundary work
- doc refresh and architecture-truth tasks
- private-probe test cleanup work

So the corpus should anchor the initial plan-authoring standard, but not become the only source for eval prompts.

## Recommendation

Use this corpus as the first tracked benchmark source for phase 1.5:

- derive the plan-authoring standard from it
- derive at least five eval prompts from it
- copy its best explicitness patterns
- explicitly ban its stale pathing and obsolete workflow references
- rely on the tracked derivation details above during fresh-clone prompt authoring instead of depending on the raw local import folder

Do not promote the raw imported files into tracked docs unless one is later curated and intentionally archived.
