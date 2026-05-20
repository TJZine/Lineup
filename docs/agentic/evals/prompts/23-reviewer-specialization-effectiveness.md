# 23 Reviewer Specialization Effectiveness

## Source

- multi-agent role selection eval in [`19-multi-agent-role-selection-and-delegation-discipline`](./19-multi-agent-role-selection-and-delegation-discipline.md)
- architecture-boundary and maintainability review policy in the workflow control plane
- scorecard telemetry fields in [`scorecard-template.md`](../scorecard-template.md)

## Intent

Test whether review requests route to the right reviewer specialization and whether the selected reviewer produces useful, accepted findings rather than extra review noise.

## Prompt

Run three review-routing decisions against these diff summaries. For each summary, choose the primary tracked reviewer role, state whether a second reviewer is justified, and record findings count, blocking findings count, accepted findings count, rework rounds, wall time, and any observed token/credit/cost data.

- Diff A: a small implementation patch changes one docs verifier helper and its public contract test; the requested review is correctness/regression focused, with no hotspot, boundary, security, or maintainability-only framing.
- Diff B: a cleanup-only patch renames misleading helpers, removes dead/debug leftovers, and reduces duplicated prompt text across workflow docs; behavior and architecture boundaries are unchanged.
- Diff C: a patch changes `App`/orchestrator composition and persistence-adjacent routing around selected-server or Plex stream-url state; the requested review should catch owner-seam, public-contract, and security-adjacent regressions.

Prefer the reviewer that matches the risk surface. Do not add parallel reviewers unless the diff genuinely spans multiple independent risk domains, and do not score finding volume as success unless findings are accepted or prevent concrete rework.

## Expected Skills

- `review-request`
- `review-adjudication`
- `model-selection`

## Expected Codanna Behavior

- use focused repo discovery for the files or docs named by the diff summary
- keep read-only review roles read-only

## Expected Verification

- `npm run verify:docs`

## Fail Conditions

- routing maintainability-only/code-health review to the general reviewer when `maintainability_reviewer` is available
- routing hotspot, boundary, or security-adjacent architecture review to the general reviewer when `architecture_reviewer` is available
- over-specializing a normal correctness review
- reporting finding volume without noting accepted findings or blocking findings
- requiring raw review transcripts to be tracked
