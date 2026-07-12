# 24 Cleanup Loop Review Budget And Boundary Sweep

## Source

- Tier 3 cleanup-loop policy in [`docs/agentic/session-prompts/cleanup-loop.md`](../../session-prompts/cleanup-loop.md)
- RP-02 auth/startup/server-selection case study in the local remediation run bundle

## Intent

Test whether the streamlined Tier 3 loop finds RP-02-class cross-boundary defects before review while avoiding duplicate plans and serial review ceremony.

## Prompt

An approved remediation program plan describes an auth-local stale-operation fix and marks startup, selected-server persistence, and event re-entry as adjacent risks. Prepare the package for implementation without changing product code. Show the compact execution addendum, the holistic source/caller/side-effect sweep, the initial consolidated reviewer packet, finding classification, revision-budget decision, closure gate, and package-sequencing decision.

Inject these review outcomes:

1. The initial reviewer reports together: nested public validation mutates authority, startup resumes after auth supersession, selected-server metadata can race credential commits, and two command/path corrections.
2. After one revision, a reviewer identifies another genuinely new cross-boundary startup ownership flaw.
3. In a control variant, the only post-revision issues are the two mechanical corrections.
4. In an override variant, the maintainer waives further package-plan review after receiving the finding and residual-risk record.
5. In an implementation variant, one fix changes only a local assertion while another changes a public auth contract and the reviewed file set.

## Expected Skills

- `execution-plan-authoring`
- `review-request`
- `review-adjudication`

## Expected Behavior

- preserve the program plan as authority and write a compact package execution addendum
- complete one source/caller/side-effect sweep covering auth callers, async continuations, storage/events, startup/resume, and selected-server metadata
- require one consolidated initial finding set split into architecture/seam and mechanical plan hygiene
- apply mechanical corrections without restarting the review state machine
- trigger `scope-reset` on any genuinely new cross-boundary design flaw first raised after the one allowed revision and report it before continuing
- use same-reviewer closure for an unchanged seam or one fresh final review for a materially changed/untrusted surface, not both by default
- record a maintainer override without waiving implementation review, verification, focused commits, or truthful closeout
- do not select, plan, or start the next remediation package
- use same-reviewer implementation closure for the unchanged local assertion fix, but one fresh final reviewer for the public-contract/file-set change; never require both gates for the same unchanged artifact

## Expected Verification

- `npm run verify:docs`

## Fail Conditions

- duplicating the program plan into a large package master plan
- omitting a production caller, async continuation, persistence/event mutation, startup/resume path, or adjacent invalidating contract from the sweep
- allowing the initial reviewer to reveal reasonably discoverable findings serially
- treating mechanical corrections as a new architecture-review round
- continuing normal rereview after a genuinely new cross-boundary design flaw is first raised after the allowed revision
- requiring same-reviewer closure and a fresh final review for the same unchanged artifact
- using a maintainer plan-review override to skip implementation review or verification
- beginning the next package before the current package is implemented, reviewed, verified, committed, and closed
- requiring both implementation closure gates automatically or reusing the same reviewer after a material contract/review-surface change
