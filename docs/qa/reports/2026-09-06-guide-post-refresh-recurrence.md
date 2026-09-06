# Guide unavailable rows after reported daily refresh — 2026-09-06

P2 remains open. Recovery and shuffle-continuity implementation passed local
verification and independent review under the 2026-09-06 plan; development device
QA is pending. The development candidate is installed; no release deployment.
The sections below preserve the investigation chronologically; later verification
supersedes the explicitly pending checks recorded earlier.

## Operator evidence

The operator reports many unavailable rows after the daily Kometa refresh and
multiple unsuccessful OK retries. Channels 19 and 20 are affected. After a full
app restart and later a TV power cycle, the operator pressed OK three times on
channel 19. The pre-restart runtime was not captured.

## Direct evidence

The developer endpoint initially timed out from both Codex and the operator’s
Terminal. The operator confirmed the same TV IP and active Developer Mode. After
a physical power cycle, the same endpoint accepted connections and Inspector
attached successfully. The precise connectivity cause is unproven.

Before the reported three retries, Inspector showed multiple collection-children
GET requests returning HTTP 404. After the retries, the console contained three
additional GET errors for the same collection endpoint, each HTTP 404, paired
with library warnings. This correlates the retry batch with repeated real server
failures; channel-to-source identity still needs a direct runtime check. Private
server addresses and collection identifiers are intentionally omitted here.

The running assets include `auth-C7Z8lguS.js`, `discovery-DK55St2j.js`, and
`index-DDJ5WpUY.css`. Exact implementation identity is not yet verified for this
new runtime. Do not assume the previous candidate solely from conversation.

## Interpretation and next proof

Proven: repeated collection requests receive 404, including three additional
requests after the channel-19 retry report. Retrying is not merely displaying an
old unavailable state without any request.

Hypothesis: saved collection references became obsolete after collection
recreation. Kometa recreation itself, replacement identity, and channel 20’s
specific request are not yet proven. The existing ContentResolver collection
path requests the saved collectionKey; collection identity recovery was explicitly
outside the previous shared-request repair and is retained in `todo.md`.

Next: verify running artifact, correlate channels 19/20 to saved sources, and
compare the old references with current library collections without mutating
lineup data. Preserve unique/ambiguous/missing match distinctions before deciding
on repair. Inspector’s new-origin paste warning currently blocks custom reads;
the operator must handle that browser warning. No diagnostic settings changed.

## Runtime verification and replacement validation

The runtime has timeOrigin 1788695632012.8. Packaged `guide-qa-provenance.json`
identifies implementation `bd6368432598e89e86e44c0360eb6b9c31e40338`; the running
entry SHA-256 matches the retained exact candidate:
`ac711ed152a077c03be7c575f2118dfae3e62ca7881539229ff8b127d7f547b7`.

The active manager confirms channels 19 and 20 are shuffled collection channels
sharing the failing key and carrying sourceLibraryId metadata. Listing the saved
library through the existing PlexLibrary owner returned 73 collections: the old
key was absent and exactly one exact-name match had a different key. Reading that
candidate returned 67 items, all with positive durations. Original references
remained unchanged. This establishes the reference mismatch and a usable candidate,
without proving the automation event that created it. Listing completeness beyond
the existing API response must be addressed in implementation proof.

The operator clarified the adjacent continuity issue is changing Plex collection
item order, not channel list order. The existing same-day continuity backlog notes
apply. Root prioritizes reference recovery and stable shuffled ordering as separate
correctness units; no production changes yet.

## Diagnostic-induced error — exclude from product reproduction

A controller console probe fetched `build-provenance.json`, which is absent from
this older QA package. Its uncaught rejection triggered the app global error
overlay, reported by the operator as a fatal Failed to fetch message. This was
caused by the diagnostic, not the collection retries. Root acknowledged the error,
removed only that exact overlay, and verified it absent; the Guide still contained
one cell marked focused. DOM focus returned to body because that cell was not
natively focusable; physical navigation confirmation remains pending. No app
restart, cache clear, or persisted channel mutation followed. Later asynchronous
probes caught their errors. Temporary Inspector `temp1` references the existing
app instance and does not create another app or shipped debug surface.


## Operator confirmation and local ordering proof

The operator confirmed the Guide is visible and responding after removal of the
diagnostic-induced overlay. No further physical input is required while the
implementation is prepared.

Three new public-seam regression tests fail with the original ordering code:
response permutation changes channel shuffle/random order and the scheduler's
current program/window. The shared stable-input change passes all 74 tests in
ContentSelectionPolicy, ScheduleCalculator, ChannelScheduler, and blockPlayback
suites. This is automated local proof, not physical validation of a new build.


Before installing changes, the 390 current channel configurations were fingerprinted
in array order, excluding only collectionKey for top-level collection sources and
lastContentRefresh/updatedAt/itemCount/totalDurationMs. Remaining configuration
(including seeds, anchors, IDs, numbering, names, filters, settings, and library
metadata) SHA-256:
`381cddad263ac0e36825bb24b63787a869ba724e7a7295b4808d4bff95b8e1fe`.
This is a preservation comparison, not a restorable backup or a continuity proof.

A second baseline canonicalizes object keys recursively while preserving all array
order and the same narrow exclusions, avoiding false differences from serialization
property order. Use this canonical SHA-256 for the post-install comparison:
`f81361c418518165988e2a5015efb86e98f38be66faccfc2e1b589d77ebd0d28`.

## Local implementation verification

The controller limited recovery to foreground content resolution (including Guide
retry and authorized initial tuning). Independent review caught an initial
schedule-only mutation; that path now preserves its nonmutating contract, with a
regression test. Complete-listing, error-classification and lookup-lifecycle
tests pass, alongside 17 manager integration cases for persistence, pending saves,
stale consumers, edit/delete reentry, scope drain and initial tuning.

The full `npm run verify` passed: 354 unit suites (4,716 passed, one skipped),
six tooling suites (52 passed, one skipped), six contract suites (94 passed),
Node tooling, typecheck, lint, coverage thresholds, docs, lean bundle gate and dev
build. An initial lint failure in a new test's missing return annotation was
corrected before this complete run. Architecture size notices and the dev chunk
size advisory are attention signals, not gate failures.

The review's earlier unhandled AbortError reproduction was isolated to a test
asserting before its deferred producer started, then disposing unobserved work.
The corrected integration suite waits for the producer and settles its promises.
No physical proof of the new implementation is claimed yet.

Final independent review found no remaining actionable issues. The reviewer
observed 39 recovery-boundary tests, 39 ordering tests, and a targeted EPG retry
integration test passing. Foreground retry can publish the repaired schedule;
the production `channelUpdated` subscribers do not invalidate that active retry.

## Exact development candidate installed

Implementation commits: `9eaf10b8` (stable shuffle) and
`5b1f7a14b5a7c0a6eb86c829a3cd5c9f1f1ee0de` (reference recovery).
After commit, `build:dev` succeeded with an empty build-relevant dirty summary.
The development package's 70 source files were compared byte-for-byte against
the packaged archive before installation.

- Package SHA-256: `b24896152530a25ad3ff711f9011e65dc768a05febcb498d3cd35eb5003eb13c`
- Entry: `assets/index-DCNhgkPp.js`
- Entry SHA-256: `dddf4acc419ff59623bde71a2ec344f3a60bb62fc0eddd4c5876653d09108f4d`

Lineup was closed, the running-app list was empty, installation succeeded, then
one launch succeeded. Fresh Inspector shows the new entry and “Started
successfully.” Runtime manifest/hash verification, operator picture/sound, and
the recovery/relaunch batch remain pending. The new Inspector origin presents
the browser paste-warning gate; no probe executed through it yet.
