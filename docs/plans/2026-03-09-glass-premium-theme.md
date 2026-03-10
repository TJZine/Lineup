# Glass Premium Smoked Acrylic Theme Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the Glassmorphism Premium (`glass`) theme so every current Glass surface uses a no-blur "Smoked Acrylic" treatment with electric-cyan focus accents, while keeping the work CSS/docs-only and preserving the existing theme registry.

**Architecture:** First update the tracked design language so repo policy explicitly matches the intended no-blur Glass direction. Then add a CSS contract test that fails on both tokenized and hard-coded blur inside the current Glass theme owners. Finally refresh the shared Glass token block in `src/styles/themes.css` and the existing Glass override blocks in EPG, Settings, Mini Guide, Now Playing, and Exit Confirm so they use dark edge-integrated scrims, minimal free-edge borders, and cyan interaction accents instead of blur-dependent translucent slabs.

**Tech Stack:** Markdown docs, CSS custom properties, theme-scoped CSS overrides, Jest node-side CSS contract tests, `npm run verify:docs`, `npm run verify`.

**Task Family / Tier:** feature/design, Tier 2.

---

## Non-Goals

- No TypeScript, DOM, focus-management, navigation, or Orchestrator behavior changes.
- No redesign of Slate & Pine, Swiss, DirecTV, Ember & Steel, or any non-Glass selectors beyond proving they do not regress.
- No change to theme labels, order, or default selection in `src/modules/ui/settings/theme.ts`.
- No reintroduction of `backdrop-filter`, `-webkit-backdrop-filter`, `filter: blur()`, or heavy floating-card box-shadow styling.
- No opportunistic cleanup outside the current Glass theme styling/doc surfaces.

## Parent Alignment

- Supports the theme system owner in [`src/modules/ui/settings/theme.ts`](../../src/modules/ui/settings/theme.ts), where `glass` remains a stable theme option and the label stays `Glassmorphism (Premium)`.
- Resolves the tracked policy contradiction in [`docs/design/ui-design-language.md`](../design/ui-design-language.md): the implementation direction is "smoked acrylic via scrims and edge highlights," not mixed blur/no-blur guidance.
- Advances the still-open Glass performance item in [`docs/plans/2026-03-04-epg-performance-risk-register.md`](./2026-03-04-epg-performance-risk-register.md) (`EPG-PND-006`) by turning the theme into a deterministic no-blur path instead of a partial EPG-only tweak.

## Required Reading

1. [`agents.md`](../../agents.md)
2. [`docs/agentic/document-map.md`](../agentic/document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md)
4. [`docs/design/ui-design-language.md`](../design/ui-design-language.md)
5. [`docs/plans/2026-03-04-epg-performance-risk-register.md`](./2026-03-04-epg-performance-risk-register.md)
6. [`src/styles/themes.css`](../../src/styles/themes.css)
7. [`src/modules/ui/epg/styles.css`](../../src/modules/ui/epg/styles.css)
8. [`src/modules/ui/settings/styles.css`](../../src/modules/ui/settings/styles.css)
9. [`src/modules/ui/mini-guide/styles.css`](../../src/modules/ui/mini-guide/styles.css)
10. [`src/modules/ui/now-playing-info/styles.css`](../../src/modules/ui/now-playing-info/styles.css)
11. [`src/modules/ui/exit-confirm/styles.css`](../../src/modules/ui/exit-confirm/styles.css)
12. [`src/styles/__tests__/theme-token-completeness.test.ts`](../../src/styles/__tests__/theme-token-completeness.test.ts)
13. [`src/styles/__tests__/ember-steel-theme.contract.test.ts`](../../src/styles/__tests__/ember-steel-theme.contract.test.ts)
14. [`src/modules/ui/settings/theme.ts`](../../src/modules/ui/settings/theme.ts)

## Required Skills

- `using-superpowers`
- `frontend-design`
- `ui-composition-patterns`
- `verification-before-completion`

## Freshness Gate

- Before editing, rerun the Glass blur audit in Task 1. If any new `.theme-glass` `backdrop-filter` or `blur(` callsites exist outside the files listed in this plan, update the plan first instead of quietly widening scope.
- If the Glass section of [`docs/design/ui-design-language.md`](../design/ui-design-language.md) already changed materially, reconcile this plan with the new tracked policy before implementation continues.
- If [`src/modules/ui/settings/theme.ts`](../../src/modules/ui/settings/theme.ts) no longer labels the theme `Glassmorphism (Premium)` or the Glass theme has moved out of the current registry, stop and refresh the plan.
- If visual verification shows an additional user-visible Glass surface still using blur after the in-scope changes land, expand the plan instead of shipping a mixed blur/no-blur theme.

## Planner Self-Check

1. Hidden architecture seam or ownership seam?
   No. The previously unresolved seam was policy ownership: whether Glass blur remained allowed. This plan resolves that by putting the design-doc change in scope before CSS implementation.
2. Adjacent contract or type changes required?
   No. Theme labels/order stay read-only and the work remains CSS/docs-only.
3. Any file declared out of scope but still implicitly required for the implementation?
   No. `player-osd/styles.css`, `playback-options/styles.css`, and `theme.ts` are read-only validation surfaces only.
4. Full evidence trail plus fallback recorded?
   Yes. Codanna insufficiency, repo-doc timeout, Context7 docs lookup, and the deterministic `rg`/direct-read fallback path are all recorded below.
5. Growing a hotspot or wrong owner?
   No. Shared Glass tokens stay in `src/styles/themes.css`; surface-specific presentation stays in each surface stylesheet; policy stays in the design doc.
6. Would a fresh session need to invent important decisions?
   No. The plan now locks task family, touched surfaces, visual direction, test strategy, verification gates, and rollback boundaries.
7. Any unresolved design decision left?
   No. The chosen direction is full current-Glass-surface no-blur smoked acrylic, not an EPG-only refresh or a token-only tweak.

## Architecture Seam Decision Gate

- Chosen seam: treat this as one bounded feature/design refresh across the current Glass theme policy doc plus the current user-visible Glass CSS owners.
- Explicitly rejected seam 1: an EPG-only rewrite while leaving Settings, Mini Guide, Now Playing, or Exit Confirm on blur.
- Explicitly rejected seam 2: neutralizing only `--glass-backdrop-filter*` tokens while leaving hard-coded `blur(...)` selectors in place.
- If implementation discovers a new Glass surface outside the in-scope files, stop and either expand the plan or split a follow-up plan; do not quietly ship partial parity.

## Public Docs Check

- MDN Web Docs `backdrop-filter` reference, accessed 2026-03-10 via Context7 (`/mdn/content`):
  - `backdrop-filter: none;` disables backdrop filtering.
  - The blur effect depends on transparent or semi-transparent backgrounds to reveal the filtered backdrop.
- This supports the chosen implementation shape: remove Glass blur declarations entirely and replace them with explicit scrim backgrounds instead of mixed blur/no-blur styling.

## Codanna Discovery

- `semantic_search_with_context`
  - Query on 2026-03-10: `glass theme backdrop filter theme tokens EPG settings mini guide now playing exit confirm`
  - Result quality was insufficient for planning: top matches were unrelated TypeScript symbols, with no useful CSS ownership signal.
- `search_documents`
  - Query on 2026-03-10: `glass theme design language backdrop-filter ui design language feature plan routing`
  - Timed out in the current workspace.
- Deterministic fallback path used because Codanna was insufficient for this CSS-heavy scope:
  - Direct reads of [`docs/design/ui-design-language.md`](../design/ui-design-language.md), [`src/styles/themes.css`](../../src/styles/themes.css), [`src/modules/ui/epg/styles.css`](../../src/modules/ui/epg/styles.css), [`src/modules/ui/settings/styles.css`](../../src/modules/ui/settings/styles.css), [`src/modules/ui/mini-guide/styles.css`](../../src/modules/ui/mini-guide/styles.css), [`src/modules/ui/now-playing-info/styles.css`](../../src/modules/ui/now-playing-info/styles.css), [`src/modules/ui/exit-confirm/styles.css`](../../src/modules/ui/exit-confirm/styles.css), and the existing repo CSS contract tests.
  - `rg -n "backdrop-filter|blur\\(" src/styles/themes.css src/modules/ui/settings/styles.css src/modules/ui/mini-guide/styles.css src/modules/ui/now-playing-info/styles.css src/modules/ui/epg/styles.css src/modules/ui/exit-confirm/styles.css src/modules/ui/player-osd/styles.css docs/design/ui-design-language.md`
- Fallback findings that justify this plan:
  - [`src/styles/themes.css`](../../src/styles/themes.css) still defines `--glass-backdrop-filter` and `--glass-backdrop-filter-strong` with blur values.
  - [`src/modules/ui/epg/styles.css`](../../src/modules/ui/epg/styles.css), [`src/modules/ui/mini-guide/styles.css`](../../src/modules/ui/mini-guide/styles.css), and [`src/modules/ui/now-playing-info/styles.css`](../../src/modules/ui/now-playing-info/styles.css) still contain hard-coded Glass blur declarations.
  - [`src/modules/ui/settings/styles.css`](../../src/modules/ui/settings/styles.css) and [`src/modules/ui/exit-confirm/styles.css`](../../src/modules/ui/exit-confirm/styles.css) still consume the Glass blur tokens.
  - [`src/modules/ui/player-osd/styles.css`](../../src/modules/ui/player-osd/styles.css) already uses `backdrop-filter: none` for Glass and stays read-only for this task.
  - [`docs/design/ui-design-language.md`](../design/ui-design-language.md) still says Glass "may add" blur, which would contradict the intended no-blur implementation if not updated.

## Impact Snapshot

- [`docs/design/ui-design-language.md`](../design/ui-design-language.md)
  - Tracked design policy owner for Glass compatibility guidance.
  - Must be updated in the same pass so implementation and policy do not diverge.
- [`src/styles/themes.css`](../../src/styles/themes.css)
  - Shared Glass token owner.
  - Affects every token-driven Glass surface, including Settings and Exit Confirm.
- [`src/modules/ui/epg/styles.css`](../../src/modules/ui/epg/styles.css)
  - Owns the largest current Glass override block, including both hard-coded blur and the Glass-specific focus/time-indicator styling that must shift from white to cyan.
- [`src/modules/ui/settings/styles.css`](../../src/modules/ui/settings/styles.css)
  - Consumes Glass blur tokens and includes Glass-specific button/dropdown surfaces that need token-aligned cyan accents.
- [`src/modules/ui/mini-guide/styles.css`](../../src/modules/ui/mini-guide/styles.css)
  - Contains a hard-coded Glass blur path on the top-edge panel.
- [`src/modules/ui/now-playing-info/styles.css`](../../src/modules/ui/now-playing-info/styles.css)
  - Contains a hard-coded Glass blur path on the left-edge info panel.
- [`src/modules/ui/exit-confirm/styles.css`](../../src/modules/ui/exit-confirm/styles.css)
  - Consumes the strong Glass blur token and must move to explicit scrim styling only.
- Planned new file: `src/styles/__tests__/glass-theme.contract.test.ts`
  - New regression guard required because `theme-token-completeness.test.ts` only checks token presence/delimiter conventions, not the Glass no-blur contract or scoped accent styling.

## Files In Scope

- Modify: `docs/design/ui-design-language.md`
- Modify: `src/styles/themes.css`
- Modify: `src/modules/ui/epg/styles.css`
- Modify: `src/modules/ui/settings/styles.css`
- Modify: `src/modules/ui/mini-guide/styles.css`
- Modify: `src/modules/ui/now-playing-info/styles.css`
- Modify: `src/modules/ui/exit-confirm/styles.css`
- Create: `src/styles/__tests__/glass-theme.contract.test.ts`

## Files Out Of Scope

- `src/modules/ui/settings/theme.ts`
  - Read-only; theme label/order/default must not change.
- `src/modules/ui/player-osd/styles.css`
  - Read-only; Glass already uses `backdrop-filter: none`.
- `src/modules/ui/playback-options/styles.css`
  - Read-only; token-driven but not part of the current blur problem.
- `src/styles/tokens.css`
  - Read-only unless implementation proves a missing shared token, which is not expected.
- Any TypeScript coordinator, presenter, store, navigation, or DOM-construction file.

## Invariants / Preservation Contracts

- Preserve the theme name/label/order in [`src/modules/ui/settings/theme.ts`](../../src/modules/ui/settings/theme.ts); this is a visual refresh, not a theme-system rename.
- Preserve Glass as an edge-integrated theme: no floating-card geometry, no new surface box-shadows, no hard dividers, and no border opacity above `rgba(255, 255, 255, 0.08)` on free edges.
- Preserve focus ownership, forced-colors support, reduced-motion behavior, and all existing `.focused` class logic; only scoped CSS values change.
- Every `.theme-glass` block touched by this plan must be free of `backdrop-filter`, `-webkit-backdrop-filter`, and `blur(` declarations after implementation.
- Preserve `var(--font-family-display)` usage for Glass titles/headings.
- Lock the accent direction: Glass focus, selected Settings affordances, and the EPG time indicator should converge on electric cyan (`#00e5ff`) rather than the old white glow.
- Keep non-Glass selectors visually unchanged unless the final diff proves the selector is Glass-scoped.

## Verification Commands

1. Reconfirm the current Glass blur footprint before editing:

```bash
rg -n "backdrop-filter|blur\\(" docs/design/ui-design-language.md src/styles/themes.css src/modules/ui/settings/styles.css src/modules/ui/mini-guide/styles.css src/modules/ui/now-playing-info/styles.css src/modules/ui/epg/styles.css src/modules/ui/exit-confirm/styles.css src/modules/ui/player-osd/styles.css
```

Expected before edits:
- blur matches in `docs/design/ui-design-language.md`, `src/styles/themes.css`, `src/modules/ui/settings/styles.css`, `src/modules/ui/mini-guide/styles.css`, `src/modules/ui/now-playing-info/styles.css`, `src/modules/ui/epg/styles.css`, and `src/modules/ui/exit-confirm/styles.css`
- `src/modules/ui/player-osd/styles.css` matches only `backdrop-filter: none`

2. Verify the tracked docs after the design-language update:

```bash
npm run verify:docs
```

Expected: PASS.

3. Run the targeted Glass theme tests after the CSS work lands:

```bash
npm test -- --runInBand --runTestsByPath src/styles/__tests__/theme-token-completeness.test.ts --verbose
npm run test:contracts -- --runTestsByPath src/styles/__tests__/glass-theme.contract.test.ts --verbose
```

Expected: PASS.

4. Run the full UI verification gate:

```bash
npm run verify
```

Expected: PASS.

5. Manual visual verification:

```bash
npm run dev
```

Expected:
- Glass EPG, Settings, Mini Guide, Now Playing, and Exit Confirm surfaces show no blur
- Glass surfaces read as smoked charcoal scrims with subtle edge highlights, not opaque floating cards
- Focus/selection states are cyan and remain obvious at TV distance
- Other themes remain visually unchanged

## Rollback Notes

- If the design-doc change is rejected after implementation review, revert the docs change and do not ship the CSS; policy and implementation must stay aligned.
- If the shared token refresh is correct but one Glass surface becomes unreadable, revert only that surface stylesheet first and keep the token change isolated for targeted follow-up.
- If verification shows non-Glass drift, revert any generic selector edits and re-scope them under `.theme-glass ...` selectors only.
- If the new contract test is too brittle, keep the no-blur assertions and simplify only the exact style-value assertions; do not remove the repo-wide Glass blur guard.

## Commit Checkpoints

1. After the design-language update plus `npm run verify:docs`
2. After the new Glass contract test is written and observed failing against the current CSS
3. After the Glass token/surface CSS refresh plus targeted Glass tests
4. After full `npm run verify` and any manual-visual polish fixes

---

## Task 1: Reconfirm Scope And Current Blur Footprint

**Files:**

- Read: `docs/design/ui-design-language.md`
- Read: `src/styles/themes.css`
- Read: `src/modules/ui/epg/styles.css`
- Read: `src/modules/ui/settings/styles.css`
- Read: `src/modules/ui/mini-guide/styles.css`
- Read: `src/modules/ui/now-playing-info/styles.css`
- Read: `src/modules/ui/exit-confirm/styles.css`
- Read: `src/modules/ui/player-osd/styles.css`

**Step 1: Run the Glass blur audit**

```bash
rg -n "backdrop-filter|blur\\(" docs/design/ui-design-language.md src/styles/themes.css src/modules/ui/settings/styles.css src/modules/ui/mini-guide/styles.css src/modules/ui/now-playing-info/styles.css src/modules/ui/epg/styles.css src/modules/ui/exit-confirm/styles.css src/modules/ui/player-osd/styles.css
```

Expected: matches only in the exact files listed above, with `player-osd/styles.css` matching only `none`.

**Step 2: Confirm the scope split**

Verify from the audit/read-through:

- hard-coded blur still exists only in `epg/styles.css`, `mini-guide/styles.css`, and `now-playing-info/styles.css`
- tokenized blur still exists only in `themes.css`, `settings/styles.css`, and `exit-confirm/styles.css`
- `player-osd/styles.css` already represents the no-blur end state and stays read-only
- the design doc still allows Glass blur today, so the policy update is not optional

**Step 3: If a new Glass blur callsite exists outside this list, update the plan before coding**

No commit for Task 1.

---

## Task 2: Update The Tracked Glass Policy Before CSS Changes

**Files:**

- Modify: `docs/design/ui-design-language.md`

**Step 1: Replace the `Glass Theme Compatibility` bullets with the no-blur smoked-acrylic policy**

Update the Glass compatibility section so it says Glass:

- uses slightly lower-opacity smoked scrims than the base surfaces
- does **not** use `backdrop-filter` or `blur()` on TV surfaces
- keeps `var(--font-family-display)` for titles
- may use electric-cyan focus/selection glow on interactive elements, but does not reintroduce surface box-shadows or floating-card chrome

Do not change the broader edge-integration rules outside what is needed to make Glass policy explicit.

**Step 2: Verify docs**

```bash
npm run verify:docs
```

Expected: PASS.

**Step 3: Commit the policy update**

```bash
git add docs/design/ui-design-language.md
git commit -m "docs(design): define glass theme as no-blur smoked acrylic"
```

---

## Task 3: Add A Failing Glass Theme Contract Test

**Files:**

- Create: `src/styles/__tests__/glass-theme.contract.test.ts`

**Step 1: Create the new contract test**

Create `src/styles/__tests__/glass-theme.contract.test.ts` with this structure:

```ts
/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const GLASS_STYLE_FILES = [
    'src/modules/ui/epg/styles.css',
    'src/modules/ui/settings/styles.css',
    'src/modules/ui/mini-guide/styles.css',
    'src/modules/ui/now-playing-info/styles.css',
    'src/modules/ui/exit-confirm/styles.css',
] as const;

const glassBlocks = (css: string): string[] =>
    Array.from(css.matchAll(/\.theme-glass[^{]*\{[\s\S]*?\}/g), (match) => match[0]);

describe('glass theme contract', () => {
    it('neutralizes the shared blur tokens and locks the cyan accent', () => {
        const themesCss = read('src/styles/themes.css');
        const block = themesCss.match(/\.theme-glass\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

        expect(block).toContain('--glass-backdrop-filter: none;');
        expect(block).toContain('--glass-backdrop-filter-strong: none;');
        expect(block).toContain('--focus-color: #00e5ff;');
        expect(block).toContain('--color-primary: #00e5ff;');
    });

    it('forbids backdrop blur declarations inside current glass surface blocks', () => {
        for (const relativePath of GLASS_STYLE_FILES) {
            const blocks = glassBlocks(read(relativePath));
            expect(blocks.length).toBeGreaterThan(0);

            for (const block of blocks) {
                expect(block).not.toMatch(/(^|[\s{;])backdrop-filter\s*:/m);
                expect(block).not.toMatch(/(^|[\s{;])-webkit-backdrop-filter\s*:/m);
                expect(block).not.toMatch(/blur\(/);
            }
        }
    });

    it('locks the Glass EPG focus and time-indicator accent to theme tokens', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');

        expect(epgCss).toMatch(/\.theme-glass\s+\.epg-cell\.focused\s*\{[^}]*box-shadow:\s*0 0 0 3px var\(--focus-color\) inset/s);
        expect(epgCss).toMatch(/\.theme-glass\s+\.epg-time-indicator\s*\{[^}]*background:\s*var\(--color-primary\);/s);
    });
});
```

**Step 2: Run the new test suite before CSS changes**

```bash
npm test -- --runInBand --runTestsByPath src/styles/__tests__/theme-token-completeness.test.ts --verbose
npm run test:contracts -- --runTestsByPath src/styles/__tests__/glass-theme.contract.test.ts --verbose
```

Expected before CSS edits: PASS for the token completeness test and FAIL for the Glass contract test because the current theme still contains blur tokens/declarations and white-accent Glass styling.

**Step 3: Commit the failing test**

```bash
git add src/styles/__tests__/glass-theme.contract.test.ts
git commit -m "test(styles): add glass theme no-blur contract"
```

---

## Task 4: Refresh Shared Glass Tokens And Token-Driven Surfaces

**Files:**

- Modify: `src/styles/themes.css`
- Modify: `src/modules/ui/settings/styles.css`
- Modify: `src/modules/ui/exit-confirm/styles.css`

**Step 1: Replace the `.theme-glass` token block with the smoked-acrylic token set**

Replace the existing `.theme-glass { ... }` block in `src/styles/themes.css` with:

```css
.theme-glass {
  --focus-color: #00e5ff;
  --focus-color-rgb: 0, 229, 255;

  --color-primary: #00e5ff;
  --color-primary-rgb: 0 229 255;
  --color-primary-dark: #009fb4;
  --color-primary-light: #7af1ff;

  --color-bg-deep: #05080b;
  --color-bg-surface: rgb(9 12 16 / 72%);
  --color-bg-elevated: rgb(12 16 21 / 82%);
  --color-bg-overlay: rgb(4 6 9 / 78%);

  --panel-surface: rgb(8 11 15 / 72%);
  --panel-surface-2: rgb(12 16 21 / 84%);
  --panel-border: 1px solid rgb(255 255 255 / 8%);
  --panel-radius: 16px;

  --transition-normal: 180ms ease-out;
  --epg-info-panel-fade-to: rgb(var(--scrim-tint-rgb) / 92%);
  --panel-inner-glow: linear-gradient(180deg, rgb(255 255 255 / 8%), transparent 42%);

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 32%);
  --shadow-md: 0 6px 18px rgb(0 0 0 / 36%);
  --shadow-lg: 0 14px 32px rgb(0 0 0 / 40%);

  --font-family-display: "Avenir Next", "Segoe UI", "Noto Sans", sans-serif;
  --glass-panel-strong: rgb(6 9 13 / 82%);
  --glass-panel-soft: rgb(255 255 255 / 6%);
  --glass-border-strong: rgb(255 255 255 / 8%);
  --glass-border-soft: rgb(255 255 255 / 5%);
  --glass-highlight: rgb(255 255 255 / 10%);
  --glass-shadow-deep: none;
  --glass-panel-soft-hover: rgb(0 229 255 / 12%);
  --glass-backdrop-filter: none;
  --glass-backdrop-filter-strong: none;
  --glass-scrim-gradient: linear-gradient(
    135deg,
    rgb(255 255 255 / 3%) 0%,
    rgb(255 255 255 / 1%) 32%,
    rgb(0 0 0 / 30%) 100%
  );
  --scrim-tint-rgb: 8 11 15;
}
```

Keep the delimiter conventions intact:

- `--focus-color-rgb` remains comma-separated
- `--color-primary-rgb` remains space-separated

**Step 2: Remove blur-dependent styling from the Glass Settings and Exit Confirm surfaces**

In `src/modules/ui/settings/styles.css`:

- remove the `backdrop-filter` and `-webkit-backdrop-filter` declarations from `.theme-glass .settings-categories`
- remove the `backdrop-filter` and `-webkit-backdrop-filter` declarations from `.theme-glass .settings-dropdown`
- retune Glass-specific Settings accents to the cyan tokens:
  - active category button uses `var(--focus-color)` for the left rail and `rgb(var(--focus-color-rgb) / ...)` for the background ramp
  - focused profile row uses `var(--focus-color)` and a cyan-tinted background
  - dropdown hover/focus state uses `var(--glass-panel-soft-hover)` rather than the old white hover slab

In `src/modules/ui/exit-confirm/styles.css`:

- remove the Glass `backdrop-filter` and `-webkit-backdrop-filter` declarations
- keep the panel background token-driven via `var(--glass-scrim-gradient, transparent)` plus a dark scrim fill
- do not add a new card shadow or new geometry

No test run yet; the new contract should still fail until the hard-coded blur surfaces are updated in Task 5.

---

## Task 5: Remove Hard-Coded Blur From Glass Surface Overrides And Land The Cyan Accent

**Files:**

- Modify: `src/modules/ui/epg/styles.css`
- Modify: `src/modules/ui/mini-guide/styles.css`
- Modify: `src/modules/ui/now-playing-info/styles.css`

**Step 1: Refresh the Glass EPG block so it no longer depends on blur**

In `src/modules/ui/epg/styles.css`:

- `.theme-glass .epg-container`
  - delete the hard-coded blur declarations
  - replace the old `rgba(0, 0, 0, 0.42)` fill with a darker scrim/gradient background that reads as smoked acrylic without looking opaque or card-like
- `.theme-glass .epg-channel-list`, `.theme-glass .epg-time-header`, `.theme-glass .epg-library-tabs`
  - stop relying on full transparency "to let blur do the work"
  - give them explicit dark scrim backgrounds so the layout remains legible with blur removed
- `.theme-glass .epg-dashboard-bottom`
  - remove the deep surface box-shadow
  - keep only a subtle free-edge top border at or below `rgba(255, 255, 255, 0.08)`
- `.theme-glass .epg-container.layout-classic .epg-classic-showcase`
  - remove the tokenized `backdrop-filter` declarations
  - keep the existing layout geometry, but rely on `var(--glass-panel-strong)` plus the current border radius instead of blur

**Step 2: Retune the Glass EPG interaction accents to cyan**

Still in `src/modules/ui/epg/styles.css`:

- update `.theme-glass .epg-cell` to a darker smoked-surface default with only a subtle inner edge highlight
- update `.theme-glass .epg-cell.focused` so the accent is `var(--focus-color)` with an inset 3px ring and restrained outer glow; do not restore a white border
- keep the existing forced-colors block intact
- update `.theme-glass .epg-channel-row::before` and `.theme-glass .epg-channel-row.focused::before` so the focused state leans on cyan tinting rather than white glass
- update `.theme-glass .epg-time-indicator` and `::after` to use `var(--color-primary)` and a cyan glow

**Step 3: Remove hard-coded blur from Mini Guide and Now Playing**

In `src/modules/ui/mini-guide/styles.css`:

- remove both blur declarations from `.theme-glass .mini-guide-panel`
- keep the panel edge-anchored and shadow-free
- preserve the bottom free-edge border, but keep it at or below `rgba(255, 255, 255, 0.08)`
- shift `.theme-glass .mini-guide-row.focused` from white to cyan-accent styling

In `src/modules/ui/now-playing-info/styles.css`:

- remove both blur declarations from `.theme-glass .now-playing-info-panel`
- keep the edge-shelf geometry, top/right free-edge borders, and no box-shadow
- preserve title display-font usage without changing DOM/layout behavior

**Step 4: Run the targeted Glass tests**

```bash
npm test -- --runInBand --runTestsByPath src/styles/__tests__/theme-token-completeness.test.ts --verbose
npm run test:contracts -- --runTestsByPath src/styles/__tests__/glass-theme.contract.test.ts --verbose
```

Expected: PASS.

**Step 5: Commit the Glass CSS refresh**

```bash
git add src/styles/themes.css src/modules/ui/settings/styles.css src/modules/ui/exit-confirm/styles.css src/modules/ui/epg/styles.css src/modules/ui/mini-guide/styles.css src/modules/ui/now-playing-info/styles.css src/styles/__tests__/glass-theme.contract.test.ts
git commit -m "style(glass): refresh premium theme to no-blur smoked acrylic"
```

---

## Task 6: Run Full Verification And Visual Validation

**Files:**

- Verify only unless fixes are required.

**Step 1: Run the full repo gate**

```bash
npm run verify
```

Expected: PASS.

**Step 2: Start the app for manual Glass-theme verification**

```bash
npm run dev
```

**Step 3: Manual checklist**

- [ ] Select `Glassmorphism (Premium)` in Settings and confirm the label/order did not change.
- [ ] Settings left rail and dropdown have no blur, no white glass slab treatment, and a cyan active/focus accent.
- [ ] EPG container, channel list, classic showcase, program cells, channel rows, and time indicator render without blur.
- [ ] Mini Guide and Now Playing remain edge-anchored, shadow-free, and readable with no blur.
- [ ] Exit Confirm uses the Glass scrim styling with no blur.
- [ ] Slate & Pine, Swiss, DirecTV, and Ember & Steel still look unchanged.

**Step 4: Commit only if a verification-driven polish fix was required**

If fixes were needed after `npm run verify` or manual QA:

```bash
git add docs/design/ui-design-language.md src/styles/themes.css src/modules/ui/epg/styles.css src/modules/ui/settings/styles.css src/modules/ui/mini-guide/styles.css src/modules/ui/now-playing-info/styles.css src/modules/ui/exit-confirm/styles.css src/styles/__tests__/glass-theme.contract.test.ts
git commit -m "style(glass): polish smoked acrylic verification fixes"
```

If no fixes were needed, no additional commit is required after Task 5.
