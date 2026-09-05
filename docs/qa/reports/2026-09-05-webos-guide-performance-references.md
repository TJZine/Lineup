# webOS media-app performance references for late-MVP Guide work

Decision: retain current Guide settings. No reviewed source establishes a better
Lineup concurrency, overscan, or cache limit for this TV/server/workload. The
operator deferred further investigation to late MVP. Playback problems and
hardware saturation have not been observed/proven in this session.

This is a short primary-source comparison, not a benchmark or approval to port
another application's architecture. External defaults describe different workloads.

## Moonfin Smart-TV

Moonfin's [v2.6.0 release notes](https://github.com/Moonfin-Client/Smart-TV/releases/tag/2.6.0)
report reducing expensive blur on weaker TVs, avoiding full card-row rebuilds,
virtualizing its Live TV Guide, and improving cancellation. They also report a
15-second request timeout replacing 30 seconds. These are maintainer-reported
changes, not controlled LG C3 benchmark results.

Lineup already has a bounded, recycling `EPGVirtualizer`. The measured slow cases
had milliseconds of schedule generation/publication but seconds of resolution;
there is no evidence here that blur or DOM count explains them. Do not blindly
copy the timeout: Lineup observed a successful resolution taking about 24 seconds.
Per-request versus whole-resolution timing also differs. Shortening a timeout
can produce earlier failure rather than faster successful schedules.

Its [Guide implementation](https://raw.githubusercontent.com/Moonfin-Client/Smart-TV/main/packages/app/src/views/LiveTV/LiveTV.js)
also uses viewport prefetch and bounded channel batches (12 prefetch rows and
50 channels per batch in the inspected source). These support bounded demand,
but their values are workload-specific, not recommended Lineup settings.

## Jellyfin Web / webOS

[Jellyfin's Guide source](https://github.com/jellyfin/jellyfin-web/blob/master/src/components/guide/guide.js)
combines channel IDs in a program request and disables images, user data, and
total-record counts for that request. This suggests checking unnecessary payload
fields when revisiting dense-source latency. It does not prove Lineup currently
requests unnecessary data or that larger batches would help. Jellyfin serves
prepared program data; Lineup's source resolution and schedule construction are
a different workload. No request-shape change is approved by this comparison.

## Breezyfin

The [upstream project README](https://github.com/botagas/Breezyfin) describes
animation-reduction performance modes, adaptive WebP image loading with fallback,
and performance/focus diagnostics. These are useful references for future UI
responsiveness work. They do not establish a fix for Lineup's measured dense-source
resolution waits. No new performance toggle or dependency is proposed now.

## LG and Enact resources

- [LG Developer Workflow](https://webostv.developer.lge.com/develop/getting-started/developer-workflow)
  points to on-device resource monitoring, Inspector, and Beanviser. At the next
  investigation, correlate TV CPU/memory with request timing; do not infer spare
  capacity or saturation from successful playback alone. Verify tool support on
  the actual firmware/CLI version before choosing the capture method.
- [Enact VirtualList documentation](https://enactjs.com/modules/ui/virtuallist/)
  warns that work on every scroll event can degrade performance and recommends
  scroll-start/stop callbacks where appropriate. Apply this as a profiling lead,
  not a reason to delay Lineup's visible-row work or replace its virtualizer.
- [LG Web Engine specification](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)
  describes browser-engine cache lifetime ending with app termination. This is
  distinct from Lineup's application caches and does not explain why the warmup
  entry record was absent before per-channel cache checks.

## Proposed revisit, not current implementation scope

1. Explain skipped hidden-startup warming with a bounded reason diagnostic.
2. Split dense-source resolution into admission/shared wait, HTTP/server time,
   parsing, and schedule generation; correlate with actual visible-cell samples.
3. Only then compare existing normal/aggressive settings or a narrower change,
   keeping exact-commit, cold/warm, and playback results separate.

Current evidence: `2026-09-05-guide-shared-source-device-session.md` and
`docs/qa/evidence/2026-09-05-guide-shared-source-repair/device-session.json`.
