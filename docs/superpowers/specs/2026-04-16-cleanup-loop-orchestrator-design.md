## Summary

Replace the unfinished Tier 3 `cleanup-loop` controller placeholder with the explicit orchestrator workflow it was intended to become. The new loop should let the main session act as the controller the human operator has been manually acting as, while delegating almost all planning, implementation, and adversarial review work to persistent subagents.

## Goal

Make `cleanup-loop` the canonical all-in-one cleanup workflow for Tier 3 cleanup/refactor work, including checklist-linked `P#-W#` items and standalone remediation that is still risky enough to need controller orchestration:

- accept the current work item from the user
- drive planning, plan review, implementation, and implementation review through subagents
- keep planner and implementer context alive across revision loops
- only allow completion when review is clean and checklist closeout requirements are satisfied

## Non-Goals

- do not create a parallel launcher such as `lineup-cleanup-orchestrator`
- do not make the thin global launcher skill a second authority surface
- do not turn the loop into a script-first automation harness
- do not use `cleanup-loop` as umbrella control for feature/design or mixed-task delivery

## Current Problem

The current tracked `cleanup-loop` launcher describes the Tier 3 controller at a high level, but it does not define the concrete subagent choreography, revision routing, model-selection behavior, or strict completion gates. In practice, the human operator has been serving as the orchestrator manually across separate planner, reviewer, and implementer threads.

## Proposed Design

### Canonical Owner

`docs/agentic/session-prompts/cleanup-loop.md` becomes the canonical orchestrator contract for Tier 3 cleanup/refactor work. It should stop reading like a thin placeholder and instead define the explicit controller state machine and loop semantics. This spec should defer to the tracked launcher and runbook for durable invocation wording, read order, and verification policy rather than duplicating those details here.

### Orchestrator Responsibilities

The main session remains the only authoritative controller. It owns:

- `update_plan`
- current phase and loop state
- task routing and scope control
- escalation decisions
- final completion gating
- final checklist and closeout correctness

The orchestrator should prefer subagents for nearly all substantive work. Direct orchestrator edits are allowed only as a last resort when:

- the change is a very small cleanup or adjustment
- a significant issue must be resolved without losing critical controller context
- repeated agent handoff churn is materially reducing reliability

Even in those cases, direct editing is an exception path, not the default execution model.

### Agent Roles And Runtime Policy

The workflow should stay aligned with the tracked Lineup role catalog instead of inventing a second repo-local role system. The controller may apply per-pass overrides when the tracked launcher contract requires stricter behavior than the repo-wide defaults, but this spec should not hardcode volatile model identifiers. The authoritative defaults and any current override wording belong in the tracked role config plus the launcher/runbook.

- planner: controller-managed planning pass using the tracked write-capable role and any stricter launcher-defined reasoning override
- plan reviewer: tracked reviewer role, with any stricter review settings defined by the launcher
- implementation reviewer: tracked reviewer role, with any stricter review settings defined by the launcher
- implementer: tracked worker role by default, with escalation allowed only when the approved handoff or review output explicitly justifies it

Implementation model escalation rule:

- if the approved plan review output explicitly recommends stronger implementation settings, the orchestrator may escalate the implementation pass instead of silently staying on the default worker settings

Persistence rule:

- keep the planner alive across plan-fix rounds
- keep the implementer alive across implementation-fix rounds
- use fresh review passes for each review cycle

This preserves working context in the writer agents while keeping the adversarial review passes independent. It also keeps the workflow grounded in the existing role surfaces while letting the controller enforce the more specific model policy required by this launcher.

## Controller State Machine

The orchestrator should run `cleanup-loop` as an explicit state machine with these phases:

1. `scope-load`
2. `plan`
3. `plan-review`
4. `plan-revise`
5. `slice-select`
6. `implement`
7. `implementation-review`
8. `implementation-revise`
9. `closeout`
10. `done`
11. `blocked`

### Phase Rules

#### `scope-load`

- accept the user-provided `P#-W#`
- load the standard cleanup control-plane docs
- confirm the task is being handled as cleanup Tier 3 controller work
- initialize `update_plan`

#### `plan`

- spawn or resume the persistent planning agent
- have the planner produce or refresh the implementation plan using the existing cleanup planning standards

#### `plan-review`

- run an adversarial plan review using the cleanup review standards
- require an implementation-ready outcome before implementation can start

#### `plan-revise`

- if plan review finds issues, send the findings back to the same planning agent
- do not open implementation while material plan findings remain
- repeat `plan` -> `plan-review` until review is clean

#### `slice-select`

- for `checklist-linked` work, choose the next approved cleanup slice from the tracked package plan before implementation starts
- keep slice selection controller-owned so the orchestrator, not the implementer or reviewer, decides package sequencing
- for `standalone remediation`, confirm the one approved bounded execution target and proceed without inventing package slices
- return here after each clean checklist-linked slice review until the approved package slices are complete or explicitly deferred by the approved plan

#### `implement`

- spawn or resume the persistent implementation agent using the approved plan
- follow the tracked role defaults plus any launcher-defined override or approved handoff guidance rather than restating concrete model ids here
- implementation work is scoped to the controller-selected slice for `checklist-linked` work and to the one approved execution target for `standalone remediation` unless the approved plan explicitly permits a narrower or adjacent merge

#### `implementation-review`

- run an adversarial implementation review against the approved plan and required closeout standards
- require zero material findings before the work item can close

#### `implementation-revise`

- if implementation review finds issues, send the findings back to the same implementation agent
- do not mark the work item complete while material implementation findings remain
- repeat `implement` -> `implementation-review` until review is clean

#### `closeout`

- ensure required verification actually ran
- ensure the subtype-matched bookkeeping/doc updates happened in the same pass
- if a completed checklist-linked slice closes the final planned work item in the priority, ensure the required `P#-EXIT` evidence and status handling are also complete before marking the loop done

#### Terminal States

- `done`: all review loops are clean and closeout requirements are satisfied
- `blocked`: progress cannot continue without new user input, a routing correction, or a material workflow exception

## Review Loop Semantics

### Planning Loop

Planning is not complete until the plan reviewer returns no material findings and produces an implementation-ready handoff. Any plan-review findings route back to the existing planner agent, not to a fresh planner by default.

### Implementation Loop

Implementation is not complete until the adversarial implementation review returns no material findings. Any implementation-review findings route back to the existing implementer agent, not to a fresh implementer by default.

When a checklist-linked slice review is clean, return to `slice-select` for the next approved slice unless package exit conditions are already satisfied. `Standalone remediation` proceeds directly to `closeout` once its one approved execution target is clean.

### Repeated-Finding Escalation

If the same findings recur across loops, the orchestrator should escalate deliberately instead of spinning:

- tighten the instructions
- refresh or narrow context
- explicitly resolve the blocked decision in the controller
- use last-resort direct edits only when necessary

## Completion Gate

The orchestrator must not treat a task as complete unless all of the following are true:

- plan review is clean
- implementation review is clean
- required verification actually ran
- the subtype-matched bookkeeping/doc updates were made in the same pass
- if applicable, required `P#-EXIT` evidence and status handling are complete

This means “code landed” is not enough, and “review is clean but checklist is stale” is not enough.

## Tracked File Changes

Primary tracked changes:

- `docs/agentic/session-prompts/cleanup-loop.md`
- `docs/AGENTIC_DEV_WORKFLOW.md`
- `docs/agentic/session-prompts/README.md` if its launcher description or routing note needs to reflect the finished orchestrator behavior
- the `lineup-cleanup-loop` launcher skill, only as a thin wrapper update if needed

Change-boundary rule:

- orchestration behavior belongs in tracked repo docs
- the launcher skill remains a thin wrapper to the tracked prompt and must not become a second authority surface

## Verification And Eval Expectations

This is a workflow/control-plane change, so the implementation should follow the canonical verification and eval requirements from `docs/AGENTIC_DEV_WORKFLOW.md` and the tracked eval guidance. At minimum, the tracked docs verifier must run, and any workflow-eval trigger should be satisfied through the canonical eval surfaces instead of local-only notes.

## Implementation Guidance

The eventual implementation should keep the workflow compatible with the existing planner, reviewer, and implementer launcher family rather than replacing them. `cleanup-loop` should orchestrate those same responsibilities explicitly instead of inventing a separate prompt family.

The orchestrator should also preserve current cleanup-family routing boundaries:

- use the loop only for Tier 3 cleanup/refactor work
- do not widen it into the default controller for feature or mixed work

## Open Questions

No unresolved design questions remain from the current discussion. The next step is to convert this approved design into an implementation plan for the tracked workflow changes and eval/update requirements.
