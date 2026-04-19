# CSS Governance

This doc owns the repo-wide CSS decision process, reuse and exception policy, and documentation routing.

It describes preferred decision-making for ongoing work. It does not imply the repo is already fully aligned with every guideline below.

## Authority Boundary

- [`ui-design-language.md`](./ui-design-language.md) owns target visual outcomes for TV overlay and panel surfaces.
- Record visual pattern changes in [`ui-design-language.md`](./ui-design-language.md).
- Record repo-wide CSS decision rules here.
- Surface-local exceptions belong with the owning surface doc or in local comments when that is the clearest durable record.

## Decision Order

Prefer tokens first for typography, spacing, radius, color, and overlay z-index when the mapping is clear and shared.

The shared overlay-stack contract lives in `src/styles/tokens.css` through `--z-base`, `--z-dropdown`, `--z-modal`, `--z-overlay`, `--z-toast`, and `--z-max`. Reusing that scale locks relative ordering; it is not permission to widen a bounded package into repo-wide z-index migration.

If no token fits, choose the smallest reasonable option for the work in front of you:

1. Reuse an existing surface pattern or documented custom property.
2. Keep a bounded local exception.
3. Record a candidate for a new reusable token when the value looks shared but the repo is not ready to add it yet.

Current shared style contracts that later packages may depend on:

- `--radius-compact: 10px` is the intentional compact radius for smaller overlay badges, hints, and similar bounded surfaces.
- `--color-text-on-focus` is the shared default text color for bright focused fills.
- Theme-specific focus-text tokens may remain only as aliases or overrides beneath `--color-text-on-focus`; they should not create a competing cross-surface contract.

Literals are not automatically wrong. A raw value can be valid when the semantics are local, geometry-driven, platform-constrained, intentionally theme-invariant, or otherwise clearer than forcing a weak token mapping.

## Theme Participation

Reusable and runtime surfaces should usually use theme-owned tokens or documented surface-scoped custom properties for values expected to vary by theme.

Hardcoded literals are acceptable when they are intentionally theme-invariant, geometry-driven, platform-constrained, or a documented product distinction.

If a surface opts out of normal theme participation, document the surface as theme-immune or product-distinct and include a short rationale near the owning doc or local exception.

Do not add explicit override blocks for every theme when inherited tokens already satisfy the surface.

## File Structure And Diff Scope

For complex or runtime surfaces, prefer the barrel plus `core` / `motion` / `theme` split when practical. This keeps visual structure, animation concerns, and theme participation easier to review without forcing every small surface into extra files.

Treat low churn as a diff-scope rule, not a permanent exemption:

- Do not widen a bounded change purely for cleanup.
- Do not use small file size or low churn to justify introducing new repeated literals.
- Do not skip obvious consolidation when the same edit already touches multiple call sites in scope.

## Repeated Raw Values

If a raw value is introduced or edited across multiple surfaces in the same work, or it clearly expresses a reusable semantic concept, record it as a candidate in the most relevant doc, issue, or PR note.

Recording a candidate does not imply a mandatory migration in the same pass.

## Accessibility Expectations

CSS decisions should preserve contrast, focus visibility, reduced-motion behavior, and forced-colors usability.

Some accessibility requirements require verification in running surfaces and are not proven by prose alone. Document intent in docs, then verify in the relevant UI work.

## STYLE_AUDIT.md

[`STYLE_AUDIT.md`](../../STYLE_AUDIT.md) is optional triage and reference material for planned cleanup or broader surface work.

It is not a prerequisite for small edits, not an approval gate, and not a mandate to widen scope.

## Phase Boundary

This pass is documentation only. It does not change current lint, verify, CI, token, or enforcement behavior.

Future enforcement hooks may be added later if the repo decides to operationalize parts of this guidance, but nothing in this doc changes current behavior today.
