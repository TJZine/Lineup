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

When cleanup work aims to preserve visuals exactly, use this stricter order:

1. Reuse an existing token with the exact same rendered value and semantics.
2. Reuse or introduce a surface-scoped custom property with the exact same rendered value.
3. Keep the raw literal as a bounded exception.

Do not treat a cleanup pass as permission to snap values, normalize by approximation, or canonize a competing visual treatment. Any change that alters a rendered value, theme participation, or relative stacking meaning is design-contract work, not exact-value cleanup.

Current shared style contracts that later packages may depend on:

- `--radius-compact: 10px` is the intentional compact radius for smaller overlay badges, hints, and similar bounded surfaces.
- `--color-text-on-focus` is the shared default text color for bright focused fills.
- Theme-specific focus-text tokens may remain only as aliases or overrides beneath `--color-text-on-focus`; they should not create a competing cross-surface contract.

Literals are not automatically wrong. A raw value can be valid when the semantics are local, geometry-driven, platform-constrained, intentionally theme-invariant, or otherwise clearer than forcing a weak token mapping.

## Shared Tokens Vs Local Properties

Promote a value into a root token only when all of the following are true:

- the token expresses a durable semantic, not a current audit residue
- it is reused or expected to be reused across independently owned surfaces
- the semantic should remain stable even if one current caller disappears
- a local property would create worse duplication or weaker ownership clarity

Prefer surface-scoped custom properties when the value is:

- local to one feature or owner surface such as EPG, onboarding, or a single theme
- repeated within that owner but not strong enough for a repo-wide contract
- tied to a product-distinct palette or a bounded local visual treatment

Do not add root tokens just because an audit found repeated literals. Repetition is a signal to evaluate ownership, not an automatic promotion rule.

## Cleanup Categories

Treat style debt work as one of these categories and verify it accordingly:

- Exact-value normalization: replace raw literals with existing tokens or exact-value local properties only. This is the default cleanup path.
- Local deduplication: extract repeated owner-local values into surface-scoped properties without changing rendered output.
- Design-contract change: add new root tokens, redefine shared layer semantics, canonize competing palettes, or change rendered values. This requires explicit design approval and manual visual verification.

Do not mix exact-value normalization and design-contract changes under one "no visual change" claim.

For cleanup accounting, a value is considered retired when it has been moved to the narrowest correct abstraction:

- a shared/root token when the contract is truly cross-surface
- a surface-scoped custom property when the value is owner-local
- an explicit bounded exception when a raw literal is still the clearest durable choice

## Overlay Z-Index Policy

Shared z-index tokens should represent durable layer semantics, not the current component inventory.

- Good shared tokens describe layers such as base, modal, shared overlay, and toast.
- Component-specific aliases belong at the owning surface only when that local alias materially improves readability.
- If the repo does not yet have a stable semantic layer model for a set of overlays, keep the literals or local aliases and defer the root-token expansion until the layer contract is explicit.

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

## Historical Style Cleanup Artifacts

The 2026-04-18 style cleanup intake surfaces are retired as live cleanup
control-plane inputs. `STYLE_AUDIT.md` and `STYLE_CLEANUP_CHECKLIST.md` are not
present in the current workspace, and no current cleanup pass should depend on
them as required reading, approval gates, or package membership truth.

The retained
[`active-style-cleanup-package-map.json`](./active-style-cleanup-package-map.json)
is itself marked retired and exists only as historical context when reconciling
old style-cleanup references;
new style work should source current evidence from the owning CSS, UI, and
design-governance docs instead of reactivating that intake surface.

## Phase Boundary

This pass is documentation only. It does not change current lint, verify, CI, token, or enforcement behavior.

Future enforcement hooks may be added later if the repo decides to operationalize parts of this guidance, but nothing in this doc changes current behavior today.
