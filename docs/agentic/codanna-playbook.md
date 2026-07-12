# Codanna Playbook

Optional Lineup guidance for semantic discovery and impact analysis. Codanna is a
tool choice, not a workflow gate; use the smallest reliable discovery method for the
question.

## Choose The Tool

- Exact symbol, path, literal, CSS class, config key, or known owner: start with
  `rg`, language tooling, and direct reads.
- Unknown owner or concept spread across modules: use
  `semantic_search_with_context` when Codanna is available.
- Shared/public symbol with uncertain callers: use `analyze_impact`, `find_symbol`,
  `get_calls`, or `find_callers` when available, then confirm important callers in
  source.
- Architecture, cleanup, or plan history: use `search_documents` when it is likely
  to return a smaller useful set than direct document search.

Do not delay implementation merely to prove Codanna was attempted. Evidence quality
matters; tool order does not.

## Query Shape

Use a concrete anchor such as a feature, screen, module, file-like hint, or symbol.
Prefer short noun phrases:

- `SettingsScreen transcode quality storage`
- `AppOrchestrator overlay runtime controller`
- `Plex subtitle delivery policy`
- `ChannelPersistenceStore serialization`

Use `lang:"typescript"` when semantic results are noisy. Start broad enough to find
the likely owner, then narrow to the exact symbol or call path.

## Reliability Bound

Treat semantic results as discovery evidence, not proof. Confirm affected public
callers, contracts, and tests in current source.

If an expected symbol is missing or results are implausibly weak:

1. Run `get_index_info` once when available.
2. Retry once with a clearer anchor if that is likely to help.
3. Fall back to `rg`, language tooling, and direct reads.

Do not build task notes around query counts or index metadata unless a risky decision
actually depends on the semantic result. If the index predates relevant working-tree
changes or covers implausibly few files, prefer deterministic source discovery.

## Lineup Heuristics

- Architecture: begin at `App`, `AppOrchestrator`, the current composition owner, or
  the owner named by `docs/architecture/CURRENT_STATE.md`.
- UI: trace the screen/overlay, focus owner, timers/listeners, and shared primitive.
- Persistence: find the store/repository and every key/API caller before editing.
- Plex: start inside the relevant auth, discovery, library, stream, or subtitle owner;
  keep transport and policy out of UI/orchestration callers.
- Checklist work: search the exact item only after the task is confirmed as
  checklist-linked.

## Local Reliability Note

`.codanna/settings.toml` keeps `documents.search.highlight = false` because Codanna
`0.9.14` can fail while building highlighted previews for some overlapping multiword
matches. Re-enable it only after verifying the upstream behavior is fixed.

## References

- [Codanna repository](https://github.com/bartolli/codanna)
- [Lineup workflow](../AGENTIC_DEV_WORKFLOW.md)
- [Lineup agent entrypoint](../../AGENTS.md)
