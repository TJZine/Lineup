# First-Pass Architecture Boundary Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a machine-readable first-pass architecture contract plus conservative enforcement that blocks the clearest structural regressions without freezing still-moving cleanup seams.

**Architecture:** Keep the source of truth for architecture boundaries in one repo-owned contract file that is tool-agnostic enough to survive future tooling changes and a future Windows repo. Use ESLint as the first consumer because it already runs in this repo's verification path. Limit the first pass to stable invariants only: composition-root restrictions, raw storage ownership, and bans on non-UI runtime modules importing UI surfaces, with explicit temporary exceptions where unavoidable.

**Tech Stack:** TypeScript, ESLint flat config, Node scripts, existing `npm run verify` workflow

---

## Goal

- Introduce a machine-readable architecture contract that encodes stable present-day invariants without baking in temporary cleanup-era structure.
- Enforce a small first-pass rule set with low false-positive risk.
- Create a named architecture verification lane that can grow later without forcing a second architecture-tool decision now.

## Non-Goals

- Do not attempt to encode the repo's full future ideal architecture in this first pass.
- Do not add dependency-cruiser or another graph tool in this slice.
- Do not freeze moving cleanup seams such as detailed EPG/package surface rules or current orchestrator/app-shell UI wiring that belong to later priorities.
- Do not rewrite storage owners to remove existing direct `localStorage` usage in the same slice unless the rule implementation requires a narrowly scoped allowance update.

## Parent Alignment

- Aligns with `docs/architecture/CURRENT_STATE.md` working rules:
  - keep composition roots thin
  - keep persistence behind typed owners
  - keep Plex transport/policy logic inside Plex modules
- Aligns with the external workflow review recommendation to move from architecture protection by narration toward mechanical enforcement.
- Supports future Windows-port portability by separating the rule source from the first enforcement engine.

## Required Reading

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/architecture/CURRENT_STATE.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
5. `eslint.config.js`
6. `package.json`
7. `tsconfig.json`
8. `src/App.ts`
9. `src/Orchestrator.ts`
10. `src/utils/storage.ts`

## Required Skills

- `architecture-boundaries`
- `writing-plans`

If implementation needs to touch raw storage owners or persisted-key policy, also load `persistence-boundaries`.

## Codanna Discovery

- `find_symbol` confirmed `App` in `src/App.ts` as the application shell composition root.
- `search_symbols` confirmed `AppOrchestrator` is re-exported from `src/Orchestrator.ts`, while `CURRENT_STATE.md` names `src/App.ts` and `src/Orchestrator.ts` as composition-root/tracked hotspot surfaces.
- direct source reads confirmed `tsconfig.json` path aliases (`@core/*`, `@modules/*`, `@utils/*`, `@config/*`) are stable enough to serve as first-pass boundary anchors.
- direct `rg` evidence confirmed raw `localStorage` usage is concentrated in:
  - `src/utils/storage.ts`
  - `src/modules/lifecycle/StateManager.ts`
  - `src/modules/plex/auth/PlexAuth.ts`
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
- direct source reads of `src/App.ts` and `src/Orchestrator.ts` confirmed they are viable first-pass composition-root targets because their import surfaces are explicit and relatively small.

Fallback note:

- Codanna document search was too noisy for this contract-shaping task, so final rule targeting relied on direct tracked-doc reads plus direct source reads and `rg`.

## Impact Snapshot

Primary touched surfaces are expected to be:

- `eslint.config.js`
- `package.json`
- new contract/helper files under `tools/architecture-rules/`
- optionally one or two workflow/architecture docs if the new verification lane is documented

High-risk shared-code impact is low because this slice should affect verification and policy surfaces, not runtime behavior. The main risk is introducing brittle lint rules or over-constraining still-moving seams.

## Files In Scope

- Create: `tools/architecture-rules/lineupArchitectureRules.mjs`
- Create if helpful: `tools/architecture-rules/buildEslintArchitectureRules.mjs`
- Modify: `eslint.config.js`
- Modify: `package.json`
- Modify if needed for minimal documentation only:
  - `docs/architecture/CURRENT_STATE.md`
  - `docs/AGENTIC_DEV_WORKFLOW.md`
- Create tests only if the implementation introduces non-trivial helper logic:
  - `tools/__tests__/architecture-rules.test.mjs`

## Files Out Of Scope

- `src/**` runtime implementation files, unless a narrowly scoped allowance update is truly required to reflect an already-approved storage owner
- `docs/agentic/phase-2-steady-state-plan.md`
- launcher prompts
- eval prompt inventory
- `.codex/skills/*`
- graph-tool configuration for dependency-cruiser or equivalent

## Invariants / Preservation Contracts

- The contract file must represent stable invariants, not accidental current structure.
- Any temporary violation must be expressed as an explicit exception with a reason, not hidden in ad hoc lint disables.
- The first pass must not block clearly legitimate cleanup work in moving seams such as deeper EPG package normalization or current orchestrator/app-shell UI wiring.
- `src/App.ts` and `src/Orchestrator.ts` must remain composition-root-focused surfaces.
- Raw storage access must remain restricted to shared storage helpers and explicitly approved owners only.
- Do not treat current `src/core/** -> src/modules/ui/**` wiring as a stable law in this first pass; that seam remains in active cleanup and should tighten later when `P3` clarifies durable public surfaces.

## Proposed First-Pass Rules

### Stable invariants to enforce now

1. Composition-root restrictions
   - `src/App.ts` may import only approved app-shell/core seams plus explicitly allowed module owners already used for shell composition.
   - `src/Orchestrator.ts` must remain a narrow public/runtime surface and must not import UI-private module internals beyond the existing approved export surface.

2. Raw storage restrictions
   - Ban direct `localStorage` / `sessionStorage` usage outside:
     - `src/utils/storage.ts`
     - explicitly approved current owners already recognized by architecture truth
   - keep the allowlist explicit in the contract

3. Non-UI runtime module boundary restrictions
   - files under these modules must not import `src/modules/ui/**`:
     - `src/modules/plex/**`
     - `src/modules/player/**`
     - `src/modules/scheduler/**`
     - `src/modules/navigation/**`
     - `src/modules/lifecycle/**`

4. Composition-root access restrictions
   - non-composition-root modules must not import `src/App.ts` or `src/Orchestrator.ts`
   - explicit exceptions belong in the contract, not inline lint comments

### Temporary exception model

- Contract must include a structured `temporaryExceptions` list.
- Each exception must include:
  - `from`
  - `to`
  - `reason`
  - optional `owner` or `cleanupPriority`
- No wildcard “allow everything under this folder” exceptions.

## Verification Commands

### Task 1: Decide verification class

- `Existing coverage sufficient or should be adjusted`
- This slice primarily changes verification/configuration surfaces. Add automated tests only if helper logic grows beyond static mapping.

### Task 2: Implement contract file and ESLint integration

Run:

```bash
npm run lint
```

Expected:

- PASS with the new architecture rules active

### Task 3: Add the named architecture verification lane

Run:

```bash
npm run verify:architecture
```

Expected:

- PASS

### Task 4: Run proportional repo verification

Run:

```bash
npm run typecheck
npm run verify:docs
```

Expected:

- both PASS

If `verify:architecture` is wired into `verify`, also run:

```bash
npm run verify:quick
```

Expected:

- PASS

## Planner Self-Check

- Scope check: this slice is limited to architecture-contract and verification surfaces (`tools/architecture-rules/*`, `eslint.config.js`, `package.json`, and minimal docs notes only if required). It does not include runtime feature refactors.
- Invariant check: rules chosen for first pass are stable target-architecture constraints (thin composition roots, owned storage access, non-UI runtime isolation), not transient cleanup-era structure.
- Risk check: temporary exceptions must stay explicit and narrowly scoped by `from` -> `to` with a stated reason; no broad wildcard bypasses.
- Verification check: `npm run lint`, `npm run verify:architecture`, `npm run typecheck`, and `npm run verify:docs` are sufficient proportional gates for this config/policy slice.
- Drift check: contract facts should live in the contract file and be consumed by ESLint, not duplicated as ad hoc rule literals in multiple locations.

## Architecture Seam Decision Gate

- Decision: enforce only seams that are already stable in `CURRENT_STATE.md` and avoid freezing still-moving cleanup seams in this pass.
- Stable seams approved now:
  - composition-root restrictions for `src/App.ts` and `src/Orchestrator.ts`
  - raw storage ownership allowlist restrictions
  - non-UI runtime modules forbidden from importing `src/modules/ui/**`
  - non-composition-root modules forbidden from importing composition roots (with explicit temporary exceptions)
- Deferred seam tightening:
  - deeper EPG/package public-surface rules (targeted for `P3`)
  - broader persistence-owner tightening beyond first-pass allowlist (`P5`)
  - Plex/player public-surface tightening (`P6/P7`)
- Gate rule: if implementing a rule requires broad wildcard exceptions or blocks active cleanup routes, defer that seam to its priority pass rather than weakening first-pass invariants.

## Rollback Notes

- If the first-pass rules create noisy false positives, roll back by relaxing only the specific offending rule or by adding a narrowly named temporary exception. Do not delete the contract file entirely.
- If rule implementation requires broad wildcards to pass, stop and reduce the first-pass scope instead of normalizing a weak contract.
- If documentation updates start expanding beyond minimal explanation, revert them and keep this slice focused on the enforcement nucleus.

## Commit Checkpoints

1. After adding the contract file and helper structure
2. After ESLint consumes the contract and `verify:architecture` exists
3. After minimal docs updates and verification pass

## Priority-Exit Readiness

This plan is not a `P#-EXIT` closeout plan. No priority-exit disposition is claimed here.

## Task Breakdown

### Task 1: Create the machine-readable contract

**Files:**
- Create: `tools/architecture-rules/lineupArchitectureRules.mjs`
- Create if helpful: `tools/architecture-rules/buildEslintArchitectureRules.mjs`

**Step 1: Define stable contract sections**

- `compositionRoots`
- `storageOwners`
- `forbiddenImports`
- `temporaryExceptions`

Keep the file readable and commentable. Prefer plain exported objects/arrays over clever code generation.

**Step 2: Encode the first-pass invariants**

- add the exact first-pass rules listed above
- keep path anchors explicit
- include narrow temporary exceptions only where needed

**Step 3: If helper logic exists, add a focused test**

Only if the helper transforms contract data into ESLint config in a non-trivial way.

### Task 2: Wire ESLint to the contract

**Files:**
- Modify: `eslint.config.js`
- Create if helpful: `tools/architecture-rules/buildEslintArchitectureRules.mjs`

**Step 1: Import the contract or generated rule helper**

Do not duplicate boundary facts directly inside `eslint.config.js`.

**Step 2: Add conservative first-pass rules**

- use ESLint-native rules such as:
  - `no-restricted-imports`
  - `no-restricted-globals`
  - `no-restricted-properties`
- apply them with file-pattern overrides that match the contract

**Step 3: Keep rule messages explicit**

Every failure should explain the intended architectural move:
- composition root regrowth
- use approved storage owner/helper
- import through public seam instead of private UI internals

### Task 3: Add the named verification lane

**Files:**
- Modify: `package.json`

**Step 1: Add `verify:architecture`**

The command must run the architecture rules directly.

**Step 2: Decide integration depth**

- if architecture rules live inside normal ESLint config, document whether `verify:architecture` is a dedicated alias or a tighter focused lint run
- do not create unnecessary duplicate config files unless they materially improve clarity

### Task 4: Add only minimal documentation

**Files:**
- Modify only if needed:
  - `docs/architecture/CURRENT_STATE.md`
  - `docs/AGENTIC_DEV_WORKFLOW.md`

**Step 1: Add one small note about the contract location or verification lane**

Avoid growing the prose surface. The point is to reduce narration and increase enforceability.

### Task 5: Run verification and summarize follow-up candidates

**Files:**
- none required unless docs change

**Step 1: Run the proportional verification commands**

- `npm run lint`
- `npm run verify:architecture`
- `npm run typecheck`
- `npm run verify:docs`
- optionally `npm run verify:quick` if integration changed enough to justify it

**Step 2: Record immediate next candidates, but do not implement them**

Examples:
- EPG public seam rules for `P3`
- settings/storage-owner tightening for `P5`
- Plex/player public-surface and cross-layer tightening for `P6/P7`
