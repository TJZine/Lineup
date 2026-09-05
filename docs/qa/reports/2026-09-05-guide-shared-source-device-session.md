# Guide repair candidate: LG C3 evidence and deferred performance work

## Current disposition

Further performance work is deferred by the operator to late MVP. P2 is not
fully closed; preserve the provisional retry acceptance and unexercised hidden
startup resource proof. Physical focus and playback/PiP are confirmed good.
No playback contention or hardware saturation has been demonstrated.

All TV results below concern implementation
`bd6368432598e89e86e44c0360eb6b9c31e40338`. UI-only commit `929e0667` aligns
the channel badge and tuning overlay but was not installed or physically tested;
the operator explicitly waived its automated/physical UI verification. The
Guide candidate had previously passed the full automated gate and independent
review. Documentation checks were run for these evidence updates.

Temporary EPG debug is restored to absent; passive observation timers stopped.
No fixture was created, no lineup was replaced, and no release or push occurred.
The sections below retain chronological observations and corrections; earlier
mentions of pending checks or temporary flags are superseded by this disposition
and the later recorded results. Sources and follow-up recommendations are
recorded separately in `2026-09-05-webos-guide-performance-references.md`.

## Identity and physical baseline

The exact `bd6368432598e89e86e44c0360eb6b9c31e40338` candidate package was
installed successfully with `ares-install` and launched with `ares-launch`.
Inspector fetched its artifact manifest and hashed the running entry. The
implementation identity and SHA-256 matched the [candidate](2026-09-05-guide-shared-source-repair-candidate.md).
The operator confirmed normal moving picture and sound after launch.
Debug logging is `1`; subtitle debug logging is unset (disabled by default).

The operator subsequently authorized Inspector-driven inputs. Paired synthetic
`keydown`/`keyup` events go through the app's existing document input handler.
These are device runtime checks, not physical remote input proof. No lineup,
source, schedule-cache clearing, or fixture mutation was performed. Temporary
debug-setting changes are recorded below.

## Warm opening

Physical Guide opening on the existing lineup, long after startup, initially
showed five loading cells and two ready cells. All visible cells were ready
1,196.6 ms after the first visible DOM sample. The operator perceived loading
for less than one second followed by populated rows. These observations use
different clocks and are retained separately. No unavailable cell was sampled.
The 500-sample cap retained approximately 10.56 seconds, not the full requested
20 seconds. This is not the controlled ten-second cold-start case.

Correctness for this viewport: populated. Warm performance: zero-loading and
1,000 ms all-visible settlement targets missed in this baseline.

## Forward navigation and stop

Bounded batches contained at most eight inputs. Each input was followed by a
nominal 100 ms sample, then 100 ms polling while loading, with a ten-second
stop condition. Timers were sometimes delayed; elapsed values are observed
upper bounds to a sampled state, not precise render or physical input latency.
Inspector screencast was enabled during these batches.

The traversed viewports covered rows 32 through 337, including 90–110, 140–170,
and 250–280. Each of those three requested ranges populated without retry.
Some later viewports loaded for several seconds; one sampled settlement was
6,791.2 ms before the final slow range. Sampled video state consistently showed
unpaused, readyState 4, and no media error, which does not establish physical
picture/sound continuity.

At rows 332–337, focus 336, the guard stopped the batch with five loading cells
after 10,123.3 ms. No recovery input followed. At monotonic 945,912 ms one cell
was still loading. At 986,699 ms all 26 visible cells were ready. Diagnostics
for zero-based rowOrdinal 332 (one-based row 333) recorded a successful final
attempt with resolution 30,757.6 ms, generation 12.3 ms, publication 1.9 ms,
and 2,070 resolved items. Its completion was at monotonic 952,351.6 ms.
All timestamps share timeOrigin 1788628019926.8.

The range settlement target failed. Eventual recovery without retry does not
turn that into a pass. Resolution dominated this attempt, but the source event
arrays were empty; the cause cannot yet be assigned to HTTP, shared-request
waiting, or another resolution subphase. The controller requested a bounded
read-only source trace of that missing diagnostic seam.

## Evidence limits and remaining work

Inspector's screencast image appeared stale on rows around 33–37 while the live
DOM and diagnostics advanced to 332–337. Toggling screencast did not refresh the
observed image. An operator visual/picture/sound confirmation was requested;
no screenshot is being claimed as current-view proof.

Reverse cached traversal, rows 1–20, the remaining 340–350 range, controlled cold
opening, hidden-startup resource bounds, deterministic unavailable/retry/source
restoration, and any required fixture backup/restore remain pending. No
correctness closure is supported yet. Performance has a reproduced miss.

[Sanitized session evidence](../evidence/2026-09-05-guide-shared-source-repair/device-session.json)
contains the observed identity and checkpoints.

## Continued device proof

The operator confirmed the settled 332–337 viewport and normal physical picture
and sound. Source tracing found separate general and EPG debug gates. The device
EPG flag was absent. Enabling it through `DebugOverridesStore.writeEpgDebugEnabled`
restored source events; no production edit was needed. Restoration of this
temporary setting is tracked in the session evidence.

The remaining forward pages reached focus 351; the final sampled settlement was
10,324 ms with no remaining loading/unavailable cell. This is another measured
limit miss. Reverse traversal to focus 151 had no sampled loading. Below that,
the earlier forward schedules were older than the ten-minute stale retention,
and reloads are not classified as valid-cache regressions. A short immediate
loop at focus targets 116, 121, 126, 121, 116, 111 showed no loading/unavailable
cells at its first samples; observed waits ranged from 451 to 997 ms.

Inspector bound-argument inspection of the existing `__LINEUP__.openEPG`
function located the existing app instance, stored as temporary `temp1`.
No additional app instance or shipped debug mutation bridge was created.
Through the existing ChannelManager public resolver, two `revalidate` callers
resolved channel 333. A created producer 261; B joined that producer with two
waiters observed. B's join triggered cancellation of A. A rejected with its own
`caller-abort` reason while producer/common-scope aborted flags stayed false.
B remained un-aborted and completed with 2,070 items after approximately 11.01
seconds overall. The bounded test did not time out. Its source-wait observation
was 10,782.6 ms. The visible Guide remained populated and video state healthy.

This passes the on-device shared-request cancellation ownership experiment.
It does not substitute for a physical Guide retry after external restoration,
and the different times in two non-controlled runs do not prove that request
concurrency caused the earlier thirty-second delay.

Guide close/reopen through the existing debug API hid the Guide and reopened at
the current channel, focus 36. No loading was present at the first sample, but
that sample arrived 1,321.2 ms after the call; exact initial paint is not measured.

The initial 1–6 viewport settled in 1,875.6 ms. A subsequent eight-input
forward/reverse loop through focus 6, 11, 16, 21, 16, 11, 6, 1 had no sampled
loading or unavailable cells; sample waits ranged from 297 to 980 ms.

A development-app close and cold launch both succeeded. The new Inspector
connection reports startup success on the same entry. Its new origin shows the
paste safety prompt again, so the deferred-opening capture awaits the operator
handling that prompt. This attachment delay cannot count as immediate cold
opening proof. EPG debug remains temporarily enabled and must be restored to
its original absent state after the diagnostic session. No fixture has changed.

## Operator correction: cold-launch attempt invalid

The operator reported that Lineup did not visibly open after the CLI close/launch;
YouTube TV was foreground. The controller had inferred physical launch from CLI
success and an Inspector runtime. That inference was wrong. **All cold/deferred
physical-QA conclusions from the new timeOrigin 1788630257506.8 are invalid.**
Its 1,597.5 ms sampled ready time and zero pre-open request completions are retained
only as runtime diagnostics. They do not prove foreground startup behavior,
physical playback competition, or a hidden-warmup defect. The conditional startup
warmup gates are compatible with the corrected state; no new bug is adjudicated
from those measurements.

Earlier operator-confirmed viewport and picture/sound observations belong to the
previous runtime and remain separate. Synthetic resolver checks are still labeled
as runtime experiments, not continuous foreground or physical-remote proof.
Testing stopped on the correction. A valid repeat must start with explicit
physical confirmation that Lineup is foreground on the LG C3 before capture.

Temporary EPG debug flag restoration was verified: the original key is absent.
The disconnected physical state still reported DOM visibility `visible`; that
signal is also insufficient to establish TV foreground.

## Launch blocker investigation

The operator reports this launch failure is new and also occurs from the TV Home
screen. The installed manifest uses `handlesRelaunch: true`; the runtime receives
relaunch events and reports ready modules with no fatal overlay. A direct
`webOSSystem.activate()` call executed but did not make Lineup visible according
to the operator. Therefore the missing source activation call is not established
as the cause, and no manifest or lifecycle fix has been selected.

A subsequent controlled restart verified an empty running-app listing after
close and an Inspector `target_closed` disconnect before issuing launch. Launch
succeeded and Lineup reappeared in the running-app listing. The operator confirmed Lineup is now visible on the TV. This establishes
recovery on the same installed build, but not the precise failure cause or a
launch fix. No reinstall, app-data clearing, or production edit
was performed during this investigation.

The operator subsequently confirmed moving picture and sound are both normal
after the verified restart. A new Inspector connection was opened for this
recovered runtime; no further cold-start measurements have been claimed.

## Approved follow-up: channel-change indicator placement

The operator requested moving the channel name and number shown on channel
changes from the top right to the top left because LG HDR and similar system
popups overlap the current indicator. This UI direction is approved. Record as
a separate follow-up in `src/modules/ui/channel-badge/styles.css`, with its
corresponding design-language documentation updated and physical overlap
checked. It is not implemented in the Guide candidate under test; preserving
that exact build takes precedence during this performance capture.

## Recovered-runtime delayed first opening

On the same implementation `bd6368432598e89e86e44c0360eb6b9c31e40338`, after
operator-confirmed foreground playback recovery, runtime timeOrigin was
1788631256185. The baseline at 235,007.2 ms had Guide hidden, modules ready,
and an unpaused video with readyState 4 and no media error. Guide was opened
through the existing debug API at 252,995.5 ms after timeOrigin: approximately
4 minutes 13 seconds after launch. This is delayed first opening, not immediate
cold-start opening.

The first sample at 283.1 ms contained 13 visible populated cells and no loading
or unavailable cells. Across 193 samples through 20,008.7 ms, none showed
loading, unavailable cells, or unhealthy sampled video state. Sampling was
nominally 100 ms; this does not exclude a transient before the first sample.
Inspector was attached with screencast disabled.

A bounded six-input page-down/page-up loop reached one-based focus rows
39, 44, 49, 44, 39, and 34. Every first sample was populated, with waits of
250.8, 195.3, 377.3, 205.8, 214.1, and 253.1 ms respectively. No sampled loading,
unavailable cells, or video problems occurred. Physical confirmation of this
batch is pending. No cache clearing, retry, or fixture mutation was used.

Performance verdict for this limited delayed-opening/local-navigation batch:
meets the 1,000 ms all-visible-settled target. The first ready sample at
283.1 ms does not establish the stricter 250 ms first-visible-ready target;
actual readiness could have preceded sampling. It does not supersede the
earlier slow distant viewports, prove whole-lineup performance, or establish
startup warmup causality. Correctness remains separate: no failure appeared
in this batch, but external-restoration/manual-retry proof remains outstanding.
P2 remains open.

## Operator disposition of remaining closure gates

The operator accepts prior unavailable-channel OK retry/recovery observations as
tested for now and does not require recreating an unavailable source in this
session. Retain the original observations, multiple-attempt caveat, and absent
controlled-fixture checkpoints for future recurrence. This is provisional
acceptance, not newly observed exact-candidate fixture proof. No fixture was
created, so there is no fixture mutation to restore. P2 remains open for the
remaining device checks.

The operator directs treating the recovered launch failure as provisionally
transient unless it recurs with a future install. Keep its evidence and unknown
cause; it is no longer a separate mandatory investigation gate. Remaining work
is immediate cold opening, resource/priority bounds, focus, and playback/PiP.

## Immediate cold-opening batch in progress

The same installed candidate was closed; both an empty running-app listing and
Inspector `target_closed` verified exit before launch. The operator was instructed
to open Guide as soon as Lineup appeared and reported: "yes and loaded very fast
after opening". This supports physical launch and immediate-opening usability,
not an exact timing or explicit playback/PiP result. The launch failure did not
recur in this batch.

EPG debug was temporarily enabled through DebugOverridesStore before restart
(original key absent; general debug enabled; subtitle debug key absent). Its
restoration is pending diagnostic collection. The new Inspector Console requires
the operator to handle its paste warning. Resource/priority, focus, and explicit
picture/sound/PiP checks remain in progress.

## Planned heavier cold-opening case

The operator reports TV-show pages are denser and often slower than movie-channel
pages. Add a separate cold-opening case after tuning to an operator-selected
TV-show channel. Verify full app stop before relaunch, then open Guide immediately.
Treat this as a heavier-workload hypothesis, not a proven worst-case workload.
Keep results separate from the prior opening. Target channel is pending.

## Pre-dense-case diagnostic capture

Runtime 1788632319087.1 retained 149 request completions in a 250-entry full
ring. First refresh started approximately 9,438 ms after launch; replacement
refresh 2 settled at 10,646 ms, reporting 865 ms refresh elapsed and 241 ms
all-visible settlement, nine ready rows, zero unavailable, and program focus.
These are per-refresh diagnostics, not exact opening or paint latency. The
maximum reported background selection was 96 and observed active source
producers five. No warmup events were retained; hidden concurrency remains
unproven. The initial diagnostic query used an incorrect producer-count field
and its zero result was discarded; the verified field is `activeProducers`.

The operator tuned to channel 115 for the denser TV-show case. Full stop was
verified by empty running list and Inspector disconnect before successful CLI
launch. Physical opening report and fresh diagnostic capture are pending.
EPG debug remains temporarily enabled for this batch and must be restored.

## Dense-case operator result and remaining resource evidence

Channel-115 cold opening took approximately three seconds per operator, who
considers that acceptable for the heavier case. Playback/PiP and focus are
explicitly confirmed good. The operator additionally observed approximately
five seconds of loading while paging past channel 350 on TV-show channels.
Neither late prefetch admission nor slow sources is established as its cause.
Keep this as a separate performance observation.

The reconnected Inspector console showed a scheduler warning of 3,361 ms timer
drift with hard resync. It is not correlated with the reported loading interval
and does not establish causation. Detailed resource/timing reads are blocked
until the operator handles this Inspector origin's paste warning. EPG debug
is still temporarily enabled and restoration remains pending.

## Dense-run retained resource results

Runtime 1788632522280.7 retained 238 current-run EPG events in the full
250-entry ring. Background selection remained at or below 96. Recent refreshes
77 and 78 reported nine ready rows, zero unavailable rows, and program focus;
visible settlement was 123 and 706 ms respectively. Refresh 78 overall took
5,696 ms with 28 stale-cache hits, so overall refresh duration must not be
confused with visible loading duration.

Zero-based row 363 had a 5,484.3 ms aborted resolution followed by a successful
294.5 ms resolution and 8.4 ms generation. This is not correlated sufficiently
with the operator's five-second delay to identify its cause. No hidden-warmup
events remain; startup resource proof is still limited. Temporary EPG debug
was restored through the storage helper and verified absent.

## Hidden-startup resource batch result

Runtime 1788633442567.9 had normal physical playback and Guide closed per
operator. At 111,321.2 ms, the hidden DOM and healthy video were corroborated;
there were zero current-run EPG entries, although both general and EPG debug
were enabled. Opening Guide then produced 129 EPG entries, validating logging.
No warmup events appeared. This run did not exercise hidden warming; it is not
a physical pass of the one-request limit. Source explicitly configures hidden
concurrency one and existing automated coverage addresses that contract. The
one-time playback gate can skip warming, but the precise skip reason on this
run is not proven.

Foreground requests first addressed zero-based visible rows 195–198. The
replacement refresh settled nine visible rows, zero unavailable, with program
focus, 96 background channels, and 7,428 ms visible settlement (7,442 ms overall).
This diagnostic settlement result misses the 1,000 ms warm target. It is not
a measured 7.4-second blank-screen wait: the operator reported immediately
visible items looked good, and the metric includes the replacement refresh. Preserve it as a
specific startup-warmup performance follow-up, separate from correctness and
from the accepted approximately three-second channel-115 cold opening.

Temporary EPG debug was restored and verified absent. P2 remains open; do not
convert the unexercised physical hidden-resource check into a passed result.

## Operator-paced forward pass: observed channel 255 through 390

Passive capture joined after paging had begun. It retained 475 geometry-filtered
visible-cell samples across approximately 127 seconds and 255 issue events in
a bounded in-memory collector, without injecting navigation. The operator
reported the first several-second wait around channels 333–335 and continued
after they loaded. At focus 335, four loading cells appeared in the first sample;
the first all-ready sample arrived 20,759 ms later. At focus 370, the operator
left while three cells were still loading; the subsequent focus 375 viewport
settled 5,262 ms after its first sampled appearance. Other observed focus targets
were ready at first sample. No unavailable or unhealthy-video samples occurred;
channel 390 ended with 39 visible cells and no loading. Timers were stopped.

Channel 333 (zero-based ordinal332) was already resolving in background refresh 26
and was adopted by visible refresh 29. Resolution took 23,902.5 ms, generation
23.9 ms, publication 0.7 ms; it succeeded with 2,070 items. Channels 334 and 335
resolved in 13,947.4 and 9,821.2 ms respectively, with generation/publication each
under 20 ms. Earlier immediate consumers were aborted during viewport
supersession. These records prove preloading occurred for channel 333 and locate
the large measured duration in resolution rather than schedule generation.
They do not isolate HTTP, shared waiting, parsing, or server behavior.

Performance remains open. Durations start at sampled focus transitions, not
remote-key timestamps. Channels 1–254 were not observed in this pass, and
Inspector/sampling overhead is not controlled. Source-level diagnostic tracing
was disabled; no persistent settings changed during this pass.

## Operator-directed late-MVP deferral

Further Guide performance investigation and tuning are deferred until near the
end of MVP development. The operator reports playback health has never been
an issue; contention and hardware saturation are not measured findings. The
active plan now retains a late-MVP TODO for skipped startup warming, dense-source
latency, resource profiling, and bounded settings comparisons. A brief review of
LG official documentation provided profiling guidance but no numeric setting
recommendation sufficient to justify immediate changes. Current settings remain
unchanged. Preserve all evidence and missing-proof qualifications; no full P2
closure is claimed by this deferral.
