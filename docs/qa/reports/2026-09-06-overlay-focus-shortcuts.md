# Guide, Settings and Now Playing shortcut ownership — 2026-09-06

## Operator evidence

On exact development implementation `7e716692`, the operator reported:

- With Settings open, physical green opened Guide behind the pane; D-pad then
  controlled Guide.
- Now Playing Info could open above an already visible Guide.
- Yellow opened Settings but did not close it; Back did close it.

## Scope and source adjudication

The controller selected a bounded navigation correction. Guide opening is eligible
only on Player or Guide with no modal open. Deferred initialization must not show
or refocus an overlay hidden during navigation away, even if the user returns to
Player before initialization settles. Entering other major screens hides Guide;
Guide key routing and held-repeat work also require an eligible screen. Now Playing
Info opening is blocked while Guide is visible. Yellow closes Settings through
screen Back navigation, with Player as the root fallback; a modal retains control.

Source confirms unconditional Guide shortcut dispatch, visibility-only Guide key
routing, and a Settings-specific hide on screen transition. Now Playing Info checks
Player navigation state but omits Guide overlay visibility. The Settings shortcut
handles opening only. These are UI ownership defects, separate from collection
recovery and schedule performance. No cache, Plex, playback or persistence changes
are included. No new visual design or overlay framework is needed.

## Verification

Implementation is complete in the existing owners. The worker reported 204
focused tests plus 10 deferred-component tests passing, along with typecheck and
exact-file lint. Independent review found one material regression: checking
post-failure visibility suppressed legitimate lazy initialization warnings because
the deferred component rolls visibility back first. The controller accepted the
finding. Failure handling now checks request currentness and navigation eligibility;
successful publication additionally checks visibility. A real deferred loader
failure regression replaces the overlapping mocked test; its 86-test coordinator
suite passed. No other production findings were reported. Full verification and
exact development candidate physical checks are pending. Required physical
batch: yellow open → green remains in Settings → D-pad controls Settings → yellow
close; green open Guide → red leaves Guide unobscured; close Guide → red opens and
closes Now Playing normally. Check Back and playback continuity during the batch.

The first full gate failed one assembly dependency assertion that omitted the new
navigation input. Its exact expectation was updated without weakening assertions;
full verification was restarted. The real deferred-loader test uses a rejecting
function directly, with no type escape or additional test abstraction.

Final `npm run verify` passed: 354 unit suites, 4,748 passed and one skipped;
52 tooling tests passed and one skipped; 94 contract tests passed. Node tooling,
typecheck, architecture/lint, stylelint, coverage thresholds, documentation,
lean bundle verification and development build completed successfully. The final
run did not repeat the initial worker-exit warning. Exact implementation packaging
and physical shortcut QA remain pending.

## Exact development candidate

Implementation `de1ba6007c80bd7070f8d7e368044c8e8841657e` was built after commit
with an empty build-relevant dirty summary. Entry `assets/index-DZ_vy_xG.js`
SHA-256: `1205a80a6fc919ab70ee1318146c668cc68a721dbbae272b4835c72171e4ba46`.
The development IPK SHA-256 is
`bdd04b409034bc775b99d84ede90e8a825cad69a22c20155e7d28eb302f94d77`;
all 70 packaged files matched the archived build byte for byte.

Lineup was closed, the running-app list was empty, installation succeeded, and
a single launch succeeded. Fresh Inspector attached. Its Console paste warning
requires operator input before the runtime manifest check; physical shortcut and
picture/sound confirmation remain pending. No release deployment or push occurred.
