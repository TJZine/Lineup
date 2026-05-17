# Architecture Docs

This folder has a stable split between current truth, active reference, and backlog direction.

> [!NOTE]
> If you only need the current architecture truth, start with [`CURRENT_STATE.md`](./CURRENT_STATE.md). The rest of this folder provides supporting reference and cleanup context.

## Read In This Order

| Order | Document | Purpose |
| --- | --- | --- |
| 1 | [`CURRENT_STATE.md`](./CURRENT_STATE.md) | Canonical and current architecture truth |
| 2 | [`modules.md`](./modules.md) | Current module inventory and ownership reference |
| 3 | [`file-shape-guardrails.md`](./file-shape-guardrails.md) | Production file-size baseline and growth guardrail |
| 4 | [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md) | Active backlog, priority queue, and cleanup direction |
| 5 | [`p13-post-p12-subjective-backlog-package-map.json`](./p13-post-p12-subjective-backlog-package-map.json) | Exact package-membership companion for the active cleanup checklist |

## Notes

- If this folder disagrees with [`CURRENT_STATE.md`](./CURRENT_STATE.md), update the stale doc.
- Production file-shape exceptions live in [`file-shape-guardrails.md`](./file-shape-guardrails.md) and are checked by `npm run verify:maintainability`.
- UI composition rules live in [`docs/design/ui-design-language.md`](../design/ui-design-language.md).
- Plex integration contract details live in [`docs/api/plex-integration.md`](../api/plex-integration.md).
