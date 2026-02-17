# Observability Contract (2026-02-17)

This contract defines the minimum production-safe telemetry required for post-change risk remediation.

## Required Event Families

1. Stream decision changes.
Required fields: `itemKey` (redacted-safe identifier), `decision` (`direct_play|transcode`), `reasonCode` (bounded enum/string).
2. Subtitle burn-in recovery lifecycle.
Required fields: `outcome` (`started|aborted|failed|recovered`), `reasonCode`, `safeError` when failed.
3. Discovery fallback selection.
Required fields: `serverId`, `fallbackType` (`http_last_resort|none`), `local`, `relay`.
4. Orchestrator teardown failures during shutdown.
Required fields: `phase`, `moduleId` (if known), `safeError`.

## Forbidden Fields (Never Log)

- `X-Plex-Token`
- tokenized URLs (full raw URL/query string that includes auth token)
- authorization headers
- credential blobs / raw auth payloads

## Redaction Requirements

- Errors must be summarized using shared safe formatter helpers.
- String payloads (especially URLs) must be redacted before logging.

```ts
// Errors: summarize (and redact) structurally
const safeError = summarizeErrorForLog(error);

// URLs/strings: redact tokens in string form
const safeUrl = redactSensitiveTokens(url.toString());
```

## Payload Discipline

- Keep payloads bounded and reason-focused; avoid verbose dumps.
- Prefer one warning per failure path over repeated per-item spam.
- Debug-only logs must remain gated behind explicit debug checks.
