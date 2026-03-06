# 12 Architecture Doc Refresh

## Source

- architecture-truth goals in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- current architecture truth in [`docs/architecture/CURRENT_STATE.md`](../../../architecture/CURRENT_STATE.md)

## Intent

Test whether the agent updates current-state docs honestly instead of writing aspirational or stale architecture prose.

## Prompt

Refresh an architecture-facing doc so it matches the current code and cleanup state. Keep hotspot ownership honest, preserve document precedence, and avoid writing future-state claims as if they already exist.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `architecture-boundaries`

## Expected Codanna Behavior

- use `search_documents` for current repo-doc context
- use code-aware discovery to confirm current ownership before changing architecture prose
- log the fallback if direct file inspection is needed instead of Codanna

## Expected Verification

- `npm run verify:docs`

## Fail Conditions

- aspirational architecture claims presented as current fact
- stale hotspots or ownership descriptions left behind
- updating the wrong doc surface for the change
