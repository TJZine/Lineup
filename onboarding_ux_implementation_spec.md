# Onboarding UI/UX Implementation Specification (Part 1 of 2)

> **Purpose:** This document provides detailed, implementation-ready specifications for approved onboarding UI/UX enhancements. It has been reviewed against the current Retune codebase to correct mismatches and to align with existing UI/navigation patterns.
>
> **Part 1 (Session 1):** Auth → Profile Select → Server Select  
> **Part 2 (Session 2):** Audio Setup → Channel Setup → Cross-cutting + priorities + suggestions: `onboarding_ux_implementation_spec_part2.md`

---

## How this maps to the current Retune codebase (baseline)

- **Screen architecture:** Onboarding/setup screens are DOM-built classes rendering into `.screen` + `.screen-panel` containers (see `src/styles/shell.css`).
- **Navigation/focus:** Focus is explicit: `nav.registerFocusable({ id, element, neighbors, onSelect })`. Modals should use `nav.openModal(modalId, focusableIds)` to trap focus (see `src/modules/navigation/interfaces.ts` and `src/modules/navigation/NavigationManager.ts`).
- **Existing primitives to reuse:**
  - `.screen-button` (scaled by `--onboarding-scale`) in `src/styles/shell.css`
  - `.panel-spinner` (spinner inline with text) in `src/styles/shell.css`
  - `PlexPinRequest.expiresAt` (PIN expiry timestamp) in `src/modules/plex/auth/interfaces.ts`

---

## Table of Contents (Part 1)

1. [Auth Screen Enhancements](#1-auth-screen-enhancements)
2. [Profile Select Screen Enhancements](#2-profile-select-screen-enhancements)
3. [Server Select Screen Enhancements](#3-server-select-screen-enhancements)
4. [Appendix A: Shared UI Foundations (Part 1)](#appendix-a-shared-ui-foundations-part-1)

---

## 1. Auth Screen Enhancements

**Implementation location:** `src/modules/ui/auth/AuthScreen.ts`

### 1.1 QR Code for Auth Linking ✅ APPROVED

**Current State (repo):**
- Subtitle instructs: “Go to https://plex.tv/link and enter the code below.”
- PIN is rendered as a single `.pin-code` text element.

**Correction / risk note (important):**
- A Plex “auto-fill PIN” URL format (query param / fragment) is **not verified**. This spec defaults to encoding `https://plex.tv/link` in the QR and keeping the PIN visible for manual entry. If an official auto-fill format is later verified, we can upgrade the QR payload.

**Target UI:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                        Sign in to Plex                                     │
│                                                                            │
│              Scan the QR code or visit plex.tv/link                        │
│                                                                            │
│                      ┌─────────────────────┐                               │
│                      │                     │                               │
│                      │    ██ █ ██ █ ██     │                               │
│                      │    █ ██ █ ██ ██     │                               │
│                      │    ██ █ ██ █ ██     │    ← 160×160px QR code        │
│                      │    █ ██ █ ██ ██     │      white background         │
│                      │    ██ █ ██ █ ██     │      8px rounded corners      │
│                      │                     │                               │
│                      └─────────────────────┘                               │
│                                                                            │
│                         Enter this code:                                   │
│                                                                            │
│                   ┌────┐  ┌────┐  ┌────┐  ┌────┐                           │
│                   │ A  │  │ B  │  │ C  │  │ D  │  ← Individual boxes       │
│                   └────┘  └────┘  └────┘  └────┘    64×72px each           │
│                                                                            │
│                        Expires in 04:32                                    │
│                                                                            │
│                         [ Cancel ]                                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**UX Behavior:**

1. **QR Code Generation:**
   - Default QR payload: `https://plex.tv/link`
   - Generated client-side using a lightweight library or minimal implementation.
   - White background with 8px border-radius to match the app aesthetic.
   - Minimum 160×160px for scan reliability.

2. **Visual URL Display:**
   - Display `plex.tv/link` prominently above/near the QR code.
   - Not a clickable link (TV interface).

3. **Fallback:** If QR generation fails, show PIN-only view (existing behavior stays usable).

**Technical Notes:**

- Performance: generate QR on PIN receive, not on every render/status tick.
- Bundle impact: do not assume library size in this spec; measure before merging.
- webOS: test QR readability on multiple screen sizes.

---

### 1.2 Improved PIN Display ✅ APPROVED

**Constraint:** Use existing `--font-family-sans` only (no additional fonts for performance).

**Target UI:**

```
PIN Characters:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│           ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │
│           │        │  │        │  │        │  │        │    │
│           │   A    │  │   B    │  │   C    │  │   D    │    │
│           │        │  │        │  │        │  │        │    │
│           └────────┘  └────────┘  └────────┘  └────────┘    │
│                                                              │
│              Individual character boxes                      │
│              64px wide × 72px tall                           │
│              12px gap between boxes                          │
│              40px font-size, 700 weight                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**CSS Specification:**

```css
.auth-pin-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 24px 0;
}

.auth-pin-character {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 72px;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  font-family: var(--font-family-sans);
  font-size: 40px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-transform: uppercase;
}
```

**UX Behavior:**

- Each character rendered in its own distinct box (do not assume fixed length; render `code.length`).
- Optional subtle fade-in when PIN arrives.
- Keep an `aria-live="polite"` announcement that reads the full code once when it changes (avoid per-tick announcements).

---

### 1.3 Countdown Timer (Expiration) ✅ APPROVED

**Current State (repo):** `.screen-detail` shows elapsed polling time.

**Correction:** do not hardcode “15 minutes / 900 seconds”. Use `PlexPinRequest.expiresAt` as the source of truth.

**Target UI:**

```
Countdown Display:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    Expires in 04:32                          │
│                           │                                  │
│                           └── mm:ss format                   │
│                                                              │
│   When < 2 minutes remaining:                                │
│                    Expires in 1:45                           │
│                           └── var(--color-warning)           │
│                                                              │
│   When expired:                                              │
│                    Code expired                              │
│                    [ Get New Code ]                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**UX Behavior:**

1. **Timer Calculation:**
   - `remainingMs = pin.expiresAt.getTime() - Date.now()`
   - Clamp at `0`.
   - Update every second.

2. **Visual States:**

   | Remaining Time | Text Color | Text |
   |----------------|------------|------|
   | > 2 minutes | `--color-text-secondary` | “Expires in MM:SS” |
   | ≤ 2 minutes | `--color-warning` | “Expires in MM:SS” |
   | ≤ 0 | `--color-error` | “Code expired” |

3. **On Expiration:**
   - Stop polling.
   - Show “Code expired”.
   - Provide a single primary action to request a new PIN (“Get New Code” can reuse the existing “Request PIN” path).

**Technical Notes:**

- Store `expiresAt` when the PIN is received (already part of `PlexPinRequest`).
- Clear timers on `hide()` and when requesting a new PIN.

---

### 1.4 Improved Error States ✅ APPROVED

**Requirement:** display errors in a user-friendly, action-oriented way.

**Target UI:**

```
Error Display (inline, non-modal):
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌────────────────────────────────────────────────────┐     │
│   │  [!]  Unable to reach Plex                          │     │
│   │       Check your internet connection and try again. │     │
│   │                                                     │     │
│   │                     [ Retry ]                       │     │
│   └────────────────────────────────────────────────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Styling (pattern; no emoji icons):**
- Background: warning/error tint
- Border: subtle, color-matched
- Border-radius: 12px
- Padding: 16px 20px
- Title: 18px, semibold
- Message: 16px, secondary color

**Error Messages by Type:**

| Error Condition | Title | Description |
|-----------------|-------|-------------|
| Network unreachable | “Unable to reach Plex” | “Check your internet connection and try again.” |
| PIN request failed | “Couldn't get a linking code” | “Plex services may be temporarily unavailable.” |
| Timeout | “Connection timed out” | “Please check your network and try again.” |

**UX Behavior:**

- Error box appears in the content area (not modal).
- Retry becomes the primary focusable action when present (AuthScreen already has a retry button pattern).
- Error clears automatically when retry is initiated.

---

## 2. Profile Select Screen Enhancements

**Implementation location:** `src/modules/ui/profile-select/ProfileSelectScreen.ts` + `src/modules/ui/profile-select/styles.css`

### 2.1 On-Screen Numpad for PIN Entry ✅ CRITICAL

**Current State (repo):** PIN modal relies on physical number keys; many remotes lack a numpad.

**Target UI:**

```
PIN Entry Modal with Numpad:
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │                    Enter PIN for John                            │     │
│   │                       ● ● ○ ○                                    │     │
│   │                                                                    │     │
│   │              ┌─────────┬─────────┬─────────┐                      │     │
│   │              │    1    │    2    │    3    │                      │     │
│   │              ├─────────┼─────────┼─────────┤                      │     │
│   │              │    4    │    5    │    6    │                      │     │
│   │              ├─────────┼─────────┼─────────┤                      │     │
│   │              │    7    │    8    │    9    │                      │     │
│   │              ├─────────┼─────────┼─────────┤                      │     │
│   │              │    ⌫    │    0    │    ✓    │                      │     │
│   │              └─────────┴─────────┴─────────┘                      │     │
│   │                                                                    │     │
│   │                        [ Cancel ]                                  │     │
│   └──────────────────────────────────────────────────────────────────┘     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Numpad Button Styling:**

```css
.profile-numpad {
  display: grid;
  grid-template-columns: repeat(3, 80px);
  grid-template-rows: repeat(4, 64px);
  gap: 10px;
  justify-content: center;
  margin: 20px 0;
}

.profile-numpad-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  font-size: 28px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.profile-numpad-button.focused,
.profile-numpad-button:focus {
  outline: var(--focus-ring-width) solid var(--focus-color);
  outline-offset: var(--focus-ring-offset);
  background: rgba(255, 255, 255, 0.12);
}
```

**UX Behavior:**

1. **Navigation:**
   - D-pad navigation: Up/Down/Left/Right moves between buttons.
   - Initial focus: “5”.
   - Wrap horizontally within rows.
   - Down from bottom row → Cancel.

2. **Input Handling:**
   - OK/Enter on focused button enters digit / backspace.
   - Physical number keys still work (existing behavior stays).
   - When `PIN_LENGTH` digits entered → auto-submit (existing).

3. **Modal Focus Trap (required):**
   - Use `nav.openModal(PIN_MODAL_ID, focusableIds)` including all numpad keys + cancel to trap focus.

4. **Accessibility:**
   - `aria-label` on each key (“Digit 1”, …, “Backspace”, “Submit”).

---

### 2.2 Visual Feedback on PIN Entry ✅ APPROVED

**Target UI Animation:**

```
PIN Dot Animation:
┌──────────────────────────────────────────────────────────────┐
│ Empty state:      ○ ○ ○ ○                                    │
│ On digit entry:   ● → ● ○ ○  (pop 150ms)                     │
│ Error shake:      ● ● ● ●    (shake 300ms, then clear)       │
└──────────────────────────────────────────────────────────────┘
```

**CSS Animation:**

```css
@keyframes pin-dot-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes pin-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
```

**UX Behavior:**

- Pop the newest filled dot.
- On wrong PIN, shake the dot row and clear.
- Respect `prefers-reduced-motion`.

---

### 2.3 Larger Profile Avatars ✅ APPROVED

**Current (repo):** 56×56px (`src/modules/ui/profile-select/styles.css`)
**Target:** 80×80px

**Updated CSS:**

```css
.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  font-size: 28px;
}

.profile-row {
  grid-template-columns: 80px 1fr;
  gap: 16px;
}
```

---

### 2.4 Profile Switching Access ✅ APPROVED

**Current (repo):** Settings already has a switch-profile action (`src/modules/ui/settings/SettingsScreen.ts`).

**Requirement:** add an onboarding-path entry point from Server Select (see §3.4).

---

## 3. Server Select Screen Enhancements

**Implementation location:** `src/modules/ui/server-select/ServerSelectScreen.ts` + `src/modules/ui/server-select/styles.css`

### 3.1 Latency Display ✅ APPROVED

**Current State (repo):** health data includes `latencyMs` but pill text does not show it.

**Target UI:**

```
Server Row with Latency:
┌────────────────────────────────────────────────────────────────────────────┐
│  Plex Media Server                                                         │
│  Owned • Last connected: just now                                          │
│  [ OK • 45ms ]     ← status pill includes latency                          │
│                                                    [ Connect ]             │
└────────────────────────────────────────────────────────────────────────────┘

Latency thresholds:
- < 100ms: OK • XXms
- 100–500ms: Slow • XXms (warning styling)
- > 500ms: Very Slow • XXms (stronger warning)
- No data: OK only
```

**Implementation Notes (align to repo):**
- Update the pill rendering block (where `statusText` is computed) to append latency text.
- Add latency class modifiers in `src/modules/ui/server-select/styles.css` (e.g., `.latency-slow`, `.latency-very-slow`) without removing base `ok/unreachable/auth-required` class.

---

### 3.2 Visual Hierarchy for Active Server ✅ APPROVED

**Current State (repo):** no visual distinction for the saved/active server.

**Target UI:**

```
Active Server Indication:
┌────────────────────────────────────────────────────────────────────────────┐
│  ✓ Plex Media Server                                  [ Connected ]        │
│    Owned • Last connected: just now                                       │
│    [ OK • 12ms ]                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

**CSS (example):**

```css
.server-row.active {
  border-color: var(--color-primary);
  background: rgba(0, 168, 225, 0.08);
}

.server-row.active .server-name::before {
  content: '✓ ';
  color: var(--color-success);
}
```

**UX Behavior:**

- Compare server ID with the saved server ID in storage.
- Active row gets `.active`.
- Button label changes from “Connect” to “Connected” (or “Reconnect” if last known status isn’t OK).
- Do not create a focus trap: if “Connected” is disabled, neighbors remain valid.

---

### 3.3 Empty State Improvement ✅ APPROVED

**Current State (repo):** “No servers available.” text only.

**Target UI:**

```
Empty State:
┌────────────────────────────────────────────────────────────┐
│   [server SVG]                                             │
│   No servers found                                         │
│   Ensure your Plex Media Server is running and reachable.   │
│   [ Retry discovery ]                                      │
└────────────────────────────────────────────────────────────┘
```

**CSS (example):**

```css
.server-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 20px;
  gap: 16px;
}
```

---

### 3.4 “Switch Profile” Entry Point ✅ APPROVED

**Requirement:** users can switch profiles from the onboarding path.

**Spec:**
- Add a “Switch Profile” button in the Server Select `.button-row`.
- Update focus neighbors so the button row remains left/right navigable.

---

## Appendix A: Shared UI Foundations (Part 1)

### A.1 Buttons

**Current State (repo):** `.screen-button` already scales with `--onboarding-scale` (`src/styles/shell.css`).

**Spec adjustment:** if button sizing changes are desired, edit the existing `.screen-button` rule in-place; do not introduce a competing global button spec.

### A.2 Loading

**Current State (repo):** `.panel-spinner` exists and is used.

**Spec adjustment:** prefer `.panel-spinner` applied to label elements instead of introducing a separate `.spinner` system for onboarding screens.

### A.3 Error UI

**Spec:** standardize on an inline error box pattern without emoji icons; keep focus and retry actions deterministic.

---

**Next:** Continue with Part 2: `onboarding_ux_implementation_spec_part2.md`

*Updated: 2026-02-05 (reviewed against current repo code; Plex QR auto-fill URL remains unverified).*

