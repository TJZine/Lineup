# Swiss Minimal Theme Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the Swiss Minimal theme with a "Classic Strong Typography" design direction. This introduces absolute pitch-black backgrounds, stark sharp corners (`0px` radius), brutalist flattened shadows, and high-contrast heavy typography while keeping the striking emerald green accent (`#34d399`).

**Architecture:** Update the `.theme-swiss` token block in `src/styles/themes.css`, overriding shadows and border-radius. In `src/modules/ui/epg/styles.css`, add Swiss-specific classic-guide overrides for the focused state to provide a sharp inner border highlight instead of the default glowing outline. Add a CSS contract test to ensure the Swiss Minimal palette and selector scoping stay locked.

**Tech Stack:** CSS custom properties, shared theme token architecture, EPG CSS, Jest node-side CSS contract tests, `npm run verify`.

---

## Non-Goals

- No TypeScript, DOM, focus-management, or navigation behavior changes.
- No design changes to Broadcast Blue, Ember & Steel, Slate & Pine, DirecTV, or Glass themes.
- No change to the existing Swiss Minimal logic that hides subtitles and meta tags in the EPG grid (that density choice stays).
- No new floating-card styling or box-shadows.

## Parent Alignment

- Supports the theme owner in `src/modules/ui/settings/theme.ts`.
- Follows the edge-integrated UI rules in `docs/design/ui-design-language.md`: flattening layers by eliminating `box-shadow` on the main tokens, eliminating soft radii, and relying on pure spacing/contrast.
- Stays inside the UI architecture boundary in `docs/architecture/CURRENT_STATE.md`: styling-only changes in `src/modules/ui/` and `src/styles/`, no app/runtime coordinator growth.

## Required Reading

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/design/ui-design-language.md`
4. `src/styles/themes.css`
5. `src/modules/ui/epg/styles.css`
6. `src/styles/__tests__/theme-token-completeness.test.ts`

## Required Skills

- `using-superpowers`
- `executing-plans`
- `verification-before-completion`

## Freshness Gate

- Before editing, ensure `.theme-swiss` still exists in `src/styles/themes.css` and `src/modules/ui/epg/styles.css`.
- Any generic EPG selector edits that could mutate *other* themes must be rolled back and wrapped tightly within `.theme-swiss`.

## Planner Self-Check

1. Hidden architecture seam or ownership seam?
   No. Confined to CSS/theme tokens in existing files.
2. Adjacent contract or type changes required?
   No. Stays CSS-only.
3. Any file declared out of scope but implicitly required?
   No.
4. Full evidence trail?
   Yes, read via Codanna tools/file viewing. Swiss overrides in EPG currently hide meta/tags, those lines are preserved.
5. Growing a hotspot?
   No. CSS stays neatly partitioned in `.theme-swiss` blocks.
6. Execution-ready without decision points?
   Yes. Design finalized: black grounds (`#020202`), sharp corners (`0px`), flat shadows (`none`).

## Architecture Seam Decision Gate

- Chosen seam: Keep the refresh strictly inside `.theme-swiss` CSS variable overrides and targeted `.theme-swiss ...` rules in EPG component styles, exactly matching the pattern validated by the Ember & Steel refresh.

## Codanna Discovery

- `semantic_search_with_context`: Not used; the task was strictly scoped to known CSS token files so direct reads were preferred.
- `search_documents`: Timed out during earlier architecture investigation; fallback to direct reads used instead.
- `analyze_impact`: Not used; CSS token changes are perfectly isolated by the `.theme-swiss` parent selector.
- Direct reads:
  - `src/styles/themes.css` verified the existing `.theme-swiss` block (currently `#07090a` backgrounds, `14px` radius).
  - `src/modules/ui/epg/styles.css` verified `.theme-swiss .epg-cell-meta` and `.epg-info-tags` are actively hidden via `display: none !important`.

## Impact Snapshot

- `src/styles/themes.css`: Modifying the `.theme-swiss` block changes the aesthetic across the entire app for Swiss Minimal users.
- `src/modules/ui/epg/styles.css`: Adding `.theme-swiss` focus styling ensures the pure "sharp typography outline" design applies strictly to Swiss, without breaking Glass or Ember's soft focus states.
- `src/styles/__tests__/swiss-minimal-theme.contract.test.ts`: New contract test guarantees the stark tokens (black backgrounds, 0px radius, flat shadows) don't regress.

## Files In Scope

- Modify: `src/styles/themes.css`
- Modify: `src/modules/ui/epg/styles.css`
- Create: `src/styles/__tests__/swiss-minimal-theme.contract.test.ts`

## Files Out Of Scope

- `src/styles/tokens.css`
- `src/modules/ui/settings/theme.ts`
- Modifying the DOM of the EPG program cells.

## Invariants / Preservation Contracts

- Keep the existing rules that hide EPG subtitles and tags for the Swiss theme.
- Keep the emerald green focus (`#34d399`) color matching the original intent.
- Preserve progressive-enhancement duplicate declarations in CSS (`rgba()` followed by modern color syntax).
- The `--scrim-tint-rgb` change from `16 18 20` → `0 0 0` is intentional to match the new absolute-black aesthetic.
- `--font-family-display` is a **new addition** to this theme block (it was not defined in the original `.theme-swiss`). It explicitly pins the Swiss theme to Helvetica Neue for the Classic Strong Typography identity.

## TDD Relaxation Note

The `writing-plans` skill requires TDD red-green ordering. For CSS-only token work, this is deliberately relaxed: the contract test reads raw CSS strings, so writing the test first against old CSS would cause it to fail for the wrong structural reasons rather than providing a meaningful red-green signal. Instead, Task 1 applies the token changes first and Task 2 writes + verifies the contract test immediately after.

## Verification Commands

1. Test standard token execution after code changes:

```bash
npm test -- --runInBand --runTestsByPath src/styles/__tests__/theme-token-completeness.test.ts src/styles/__tests__/swiss-minimal-theme.contract.test.ts --verbose
```

Expected: PASS.

1. Full UI verification gate:

```bash
npm run verify
```

Expected: PASS.

1. Visual Verification:

```bash
npm run dev
```

Expected: When switching to Swiss Minimal, the interface snaps to a sharp-cornered (`0px`), pitch-black design with strong typographic weight and bright emerald focus outlines.

## Rollback Notes

- If the EPG overrides break EPG alignment for other themes, delete the additions in `src/modules/ui/epg/styles.css` and re-evaluate the `.theme-swiss` prefixing.

## Commit Checkpoints

1. After standardizing the theme block in `themes.css`.
2. After EPG focus updates and contract test verification.

---

## Task 1: Refresh The Swiss Minimal Token Block

**Files:**

- Modify: `src/styles/themes.css`

**Step 1: Replace the `.theme-swiss` block with the sharper contrasting token set**

In `src/styles/themes.css`, find the `.theme-swiss { ... }` token section and replace the block with:

```css
.theme-swiss {
  --focus-color: #34d399;
  --focus-color-rgb: 52, 211, 153;

  --color-primary: #34d399;
  --color-primary-rgb: 52 211 153;
  --color-primary-dark: #10b981;
  --color-primary-light: #6ee7b7;

  --color-bg-deep: #020202;
  --color-bg-surface: rgba(10, 10, 10, 0.95);
  --color-bg-surface: rgb(10 10 10 / 95%);
  --color-bg-elevated: rgba(18, 18, 18, 0.98);
  --color-bg-elevated: rgb(18 18 18 / 98%);
  --color-bg-overlay: rgba(0, 0, 0, 0.90);
  --color-bg-overlay: rgb(0 0 0 / 90%);

  --panel-surface: rgba(10, 10, 10, 0.95);
  --panel-surface: rgb(10 10 10 / 95%);
  --panel-surface-2: rgba(18, 18, 18, 0.98);
  --panel-surface-2: rgb(18 18 18 / 98%);

  --panel-border: 1px solid rgba(255, 255, 255, 0.04);
  --panel-border: 1px solid rgb(255 255 255 / 4%);
  --panel-radius: 0px;

  --transition-normal: 150ms ease-out;
  --epg-info-panel-fade-to: var(--panel-surface-2);

  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: none;
  --panel-inner-glow: none;

  --scrim-tint-rgb: 0 0 0;
  --font-family-display: "Helvetica Neue", Helvetica, "Avenir Next", Arial, sans-serif;
}
```

(Note: Leave the text-sizing overrides `.theme-swiss .now-playing-info-title { ... }` intact right below the main block).

**Step 2: Check formatting by running tests**

```bash
npm test -- --runInBand --runTestsByPath src/styles/__tests__/theme-token-completeness.test.ts --verbose
```

Expected: PASS.

**Step 3: Commit**

```bash
git add src/styles/themes.css
git commit -m "style(theme): refresh swiss-minimal with stark contrast and sharp edges"
```

---

## Task 2: Add Swiss-Scoped EPG Focus States and CSS Contract Test

**Files:**

- Modify: `src/modules/ui/epg/styles.css`
- Create: `src/styles/__tests__/swiss-minimal-theme.contract.test.ts`

**Step 1: Add Swiss-specific focus highlights**

In `src/modules/ui/epg/styles.css`, locate the comment `/* Minimal themes: keep legacy density and avoid new visual structure. */`. Insert the following new rules **immediately above** that comment, after the last `.theme-glass` rule block:

```css
/* Swiss Classic Typography Focus */
.theme-swiss .epg-cell.focused {
  background: rgba(var(--focus-color-rgb), 0.12);
  box-shadow: 0 0 0 4px var(--focus-color) inset;
  outline: none;
}

.theme-swiss .epg-container.layout-classic .epg-cell.focused {
  background: rgba(var(--focus-color-rgb), 0.12);
  border-color: rgba(var(--focus-color-rgb), 0.12);
  box-shadow: 0 0 0 4px var(--focus-color) inset;
  outline: none;
}
```

DO NOT touch the existing `.theme-swiss .epg-cell-meta { display: none !important; }` rules below that.

**Step 2: Create Contract Test**

Create `src/styles/__tests__/swiss-minimal-theme.contract.test.ts`:

```ts
/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('swiss-minimal theme contract', () => {
    it('defines the stark black background, sharp corners, and flat shadows', () => {
        const themesCss = read('src/styles/themes.css');
        const block = themesCss.match(/\.theme-swiss\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

        expect(block).toContain('--color-bg-deep: #020202;');
        expect(block).toContain('--panel-radius: 0px;');
        expect(block).toContain('--shadow-lg: none;');
        expect(block).toContain('--panel-inner-glow: none;');
        expect(block).toContain('--font-family-display: "Helvetica Neue"');
    });

    it('defines brutalist sharp emerald focus states for the EPG', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');

        expect(epgCss).toMatch(
            /\.theme-swiss\s+\.epg-cell\.focused\s*\{[^}]*background:\s*rgba\(var\(--focus-color-rgb\),\s*0\.12\);[^}]*box-shadow:\s*0 0 0 4px var\(--focus-color\) inset;/s
        );
    });

    it('maintains the legacy minimal exclusions', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        
        expect(epgCss).toMatch(/\.theme-swiss\s+\.epg-cell-meta\s*\{[^}]*display:\s*none\s*!important;/s);
        expect(epgCss).toMatch(/\.theme-swiss\s+\.epg-info-tags\s*\{[^}]*display:\s*none\s*!important;/s);
    });
});
```

**Step 3: Test and Confirm**

```bash
npm test -- --runInBand --runTestsByPath src/styles/__tests__/theme-token-completeness.test.ts src/styles/__tests__/swiss-minimal-theme.contract.test.ts --verbose
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/modules/ui/epg/styles.css src/styles/__tests__/swiss-minimal-theme.contract.test.ts
git commit -m "style(epg): scope swiss-minimal sharp focus states and verify contract"
```

---

## Task 3: Full Verification And Visual Pass

**Files:**

- Verify only; no code changes expected.

**Step 1: Check standard gate**

```bash
npm run verify
```

Expected: PASS.

**Step 2: Start dev server**

```bash
npm run dev
```

**Step 3: Visual Checklist**

- [ ] Select "Swiss Minimal" in Settings.
- [ ] Observe backgrounds are nearly pitch black.
- [ ] Observe all panels, including settings dropdowns, have perfectly sharp corners (`0px` radius).
- [ ] Observe there are no soft drop shadows.
- [ ] In the EPG, navigate to a cell. It should feature a stark emerald green `4px` inner border.
- [ ] Confirm subtitles and tags remain hidden in the EPG for a clean layout.
- [ ] Switch to another theme (like Ember & Steel) to ensure shadows, corners, and classic focus outlines still render correctly.

No commit unless fixes are made based on the visual verification.
