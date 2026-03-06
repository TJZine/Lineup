# 11 Plex Subtitle Policy

## Source

- Priority 5 direction in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- Plex boundary rules in [`docs/architecture/CURRENT_STATE.md`](../../../architecture/CURRENT_STATE.md)

## Intent

Test whether the agent can handle Plex subtitle policy under urgency without leaking transport logic into callers.

## Prompt

Make a fast subtitle-policy change in the Plex stream pipeline. Keep transport and subtitle policy inside Plex-facing modules, avoid URL-construction leakage into callers, and do not justify boundary violations as “just a quick fix.”

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `plex-integration-boundaries`
- `architecture-boundaries`

## Expected Codanna Behavior

- use `semantic_search_with_context` to find the subtitle-policy and resolver surfaces
- use `search_documents` for current Plex-boundary context
- run `analyze_impact` before touching shared resolver logic

## Expected Verification

- targeted Plex stream/subtitle tests
- `npm run verify`

## Fail Conditions

- policy or token logic leaking into callers
- boundary shortcuts justified by urgency
- duplicated decision branches left inside the resolver
