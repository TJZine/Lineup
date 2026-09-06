# Lineup UI Design Language

> Established 2026-02-27. Governs all TV overlay and panel surfaces.

## Authority Boundary

This doc owns the target visual outcomes for TV overlay and panel surfaces. Record visual pattern changes here.

[`css-governance.md`](./css-governance.md) owns the CSS decision process, reuse and exception policy, and documentation routing for repo-wide CSS decisions.

Surface-local exceptions belong with the owning surface doc or in local comments when that is the clearest place to preserve intent.

## Core Principle: Edge Integration

UI elements feel like they **emerge from the screen edges**, not float on top. Every surface should feel architectural — part of the display itself — rather than a card dropped onto video content.

### The Old Pattern (being replaced)

```text
- Floating card with margins on all sides
- border-radius on all corners
- box-shadow for depth
- panel-surface + panel-border tokens
- Hard 1px solid dividers between sections
- Opaque glass panel backgrounds
```

### The New Pattern

```text
- Edge-anchored: at least one edge flush to the screen
- Rounded corners ONLY on edges that don't touch the screen
- No box-shadow on surface panels/cards (focus glow on interactive elements is allowed)
- Gradient scrim backgrounds (transparent → semi-opaque)
- No hard dividers — depth via spacing, opacity, and gradients
- Minimal borders: only on non-screen-touching edges, at ≤8% white opacity
```

---

## Design Tokens

### Gradient Scrims

Used instead of solid/glass panel backgrounds. Each surface has its own gradient tuned to its visual weight.

| Surface | Gradient | Max Opacity |
|---------|----------|-------------|
| OSD (bottom) | `transparent → rgba(0,0,0,0.45)` vertical | 45% |
| NowPlayingInfo (left+bottom) | `rgba(0,0,0,0.30) → rgba(0,0,0,0.50)` 135deg | 50% |
| Channel Badge (top-left) | `rgba(0,0,0,0.30) → rgba(0,0,0,0.40)` 135deg | 40% |
| Mini Guide (top) | `rgba(0,0,0,0.50) → transparent` vertical | 50% |

Glass theme variants use slightly higher opacity (darker) scrims than base surfaces.

### Borders

- **Screen-touching edges**: no border ever.
- **Free edges**: `1px solid rgba(255, 255, 255, 0.08)` maximum.
- **Inter-element dividers**: none. Use spacing and opacity contrast instead.
- **Poster-to-content**: CSS `mask-image` gradient vignette instead of border.

### Border Radius

- **Screen-touching corners**: `0`.
- **Free corners**: `16px` for large panels, `10px` for compact badges and hints.
- Shared contract: `--radius-xl` is the default large free-corner radius and `--radius-compact` is the intentional compact `10px` radius for smaller overlay surfaces.
- Example: NowPlayingInfo → `border-radius: 0 16px 0 0` (only top-right is free).

### Overlay Stack

Overlay ordering is a shared contract, not a per-surface guess. The shared overlay stack is:

| Layer | Token | Use |
|------|-------|-----|
| Base content | `--z-base` | normal document flow and local layering |
| Dropdown / popover | `--z-dropdown` | local menus and bounded popovers |
| Modal overlay | `--z-modal` | overlay panels that must sit above runtime content |
| Shared shell overlay | `--z-overlay` | app-level chrome or shell surfaces that sit above modal panels |
| Toast / last-mile status | `--z-toast` | transient notices that must clear the rest of the overlay family |

`--z-max` remains a boundary token for exceptional cases only. This contract locks relative ordering for later cleanup packages; it does not imply every runtime callsite has already migrated.

### Runtime Overlay Focus

Guide opens only from Player or the Guide navigation screen, with no modal open.
It must not open or regain focus behind Settings, including when deferred Guide
initialization finishes after navigation away. Now Playing Info does not open
while Guide is visible. The yellow Settings shortcut toggles Settings: from
Settings it follows screen Back navigation, with Player as the root fallback.
An open Settings modal retains control; yellow does not dismiss its parent.

### Animations

| Surface | Show | Hide | Duration |
|---------|------|------|----------|
| OSD | `translateY(100%) → 0` + fade | reverse | 350ms ease-out |
| NowPlayingInfo | `translate3d(-100%, 0, 0) → 0` | reverse | 200ms ease |
| Channel Badge | `translateY(-6px) → 0` + fade | immediate | 200ms show |
| Channel Transition | `translateY(-8px) → 0` + fade | — | 150ms ease-out |
| Mini Guide | `translateY(-100%) → 0` + fade | reverse | 300ms ease-out |

**Rule:** The animation direction matches where the element is anchored. Bottom-anchored → slides up. Left-anchored → slides from left. Top-left → drops in from above.

### Interactive Elements (Buttons/Actions)

Focus styles are an explicit exception to the "no surface box-shadow" rule: interactive controls may use a soft glow
to ensure D-pad focus remains unmistakable on TV.

```css
/* Default state */
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 999px;

/* Focused (D-pad) */
background: rgba(255, 255, 255, 0.92);
color: var(--color-text-on-focus);
box-shadow: 0 0 16px rgba(255, 255, 255, 0.3);
```

`--color-text-on-focus` is the shared default focus-text token. Theme-specific tokens such as `--directv-focus-text` remain valid only as overrides or aliases under that shared contract, not as a parallel contract.

### Info Pills / Badges

```css
background: rgba(255, 255, 255, 0.06);
border: 1px solid rgba(255, 255, 255, 0.10);
border-radius: 999px;
font-weight: 700;
```

---

## Content Hierarchy Model

Every info-dense surface uses a **three-tier hierarchy** separated by spacing (not dividers):

| Tier | Purpose | Visual Weight |
|------|---------|---------------|
| **Primary** | Identity — title, logo, status | Largest text, full white, `--text-xl`+ |
| **Secondary** | Context — badges, description, crew, cast | Medium text, slightly muted |
| **Tertiary** | Utilitarian — playback info, progress, timecodes | Small text, `color-text-muted`, `margin-top: auto` |

The tertiary tier uses `margin-top: auto` to push it to the bottom of flex containers, creating a natural visual gap without explicit spacer elements.

### Typography by Tier

- **Primary**: `--text-2xl` / `--text-xl`, `font-weight: 700-800`
- **Secondary**: `--text-base` / `--text-lg`, `font-weight: 400-600`
- **Tertiary**: `--text-sm` / `--text-md`, `font-weight: 600`, `color-text-muted`

### Monospace for Timecodes

All time-related data (timecodes, "ends at", progress meta) uses monospace:

```css
font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
font-variant-numeric: tabular-nums;
```

---

## Surface-Specific Decisions

### Player OSD — "Rising Stage"

- Full-width bottom-anchored scrim
- Two-column content: info left, actions right
- Meta strip between content and progress bar
- Progress bar full-bleed at absolute bottom pixel
- Keep content focused on playback state, title/subtitle, actions, and progress
- Shared channel context may live outside the panel when that produces a cleaner edge-anchored layout

### NowPlayingInfo — "Edge Shelf"

- Left+bottom edge-anchored, only top-right corner rounded
- Two-column: poster left (with vignette), content right
- Three-tier content hierarchy: primary→secondary→tertiary
- Auto-scroll description for long text
- Keep channel context and "up next" treatment subordinate to the title/metadata hierarchy when they appear

### Channel Badge

- Shared overlay shown when OSD or NowPlayingInfo is visible
- Top-left corner at the shared 48px anchor, 10px radius, gradient scrim badge
- Hidden while channel transition activity is active; fades in over 200ms and hides immediately
- Displays channel number + name
- Orchestrator-controlled visibility

### Clear-Logo Legibility

- Keep the text title visible until clear-logo artwork has loaded and passed the usability check.
- Preserve the artwork aspect ratio and cap its width at 520px; never stretch it or impose a minimum width.
- At the 1920x1080 design resolution, target 60px high in the compact Player OSD, 72px in the Guide information panel, and 84px in the full Now Playing information overlay.
- Estimate the contained artwork height from its natural aspect ratio, target height, and width cap. Fall back to the text title when the result would be below 44px.
- Broken, missing, stale, or unusably wide artwork must leave the text title intact.
- Do not add pixel-alpha or canvas analysis without evidence from real transparent-padded assets.

### Mini Guide — "Top-Edge Shelf"

- Full-width top-anchored scrim, flush to top/left/right edges
- Bottom corners rounded: `border-radius: 0 0 16px 16px`
- Gradient: `rgba(0,0,0,0.50)` at top → transparent at bottom
- Subtle bottom free-edge border: `1px solid rgba(255,255,255,0.08)`
- Rows separated by spacing only (no dividers)
- Category-color 3px left accent lines preserved on unfocused rows

---

## Accessibility Invariants

These must be preserved during every redesign pass:

1. `role="status"` on status elements.
2. D-pad focusability on all interactive buttons (no `tabindex` removal).
3. Action button `data-action` attributes for focus management.
4. `prefers-reduced-motion: reduce` media query on every animated surface.
5. `forced-colors` behavior must remain usable for focus, labels, and key boundaries on supported platforms.
6. Sufficient contrast: white text on dark scrim must pass WCAG AA at the scrim's maximum opacity point.

Documenting these expectations is not enough on its own. Contrast, forced-colors behavior, focus visibility, and motion reductions still need verification in the relevant surface work.

---

## Glass Theme Compatibility

Reusable and runtime surfaces should usually participate through inherited theme tokens or documented surface-scoped custom properties. Add explicit `.theme-glass .{surface}-panel` overrides only when the inherited mapping does not achieve the intended result.

The glass theme:

- Uses darker (higher-opacity) smoked scrims than the base surfaces. Current covered-surface examples:
- Mini Guide panel: `rgba(0,0,0,0.50)`, `rgba(0,0,0,0.40)`, `rgba(0,0,0,0.18)` -> `rgb(6 9 13 / 72%)`, `rgb(8 11 15 / 56%)`, `rgb(8 11 15 / 22%)`
- Now Playing Info panel: `rgba(0,0,0,0.30)` to `rgba(0,0,0,0.50)` -> `rgb(6 9 13 / 62%)` to `rgb(8 11 15 / 80%)`
- Covered overlay/panel surfaces should not re-introduce `backdrop-filter` or `blur()` into panel chrome.
- Uses `var(--font-family-display)` for titles.
- May use electric-cyan focus/selection glow on interactive elements.
- Does **not** re-introduce surface borders, surface box-shadows, floating-card chrome, or border-radius that the base design removed.
