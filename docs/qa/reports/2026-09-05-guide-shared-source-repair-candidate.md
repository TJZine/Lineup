# Guide shared-source repair: exact implementation candidate

Status: **Automated verification and independent review passed; physical QA
deferred by the operator. P2 remains open. No release or device install.**

## Exact identity

- Implementation: `bd6368432598e89e86e44c0360eb6b9c31e40338`.
- Baseline evidence: `a8ae5f24`; prior physically tested implementation: `57d7a2a4`.
- The development build used an isolated `git archive` of the implementation
  commit under `.git/guide-remediation/candidate-bd636843/`. Its dependency lock
  matched the workspace installation. `npm run build:dev` passed.
- Package: `.git/guide-remediation/candidate-bd636843/packages/com.lineup.app_1.0.0_all.ipk`.
- Package SHA-256: `8e7a0ae900af3b7c073ac0d332777f262a92ac26bcec69dfd3828b5cc9a14fc5`.
- Entry: `assets/index-CAtwgibB.js`.
- Entry SHA-256: `ac711ed152a077c03be7c575f2118dfae3e62ca7881539229ff8b127d7f547b7`.
- Packaging used `ares-package --no-minify`. All 68 packaged build files matched
  the artifact-only `guide-qa-provenance.json` manifest. This is local artifact
  proof; the running TV entry has not been checked for this commit.
- [Sanitized candidate identity](../evidence/2026-09-05-guide-shared-source-repair/candidate.json).

The later documentation commit that records this candidate is not another tested
implementation. Use the full implementation hash above for device attribution.

## Result and verification

The [adjudication](2026-09-05-guide-pro-adjudication.md) records the selected scope,
deferred recommendations, controller corrections, and independent review.
Shared producers now retain common source authority; caller cancellation releases
only that caller's interest. Retired producers drain before scope/shutdown
teardown. Explicit Guide retry bypasses completed caches recursively while joining
useful work. Source/result diagnostics are bounded and allowlisted, with EPG
completion authoritative for settlement.

Final `npm run verify` passed on unchanged implementation source: 350 unit suites
with 4,670 passing tests, six TypeScript tooling suites with 52 passing tests, six
contract suites with 94 passing tests, Node tooling tests, coverage, typecheck,
architecture/CSS lint, docs verification, bundle verification, and the dev build.
One unit test and one tooling test remain skipped. Existing large-chunk build
advisories remain. Independent review's diagnostic finding was corrected and its
narrow re-review reported no remaining blocker.

Pre-existing plan additions/deletions were checked against the saved starting
diff and preserved exactly. Only the controller's remediation-authority section
was committed from that file. Scorecard, subtitle documents, and the prior LG C3
handoff remain unrelated working-tree changes.

## Remaining physical proof

The operator explicitly chose to do physical QA later. No source restoration,
fixture mutation, TV installation, remote-input batch, picture/sound check, or
performance measurement was performed for this candidate. The historical
exception remains unknown; the code-level regressions do not prove the cause of
every previous physical failure.

Resume with the [active plan's Phase 5](../../plans/2026-09-04-guide-loading-recovery-and-startup-warmup-plan.md):

1. Verify the package digest, install only this development candidate, and verify
   the running manifest and entry digest. Establish the current operator-access
   and backup/restore state before any fixture change; do not assume a prior
   Inspector reference or private backup remains valid.
2. Use bounded operator batches, with individual checkpoints for cold launch,
   immediate Guide opening, explicit retry, and persisted-state boundaries.
   Preserve unexpected states before recovery actions.
3. Cover immediate and ten-second-deferred cold Guide opening, forward/reverse
   ranges 1–20, 90–110, 140–170, 250–280, and 330–350, terminal stability at
   0/30/60/180 seconds, and physical OK recovery after external source restoration
   without channel replacement, cache clearing, or re-prime.
4. Retain the zero-loading warm-opening expectation, first-visible-ready ≤250 ms,
   all-visible-settled ≤1,000 ms, and healthy cold-range settlement ≤10 seconds.
   Measure actual HTTP/paint separately from resolution attempts/publication.
   Verify hidden concurrency one, background cap 96, remote/focus behavior,
   close/reopen, and physical picture/sound/PiP. If a fixture is used, prove
   canonical restoration with array order preserved and only the accepted
   `lastContentRefresh` exclusion.

Correctness: **candidate awaiting physical validation**. Performance:
**previous targets missed; candidate unmeasured**. P2 stays open. Phase 6 retains
separate correctness and performance verdicts; retries and automated passes alone
cannot close it.
