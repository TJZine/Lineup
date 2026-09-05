# Architecture Cleanup Checklist

> Current cleanup state and admission rules. Historical execution detail belongs
> in `docs/runs/`, commits, and current architecture documents—not in this file.

## Current State

- P0-P13, FCP-1 through FCP-25, DCR-1 through DCR-16, DCR-EXIT, and PQR-1
  through PQR-7 are complete baseline evidence.
- No cleanup package is active. Do not revive a historical package from detector
  output or a stale plan.
- Windows port planning may start from the completed FCP-25 handoff only after a
  maintainer approves a separate plan.
- `PQR-EXIT` is optional. Use it only when the maintainer wants a final
  source-backed production-readiness review before port work; it is not a score
  target, scan cycle, or prerequisite created by this checklist.

## Work Admission

Admit cleanup work only when current source, behavior, tests, or an approved
review demonstrates a present production risk. Rubrics and scanners may suggest
where to inspect, but they do not define issues, priority, scope, or completion.

Every accepted package must state:

- the concrete current-source finding and production impact;
- one owner seam and the responsibility that should move or change;
- likely files or the allowed write boundary, plus important adjacent owners out
  of scope; require exact files only for concurrent writers or sensitive shared
  surfaces;
- behavior, public-contract, and architecture invariants;
- explicit acceptance criteria;
- the smallest proof surface that can establish the change;
- stop or replan conditions; and
- one owner and revisit trigger for every accepted residual.

Reject work whose only justification is a score, line count, style preference,
hypothetical reuse, defensive handling of an impossible state, or an abstraction
without a current second responsibility or consumer.

## Architecture Standard

- Prefer the smallest cohesive owner that matches present behavior.
- Split a file or module only when a distinct responsibility, lifecycle/resource
  owner, trust boundary, policy, translation boundary, or independently changing
  consumer is evident now.
- Keep behavior together when it shares state, invariants, lifecycle, dependency
  direction, and reason to change.
- Do not add pass-through services, one-implementation interfaces, generic helper
  layers, compatibility shims, speculative extension points, or configuration for
  requirements the product does not have.
- Treat file size as an attention signal. Use the diagnostics described in
  `docs/architecture/file-shape-guardrails.md`; never split solely to cross a
  numeric threshold.
- Preserve public behavior unless the approved package explicitly changes it.

Use `.agents/skills/architecture-boundaries/SKILL.md` for owner-shape changes and
the smallest matching quality, test, persistence, UI, or integration skill for
the surface actually touched.

## Execution Contract

- Keep one package bounded by one owner, one seam, and one proof surface.
- Use the runbook's [delegation policy](docs/AGENTIC_DEV_WORKFLOW.md#delegation)
  when a package benefits from delegation; package admission does not require a worker.
- Parallel writers require disjoint files, symbols, fixtures, and verification.
  Serialize shared contracts, composition roots, and integration.
- Add a final independent `reviewer` only when risk, novelty, blast radius, or
  weak verification evidence makes hidden risk substantial. Repeat review only
  after a material finding or material review-surface change.
- Do not expand the package to opportunistic cleanup. Record a separate finding
  only when it has present evidence and deserves independent priority.

## Verification And Closeout

Record the risk class, primary verification mode, exact commands, expected
outcomes, rationale, and whether new tests are needed. Use the command canon in
`docs/AGENTIC_DEV_WORKFLOW.md`.

Use the runbook's [verification gate](docs/AGENTIC_DEV_WORKFLOW.md#verification),
including its nonbehavioral exception and reuse of still-current evidence. The
checklist does not impose an additional gate based on file location or package
membership. Inspect the final diff and run `git diff --check` before closeout.

Close a package only when the source finding is resolved or explicitly accepted
with one owner and revisit trigger, required behavior and contracts hold, proof
is fresh, architecture docs are current, and no compatibility residue or unused
abstraction was introduced.

## Optional PQR-EXIT Review

If explicitly approved, PQR-EXIT is a read-only production-readiness review of
the completed PQR-1 through PQR-7 surfaces:

1. Confirm every recorded source finding is resolved, source-disproved, or owned
   with a revisit trigger.
2. Confirm no package introduced behavior drift, public API widening,
   compatibility shims, unused abstraction, or ownership ambiguity.
3. Confirm applicable current verification under the runbook and record exact results;
   reuse inspected proof that remains current.
4. Obtain one clean independent review of the final evidence.

Completion is the evidence record above. An external health scan may be run only
when the maintainer separately requests it and remains retrospective input—not
an exit condition or a source of automatic follow-up work.

## Historical Evidence

Detailed completed package records remain in `docs/runs/`, repository history,
and the current architecture/API documentation. Consult them only when a current
finding touches the same decision or needs provenance; do not load them by
default or treat old package membership as an active queue.
