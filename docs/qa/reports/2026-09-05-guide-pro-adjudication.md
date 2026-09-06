# Guide recovery and warmup: Pro adjudication and bounded execution brief

Status: **P2 open**. This brief records the adjudication of the supplied GPT Pro handoff and the implementation contract released by the controller. It does not close the incident or approve release deployment.

The [exact implementation candidate and deferred physical handoff](2026-09-05-guide-shared-source-repair-candidate.md)
record the resulting commit, development package, verification, and remaining QA.

## Evidence baseline and authority

The evidence baseline is `a8ae5f24` (`origin/code-health`). Its production source is the tested implementation commit `57d7a2a4`; the later evidence commit contains documentation and evidence only. Any repair must establish a new exact implementation commit, build identity, installed artifact, and running entry hash before physical conclusions are attached to it.

The governing material is the [agentic development workflow](../../AGENTIC_DEV_WORKFLOW.md), the [active Guide recovery and startup warmup plan](../../plans/2026-09-04-guide-loading-recovery-and-startup-warmup-plan.md), the [investigation handoff](2026-09-05-guide-investigation-handoff.md), the [physical validation report](2026-09-05-guide-loading-recovery-validation.md), and the [sanitized checkpoint evidence](../evidence/2026-09-05-guide-loading-recovery-validation/checkpoints.json). The supplied Pro comparisons are acknowledged as third-party input; they were not independently revalidated here and do not prescribe a patch mechanism.

The working tree contains pre-existing collaborative changes. Preserve the active plan, `scorecard.png`, the subtitle audit and remediation documents, and the LG C3 collaborative QA handoff. This report is the only new file in this unit.

## Adjudication

| Finding cluster | Verdict | Evidence and boundary | Scope consequence |
| --- | --- | --- | --- |
| Shared cancellation | **Accept** | Source inspection plus controlled actual-class execution: A creates, B joins, A aborts with an arbitrary string, B rejects while B is not aborted, and the request remains a single producer. This proves an ownership defect in the composed path; it does not prove that it caused every physical cold-start failure. | Repair producer ownership and caller waiter isolation. |
| Cancelled-entry admission, retirement, and drain | **Accept with modification** | A cancelled producer can leave source lifecycle state coupled to a caller. Admission, identity retirement, and producer drain are required for safety. The latent lifecycle defect is code-proven; physical causality remains unproven. | Keep the fix bounded to common-scope producer lifecycle, admission, drain, and stale publication guards. |
| Negative or empty-result retry | **Accept** | Controlled actual-class execution confirms that an empty restored source remains `[]` on a single lookup. Completed empty results can therefore mask an explicit retry until revalidation bypasses completed caches. | Add targeted noninvalidating revalidation: bypass completed caches recursively, join useful in-flight work, and do not invalidate sibling entries. |
| Actual fresh exception | **Needs validation** | Fresh normal-onboarding cold Guide failures are reproduced on the exact tested dev artifact, but the physical report captured no causal exception and records `originalCauseEstablished: false`. | Use bounded diagnostics and a new exact build to capture the causal phase and exception. |
| Classifier-only or arbitrary-string broadening | **Reject** | `isAbortLikeError` treats an arbitrary string as non-abort; the controlled execution demonstrates why a producer must not translate that string into shared cancellation. | Preserve abort classification semantics; repair ownership and reason propagation instead. |
| Diagnostic unit | **Accept with modification** | Diagnostics are useful only if bounded and privacy-safe, with allowlisted causal/phase fields, source correlation, and device evidence for actual HTTP and paint timing. | Use the existing debug seam/helper; add no persistence or schema. |
| Immediate-adoption rewrite | **Needs validation; defer** | Current EPG adoption identity and freshness guards are not shown to be the cause of the current regression. | Prove retry propagation and composed settlement first; leave adoption logic unchanged unless a regression requires it. |
| Startup UI and collection repair | **Defer** | Current startup policy throws for `content_unavailable`; the older-installed incident established a missing saved collection key, but not the installed commit or collection recreation/Kometa involvement. The backlog approves planning; the precise landing surface and recovery metadata contract remain separate decisions. | No implementation in this Guide repair. |
| Continuity, number entry, rewrite, and snapshots | **Defer** | These are separate product/architecture or backlog concerns. | No implementation in this unit. |
| Concurrency/cache increase, added delay, or automatic retry | **Reject as primary remedy** | Existing bounds are deliberate; the physical evidence lacks phase attribution and does not establish that more concurrency, cache, delay, or retries address the cause. | Preserve current bounds and retry policy while measuring. |
| Performance optimization | **Needs validation** | Performance is a separate open verdict. The sampled cells are not row settlement: first sample was 277.1 ms with five loading cells, and range 340 was loading at 10.3847 s and ready by 75.5802 s, giving `10.3847s < settlement ≤ 75.5802s`. | Attribute time to phases with diagnostics before changing scheduling, cache, or concurrency. |

## Released implementation contract

The controller owns this scope under the user's delegated authority. The implementer owns local helper names and test organization within these contracts.

- Keep producer state in a common scope and expose caller cancellation as waiter state. Cover mixed parent/direct-child composition so a child cannot accidentally inherit a caller-owned producer lifetime.
- Admit only current entries, retire cancelled entries with identity guards, and drain the actual producer before releasing its retained source lifecycle. A stale or cancelled producer must not publish into a replacement entry.
- Add a `cacheMode` or equivalent internal operation intent for targeted revalidation. It must bypass completed channel/source caches recursively, still join useful in-flight work, and avoid invalidating sibling entries or broad cache state.
- Propagate the EPG retry signal through the composed resolution path and prove settlement identity/currentness. Keep existing adoption identity and freshness guards unchanged unless a focused regression demonstrates that they must change.
- Add bounded diagnostics through the existing privacy helper/source correlation seam. Capture only allowlisted causal phase, source correlation, and timing fields; device evidence must distinguish actual HTTP activity from DOM paint/row observations. Add no new storage, persistence, or schema.
- Keep startup routing, collection recreation, continuity, number entry, snapshots, scheduler caps, cache limits, timeout/retry policy, and playback behavior outside this change.

The retained owner seams are the [operation context](../../../src/modules/scheduler/channel-manager/resolution/ChannelResolutionOperationContext.ts), [source cache](../../../src/modules/scheduler/channel-manager/resolution/SourceResolutionCache.ts), [retained operation context](../../../src/utils/RetainedOperationContext.ts), [abort classification](../../../src/utils/errors.ts), and [EPG refresh runtime](../../../src/modules/ui/epg/runtime/EPGScheduleRefreshRuntime.ts). The [channel manager contracts](../../../src/modules/scheduler/channel-manager/contracts/interfaces.ts), [EPG refresh controller](../../../src/modules/ui/epg/coordinator/EPGRefreshController.ts), [EPG policies](../../../src/modules/ui/epg/coordinator/EPGCoordinatorPolicies.ts), and [Plex fetch policy](../../../src/modules/plex/library/PlexLibraryFetchPolicy.ts) are reference boundaries; change them only if the released contract requires it.

## Acceptance and verification

The following proof remains pending and must not be represented as complete until observed:

- [x] Add red/green regressions through the real composed ChannelManager/source-cache path for producer/waiter cancellation, arbitrary abort reasons, mixed parent/direct-child ownership, cancelled-entry retirement, producer drain, stale publication, and one-producer coalescing.
- [x] Add targeted revalidation coverage proving that a completed empty source result can be refreshed after external restoration, while useful in-flight work is coalesced and sibling cache entries are preserved.
- [x] Add EPG retry propagation and composed-settlement coverage without changing adoption identity/freshness behavior.
- [x] Add bounded privacy-safe diagnostics and inspect the resulting source correlation and phase timing in automated coverage. Physical timing interpretation remains pending.
- [x] Run the independent adversarial review against correctness, cancellation, stale publication, shared-request behavior, producer drain, resource bounds, and playback competition. One diagnostic finding was corrected and the narrow re-review found no remaining blocker.
- [x] Run `npm run verify`, repair failures caused by this change, and inspect the final diff. The exact implementation/artifact identity is recorded separately at packaging.
- [ ] Build and install the exact dev artifact for that commit; verify manifest/package identity and the running entry hash on the device. Do not deploy a release.
- [ ] Run bounded physical operator batches: terminal `0/30/60/180` stability and one targeted retry; cold immediate and deferred warmup; prescribed forward/reverse Guide ranges; visible settlement and background-cap checks; physical D-pad/page/OK/Back/close/reopen/PiP and picture/sound checks; external source restoration without channel replacement, cache clearing, or re-prime for the retry case; and final public-owner fixture restore with canonical comparison.
- [ ] Record separate correctness and performance verdicts from the exact resulting build. Preserve failures before reset and stop a batch on unexpected screen, focus, playback, or loading behavior.

The latest operator reports (cache clear/re-prime/refresh recovered only the then-visible viewport; OK recovered some other rows; channels 97 and 98 needed another attempt) are explicitly uninstrumented observations. They are not causal proof and do not satisfy the one-press physical acceptance gate.

## Closure rule

The previous physical build's correctness verdict is **failed/open**; the repair
candidate awaits exact-build device validation. The historical exception was not
retained, so physical causation remains unestablished. Performance is
**missed/open** because the sampled targets were missed and phase evidence is
incomplete. P2 stays open today. The operator explicitly deferred physical QA
until later; this remediation session performs no device install or remote test.

The active plan's Phase 6 governs closure: once every correctness criterion and fixture restore pass, P2 may close with a measured performance follow-up if performance targets miss. GPT Pro's stricter requirement that both correctness and performance pass before closure is therefore not adopted. Future reports must retain the two verdicts separately.

## Cohesion decisions

- SourceResolutionCache already owns producer coalescing, retirement, cache writes,
  and waiter accounting. Common-scope producer retention and producer drainage
  belong there, with scope suspension coordinated by ChannelManager's existing
  resolution-operation owner. No new request scheduler is introduced.
- AppOrchestrator shutdown wires the existing `supersedeActiveResolutions()` drain
  before save flush and dependency disposal. The composition root does not gain
  request policy. A deferred-drain assembly test proves that teardown waits.
- Targeted revalidation is a channel/source resolution intent. Guide supplies the
  intent; the existing resolver owns its recursive cache behavior. Playback,
  authentication, channel configuration, and persistence formats are unchanged.
- GuideDiagnosticValues owns the privacy translation shared by source and EPG
  diagnostics. It emits allowlisted scalars only and owns no stateful log/store.
  EPG buffers at most eight source events per attempt, with an explicit dropped
  count, before one completion record reaches the existing 250-entry store.

## Controller integration checks

The first controller diff inspection identified omitted propagation of revalidation
into mixed children/show decoration, and a zero-waiter cancellation cleanup gap.
Both were returned as exact corrections, with regressions. Additional composed EPG
tests use the real ChannelManager/ContentResolver/cache behind the controlled Plex
boundary. Worker-observed diagnostic integration checks passed: five focused
suites, 167 tests, plus the final EPG runtime follow-up (62 tests), typecheck and
targeted ESLint. The controller observed the missing shutdown-drain regression
fail before wiring the drain, then the complete Orchestrator suite passed (85
tests). These are code-level observations, not LG C3 proof.

Independent review found a diagnostic acceptance blocker: source success was
called `settled` before post-observer currentness checks could reject it. The
controller accepted the concern with a modified remedy: `result/success` now
means provisional source items, while EPG completion owns the final verdict.
Post-observer stale-result guards remain intact. Both cache-hit and uncached
reentrant invalidation tests assert only one terminal failure. The narrow
re-review accepted this correction with no remaining blocker; 87 affected tests
passed. Final `npm run verify` passed with 4,670 unit tests, 52 TypeScript tooling
tests, 94 contract tests, the Node tooling suite, coverage gates, typecheck,
architecture/CSS lint, docs structure, bundle verification, and the development
build. Two existing tests remain skipped (one unit and one tooling test). The
existing large-chunk build advisory remains. No physical proof is implied.

The controller also tightened the error allowlist to read each throwable property
once, so a stateful accessor cannot substitute a private value after validation.
