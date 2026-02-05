# 2026-02-05: Onboarding spec review — source-of-truth notes

## Context

While reviewing `onboarding_ux_implementation_spec.md` and splitting it into Part 1/2, we needed to validate a few implementation-critical assumptions (Plex PIN expiry timing and QR payload URL shape).

## Decision

- Treat `PlexPinRequest.expiresAt` (repo-local type) as the **canonical** expiry source for UI countdowns.
- Do **not** encode an “auto-fill PIN” URL in the QR payload until it is verified with a live Plex flow; default QR payload is `https://plex.tv/link`.

## Evidence

- Repo-local auth types indicate PIN expiry is modeled as a timestamp (`expiresAt`) and described as “typically 5 minutes”:
  - `src/modules/plex/auth/interfaces.ts`
  - `src/modules/plex/auth/constants.ts` (`PIN_TIMEOUT_MS = 300000`)
- Context7 lookup for `/websites/developer_plex_tv_pms` did not surface documentation about the PIN linking UX (`plex.tv/link`) or query-parameter-based auto-fill.

## Consequences

- UI countdown logic should be robust to server-provided expiries and avoid hardcoding minutes.
- QR rendering can ship immediately as a “link QR” without risking a broken deep link; upgrading QR payload later is a safe incremental change.

