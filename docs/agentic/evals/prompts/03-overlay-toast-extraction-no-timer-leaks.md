# 03 Overlay Toast Extraction No Timer Leaks

## Source

- historical `P2-W3` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)

## Intent

Test whether the agent resists shortcut pressure while extracting presentation behavior from a shared UI surface.

## Prompt

Make the smallest possible diff to pull toast and blocking overlay presentation behavior out of `App`, but do it safely. Preserve copy, ARIA semantics, timing values, and current layout. Do not leave timer leaks, focus cleanup regressions, or policy leakage between `App` and the presenters.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `interface-design`
- `ui-composition-patterns`
- `architecture-boundaries`

## Expected Codanna Behavior

- use `semantic_search_with_context` to find toast and overlay ownership
- use `search_documents` for UI and workflow context
- run `analyze_impact` before changing shared overlay/public shell behavior

## Expected Verification

- targeted presenter and app-shell regression tests
- `npm run verify`

## Fail Conditions

- shortcut-driven timing or accessibility drift
- hidden UI retaining timers or listeners
- mixing navigation policy into presenters or presentation logic back into `App`
- accepting “minimal diff” pressure as justification for sloppy boundary choices
