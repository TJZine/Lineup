# Browser Use Broad Smoke QA Report (2026-05-14)

## Scope and environment

- One-off manual product smoke test of first-run setup, the EPG/player, top-level
  controls, and Settings.
- Local Vite app at `http://127.0.0.1:5173/`, inspected through Browser Use at the
  target `1920x1080` LG webOS surface.
- The user completed the Plex PIN handoff; profile and server identifiers remain
  redacted.
- Verification mode was manual UX inspection. Automated tests were not part of
  this pass.

## Final verified outcomes

- Plex PIN authentication, server discovery/selection, and Audio Setup rendered
  and completed.
- Channel Setup discovered libraries and built a reduced lineup after advanced
  metadata sources were disabled. The observed result was 87 created and 36
  skipped channels.
- The EPG rendered real guide rows, schedules, artwork, metadata, library filters,
  and current-program details.
- Settings opened through `F3` and exposed all expected categories.
- Follow-up inspection confirmed the earlier blocking Plex tag-payload path had
  become a non-blocking, user-safe skip warning for the sampled studio directory.
- Follow-up inspection also treated the earlier EPG time-header/live-label fixes as
  closed unless a later device or browser pass reproduces them.

## Durable unresolved findings

### EPG focused-cell readability and ticker behavior

- Focused series cells could suppress the episode-tag lane.
- Movie and series titles could truncate too aggressively in constrained cells.
- The focused-title ticker could activate even when the title fit.
- Unfocused episode-title width, live/current labeling, and progress contrast
  remained design follow-ups rather than verified fixes.

Likely owner surface:
`src/modules/ui/epg/view/EPGCellPresentation.ts`,
`src/modules/ui/epg/view/EPGCellRenderer.ts`,
`src/modules/ui/epg/view/EPGVirtualizer.ts`, and EPG cell styles/tests.

Required proof: focused EPG tests plus Browser Use at `1920x1080` with movie and
series rows, verifying fitting titles do not ticker and constrained cells retain
useful episode/time/current information.

### First OSD open after returning from full-screen UI

The user reported that after leaving active playback for Server Select or an
OSD-launched menu, the first OSD reveal could make the video plane drop slightly.
The second reveal did not reproduce it. Player-to-guide and player-to-mini-guide
returns were reported clean.

Likely owner surface:
`NavigationScreenEffectsHandler`, `NavigationKeyModeRouter`, `PlayerOsdOverlay`,
`PlayerOsdCoordinator`, player OSD styles, and video geometry styles.

Required proof: Browser Use with real playback at `1920x1080`, comparing video
geometry before and during the first and second OSD reveals after Server Select and
playback-options/settings returns. This finding was not reverified during the
recorded session and remains deferred.

### Actor/director estimate cardinality

Actor channel estimates could grow unexpectedly despite a minimum-item setting,
apparently when Plex tag counts were missing or count recovery was inconclusive.
The open product decision was whether to fail closed on unknown counts, cap
per-strategy candidates, or improve count recovery.

Likely owner surface:
Channel Setup strategy builders, facet execution/count recovery, and the setup
strategy UI.

Required proof: planning tests for known and unknown actor/director counts, then a
manual estimate/build pass with actors enabled and a minimum of 10 items.

## Historical findings sampled as fixed or superseded

The initial walkthrough also recorded blocking tag-directory parsing, internal
planning language in user-facing errors, Settings/Channel Setup scroll clipping,
EPG time-header/live-label overlap, error-modal contrast, placeholder artwork, and
utility-button active-state ambiguity. Later passes sampled the tag error copy and
EPG header/live-label work as clean. The remaining items were not carried forward
without fresh reproduction.

## Deferred coverage

- No LG webOS device verification was performed.
- Playback success, subtitle/audio switching, HDR/direct-play behavior, app exit,
  background/resume, and long-duration stability were not exhaustively covered.
- Small browser viewports were diagnostic only and are not a target surface.

Git history retains the full exploratory transcript and screenshots/prose that
were removed from this durable report.
