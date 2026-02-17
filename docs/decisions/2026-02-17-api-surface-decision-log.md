# 2026-02-17: Post-cleanup API surface decision log

## Context

Post-cleanup review identified several symbols that moved from exported/public usage toward internal-only usage. This task requires an explicit policy decision and evidence check before re-exporting anything.

## Decision

- Adopt **internal-only policy** for this pre-MVP phase.
- Do **not** restore exports unless a project lead explicitly requests library-compat behavior.
- Treat the following as implementation details unless future external consumers are introduced:
  - `TIME_UPDATE_INTERVAL_MS`
  - `PROTOCOL_MIME_TYPES`
  - `RETRY_CONFIG`
  - `RETRYABLE_ERROR_CODES`
  - `WEBOS_CLIENT_PROFILE_PARTS`
  - `handleResponseStatus(...)`
  - `createNetworkError(...)`
  - `parseLibrarySection(...)`

## Evidence

- Symbol usage sweep in `src` only shows local/internal references and definitions:
  - `src/modules/plex/library/ResponseParser.ts`
  - `src/modules/plex/auth/helpers.ts`
- No unresolved import breakage was found during this sweep.

## Consequences

- No code export changes are required in this remediation pass.
- If external usage is requested later, re-export only the minimum set with targeted tests and a documented compatibility rationale.
