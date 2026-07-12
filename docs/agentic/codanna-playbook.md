# Codanna Playbook

> Established 2026-03-05. This is the Lineup-specific Codanna usage guide for agent discovery and change impact analysis.

## Goal

Use Codanna as the default code-intelligence layer so agent work starts with precise context instead of grep-and-hope loops.

This follows the Codanna project’s own positioning of semantic search, symbol tracing, and impact analysis as a context-first workflow, and matches Lineup’s existing Codanna-first policy.

## Default Tool Order

1. `semantic_search_with_context`
2. `analyze_impact`
3. `find_symbol`, `get_calls`, `find_callers`
4. `search_symbols`, `semantic_search_docs`, `search_documents`
5. `ripgrep` only when Codanna is unavailable or insufficient

## Query Shaping Rules

- Include one concrete anchor in every query:
  - feature name
  - screen/module name
  - file-ish hint
  - identifier
- Use `lang:"typescript"` when noise is high.
- Start broad enough to find the owner, then narrow with symbols and impact analysis.

Examples:

- `SettingsScreen transcode quality local storage`
- `AppOrchestrator overlay runtime controller`
- `Plex subtitle delivery transcode policy`
- `ChannelPersistenceStore selected channel serialization`

## Change Workflow

### 1. Discovery

Use `semantic_search_with_context` to find the likely owner and surrounding call chain.

Capture:

- key symbol names
- `symbol_id` values where available
- likely impacted files
- relevant document hits from `search_documents` when the task depends on repo docs or cleanup context

### 2. Impact Analysis

Before touching shared/public code, run `analyze_impact` on the main symbol.

Treat this as an impact gate for risky/shared edits and carry the snapshot into the plan or task notes.

Use this to answer:

- what calls this
- what types depend on this
- what render/composition relationships exist

### 3. Disambiguation

Use `find_symbol`, `get_calls`, and `find_callers` when:

- multiple symbols match
- the semantic search result is noisy
- you need the exact call path

### 4. Plan

Carry the impacted symbols/files into `update_plan` and the relevant `docs/plans/*` file.

When the task is guided by repo docs, also carry forward the key `search_documents` result(s) that shaped the plan.

### 5. Verification

Before finishing:

- cross-check Codanna’s impacted files against the actual diff
- ensure tests cover the high-risk scopes Codanna surfaced

## Fallback To `rg`

Use `rg` when:

- Codanna has no useful semantic result
- you need raw text/config search
- you are searching generated names, literals, CSS classes, or comments

When you fall back, note that you did so.

## Index Freshness Gate

If expected symbols are missing from `find_symbol`/`search_symbols` or semantic hits are unexpectedly weak, treat it as a possible stale Codanna index before assuming the symbol is absent.

Treat results as "unexpectedly weak" when any of these hold:

- `find_symbol` / `search_symbols` returns 0 results for an identifier you strongly expect to exist.
- `semantic_search_with_context` returns fewer than 3 results for a query that includes a concrete anchor (see Query Shaping Rules).
- the semantic top hit score is below ~0.5 (0.3-0.5 is often weak/noisy) *and* the anchor is specific.

Index freshness gate workflow:

1. Run `get_index_info` and capture the snapshot in task notes.
2. Retry with one broader and one narrower query anchor (use the Query Shaping Rules).
3. If results are still insufficient, log the Codanna insufficiency and fall back to `rg` with explicit evidence paths.

Concrete broader/narrower anchor example:

- Broad: `SettingsScreen state management`
- Narrow: `SettingsScreenStateController focus restore`

Explicit evidence paths means logging (in the task notes or plan):

- query string(s)
- tool used (e.g., `semantic_search_with_context`, `find_symbol`)
- result count
- top hit file paths (1-3)
- the `get_index_info` snapshot

Interpreting `get_index_info` snapshots (what to look at):

- index "Updated" time: if it is older than your current working session and you're searching for recently changed code, treat results as suspect
- indexed file count: if it looks implausibly low for the repo, prefer `rg` for determinism
- semantic search status/model/embedding count: confirms whether semantic search is actually available in this environment

If you do not have a supported way to refresh the index in your environment, treat `rg` as the deterministic fallback once the gate triggers and you have preserved the evidence above.

## Document Search

Use `search_documents` when:

- planning against [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- checking [`docs/architecture/CURRENT_STATE.md`](../architecture/CURRENT_STATE.md) or architecture reference docs
- looking for prior decisions in [`docs/decisions/`](../decisions)
- reviewing task memory in `docs/plans/*`

This keeps repo docs as queryable context instead of relying on memory or manual browsing alone.

Document-search reliability notes for this repo:

- Prefer short anchored noun phrases over sentence-like prompts.
- Good: `CURRENT_STATE persistence owner map P3-W5`
- Avoid: `refresh CURRENT_STATE and adjacent docs so the persistence-owner list is accurate and complete`
- If `search_documents` stalls, times out, or returns obviously noisy hits, retry once with a narrower anchor and once with a broader anchor before falling back.
- For deterministic fallback, use `rg` plus direct reads and record that `search_documents` was insufficient in the task notes/plan.
- Repo-local mitigation: `.codanna/settings.toml` keeps `documents.search.highlight = false` because Codanna `0.9.14` can panic while building highlighted previews for some overlapping multi-word matches. Re-enable only after the upstream preview/highlighting bug is fixed.

## Lineup-Specific Heuristics

- Architecture work:
  - start with `AppOrchestrator`, `App`, `InitializationCoordinator`, or the relevant boundary store/controller
- UI work:
  - find the screen/overlay plus its focus coordinator and shared primitives
- Persistence work:
  - find the store/repository first, not the screen/controller caller
- Plex work:
  - trace from the relevant Plex module and keep policy leakage out of callers
- Doc-backed work:
  - search the relevant docs collection first, then trace the code symbols the docs point to

## Automation Note

For future scripted/automated Codanna workflows, prefer structured outputs and tool chaining over ad-hoc text scraping so follow-up calls stay deterministic.

## References

- Codanna repo: [bartolli/codanna](https://github.com/bartolli/codanna)
- Repo workflow: [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md)
- Stable policy: [`AGENTS.md`](../../AGENTS.md)
