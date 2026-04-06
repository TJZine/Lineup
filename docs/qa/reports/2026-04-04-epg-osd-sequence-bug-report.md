# EPG / OSD Sequence Bug Report (2026-04-04)

## Scope

- Primary issue: player video shift/flash after sequence-sensitive overlay reopen.
- Secondary issue: visible PiP shrink/jank when opening EPG in classic layout.
- This report reflects landed changes in commits `6d8a75b8` and `e2413139` only.

## Landed Changes

### Phase 1 (owner-seam proof + coverage)

- `PlaybackRuntimeController` now owns an explicit post-program-start overlay-readiness seam:
  - `trackProgramStart()` marks readiness pending
  - first `playing` state clears pending and marks ready timestamp
- `InitializationStartupPolicy` now exports `CLASSIC_EPG_PIP_CLASS` and preserves ownership of classic/overlay PiP class toggling.
- Sequence/contract tests added:
  - `src/core/__tests__/PlaybackRuntimeController.test.ts`
  - `src/core/__tests__/InitializationCoordinator.test.ts`
  - `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`
  - `src/modules/player/__tests__/VideoPlayer.test.ts`

### Phase 2 (classic PiP stabilization)

- `src/styles/video.css` no longer animates real-video geometry for classic PiP.
- `top/left/width/height` are still applied for placement, but no `transition` remains on `#lineup-video-player` in the classic PiP rule.
- OSD and exit-confirm motion were not globally changed.

## Verification Log (Executed)

- `npm test -- --runInBand src/core/__tests__/InitializationCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/core/__tests__/PlaybackRuntimeController.test.ts`
  - Result: PASS
- `npm run verify`
  - Result: FAIL at `verify:docs` only.
  - Cause: doc verifier flags local-run reference in untracked plan surface (`docs/plans/2026-04-04-epg-video-layer-stability-plan.md` -> `docs/runs/...`).

## Current Disposition

- `stale PiP/layout state`: confirmed seam, with ownership and tests now explicit.
- `post-switch runtime instability`: runtime-owner seam added and test-covered, but no phase-3 consumer gate has been enabled in navigation/UI yet.
- Combined status: partial remediation complete; final device behavior still requires manual repro replay.

## Manual Repro Required (Post-Phase-2)

- Sequence A: `channel switch -> auto OSD -> back -> down`
- Sequence B: `back -> exit confirm -> cancel -> down`
- PiP issue: `open EPG while video is playing in classic PiP mode`

Expected manual outcome:

- no visible PiP shrink animation/jank on EPG open
- no post-overlay video shift/black flash in issue-1 sequences

## Notes

- The phase-1 local raw proof artifact remains local-only:
  - `docs/runs/2026-04-04-epg-video-layer-stability/phase-1-proof.md`
- This report intentionally avoids pre-fix assertions that no longer match `src/styles/video.css`.
