# Swiss Minimal Theme Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the Swiss Minimal theme with a "Classic Strong Typography" design direction. This introduces absolute pitch-black backgrounds, stark sharp corners (`0px` radius), brutalist flattened shadows, and high-contrast heavy typography while keeping the striking emerald green accent (`#34d399`).

**Architecture:** Update the `.theme-swiss` token block in `src/styles/themes.css`, overriding shadows and border-radius. In `src/modules/ui/epg/styles.css`, add Swiss-specific classic-guide overrides for the focused state to provide a sharp inner border highlight instead of the default glowing outline.

**Tech Stack:** CSS custom properties, shared theme token architecture, EPG CSS, `npm run verify`.

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

Goal: Make verification reproducible for a fresh executor (no “investigation state” notes).

**Pre-change verification (confirm current Swiss baseline + existing minimal exclusions):**

```bash
# Swiss theme token baseline (pre-change)
rg -n "^\\s*\\.theme-swiss\\s*\\{" src/styles/themes.css
rg -n "--color-bg-deep:\\s*#07090a" src/styles/themes.css
rg -n "--panel-radius:\\s*14px" src/styles/themes.css

# Swiss minimal exclusions (note: selectors may be grouped with commas)
rg -n "\\.theme-swiss\\s+\\.epg-cell-meta" src/modules/ui/epg/styles.css
rg -n "\\.theme-swiss\\s+\\.epg-info-tags" src/modules/ui/epg/styles.css
rg -n "display:\\s*none\\s*!important" src/modules/ui/epg/styles.css
```

Expected: all three Swiss token checks match, and both Swiss exclusion selectors appear with `display: none !important` in their rule bodies.

## Impact Snapshot

- `src/styles/themes.css`: Modifying the `.theme-swiss` block changes the aesthetic across the entire app for Swiss Minimal users.
- `src/modules/ui/epg/styles.css`: Adding `.theme-swiss` focus styling ensures the pure "sharp typography outline" design applies strictly to Swiss, without breaking Glass or Ember's soft focus states.

## Files In Scope

- Modify: `src/styles/themes.css`
- Modify: `src/modules/ui/epg/styles.css`

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

This plan is CSS-only. Per maintainer guidance, avoid adding tests for one-off theme/plan work.

## Verification Commands

1. Test standard token execution after code changes:

```bash
npm test -- --runInBand --runTestsByPath src/styles/__tests__/theme-token-completeness.test.ts --verbose
```

Expected: PASS.

2. Full UI verification gate:

```bash
npm run verify
```

Expected: PASS.

3. Visual Verification:

```bash
npm run dev
```

Expected: When switching to Swiss Minimal, the interface snaps to a sharp-cornered (`0px`), pitch-black design with strong typographic weight and bright emerald focus outlines.

## Rollback Notes

- If the EPG overrides break alignment/behavior for other themes, revert these targets:
  - `src/modules/ui/epg/styles.css` (remove the new `.theme-swiss ...` focus rules / prefixing changes)
  - `src/styles/themes.css` (restore the previous `.theme-swiss` token block)

After rollback, verify no leftover artifacts:

```bash
npm test -- --runInBand
```

## Commit Checkpoints

1. After standardizing the theme block in `themes.css`.
2. After EPG focus updates.

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

## Task 2: Add Swiss-Scoped EPG Focus States

**Files:**

- Modify: `src/modules/ui/epg/styles.css`

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

**Step 2: Commit**

```bash
git add src/modules/ui/epg/styles.css
git commit -m "style(epg): scope swiss-minimal sharp focus states"
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
