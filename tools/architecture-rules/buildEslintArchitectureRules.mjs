const APP_ROOT_RESTRICTION_MESSAGE =
    'App.ts is a composition root. Route feature wiring through approved app-shell seams.';

const STORAGE_RESTRICTION_MESSAGE =
    'Direct storage global access is restricted. Use src/utils/storage.ts or an approved storage owner.';

const RUNTIME_UI_RESTRICTION_MESSAGE =
    'Non-UI runtime modules cannot import src/modules/ui/* directly in first-pass architecture boundaries.';

const ROOT_IMPORT_RESTRICTION_MESSAGE =
    'Non-composition-root modules cannot import src/App.ts or src/Orchestrator.ts.';

function collectExceptionToPaths(rules, ruleName, fromPath) {
    return rules.temporaryExceptions
        .filter((exception) => exception.rule === ruleName && exception.from === fromPath)
        .map((exception) => exception.to);
}

function escapeRegexLiteral(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegexSource(alternatives) {
    return `^(?:${alternatives.join('|')})$`;
}

function buildRegexSourceWithExcludedLiterals(alternatives, excludedLiterals) {
    if (excludedLiterals.length === 0) {
        return buildRegexSource(alternatives);
    }
    const excluded = excludedLiterals.map(escapeRegexLiteral).join('|');
    return `^(?!(?:${excluded})$)(?:${alternatives.join('|')})$`;
}

export function buildEslintArchitectureRules(rules) {
    const runtimeUiExceptionFiles = Array.from(
        new Set(
            rules.temporaryExceptions
                .filter((exception) => exception.rule === 'runtime-ui-boundary')
                .map((exception) => exception.from)
        )
    );

    const compositionRootExceptionFiles = Array.from(
        new Set(
            rules.temporaryExceptions
                .filter((exception) => exception.rule === 'composition-root-access-boundary')
                .map((exception) => exception.from)
        )
    );

    const storageAllowedFiles = Array.from(new Set(rules.storageOwnership.allowedFiles));
    const compositionRootFiles = Array.from(new Set(rules.compositionRoots.files));
    const allowedRootImporters = Array.from(
        new Set([...compositionRootFiles, ...rules.compositionRootAccessBoundary.allowedImporters])
    );

    const config = [
        {
            files: ['src/App.ts'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: rules.compositionRoots.appRestrictedImportPatterns,
                                message: APP_ROOT_RESTRICTION_MESSAGE,
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ['src/**/*.ts', 'src/**/*.tsx'],
            ignores: ['src/**/__tests__/**', ...storageAllowedFiles],
            rules: {
                'no-restricted-globals': [
                    'error',
                    ...rules.storageOwnership.restrictedGlobals.map((name) => ({
                        name,
                        message: STORAGE_RESTRICTION_MESSAGE,
                    })),
                ],
                'no-restricted-properties': [
                    'error',
                    {
                        object: 'window',
                        property: 'localStorage',
                        message: STORAGE_RESTRICTION_MESSAGE,
                    },
                    {
                        object: 'window',
                        property: 'sessionStorage',
                        message: STORAGE_RESTRICTION_MESSAGE,
                    },
                    {
                        object: 'globalThis',
                        property: 'localStorage',
                        message: STORAGE_RESTRICTION_MESSAGE,
                    },
                    {
                        object: 'globalThis',
                        property: 'sessionStorage',
                        message: STORAGE_RESTRICTION_MESSAGE,
                    },
                ],
            },
        },
        {
            files: rules.runtimeUiBoundary.nonUiRuntimeModuleGlobs,
            ignores: ['src/**/__tests__/**', ...runtimeUiExceptionFiles],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: rules.runtimeUiBoundary.forbiddenUiImportPatterns,
                                message: RUNTIME_UI_RESTRICTION_MESSAGE,
                            },
                        ],
                    },
                ],
            },
        },
        ...runtimeUiExceptionFiles.map((fromPath) => ({
            files: [fromPath],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: [
                                    ...rules.runtimeUiBoundary.forbiddenUiImportPatterns,
                                    ...collectExceptionToPaths(
                                        rules,
                                        'runtime-ui-boundary',
                                        fromPath
                                    ).map((allowedPath) => `!${allowedPath}`),
                                ],
                                message: RUNTIME_UI_RESTRICTION_MESSAGE,
                            },
                        ],
                    },
                ],
            },
        })),
        {
            files: ['src/**/*.ts', 'src/**/*.tsx'],
            ignores: ['src/**/__tests__/**', ...allowedRootImporters, ...compositionRootExceptionFiles],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                regex: buildRegexSource(
                                    rules.compositionRootAccessBoundary.restrictedImportRegexAlternatives
                                ),
                                message: ROOT_IMPORT_RESTRICTION_MESSAGE,
                            },
                        ],
                    },
                ],
            },
        },
        ...compositionRootExceptionFiles.map((fromPath) => ({
            files: [fromPath],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                regex: buildRegexSourceWithExcludedLiterals(
                                    rules.compositionRootAccessBoundary.restrictedImportRegexAlternatives,
                                    collectExceptionToPaths(
                                        rules,
                                        'composition-root-access-boundary',
                                        fromPath
                                    )
                                ),
                                message: ROOT_IMPORT_RESTRICTION_MESSAGE,
                            },
                        ],
                    },
                ],
            },
        })),
    ];

    return config;
}
