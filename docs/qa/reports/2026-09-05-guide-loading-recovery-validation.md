# Guide Loading Recovery LG C3 QA — 2026-09-05

Status: **P2 OPEN — fresh-onboarding cold-start Guide failures reproduced.**

The tested LG C3 development artifact was verified against exact implementation
`57d7a2a4a4cc80b96d4939eb2405292841559424` using its running entry hash and build
manifest. The initial stale-install startup error below predates that verification
and is a separate incident. No production code was changed during QA.

Final findings:
- Disposable failure stays terminal; manual failed retry and browser-driven
  valid-source recovery worked without closing Guide.
- Real Guide rows fail after cold launch even on a freshly built normal-onboarding
  lineup, with no developer restoration between build and launch. Eight rapid
  resolution failures follow request invalidations; causation is unproven.
- Warmed opening and the range-340 ten-second performance target missed.
- Restored configuration matched the original backup after excluding only
  lastContentRefresh; the operator accepted this refinement of raw-checksum proof.
  The operator subsequently replaced that lineup through normal onboarding.
- Immediate-open priority timing, complete concurrency/resource proof, and parts
  of the physical matrix remain incomplete. Do not close P2 or claim performance
  completion from this report.

Use the [investigation brief](2026-09-05-guide-investigation-handoff.md) as the
entrypoint. The following sections preserve session chronology; early statements
about unavailable access, unverified artifacts, pending backup, and no device
mutations describe those earlier checkpoints, not the final status.

## Initial preflight chronology

The checkout HEAD was verified as
`57d7a2a4a4cc80b96d4939eb2405292841559424`. This is repository identity
proof only; the installed LG C3 artifact has not been verified in this session.
AGENTS.md, the complete agentic workflow, and the complete active recovery plan
were read. Phase 5 controls this session.

Phase 5 step 0 requires an authorized operator-access mechanism before device
validation. Source inspection confirms that `createLineupDebugApi` in
`src/bootstrap.ts` exposes no lineup export, replacement, save flushing, or
re-prime access. ChannelManager has public `exportChannels`, `getCurrentChannel`,
`replaceAllChannels`, and `flushSaves` methods, but access to the running owner
has not been established or authorized. No mutation bridge was added.

Initial preflight performed no device actions. After the operator authorized
resolving access, `ares-inspect --device LGC3 --app com.lineup.app` connected to
the running app and its Inspector was opened. The Inspector identified the
`com.lineup.app` target. No launch, relaunch, installation, release deployment,
fixture export/mutation, timing measurements, or physical acceptance checks were
performed by this session. Automated implementation/review phases were not repeated.

The operator then reported that opening the installed app produces a startup
error and that the error is currently present. This is operator-observed evidence;
the exact message and installed artifact identity are not yet verified. The
operator described it as present after a launch, but this session issued only an
Inspector connection command, not `ares-launch`. No cause or attribution to
`57d7a2a4` is established. QA setup stopped immediately to preserve the state.
The Inspector remains open. Error text has been requested with private values
omitted. Do not reload, reinstall, dismiss the error, or mutate the fixture before
the separate diagnosis/remediation decision.

Pre-existing changes were preserved: the active recovery plan, `scorecard.png`,
`SUBTITLE_AUDIT_REPORT.md`, `SUBTITLE_REMEDIATION_NEXT_SESSION_PROMPT.md`, and
`docs/plans/2026-09-02-lg-c3-collaborative-qa-handoff.md`.

Next required decision: hand off the startup error for a separate bounded
diagnosis/remediation decision. The operator authorized resolving Inspector
access, but that work remains incomplete and is paused. Resume Phase 5 setup only
after the error disposition permits it. The operator must keep any
private backup outside the repository; this session's agent work stays inside
the repository. Then verify the installed development artifact, capture and
verify the backup, and proceed through the physical matrix with bounded batches
and the specified timing/persisted-state checkpoints.

All physical results, fixture backup/restore proof, and performance verdicts
remain pending. No private fixture content, credentials, titles, identifiers,
or device screenshots were captured.

Evidence: [sanitized session state](../evidence/2026-09-05-guide-loading-recovery-validation/checkpoints.json).

## Authorized read-only startup diagnosis

The operator subsequently requested diagnosis and advice on rebuilding. Inspector
DOM inspection confirmed the fatal overlay and the sanitized detail:
`Initial channel switch failed for [channel]: content_unavailable.`
The running page loads `index-92r2mDCr.js`; no provenance mapping to an exact
commit has been established. The local dist entry is `index-DZ68Dw1o.js`, and no
local dist provenance file exists. Neither filename proves the installed commit.

Console inspection found a collection-children request and a PlexLibrary
`404 Not Found` warning for a collection-children URL. It also contains
`net::ERR_ADDRESS_UNREACHABLE`; its causal relationship to the collection failure
is not established. Private URLs, collection keys, and channel identifiers were
withheld from tool output and this evidence.

Current-source trace:

- PlexLibraryRequestClient maps 404 to null data; PlexLibrary.getCollectionItems
  maps that to an empty item list.
- ChannelManager rejects unavailable/empty resolved content; ChannelTuningCoordinator
  maps resolution failure to `content_unavailable`.
- InitializationStartupPolicy throws for that initial-tune outcome. It chooses
  the first channel only when no current channel exists, not when the current
  channel fails to resolve. There is no fallback/recovery routing in that branch.
- Commit `1d879b72` introduced the explicit failed-startup throw. The recent
  Guide recovery/warmup changes do not repair collection references or change
  this initial-tune outcome policy, which remains present at `57d7a2a4`.

Assessment: an unavailable collection reference is supported by the observed
404, but deletion/recreation, wrong server/profile context, or another request
issue have not been distinguished. There is no evidence that the entire lineup
is corrupt. Rebuilding may refresh obsolete collection references, but is not
proven necessary and would not address fatal startup on unavailable content.
Preserve the fixture; compare the referenced collection with the same
server/profile's current collection listing before choosing rebuild or a narrow
repair. Treat startup recovery as a separate product/remediation decision.

No production edits, requests to Plex for additional content, lineup mutation,
relaunch, or install were performed during diagnosis. Existing failure evidence
was inspected without reproducing it. No automated test gate was rerun for this
read-only diagnosis; evidence JSON parsing and `git diff --check` passed.

## Follow-up connectivity checks

The operator authorized carrying out the recommendation. The failed collection
request was present once in Resource Timing, with no token in its query. Saved
active-profile credentials exist, but the saved selected-server origin differs
from the observed request origin. The first metadata-check script stopped at
that origin guard without making a request.

Two subsequent bounded, unauthenticated `/identity` GETs checked the observed
request origin (15-second overall bound) and the saved selected-server address
(10-second bound). Both failed before identity verification; Inspector reported
`net::ERR_ADDRESS_UNREACHABLE`, and the saved-address failure was not a timeout.
No collection metadata/listing request with credentials was sent. No private
address, token, server identifier, or collection key was returned in evidence.

The development debug API is absent in the current failed app state. Public-owner
backup/repair access remains unresolved. No lineup or production-code changes
were made. Current connectivity prevents deciding whether the collection itself
is obsolete; the historical 404 alone is insufficient to select a rebuild.

Next operator batch: leave the Lineup error screen intact; confirm Plex Media
Server is running on its host, then use another device on the same home network
to open the same Plex server and play one item. Report host status, library
access/playback result, and any recent server/network address change, without
private values. Resume read-only collection checks once connectivity is resolved.

## Retry after operator restored TV connectivity

The operator reported that the TV may have been offline and requested a retry.
Both the observed-request address and the saved selected-server address returned
HTTP 200 for `/identity`, with the machine identifier matching the saved selected
server. Using the saved active-profile token, collection metadata returned 404
at both verified addresses.

The same profile's library listing returned 200 with six accessible movie/show
libraries. All six collection listings returned 200; counts were 1, 73, 10, 32,
0, and 0 (116 total). Each count equaled its reported total size, so no collection
pages were omitted. The failed collection key appeared in none of those lists.

Conclusion: connectivity recovered, but the referenced collection remains absent
from the current profile's accessible video collections on the verified selected
server. This supports an obsolete or no-longer-accessible source reference;
deletion versus recreation versus profile visibility is not distinguished.
Rebuilding the entire lineup is not yet justified by this single reference.
No retry of app startup, lineup mutation, code edit, or release deployment was
performed. The fatal startup state and existing lineup remain intact.

The operator subsequently noted that Kometa likely rebuilds collections daily.
This is a plausible explanation for the missing stored collection key if the
workflow deletes and recreates collections, but has not been verified against
their configuration or run logs. Kometa documents membership synchronization
separately from collection deletion settings such as `delete_not_scheduled` and
`delete_below_minimum`; a daily run alone does not establish recreation.
Reference: https://kometa.wiki/en/latest/config/settings/
Compare the saved collection name with current same-library candidates, and
confirm deletion/recreation in Kometa logs before attributing the missing key to
Kometa. A repeated recreation workflow would make a one-time lineup rebuild a
temporary workaround rather than durable recovery.

## Operator-authorized return to Channel Setup

The operator explicitly waived backup of the stale lineup before rebuilding and
requested a state reset to escape the startup error. Source inspection established
that the current server/profile setup-completion record controls startup routing
before the initial tune. Through Inspector, the session removed only that scoped
setup record directly from storage, then verified its absence and that serialized
Plex authentication was unchanged. This was a setup-marker reset, not a
ChannelManager export/restore or a completed Phase 5 fixture-safety gate.

The app page was reloaded. Inspector then verified `fatalOverlay: false`,
`setupVisible: true`, heading `Channel Setup`, and `debugAvailable: true`.
No channel records were deleted or replaced by this reset; the operator can now
choose replacement in the builder. No production code or installed artifact was
changed. The fresh lineup still needs backup before deterministic failure
injection, and the installed artifact still needs exact-commit verification.

## Replacement build completion checkpoint

The operator confirmed replacement in Channel Review, then reported build
completion with Done focused. Inspector confirmed Done present and focused,
no fatal overlay, a `390 channels` label, and no warning mention in the setup
surface. This is build-screen evidence, not yet save/restore or playback proof.
The next checkpoint is the operator's single Done action and its transition to
physical playback.

The checkout independently advanced to `a523497d` (documentation/skill changes).
There is no diff from `57d7a2a4` in `src`, package manifests/lockfile, or
`vite.config.ts`. Preserve that newer commit; exact installed-artifact validation
remains pending and this build must not be claimed as physical proof of `57d7a2a4`.

After Done, the operator reported fast settled playback, Guide subsequently
maximized with all visible channels already loaded, no picture/sound issues,
and no visible errors. These are qualitative physical observations, not
instrumented first/all-visible timing or a cold-relaunch acceptance result.
The Inspector tab had closed; its existing forwarding endpoint still returned
HTTP 200. The session reopened that Inspector URL without reloading the TV app.
Reattachment succeeded. A subsequent DOM checkpoint showed no fatal overlay,
video present/unpaused with readyState 4, Debug Logging stored as `1`, and no
Subtitle Debug Logging override. The active element was absent or body; this
checkpoint did not establish Guide visibility/focus and is not a focus pass.
Physical picture/sound proof comes from the operator, not the video element.

After the operator reported a frozen Inspector preview, two runtime samples
2,002 ms apart showed video time advancing 2.006 seconds, unpaused playback,
readyState 4, Guide visible, and no fatal overlay. This proves the diagnostic
connection is live, not physical video quality. The Inspector screencast was
toggled off/on without reloading the app and the image surface returned; visual
frame freshness itself has not been independently established.

## Exact implementation development artifact installed

Built an isolated `git archive` of
`57d7a2a4a4cc80b96d4939eb2405292841559424` under
`.git/qa-57d7a2a4-Zs4kcR/`, using the existing dependency installation after
confirming its repository lockfile matches the archived lockfile. `npm run
build:dev` passed (existing large-chunk advisory). No earlier implementation or
automated-review phase was repeated. Added artifact-only provenance containing
the archived commit, dev profile, and SHA-256 hashes of the built files, then
packaged with `ares-package --no-minify`.

Package SHA-256:
`760b03ca1486dc70244743f556a07bd5c11b401734c96307e4d528f53517719b`.
`ares-install --device LGC3` and `ares-launch --device LGC3 com.lineup.app`
both succeeded; no uninstall or app-data clear was performed. Installation closed
the previous debug target; Inspector was reconnected to the new target in the
existing tab.

On-device provenance reports the exact commit and dev profile. The running
`index-DZ68Dw1o.js` entry hash is
`0f18814aa451edd3e640ac4f96605a041c269644fb52cb853d3a51fa3a8729b5`,
matching the manifest and local artifact. The checkpoint shows no fatal overlay,
unpaused video and readyState 4. Physical picture/sound confirmation after this
install remains pending. This install/launch is not one of the controlled cold
warmup measurements; those and the verified fresh-fixture backup remain pending.

The working checkout remains `a523497d` with unrelated changes preserved. This is
a development-device installation only, not a release deployment.

## Fresh fixture backup preparation

The operator confirmed physical picture and sound good after exact-build install.
Inspector imported the already-installed AppOrchestrator module and used its
heap-query UI to locate one existing orchestrator instance, storing the result
in Inspector's temporary `temp1` variable. Through its existing owners, method
checks confirmed ChannelManager export/replace/flush and EPG re-prime access.
No production module was edited, no persistent debug API was added, and no new
release mutation surface was shipped. Temporary Inspector references are to be
released at cleanup/relaunch; reacquisition is required after a new app instance.

Public `exportChannels()` and `getCurrentChannel()` produced an in-memory JSON
fixture with 390 channels, 390 unique channel IDs, and a current-channel ID present
in the export. Serialized fixture SHA-256:
`30ff78cd48795a4fdb95c31e45e0f22ef56258f354c10e61dc2b45095a1f4523`.
Inspector's `copy` command was issued for the private export. Operator-only file
save outside the repository and disk-file verification are pending. No fixture
mutation is authorized to proceed on the strength of an in-memory copy alone;
restore-path execution proof also remains pending. Private export content was
not emitted in chat or repository evidence.

## Restore check, injected fixture, and interrupted terminal test

The saved operator file was verified with valid JSON, 390 unique channels, the
current-channel reference present, and the exact previously recorded SHA-256.
A guarded same-lineup public `replaceAllChannels` round trip, followed by
`flushSaves` and public EPG re-prime, reproduced that checksum/current channel.
One disposable non-current copy was then appended as channel 391 with a generated
nonexistent collection source. Public replacement/flush/re-prime succeeded; total
count became 391 and the current channel was unchanged. Final fixture restoration
has NOT occurred; the verified private backup remains available.

The controller incorrectly instructed number entry 391 as a Guide-only jump.
The operator reported an unavailable-channel tune attempt; they clarified that
number entry normally also moves Guide focus, but did not here because tuning
failed. `NavigationChannelNumberHandler` confirms focus follows only a successful
tune. Treat focus-only number entry in Guide as a separate collaborative UX
decision, now recorded in the existing number-entry backlog item.

The operator also reported unavailable real Guide rows. Inspector confirmed
channels 2, 3, 4, 5, and 6 are unavailable collection-backed rows, none disposable.
Guide is visible, current channel remains 1, playback is unpaused/readyState 4,
and there is no fatal overlay. The disposable row was not reached; its checkpoint
array is empty. The capture interval was stopped. No terminal 0/30/60/180 pass,
targeted retry pass, or recovery pass can be claimed from this attempt.

Pause the physical matrix on this possible defect and preserve the existing
screen/fixture. Do not conflate displayed unavailable state with incorrect
failure handling: source-resolution cause is not established. In particular,
this appeared after injected public lineup replacement/re-prime, which clears
resolution caches; causation versus exposure of an existing source issue is
unresolved. Next bounded diagnosis should examine sanitized resolution outcomes
for these real rows, their current collection references/access, and replacement
invalidation before choosing remediation. No production repair is authorized by
this incident record. P2 remains open; final restore is still required.

## Real-row diagnosis authorized by operator

Fresh public Plex collection listings confirm channels 2–6 retain valid keys and
one exact-name match each in their original library. Source configurations match
the backup. Listed item counts are 181, 127, 127, 96, and 96. Public collection-item
retrieval succeeds for the three distinct sources, returning 181/127/96 items,
all with positive duration. Direct ChannelManager resolution succeeds for
representative channels 2/3/5 with those counts and `fromCache: false`; these
resolution probes can populate caches and apply normal resolved metadata, so they
are not evidence of untouched runtime/cache state afterward.

Original bounded Guide diagnostics show eight immediate-row failures in refresh
2, ordinals 1–8, all at `failureStage: resolution`, elapsed 36–39 ms. The diagnostic
flag `networkStarted` records the runtime attempt, not proof of an actual HTTP
request. Retained Resource Timing includes successful responses for two probed
sources and a status-0 request for another near that refresh, but cannot establish
the thrown exception or its cause. Raw exception details were not retained by
the existing Guide diagnostic schema.

An abort-signal compatibility hypothesis was explicitly rejected: native
`throwIfAborted` exists and collection retrieval with a fresh signal succeeds.

Two bounded diagnostic reproductions followed, with temporary wrappers around
the existing resolution methods that preserved results and rethrew errors:
1. Same active 391-channel fixture replacement, save flush, schedule-cache clear,
   re-prime, and Guide refresh: exact lineup/current-channel round trip and zero
   captured resolution errors.
2. Cold Guide open after the same reset, followed 300 ms later by unavailable
   channel 391 tuning: only 391 throws `ChannelError/CONTENT_UNAVAILABLE`; no
   captured real-row errors. Current channel remains 1.

All temporary resolution overrides were removed, restoring the original prototype
methods. Final DOM checks show real schedules rendered for 2–6 with no loading or
unavailable cells; playback remains unpaused on channel 1. This is diagnostic
recovery after explicit cache refresh, not a manual-OK retry acceptance test and
not evidence that the original failure cause is fixed.

Verdict: the real-row incident is **not reproduced in two bounded runs; original
cause unresolved**. Current collection references and retrieval are healthy;
the missing Kometa-recreated key explanation for the earlier stale fixture does
not explain these verified fresh references. Do not rebuild this fresh lineup or
claim a regression cause based on these results. A future reproduction needs
privacy-safe exception classification at the failing boundary; no production
instrumentation or remediation was added in this session. The 391-channel test
fixture remains active with its verified 390-channel backup recoverable.

## Operator-directed continuation of disposable-row test

The operator later reported channels 5–6 unavailable again, then explicitly
directed the session to leave that incident open and continue the intended
disposable-row functionality checks rather than continue diagnosis of possible
fixture-procedure effects. This changes the QA continuation decision, not the
unresolved incident verdict. The operator tuned 390, moved down to 391, and
reported it focused. Inspector confirms Guide logical focus index 390 (channel
391), current playback channel 390, and one unavailable test cell.

The Inspector preview was toggled off/on again without reloading the TV. A new
stationary 0/30/60/180 observation was started after the operator reached the
row; zero is the observation start, not the original Guide reveal/request time.
DOM activeElement focus is not on the test cell, while the component's logical
focus matches the operator's physical report; record these separately.

Stationary checkpoints completed at elapsed 8 / 30,017 / 60,009 / 180,004 ms.
All four show one unavailable test cell, Guide visible, logical focus index 390,
current playback channel 390, no fatal overlay, and unpaused video. Video time
advanced from 1802.955 to 1982.906 seconds. This supports terminal-state stability
over the observed three minutes; initial loading latency was not measured.
Manual retry and valid-source recovery remain pending.

The operator pressed OK once and reported a fraction-of-a-second possible
Retrying display, followed by unavailable. A DOM MutationObserver captured
unavailable → retrying → unavailable; retrying lasted 133 ms. ResourceObserver
captured one disposable-source collection request (76.1 ms) and zero other
collection requests during the capture window. Guide stayed visible and logical
focus remained index 390; playback channel 390 was unpaused with no fatal overlay.
This is request-level evidence; physical picture/sound confirmation is pending.
Both temporary observers were disconnected after collecting the result.

Valid source restoration used public replacement/save flush/EPG re-prime while
Guide stayed open. The 391-channel export retained identical siblings and current
channel, and the disposable source matched its saved valid source. The operator
authorized browser-driven actions while away. A synthetic DOM Enter keydown/up
then produced unavailable at 3 ms, retrying at 81 ms, and a real schedule at
582 ms. One collection request took 319.4 ms. Guide stayed visible, logical focus
remained index 390, and playback channel 390 was unpaused with no fatal overlay.
This verifies the browser-driven recovery path; it is not a physical remote or
audiovisual confirmation. Recovery observers stopped after five seconds.

## Unattended browser checks and restore boundary

The operator authorized browser-driven checks while away. Four synthetic arrow
keydown/keyup pairs (Up, Up, Down, Down) produced logical indices 388, 386, 388,
and 0 from initial 390. These unexpected jumps are preserved for physical remote
verification; synthetic input equivalence and cause are not established. The
navigation batch ended. Guide remained visible and playback was unpaused on 390.

The authorized fixture cleanup then used the public ChannelManager replacement,
save flush, and EPG re-prime. The baseline had 390 channels, the disposable was
absent, current identity matched, and its export/current checksum exactly matched
the verified backup before relaunch:
`30ff78cd48795a4fdb95c31e45e0f22ef56258f354c10e61dc2b45095a1f4523`.

A CLI app close followed by launch on LGC3 succeeded. After reconnecting Inspector,
a fresh public export/current checksum was:
`3e2e0f37c17cd792bdca33a06fa8cd66cc00f0bad185664db5df665d08b75501`.
Count remained 390 and current channel number was 1. Video was unpaused,
readyState 4, with no fatal overlay; Guide was closed. The differing checksum
means the final exact-restore criterion has NOT passed. No cause is established;
do not infer data loss or dismiss it as expected metadata normalization. Preserve
the current app state and private backup for a separate diagnosis/remediation
decision. No further fixture mutations followed this observation.

This relaunch was for restoration proof, not an instrumented startup-warmup pass.
The two startup scenarios, range/tier metrics, physical audiovisual/PiP checks,
and exact post-relaunch restore proof remain incomplete. P2 stays open. The
private backup remains recoverable and was not removed. No production changes
or release deployment occurred.

## Restore comparison resolved; operator directs QA continuation

The operator accepted the refresh-metadata explanation and directed continuation.
A subsequent read-only comparison confirmed the backup and post-relaunch export
have identical canonical SHA-256 after excluding only channel lastContentRefresh:
`3cbcd6dd9904c3e360b135f814899ded2b67651701e0c3de4c4ad5f7f04f8b02`.
Object keys were sorted recursively; array order and every other field, including
current-channel identity, were retained. Count is 390. Thus the raw checksum
difference does not indicate a changed restored lineup. This is a documented,
operator-accepted refinement of the raw-checksum criterion, not a raw-byte match.
The private backup remains retained. QA continues; P2 is still open.

## Warm opening and browser-driven range samples

After the cold relaunch, an additional measured 10.037 seconds of unpaused video
preceded public openEPG. First sampled viewport at 277.1 ms had 5 loading cells,
0 unavailable and 2 ready. At 1327.1 ms it had 0 loading, 5 unavailable and 3 ready,
unchanged at 5251 ms. Focus index was 0 and playback remained unpaused. The warmed
zero-loading-first-frame target failed. This repeats the already documented
real-row unavailability; the operator previously directed continuing the matrix
without expanding that diagnosis. Timings are sampled bounds, not exact render
transition times, and counts are screen-intersecting program cells, not rows.

Public focusChannel sampling visited 10,100,155,265,340,265,155,100,10. All logical
focus targets matched and playback remained unpaused. Forward healthy ranges
100/155/265 settled by their five-second checkpoints; 340 still had eight loading
cells at 5487.1 ms. Reverse 265 and 100 had no loading at their first samples
(178.5/213.6 ms); reverse 155 had one loading cell at 229.7 ms and settled by
630.1 ms. Range 10 retained unavailable cells. No duplicate-request, concurrency,
physical-input or PiP pass is inferred from these DOM-only samples. An extended
340 revisit follows; it cannot retroactively measure the first visit's cold
settlement. This script traversed away after five seconds, so the initial 340
sample does not establish whether it would have settled within ten seconds.

The extended 340 revisit had eight loading cells at 79.8 and 1109.8 ms, then four
loading/21 ready at 10384.7 ms: the ten-second performance target was missed.
A later read at 75580.2 ms found 39 ready cells, no loading/unavailable, Guide
visible, focus index 339, and unpaused playback. Exact settlement occurred between
those latter two samples; do not report 75.58 seconds as exact load duration.

Retained refresh summaries report backgroundChannelCount 96. Some reverse
refreshes report zero network attempts while one reports five; without complete
per-range correlation, no duplicate-resolution pass is claimed. Retained entries
mix prior/current launch refresh IDs; they do not prove startup ordering or
maximum concurrency. No instrumentation patches or production changes were made.
Immediate-open cold-launch and physical focus/playback/PiP verification are still
pending. Performance misses remain measured follow-ups; P2 correctness closeout
is not yet complete. Current device is settled at Guide focus channel 340.

The operator completed the requested physical navigation check and reported
focus movement with no audio or visual issues, clarifying that navigation does
not change the playing channel without selection. This is physical navigation
and ongoing-playback evidence, not a channel-switch test. Exact one-row movement
each way/return and PiP-specific behavior were not separately confirmed.

## Immediate-open cold-launch failure — preserve for diagnosis

After the operator reported ready, CLI close and launch succeeded. The operator
opened Guide and reported settlement with several real rows showing Unavailable
— OK to retry, describing this as unexpected and a regression in several ways.
No retry, navigation, fixture replacement, or production repair followed.

Launch-filtered diagnostics show refresh 1 starting at about 5717 ms from page
time origin. Its row ordinals 2–4 were invalidated before refresh 2. Refresh 2
recorded eight non-abort failures at the resolution boundary (ordinals 2–9),
45–55 ms each. Its summary reports 8 failures, 15 resolution attempts, 2 visible
ready channels and 5 visible unavailable channels, background count 96. These
attempt counts are not proof of HTTP request counts. No retained warmup event
proves that Guide opened before deferred warmup; do not claim that timing gate.

At 81.86 seconds after page time origin, the screen-intersecting DOM had four
unavailable and four ready program cells, no loading, unpaused video at readyState
4, and no fatal overlay. Row counts and program-cell counts are distinct.

This recurrence happened after restoring the baseline and cold relaunching,
without the disposable channel. It cannot safely be dismissed as only the active
replacement fixture. The preceding invalidations are a diagnostic lead, not a
causal conclusion. Preserve the current Guide, Inspector and private backup.
P2 remains OPEN. Separate diagnosis should identify the actual thrown resolution
error and whether invalidation/cancellation is classified or propagated wrongly,
then adjudicate remediation and rerun affected physical tests. No implementor was
dispatched and no production or release change was made.

## Fresh-onboarding comparison reproduces startup failure

The operator rebuilt through normal onboarding, pressed Done, and confirmed
healthy playback and Guide. No developer replacement/restoration occurred between
that build and the next coordinated cold close/launch. The operator opened Guide
immediately and reported the same unavailable-row problem, identifying it as a
major issue. This rules out developer restoration as a necessary trigger; it does
not establish the exact cause or the introducing commit.

Current-launch diagnostics repeat the sequence: refresh 1 starts at 5715.4 ms;
ordinals 2–4 are invalidated; refresh 2 then records resolution failures for
ordinals 2–9 in 42–59 ms each. Its summary reports 8 failed channels, 15 resolution
attempts, 2 visible ready and 5 visible unavailable channels, background count 96.
At 45989.9 ms the DOM has four unavailable and four ready program cells, no
loading, unpaused readyState-4 video, and no fatal overlay. No retry or navigation
was issued after this observation. Inspector and the device state are preserved.

P2 remains OPEN; stop acceptance closeout and carry this evidence into a separate
diagnosis/remediation decision. The immediate next proof needed is the actual
resolution error behind these rapid failures and its relationship to preceding
invalidation. That relationship is a lead, not a confirmed cause. The delayed
fresh-lineup cold test remains pending. Do not rebuild again to erase this state.
No production changes, implementor dispatch, or release deployment occurred.
