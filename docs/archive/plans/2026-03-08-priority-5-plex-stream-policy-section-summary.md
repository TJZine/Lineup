# Priority 5 Plex Stream Policy Section Summary

## Purpose

This file preserves the durable historical memory from the completed Priority 5 cleanup section without keeping six long step-by-step implementation plans in the tracked repo.

Use this summary when you need:

- the completed shape of the Priority 5 section
- the stable owner split reached by each work unit
- the boundary and preservation contracts that matter for future Plex work
- the main harness lessons that came out of the section

Do not treat this file as an active execution plan.

For reusable planning patterns and anti-patterns derived from this section, use:

- [`docs/agentic/historical-plan-corpus-review.md`](../../agentic/historical-plan-corpus-review.md)
- [`docs/agentic/plan-authoring-standard.md`](../../agentic/plan-authoring-standard.md)

## Section Scope

Priority 5 focused on breaking `PlexStreamResolver` into a pipeline of smaller, testable policy owners without changing playback behavior.

Completed work units:

- `P5-W1` extracted request timeout/fetch mechanics into a focused helper
- `P5-W2` extracted URL building and `X-Plex-*` token/identity attachment into one auditable helper
- `P5-W3` extracted subtitle delivery and burn-in classification policy
- `P5-W4` extracted media selection plus direct-play/HDR/audio compatibility policy owners
- `P5-W5` removed transitional resolver-local wrappers and duplicate branches after the policy seams were proven
- `P5-W6` introduced a typed playback settings boundary and unified effective DTS passthrough gating

## End-State Snapshot

### `P5-W1` Request timeout/fetch helper extraction

- Result:
  - timeout + abort-controller request mechanics moved out of `PlexStreamResolver`
  - the resolver remains the orchestration owner for when those requests are made
- Stable boundaries:
  - low-level fetch/timeout behavior lives in a helper under `src/modules/plex/stream/`
  - request policy and playback decisions stay in resolver/policy owners
- Preservation contracts:
  - preserve timeout values and request options exactly
  - no retries, backoff, or compatibility logic added
- Durable lesson:
  - infrastructure helpers are safe when they remove repeated mechanics without absorbing policy

### `P5-W2` Auditable URL/token helper extraction

- Result:
  - playback URL normalization and `X-Plex-*` query-param attachment moved into one auditable helper
  - direct-play and transcode builders both depend on the same boundary-local helper
- Stable boundaries:
  - auth/query-param logic stays inside Plex-facing stream code
  - callers do not gain shared URL/token responsibilities
- Preservation contracts:
  - preserve token redaction rules
  - preserve precedence and URL-shape behavior
  - keep tokenized playback URLs inside the Plex boundary
- Durable lesson:
  - external-boundary helpers should stay local and auditable instead of being generalized prematurely

### `P5-W3` Subtitle delivery policy extraction

- Result:
  - subtitle delivery classification and burn-in request propagation moved into focused policy helpers
  - `PlexStreamResolver` keeps resolver-path orchestration and error ownership
- Stable boundaries:
  - subtitle delivery policy stays inside the Plex stream module
  - player-side subtitle fetch/render behavior remains outside this section
- Preservation contracts:
  - preserve existing `subtitle.format` / `subtitle.codec` asymmetries exactly
  - preserve `SUBTITLE_STREAM_NOT_FOUND` behavior for missing burn-in streams
- Durable lesson:
  - policy extraction is safe when output-path invariants are preserved exactly, even when the source logic has awkward asymmetries

### `P5-W4` Media selection and playback compatibility extraction

- Result:
  - highest-resolution media selection moved behind `mediaSelectionPolicy`
  - direct-play, audio fallback, HDR, and Dolby Vision compatibility moved behind one compatibility owner
- Stable boundaries:
  - `PlexStreamResolver` remains the orchestration layer that reads settings/debug/environment inputs
  - compatibility helpers do not absorb persistence ownership
- Preservation contracts:
  - preserve direct-play reason strings and DTS/HDR behavior
  - preserve `canDirectPlay(item)` wrapper semantics
  - keep raw storage ownership out of the extracted policy owners
- Durable lesson:
  - compatibility helpers should centralize behavior rules, not storage or settings mechanics

### `P5-W5` Priority 5 cleanup pass

- Result:
  - stale wrapper methods, dead structure, and duplicate resolver-local policy branches were removed after the new owners were already stable
- Stable boundaries:
  - request helper, URL/token helper, subtitle policy, media selection, and compatibility policy remain the long-lived owners
  - `PlexStreamResolver` reads as a composition root for those seams rather than a hotspot full of leftover glue
- Preservation contracts:
  - no behavior changes
  - no new long-lived collaborators introduced during cleanup
- Durable lesson:
  - cleanup passes should delete transitional plumbing only after the extracted owners are already trusted

### `P5-W6` Playback settings boundary and DTS gating unification

- Result:
  - playback knobs used by Plex moved behind `src/modules/settings/PlaybackSettingsStore.ts`
  - `SettingsStore` remains the UI-facing facade but delegates playback-key ownership to the non-UI store
  - one effective DTS passthrough computation now drives both direct-play gating and capability advertisement
- Stable boundaries:
  - cross-module playback settings live in a non-UI settings owner
  - Plex runtime policy consumes typed settings instead of raw storage reads
- Preservation contracts:
  - preserve storage keys and fallback semantics
  - preserve user-setting-as-permission behavior for DTS
  - do not advertise DTS capability when the effective runtime gate is false
- Durable lesson:
  - persistence-boundary cleanup is strongest when one non-UI owner serves all consumers and runtime eligibility is computed once, not duplicated across policy surfaces

## Why The Detailed Plans Were Pruned

The original completed P5 plans were useful during implementation, but they do not need to remain as tracked step-by-step handoff memory now that the section is complete and the reusable signal is preserved in:

- this section summary
- [`docs/agentic/historical-plan-corpus-review.md`](../../agentic/historical-plan-corpus-review.md)
- [`docs/agentic/evals-roadmap.md`](../../agentic/evals-roadmap.md)
- the completed checklist entries in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

The repo keeps the durable lessons and reference points, but drops the long execution directives that are no longer needed for active handoff.

## Harness Ingestion Triage

- status: `absorbed`
- recommended action: `historical-corpus`
- why: The strongest reusable lessons from this section were already absorbed into the historical corpus review, with eval-roadmap expansion handled from that tracked synthesis instead of from the raw section summary itself.
- tracked follow-up: `docs/agentic/historical-plan-corpus-review.md`, `docs/agentic/evals-roadmap.md`
- local-only holding note: `none`
- revisit trigger: `none`

## Future Use

Use this summary as the historical reference surface for:

- checklist completion references for Priority 5
- future Plex-boundary eval prompts and review scenarios
- section-level review of what Priority 5 changed

If a future task needs line-by-line implementation recovery for one of these work units, reconstruct it from git history rather than keeping the full execution plans permanently tracked.
