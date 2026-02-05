# Onboarding UI/UX Implementation Specification (Part 2 of 2)

> **Part 2 (Session 2):** Audio Setup → Channel Setup → Cross-cutting + deferred items + updated priorities + suggestions.  
> Part 1: `onboarding_ux_implementation_spec.md`

---

## Table of Contents (Part 2)

4. [Audio Setup Screen Enhancements](#4-audio-setup-screen-enhancements)
5. [Channel Setup Screen Enhancements](#5-channel-setup-screen-enhancements)
6. [Cross-Cutting Enhancements](#6-cross-cutting-enhancements)
7. [Deferred Items](#7-deferred-items)
8. [Summary: Implementation Priorities (Updated)](#8-summary-implementation-priorities-updated)
9. [Suggestions / Open Questions](#9-suggestions--open-questions)

---

## 4. Audio Setup Screen Enhancements

**Implementation location:** `src/modules/ui/audio-setup/AudioSetupScreen.ts`

### 4.1 SVG Icons Instead of Emoji ✅ APPROVED

**Current State (repo):** audio choice labels use emoji icons (in `AUDIO_CHOICES`).

**Target UI:**

```
Audio Choice Cards:
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │   [Soundbar Icon]               │  │   [TV Icon]                     │ │
│  │   Yes, I have a soundbar        │  │   No, using TV speakers         │ │
│  │   or receiver                   │  │                                 │ │
│  │   Connected via HDMI eARC       │  │                                 │ │
│  └─────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                            │
│  Icon specs: 32×32 inline SVG, 2px stroke, currentColor                   │
└────────────────────────────────────────────────────────────────────────────┘
```

**SVG Icon Examples (inline):**

```html
<!-- Soundbar/Speaker Icon -->
<svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="2">
  <rect x="2" y="8" width="20" height="8" rx="2"/>
  <circle cx="7" cy="12" r="2"/>
  <circle cx="17" cy="12" r="2"/>
  <path d="M11 10h2v4h-2z"/>
</svg>

<!-- TV Speakers Icon -->
<svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="2">
  <rect x="2" y="4" width="20" height="14" rx="2"/>
  <path d="M8 21h8"/>
  <path d="M12 18v3"/>
</svg>
```

**Implementation Notes:**
- Keep accessible labels: the icon should not be the only content; keep the text label.
- Do not add new focusables (icons are decorative).

---

### 4.2 Tooltip for Advanced Option ✅ APPROVED (if elegant)

**Current State (repo):** “Direct Play Audio Fallback” toggle exists with label + meta.

**Target UI:**

```
Direct Play Audio Fallback with Tooltip:
┌────────────────────────────────────────────────────────────────────────────┐
│  Direct Play Audio Fallback                                   [ On ]       │
│  Allow Direct Play using a compatible fallback audio track                 │
│                                                                            │
│  [i] On focus, show tooltip (below):                                       │
│  ┌────────────────────────────────────────────────────────────┐           │
│  │ If your audio system doesn't support a movie's format,      │           │
│  │ this allows playing a compatible track instead of           │           │
│  │ transcoding. Recommended: On for most users.                │           │
│  └────────────────────────────────────────────────────────────┘           │
└────────────────────────────────────────────────────────────────────────────┘
```

**Tooltip styling:**
- Background: `var(--panel-surface)` or a slightly darker variant
- Border: subtle 1px
- Border-radius: 8px
- Padding: 12px 16px
- Font-size: 14px
- Max-width: 360px
- Position: below toggle, center-aligned
- Animation: fade in 150ms (respect `prefers-reduced-motion`)

**UX Behavior:**
- Tooltip appears on focus (not hover).
- Disappears when focus moves away.
- Small delay (≈300ms) to avoid flash on quick navigation.

---

### 4.3 Skip Option Clarity ✅ APPROVED

**Status (repo):** already mostly implemented.

- `_ensureInitialSelectionAndState()` pre-selects a default based on stored DTS setting.
- Continue is enabled after initial selection is ensured.

**Optional polish:**
- If no explicit selection was made in-session, change the Continue button label to “Continue with current settings”.

---

## 5. Channel Setup Screen Enhancements

**Implementation location:** `src/modules/ui/channel-setup/ChannelSetupScreen.ts` + `src/modules/ui/channel-setup/styles.css` + `.setup-*` rules in `src/styles/shell.css`

### 5.1 Library Thumbnails/Icons ✅ APPROVED

**Current State (repo):** Step 1 shows title + type + state only.

**Target UI:**

```
Library Selection (Step 1):
┌────────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────┐  ┌────────────────────────┐                   │
│  │ ┌──────┐               │  │ ┌──────┐               │                   │
│  │ │ [🎬] │ Movies        │  │ │ [📺] │ TV Shows      │                   │
│  │ │      │ 1,234 titles  │  │ │      │ 456 titles    │                   │
│  │ └──────┘               │  │ └──────┘               │                   │
│  │                 [Off]  │  │                 [✓]    │                   │
│  └────────────────────────┘  └────────────────────────┘                   │
│                                                                            │
│  Icon approach (initial): SVG icons (no emoji)                             │
│  Future: thumbnail if cheap/cached                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

**CSS Updates (align to existing `.setup-toggle` grid):**

```css
.setup-toggle.library-toggle {
  grid-template-columns: 56px 1fr auto;
}

.setup-toggle-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
}

.setup-toggle-icon svg {
  width: 28px;
  height: 28px;
}
```

---

### 5.2 Library Stats (Item Count) ✅ APPROVED

**Target UI:** show item count for each library in the meta line.

**Correction (important):**
- Use `PlexLibrary.contentCount` (`src/modules/plex/library/types.ts`), not `library.size`.

**Target UI:**

```
┌────────────────────────────────────────────┐
│  [Icon]  Library Title                     │
│          Movies • 1,234 titles       [Off] │
└────────────────────────────────────────────┘
```

---

### 5.3 Select All / Clear All ✅ APPROVED

**Target UI:**

```
Top of Library List:
┌────────────────────────────────────────────────────────────────────────────┐
│      [ Select All ]  [ Clear All ]                                         │
│                                                                            │
│  ┌────────────────────────┐  ┌────────────────────────┐                   │
│  │ Movies           [✓]   │  │ TV Shows         [✓]    │                   │
│  └────────────────────────┘  └────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Button Styling:**

```css
.setup-bulk-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.setup-bulk-button {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.setup-bulk-button:focus {
  outline: var(--focus-ring-width) solid var(--focus-color);
  outline-offset: var(--focus-ring-offset);
  color: var(--color-text-primary);
}
```

**UX Behavior:**
- “Select All” → add all library IDs to `_selectedLibraryIds`.
- “Clear All” → clear `_selectedLibraryIds`.
- Re-render immediately.

---

### 5.4 Improved Selected State ✅ APPROVED

**Current State (repo):** selected libraries show the text “Selected”.

**Target UI:**
- Replace “Selected” with a checkmark icon.
- Preserve accessible state in aria-label / sr-only text.

---

### 5.5 Strategy Descriptions/Tooltips ✅ APPROVED (status: already present, revise copy)

**Current State (repo):** strategy toggles already render a 1-line detail string (shown as `.setup-toggle-meta`).

**Target UI:** revise detail strings to be clearer and consistent.

**Proposed descriptions (examples):**
- Collections: “Build channels from your Plex collections.”
- Playlists: “Build channels from your Plex playlists.”
- Genres/Directors: “Auto-generate channels (slower on large libraries).”

---

### 5.6 Slider Controls for Numeric Values ✅ APPROVED

**Current State (repo):** adjustable toggles exist (`.setup-toggle--adjustable`) and cycle presets on click.

**Target (two-step approach):**
- Step 1 (lower risk): allow left/right D-pad to adjust values while the control is focused.
- Step 2 (optional): replace with a true slider UI if we can keep focus deterministic.

**Slider Target UI (if implemented):**

```
┌──────────────────────────────────────────────────────────────┐
│ Max Channels                                                  │
│ ◀  ═══════════●══════════════════════════  ▶            50    │
│ Min Items                                                     │
│ ◀  ●═══════════════════════════════════  ▶             3     │
└──────────────────────────────────────────────────────────────┘
```

---

### 5.7 Estimate Panel Improvements ✅ APPROVED

**Current State (repo):** estimate panel exists and shows “Updating…” while loading.

**Target UI:** show transient deltas next to changed values.

```
┌──────────────────────────────────────────────────────────────┐
│ ESTIMATE                                                     │
│ Total planned         45  (+5)                               │
│ Collections          28  (+3)                                │
│ …                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

### 5.8 Accordion State Memory ✅ APPROVED (status: already implemented)

**Current State (repo):** already implemented via `_strategyAccordions` in `ChannelSetupScreen`.

---

### 5.9 Build Progress Detail ✅ APPROVED (status: already implemented)

**Current State (repo):** build progress already renders a task label + detail label (`ChannelBuildProgress.label` / `.detail`).

**Optional enhancement:** ensure detail includes “Channel X of Y” where available.

---

## 6. Cross-Cutting Enhancements

### 6.1 Consistent Button Sizing ✅ APPROVED

**Current State (repo):** `.screen-button` is defined in `src/styles/shell.css` and scales via `--onboarding-scale`.

**Spec adjustment:** any sizing changes must be made by editing `.screen-button` in-place (no competing definitions).

---

### 6.2 Visual Step Indicator ✅ APPROVED (if visually nice)

**Scope note:** Retune already has per-flow step labels (e.g., Channel Setup “Step 1 of 3”). A global onboarding stepper should only be added if it can be applied consistently without confusing those labels.

If implemented, it must:
- be decorative (no new focusables)
- appear only on onboarding screens (not Player/EPG)

---

### 6.3 Unified Loading Component ✅ APPROVED (status: already present as `.panel-spinner`)

**Current State (repo):** `.panel-spinner` exists and is used for status lines and “Updating…” labels.

**Spec adjustment:** standardize on `.panel-spinner`; do not introduce a parallel `.spinner` base unless required.

---

### 6.4 Error Handling Patterns ✅ APPROVED

**Spec correction:**
- Avoid emoji icons in error UI patterns; use inline SVG or CSS.
- Adopt incrementally per screen to avoid large refactors.

---

### 6.5 Performance Optimizations ✅ APPROVED

**Status (repo):** Channel Setup preview already has “Updating…” while loading.

**Spec notes:**
- Only virtualize lists when real-world item counts justify it, and ensure focus navigation remains deterministic.

---

## 7. Deferred Items

The following items have been deferred for future consideration (updated):

| Item | Reason |
|------|--------|
| Preset configurations (“Quick Setup”) | Product decision + testing scope |
| Detailed diff view | Higher complexity |
| Error recovery for partial builds | Requires build resume model |
| Pre-selection based on TV capabilities | Not reliable across devices |

---

## 8. Summary: Implementation Priorities (Updated)

### Phase 1 (Critical)

1. On-screen numpad for PIN entry (Profile Select)
2. QR code for auth linking + PIN countdown (Auth)
3. Server list latency + active server hierarchy + empty state (Server Select)

### Phase 2 (High Value)

4. Profile avatar sizing + PIN entry animations (Profile Select)
5. Audio setup SVG icons + optional tooltip polish (Audio Setup)
6. Channel setup: library icons + item counts (Channel Setup)

### Phase 3 (Usability)

7. Channel setup: Select All / Clear All (Channel Setup)
8. Channel setup: selected state checkmark polish (Channel Setup)
9. Channel setup: strategy description copy refresh (Channel Setup)

### Phase 4 (Polish)

10. Channel setup: estimate deltas (Channel Setup)
11. Numeric controls: left/right adjust (or slider) improvements (Channel Setup)
12. Cross-cutting: step indicator (only if consistent) (All onboarding screens)
13. Cross-cutting: error box standardization rollout (All onboarding screens)

---

## 9. Suggestions / Open Questions

1. **Plex QR payload:** verify whether Plex supports an official “auto-fill PIN” URL format. Until verified, QR encodes `https://plex.tv/link` only.
2. **PIN expiry:** UI countdown should use `PlexPinRequest.expiresAt` as canonical; avoid hardcoded minutes.
3. **Icon strategy:** consider a tiny repo-local icon helper (inline SVG strings) to avoid duplicating SVG markup.
4. **Accessibility (TV):** ensure new controls (numpad, bulk actions) have deterministic neighbor graphs and visible focus; avoid new modal traps.
5. **Testing gaps:** add/extend unit tests for numpad focus trap/neighbor mapping and Auth timer expiration behavior.
6. **Copy consistency:** unify terminology/casing across screens (“Retry discovery”, “Sign in”, etc).

---

*Updated: 2026-02-05 (reviewed against current repo code; no official Plex QR auto-fill URL found via Context7 sources—treat as TODO for live verification).*

