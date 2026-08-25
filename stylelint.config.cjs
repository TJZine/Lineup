/** @type {import('stylelint').Config} */
module.exports = {
    extends: ['stylelint-config-standard'],
    rules: {
        // webOS 6.0+ runtime: avoid forcing modern-only syntax migrations.
        // This repo intentionally uses progressive enhancement in theme variables (legacy rgba() then modern rgb(... / ...)).
        'color-function-alias-notation': null,
        'color-function-notation': null,
        'alpha-value-notation': null,
        'media-feature-range-notation': 'prefix',

        // Match existing codebase conventions and avoid lint churn on rollout.
        'selector-class-pattern': null, // allow BEM-like modifiers (e.g. --neutral)
        'custom-property-pattern': null, // allow private-ish vars like --_focus-inset
        'custom-property-empty-line-before': null,
        'rule-empty-line-before': null,
        'comment-empty-line-before': null,
        'color-hex-length': null,
        'shorthand-property-no-redundant-values': null,
        'declaration-block-no-redundant-longhand-properties': null,
        'declaration-block-no-duplicate-custom-properties': null,
        'declaration-empty-line-before': null,
        'selector-not-notation': 'simple',
        'import-notation': null,

        // Keep initial rollout low-friction; tighten later once the rule budget is stable.
        'no-descending-specificity': null,

        // Allow targeted WebKit enhancement for webOS while keeping the rule on elsewhere.
        'property-no-vendor-prefix': [true, { ignoreProperties: ['/^(-webkit-)?backdrop-filter$/i'] }],
        'property-no-deprecated': [true, { ignoreProperties: ['clip', '-webkit-box-orient'] }],
    },
    ignoreFiles: ['dist/**', 'dist-ts/**', 'coverage/**', 'node_modules/**'],
};
