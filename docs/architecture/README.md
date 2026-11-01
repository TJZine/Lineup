# Architecture Docs

This folder contains current ownership references and historical cleanup evidence.

> [!NOTE]
> If you only need the current architecture truth, start with [`CURRENT_STATE.md`](./CURRENT_STATE.md). The rest of this folder provides supporting reference and cleanup context.

## Read For The Task

| Task | Document | Purpose |
| --- | --- | --- |
| Ownership or runtime flow | [`CURRENT_STATE.md`](./CURRENT_STATE.md) | Canonical current architecture; read affected sections |
| Supporting module detail | [`modules.md`](./modules.md) | Module inventory and ownership reference |
| File-size evidence | [`file-shape-guardrails.md`](./file-shape-guardrails.md) | Advisory diagnostics; workflow owns review policy |
| Explicit checklist-linked work | [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md) | Current admission/status; no cleanup package is active |

The `*package-map.json` files are historical membership/provenance snapshots,
including the file named `active-cleanup-package-map.json`. They do not authorize
work, require package plans/reviews, or describe a current queue. Read them only
when a current question needs that history.

## Notes

- If this folder disagrees with [`CURRENT_STATE.md`](./CURRENT_STATE.md), update the stale doc.
- Production file-size attention policy lives in [`file-shape-guardrails.md`](./file-shape-guardrails.md); `npm run verify:maintainability` reports evidence without forcing decomposition.
- UI composition rules live in [`docs/design/ui-design-language.md`](../design/ui-design-language.md).
- Plex integration contract details live in [`docs/api/plex-integration.md`](../api/plex-integration.md).
