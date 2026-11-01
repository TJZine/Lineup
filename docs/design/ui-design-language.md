# Lineup TV Design Language

> Shared visual contract for the 1920 × 1080 TV canvas. Palette and component
> roles are aligned to LineupDesktop at `54dd4667d0fe8ddfd2c2e3b00abd2385360587ca`.

## Authority and reference limits

This document describes shared visual roles and TV interaction states. Screen CSS
owns surface-specific geometry and exceptions. The CSS custom properties in
[`src/styles/tokens.css`](../../src/styles/tokens.css) and
[`src/styles/themes.css`](../../src/styles/themes.css) are the implementation
contract.

The upstream Flutter goldens and the static onboarding drawings are visual
references. Neither is a capture of this webOS application. CSS token tests do
not establish browser or physical TV rendering, remote-control behavior, or
accessibility acceptance.

## Canvas and typography

Design measurements target a 1920 × 1080 canvas. Use the shared 48px screen
inset and section gap unless the owning surface has an edge-anchored layout.

| Role | Token | Default | Typeface and weight |
|---|---|---:|---|
| Page title | `--type-page-title-*` | 44px | Instrument Sans, 600, width 92%, tracking −1%, line-height 1.08 |
| Section title | `--type-section-title-*` | 24px | Instrument Sans, 600, width 92%, tracking −1%, normal line-height |
| Body and remote control | `--text-body`, `--text-control` | 18px | Inter, 400–500 |
| Action | `--text-action` | 18px | Inter, 600 |
| Supporting label | `--text-xs` | 14px | Inter, 500 |

Page and section titles use the shared `--type-page-title-*` and
`--type-section-title-*` roles, including family, size, weight, width, and
tracking. Page titles use 1.08 line-height; section titles keep normal leading,
matching the upstream title helper's unset height. Inter and Instrument Sans are
bundled locally under the SIL Open Font License. Time and numeric readouts use
`--font-family-mono` with tabular numerals where stable digit widths matter.
Avoid platform-dependent remote font loading.

## Theme palettes

Settings offers four palettes. Theme classes define the same semantic roles so
shared controls can inherit a complete palette.

| Theme | Deep background | Primary accent | Focus fill | Focus text | Panel radius |
|---|---|---|---|---|---:|
| Ember & Steel (`ember-steel`) | `#090806` | `#CC9F5B` | `#E9DCC3` | `#090806` | 8px |
| Slate & Pine (`slate-pine`) | `#161917` | `#809A79` | `#D3DECF` | `#090806` | 8px |
| Mint Noir (`swiss`) | `#020202` | `#34D399` | `#C6EEDB` | `#090806` | 0 |
| Satellite Blue (`directv`) | `#001020` | `#00A6D6` | `#FFCC00` | `#090806` | 2px |

Ember & Steel is the default and the synchronous fallback before saved theme
restoration. Use `--color-primary` for accents and progress. Use text, surface,
error, and focus roles instead of hard-coded palette colors.

## Focus, selection, and tuning

Remote focus and persistent selection are separate states:

- `--focus-color` is the palette focus accent and `--focus-border-color` is the
  focus outline or border color.
- `--focus-surface` and `--focus-text-primary` describe a focused control's
  filled surface and readable text. `--focus-inset-surface` is the interior
  surface used by focused compound controls.
- `--selection-surface` and `--selection-border` show a selected value after
  focus moves elsewhere. Selection must not be presented as current focus.
- `--tuned-surface` identifies the active channel or item independently of
  remote focus.
- `--color-text-disabled` and `--color-error` / `--color-error-text` express
  disabled and validation states. Disabled controls remain visibly disabled;
  errors retain readable text and a distinct error color.

The default focus ring is 3px with a 2px offset. The shared CSS foundation
provides `data-large-focus="true"` on the application root for the 5px
large-focus ring; production preference wiring is pending U2/U4/V3. Screen-level
focus treatments may use a filled control, an outline, or both when that
surface's existing contract requires it. Preserve visible focus for D-pad
navigation.

## Panels and over-video surfaces

Opaque panels and over-video scrims have different roles. Use `--panel-surface`,
`--panel-surface-2`, `--panel-border`, and `--panel-radius` for panel chrome.
`--overlay-surface-rgb` and `--overlay-surface-alpha` describe the general
overlay surface. Player overlays use `--player-overlay-surface`; the shared CSS
foundation maps its alpha to 0.62 for More transparent, 0.78 for Standard, and
0.94 for Reduce transparency.

`data-player-overlay-transparency="more-transparent|standard|reduced"` is a
foundation API on the application root. Production preference wiring is
pending U2/U4/V3; these selectors do not mean that the running application
already produces the attribute. Runtime overlay gradients use the centralized
`--runtime-overlay-*` tint and alpha roles in `themes.css`; UI package CSS must
not copy those global declarations. Keep screen-specific gradient stops local
to the owning component when they express a distinct layout treatment. The
runtime gradient More/Reduced stops scale the existing theme-specific Standard
pair by the corresponding source alpha ratio; this scaling is an adaptation of
the existing CSS gradients, not a per-theme value from Flutter.

## Runtime overlay ownership

During startup restore, Splash shows the branded heading and the current
restore phase, including the available channel count. Back cancels the active
restore pass and opens recovery actions. Switch server opens the existing server
selection route. Progress text follows the restore projection; it does not
present a percentage when the runtime has no measured percentage.

Channel Directory is reachable from the Guide's Lineup menu and Settings' Guide
category. Directory opens Studio with an explicit create or edit request, and
Studio returns to Directory with the saved channel selected when available.
The completed setup screen offers Add custom alongside Open Guide only after
its channel save succeeds.

- Guide opens only from Player or the Guide navigation screen, with no modal
  open. It must not open or regain focus behind Settings, including when
  deferred Guide initialization finishes after navigation away.
- Player details open from Info or Red only while Player owns input. Guide
  browsing and protected dialogs retain their own focus.
- The Yellow key (`YellowBack`) toggles Settings. From Settings it follows
  screen Back navigation, with Player as the root fallback.
- An open Settings modal retains control; `YellowBack` does not dismiss its
  parent.

The shared `--z-*` tokens define base content, dropdowns, modals, shell overlays,
toasts, and the exceptional maximum layer. Component owners remain responsible
for using the correct layer and for scoping forced-colors rules to the controls
they affect.

| Layer | Token | Value | Use |
|---|---|---:|---|
| Base content | `--z-base` | 1 | Normal flow and local layering |
| Dropdown/popover | `--z-dropdown` | 100 | Bounded menus and popovers |
| Modal | `--z-modal` | 1000 | Panels above runtime content |
| Shell overlay | `--z-overlay` | 5000 | Shared app-level chrome |
| Toast | `--z-toast` | 9000 | Transient status above overlays |
| Exceptional maximum | `--z-max` | 10000 | Boundary token for rare cases |

## Geometry and edge integration

Surfaces may be edge-anchored or bounded according to their screen role. Avoid
adding floating-card borders, blur, or shadow where the owning surface uses a
flush scrim. Keep rounded corners only on edges that do not meet the screen;
use `--radius-xl` for large free corners and `--radius-compact` for compact
surface geometry when the component contract calls for them. Interactive focus
may use an outline or restrained glow; panel chrome should not borrow that
effect.

## Motion and platform accessibility

Use `--motion-duration-*` and `--motion-distance-scale` for token-driven
transitions. `data-motion="reduced"` on the application root reduces both token
motion and feature-local fixed animation/transition durations. The operating
system's `prefers-reduced-motion: reduce` setting applies the same shared
reduction even when the app setting is off. `data-large-focus="true"` expands
focusable-control outlines through the shared role. Check feature surfaces for
contrast, clipping and focus restoration in the target TV runtime.

The shared tokens include a `forced-colors` mapping for focus and selected
surfaces. Screen styles must preserve readable labels, selected values, and
visible focus under forced colors; the shared mapping does not replace focused
component fallbacks.
The CSS mapping applies only on engines that expose the `forced-colors` media
signal. The webOS 6 Chromium 79 floor has no such signal, so the application
does not claim OS forced-color detection there; theme contrast, app Large Focus,
and OS/app Reduce Motion remain separate accessibility obligations.

## Surface decisions

- **Player OSD:** bottom-anchored compact controls reveal on one OK or Down
  press and hide after the configured compact timeout. Info or Red opens the
  untimed expanded details; Audio and Subtitles open as child drawers. Back
  returns from a child to its parent, hides expanded or compact Player, then
  goes to Guide on a later press. The expanded Close action returns to compact
  controls. The panel scrim stays legible over video and respects overlay transparency. Preserve
  artwork aspect ratio and use a readable text title when clear-logo artwork
  is absent, stale, or too small to read.
  Native paused and seeking state updates refresh an already visible panel but
  do not reveal one behind another foreground surface. Explicit Player remote
  transport can reveal controls only in the active Player context; track drawers,
  reader, Sleep, Mini Guide, dialogs, and other screens retain their own input.
  A delayed Play completion reveals controls only while its command remains the
  latest transport request and Player still owns input.
- **Guide:** prioritize channel and program identity. Focused cells and channel
  rows must retain the existing information hierarchy and prevent title, time,
  and progress content from obscuring one another.
- **Mini Guide:** top-anchored, untimed five-row schedule context. The Watching
  marker follows the accepted native playback identity, while focus follows
  remote browsing. Keep the two states distinct. Include elapsed and remaining
  program time in the existing Now time line, Full Guide, and Close actions. The visible clock tick also
  refreshes program progress and Now/Next rollover from the scheduler projection.
- **Lineup menu:** Blue opens the visible Guide menu from Player or Guide;
  Switch server follows the explicit server selection route.
- **Settings and onboarding:** use opaque panel roles for reading and focused
  controls. Keep errors, disabled options, and loading feedback visible and
  distinct from normal selection.

### Clear-logo legibility

- Keep the text title visible until clear-logo artwork has loaded and passed the
  usability check.
- Preserve the artwork aspect ratio and cap its width at 520px; never stretch it
  or impose a minimum width.
- At the 1920 × 1080 design resolution, target 60px high in the compact Player
  OSD, 72px in the Guide information panel, and 84px in expanded Player
  details.
- Estimate contained artwork height from its natural aspect ratio, target
  height, and width cap. Fall back to the text title when the result would be
  below 44px.
- Broken, missing, stale, or unusably wide artwork must leave the text title
  intact.
- Do not add pixel-alpha or canvas analysis without evidence from real
  transparent-padded assets.

## Accessibility invariants

- Keep every interactive control reachable by D-pad and show a visible focus
  treatment that stays distinct from selection.
- Expose asynchronous and validation status through the owning screen's
  accessible status text; color alone does not convey a failure or loading
  state.
- Apply `data-motion="reduced"` for the app preference and preserve the
  operating system's `prefers-reduced-motion` request. Surface-specific
  keyframes still need their own reduced-motion rule.
- Keep focused labels, selected values, disabled reasons, and important
  boundaries readable under forced colors.
- Check contrast and focus over both bright and dark video before claiming
  target-runtime acceptance.

Any change to a shared visual role belongs here; a surface-specific exception
belongs with its owning component. Verify visual contrast, focus visibility,
reduced motion, and forced colors on the relevant target runtime before claiming
acceptance.
