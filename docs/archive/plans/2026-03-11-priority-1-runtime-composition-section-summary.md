# Priority 1 Runtime Composition Section Summary

## Purpose

This file preserves historical memory from the March 2026 Priority 1 runtime-composition section without keeping five long step-by-step implementation plans tracked in the repo.

Status note (2026-03-28): this archive is historical only. Active Priority 1 ownership and exit status now live in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md), where `P1-EXIT` remains open with successor owners `P1-W5` and `P1-W6`.

Use this summary when you need:

- the historical shape of the early Priority 1 section work
- the stable owner split reached by each work unit
- the runtime-boundary and priority-exit lessons that matter for future hotspot work
- the harness-ingestion decision for the completed section

Do not treat this file as an active execution plan.

For reusable planning patterns and anti-patterns derived from this section, use:

- [`docs/agentic/historical-plan-corpus-review.md`](../../agentic/historical-plan-corpus-review.md)
- [`docs/agentic/plan-authoring-standard.md`](../../agentic/plan-authoring-standard.md)

## Section Scope

This archived section captured early Priority 1 work that focused on shrinking runtime-composition ownership in `src/Orchestrator.ts` and `src/core/InitializationCoordinator.ts` without changing startup or playback behavior.

Completed work units:

- `P1-W1` broke the `src/Orchestrator.ts` / `src/core/*` import cycle by moving shared orchestrator types behind a boundary-local owner while preserving the public re-export surface
- `P1-W2` extracted module/coordinator/controller construction into explicit `src/core/orchestrator/*Factory.ts` collaborators
- `P1-W3` moved coarse-grained startup routing and EPG-config shaping into `src/core/initialization/InitializationStartupPolicy.ts` while keeping sequencing in `InitializationCoordinator`
- `P1-W4` removed leftover runtime pass-through seams and duplicate lifecycle-save handoffs introduced by the earlier extraction pass
- `P1-W5` ran the priority cleanup pass so duplicated playback-state accessors and accidental internal-only public surface area were removed after the extracted owners were stable
- `P1-EXIT` was recorded as closed at that time; this claim was later superseded by the reopened Priority 1 exit review tracked in the active checklist

## End-State Snapshot

### `P1-W1` import-cycle break

- Result:
  - shared orchestrator-facing types moved into `src/core/orchestrator/OrchestratorTypes.ts`
  - `src/Orchestrator.ts` remained the public re-export surface for external callers
- Stable boundaries:
  - core collaborators no longer import shared types from the top-level orchestrator module
  - the new type owner stays inside the orchestrator-focused core boundary instead of becoming a general shared-types dumping ground
- Preservation contracts:
  - no startup-order or runtime-behavior changes
  - no public API churn for `OrchestratorConfig` or `ModuleStatus`
- Durable lesson:
  - import-cycle cleanup is safest when shared types move to a boundary-local owner while the public entrypoint stays stable for callers

### `P1-W2` runtime factory extraction

- Result:
  - module construction, coordinator assembly, and Priority 1 controller wiring moved behind focused factory collaborators under `src/core/orchestrator/`
  - `src/Orchestrator.ts` stayed the public API and runtime-state owner
- Stable boundaries:
  - assembly lives with the orchestrator boundary, not in unrelated shared helpers
  - runtime behavior, public methods, and error handling remain in `AppOrchestrator`
- Preservation contracts:
  - preserve constructor inputs, initialization ordering, and binder wiring timing
  - do not widen `src/core/index.ts` or move policy back into the hotspot
- Durable lesson:
  - hotspot reduction works best when assembly leaves the class first, while behavior ownership stays frozen until later seams are ready

### `P1-W3` startup-policy extraction

- Result:
  - routing decisions and EPG startup config shaping moved into `src/core/initialization/InitializationStartupPolicy.ts`
  - `InitializationCoordinator` stayed responsible for phase ordering, queueing, and resume-listener lifecycle
- Stable boundaries:
  - startup sequencing remains separate from startup policy
  - the policy move did not push logic back into `src/Orchestrator.ts`
- Preservation contracts:
  - preserve auth/profile/server-select gating outcomes exactly
  - preserve post-ready routing and first-channel fallback behavior
  - preserve EPG layout-mode and banner defaults
- Durable lesson:
  - policy extraction is strongest when the sequencing owner stays narrow and the new collaborator accepts explicit phase-shaped inputs instead of a widened dependency bag

### `P1-W4` transitional seam cleanup

- Result:
  - redundant pass-through dependency wrappers and duplicate lifecycle-save handoffs were removed from the runtime factories after the extraction seams were already in place
- Stable boundaries:
  - `src/Orchestrator.ts` remains the runtime composition root
  - the factory collaborators keep only the dependencies they actually own
- Preservation contracts:
  - no event-wiring or lifecycle-save behavior drift
  - no new collaborators or fallback seams introduced during cleanup
- Durable lesson:
  - seam cleanup should delete forwarding residue only after the replacement dependency path is already explicit and test-covered

### `P1-W5` priority cleanup pass

- Result:
  - duplicated playback-state accessor wiring moved behind one shared seam
  - accidental public exports for internal-only dependency types were removed after the factories had already stabilized
- Stable boundaries:
  - `AppOrchestrator` remains the public runtime facade
  - boundary-local helper types stay inside `src/core/orchestrator/`
- Preservation contracts:
  - no startup, playback, or overlay-behavior changes
  - do not use a cleanup pass to introduce new owners or redesign the runtime API
- Durable lesson:
  - cleanup passes are most reliable when they tighten already-proven seams and remove accidental surface area, not when they reopen extraction decisions

### `P1-EXIT` priority closeout

- Result:
  - On March 11, 2026, this archive recorded Priority 1 as closed with refreshed `desloppify` evidence and no open `P0` security findings.
  - That closeout claim is now historical only and is superseded by the active `P1-EXIT` record in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md), which keeps Priority 1 open pending `P1-W5` and `P1-W6`.
- Stable boundaries:
  - runtime-composition cleanup still centers on orchestrator/startup seams
  - active successor ownership is now tracked under `P1-W5` (runtime-root/facade narrowing) and `P1-W6` (initialization/composition-bag narrowing), not under Priority 4
- Preservation contracts:
  - treat this archive as historical evidence only; do not use it as current execution status
  - use the active checklist for final owner/disposition decisions
- Durable lesson:
  - priority-exit reviews should name one final owner for residual debt instead of leaving shared implicit ownership across future work units

## Why The Detailed Plans Were Pruned

The original execution-grade P1 plans were useful during implementation and archive review, but the durable repo memory for future sessions should now prefer:

- this section summary
- [`docs/agentic/historical-plan-corpus-review.md`](../../agentic/historical-plan-corpus-review.md)
- the active Priority 1 checklist/exit record in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

That keeps the reusable lessons and closeout evidence in tracked docs without adding another multi-thousand-line archived plan set to the repo history.

## Harness Ingestion Triage

- status: `absorbed`
- recommended action: `historical-corpus`
- why: Priority 1 added reusable hotspot-decomposition and priority-exit lessons, and those lessons were absorbed into the tracked historical corpus review in the same pass; no separate eval or workflow-doc update was justified yet.
- tracked follow-up: `docs/agentic/historical-plan-corpus-review.md`
- local-only holding note: `none`
- revisit trigger: `none`

## Future Use

Use this summary as the historical reference surface for:

- checklist completion references for Priority 1
- future runtime-hotspot planning and review work
- section-level review of how the early orchestrator/runtime cleanup was shaped before the later Priority 1 exit reopen

If a future task needs line-by-line implementation recovery, reconstruct it from git history rather than restoring the full execution plans to tracked docs.
