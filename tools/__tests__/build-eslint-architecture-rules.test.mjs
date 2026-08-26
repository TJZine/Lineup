import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ESLint } from 'eslint';

import {
    architectureRuleMessages,
    buildEslintArchitectureRules,
} from '../architecture-rules/buildEslintArchitectureRules.mjs';
import { lineupArchitectureRules } from '../architecture-rules/lineupArchitectureRules.mjs';

function getAppRestrictionGroup() {
    const config = buildEslintArchitectureRules(lineupArchitectureRules);
    const appRule = config.find((entry) => Array.isArray(entry.files) && entry.files.includes('src/App.ts'));
    assert.ok(appRule, 'expected App.ts restriction block');
    return appRule.rules['no-restricted-imports'][1].patterns[0].group;
}

function getNoRestrictedImportPatterns(entry) {
    assert.ok(entry, 'expected config entry');
    const restriction = entry.rules?.['no-restricted-imports'];
    if (!Array.isArray(restriction) || restriction.length < 2) {
        return [];
    }

    const options = restriction[1];
    if (
        options === null ||
        typeof options !== 'object' ||
        !Array.isArray(options.patterns)
    ) {
        return [];
    }

    return options.patterns;
}

function includesAllValues(actual, expected) {
    return Array.isArray(actual) && expected.every((value) => actual.includes(value));
}

function escapeRegexLiteral(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findCompositionRootRestrictionPattern(entry) {
    return getNoRestrictedImportPatterns(entry).find(
        (pattern) => pattern.message === architectureRuleMessages.compositionRootAccessBoundary
    );
}

function findRuntimeUiRestrictionPattern(entry) {
    return getNoRestrictedImportPatterns(entry).find(
        (pattern) => pattern.message === architectureRuleMessages.runtimeUiBoundary
    );
}

function findAppShellRuntimeBoundaryEntry(config) {
    return config.find(
        (entry) => includesAllValues(entry.files, lineupArchitectureRules.appShellRuntimeBoundary.runtimeModuleGlobs)
    );
}

async function lintArchitectureSource(filePath, source) {
    const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: buildEslintArchitectureRules(lineupArchitectureRules),
    });
    const [result] = await eslint.lintText(source, { filePath });
    return result.messages;
}

test('App restriction patterns block both module roots and descendants', () => {
    const group = getAppRestrictionGroup();

    for (const root of ['plex', 'player', 'scheduler']) {
        assert.ok(group.includes(`./modules/${root}`));
        assert.ok(group.includes(`./modules/${root}/**`));
        assert.ok(group.includes(`@modules/${root}`));
        assert.ok(group.includes(`@modules/${root}/**`));
        assert.ok(group.includes(`src/modules/${root}`));
        assert.ok(group.includes(`src/modules/${root}/**`));
    }
});

test('storage ownership allowlist contains only existing direct-global owners', () => {
    assert.deepEqual(lineupArchitectureRules.storageOwnership.allowedFiles, [
        'src/utils/storage.ts',
        'src/modules/plex/auth/PlexAuth.ts',
    ]);
    for (const file of lineupArchitectureRules.storageOwnership.allowedFiles) {
        const ownerUrl = new URL(`../../${file}`, import.meta.url);
        assert.ok(existsSync(ownerUrl), `expected storage owner to exist: ${file}`);
    }
});

test('runtime UI boundary config preserves composition-root import restrictions', () => {
    const config = buildEslintArchitectureRules(lineupArchitectureRules);
    const rootRestrictionIndex = config.findIndex(
        (entry) => includesAllValues(entry.files, ['src/**/*.ts', 'src/**/*.tsx'])
            && includesAllValues(entry.ignores, lineupArchitectureRules.compositionRootAccessBoundary.allowedImporters)
            && findCompositionRootRestrictionPattern(entry)
    );
    const runtimeUiRestrictionIndex = config.findIndex(
        (entry) => includesAllValues(entry.files, lineupArchitectureRules.runtimeUiBoundary.nonUiRuntimeModuleGlobs)
            && includesAllValues(entry.ignores, ['src/**/__tests__/**'])
            && findRuntimeUiRestrictionPattern(entry)
    );

    assert.ok(rootRestrictionIndex > -1, 'expected generic composition-root restriction block');
    assert.ok(runtimeUiRestrictionIndex > rootRestrictionIndex, 'runtime block must win flat-config overlap');

    assert.ok(
        findRuntimeUiRestrictionPattern(config[runtimeUiRestrictionIndex]),
        'expected runtime UI import restriction'
    );
    assert.ok(
        findCompositionRootRestrictionPattern(config[runtimeUiRestrictionIndex]),
        'expected composition-root import restriction'
    );
});

test('runtime UI exception entries preserve composition-root exceptions for the same file', () => {
    const exceptionFile = 'src/modules/navigation/SyntheticRuntime.ts';
    const allowedUiImport = '../ui/epg';
    const allowedRootImport = '../../Orchestrator';
    const rules = {
        ...lineupArchitectureRules,
        temporaryExceptions: [
            ...lineupArchitectureRules.temporaryExceptions,
            {
                rule: 'runtime-ui-boundary',
                from: exceptionFile,
                to: allowedUiImport,
                reason: 'Synthetic fixture for overlapping architecture exceptions.',
                cleanupPriority: 'test',
            },
            {
                rule: 'composition-root-access-boundary',
                from: exceptionFile,
                to: allowedRootImport,
                reason: 'Synthetic fixture for overlapping architecture exceptions.',
                cleanupPriority: 'test',
            },
        ],
    };
    const config = buildEslintArchitectureRules(rules);
    const exceptionEntry = config.find(
        (entry) =>
            includesAllValues(entry.files, [exceptionFile])
            && findRuntimeUiRestrictionPattern(entry)
    );

    const runtimePattern = findRuntimeUiRestrictionPattern(exceptionEntry);
    const compositionPattern = findCompositionRootRestrictionPattern(exceptionEntry);

    assert.ok(runtimePattern, 'expected runtime UI restriction on exception entry');
    assert.ok(compositionPattern, 'expected composition-root restriction on exception entry');
    assert.ok(
        runtimePattern.group.includes(`!${allowedUiImport}`),
        'expected runtime UI exception negation on exception entry'
    );
    assert.ok(
        compositionPattern.regex.includes(escapeRegexLiteral(allowedRootImport)),
        'expected composition-root exception to exclude the configured root import'
    );
    assert.equal(
        new RegExp(compositionPattern.regex).test('App'),
        true,
        'expected composition-root exception entry to keep restricting other roots'
    );
});

test('NavigationCoordinator no longer has stale runtime UI temporary exceptions', () => {
    const staleNavigationUiExceptions = lineupArchitectureRules.temporaryExceptions.filter(
        (exception) =>
            exception.rule === 'runtime-ui-boundary'
            && exception.from === 'src/modules/navigation/NavigationCoordinator.ts'
    );

    assert.deepEqual(staleNavigationUiExceptions, []);
});

test('app-shell no longer has stale composition-root temporary exceptions', () => {
    const staleAppShellCompositionRootExceptions = lineupArchitectureRules.temporaryExceptions.filter(
        (exception) =>
            exception.rule === 'composition-root-access-boundary'
            && (
                exception.from === 'src/core/app-shell/AppOrchestratorConfigFactory.ts'
                || exception.from === 'src/core/app-shell/AppShellRuntimeContracts.ts'
            )
    );

    assert.deepEqual(staleAppShellCompositionRootExceptions, []);
});

test('app-shell runtime boundary emits forbidden implementation paths and symbols', () => {
    const config = buildEslintArchitectureRules(lineupArchitectureRules);
    const entry = findAppShellRuntimeBoundaryEntry(config);
    const patterns = getNoRestrictedImportPatterns(entry);

    assert.ok(entry, 'expected app-shell runtime boundary block');
    assert.ok(
        findCompositionRootRestrictionPattern(entry),
        'expected the later flat-config block to preserve the composition-root restriction'
    );
    assert.deepEqual(
        patterns.slice(1),
        lineupArchitectureRules.appShellRuntimeBoundary.forbiddenImportPatterns
    );
    assert.ok(
        patterns.some(
            (pattern) => pattern.regex === '(?:^|/)(?:Orchestrator|AppOrchestrator)(?:\\.[jt]sx?)?$'
        ),
        'expected orchestrator root and concrete implementation restriction'
    );
    assert.ok(
        patterns.some(
            (pattern) => pattern.regex === '(?:^|/)ServerSelectionTypes(?:\\.ts)?$'
        ),
        'expected core server-selection result owner restriction'
    );
    assert.ok(
        patterns.some(
            (pattern) => pattern.regex === '(?:^|/)OrchestratorStorageContext(?:\\.ts)?$'
        ),
        'expected orchestrator storage context restriction'
    );

    const symbolPattern = patterns.find(
        (pattern) => pattern.importNames?.includes('OrchestratorServerSelectionResult')
    );
    assert.ok(symbolPattern, 'expected implementation symbol restriction');
    assert.deepEqual(symbolPattern.importNames, [
        'OrchestratorServerSelectionResult',
        'getSelectedServerStorageKey',
        'getServerHealthStorageKey',
    ]);
    assert.equal(symbolPattern.message, architectureRuleMessages.appShellRuntimeBoundary);
});

test('only the runtime engine loader may dynamically import the orchestrator implementation', async () => {
    const loader = lineupArchitectureRules.appShellRuntimeBoundary.orchestratorImplementationLoader;
    assert.deepEqual(loader, {
        file: 'src/core/app-shell/runtime/AppRuntimeEngineLoader.ts',
        dynamicImport: '../../orchestrator/AppOrchestrator',
    });

    const allowedMessages = await lintArchitectureSource(
        loader.file,
        `import(${JSON.stringify(loader.dynamicImport)});`
    );
    assert.deepEqual(allowedMessages, []);

    for (const [label, filePath, source, ruleId] of [
        [
            'sibling literal',
            'src/core/app-shell/runtime/AppThemeController.ts',
            `import(${JSON.stringify(loader.dynamicImport)});`,
            'no-restricted-syntax',
        ],
        [
            'sibling JavaScript specifier',
            'src/core/app-shell/runtime/AppThemeController.ts',
            "import('../../orchestrator/AppOrchestrator.js');",
            'no-restricted-syntax',
        ],
        [
            'sibling template specifier',
            'src/core/app-shell/runtime/AppThemeController.ts',
            'import(`../../orchestrator/AppOrchestrator`);',
            'no-restricted-syntax',
        ],
        [
            'loader template specifier',
            loader.file,
            'import(`../../orchestrator/AppOrchestrator`);',
            'no-restricted-syntax',
        ],
        [
            'loader alternate path',
            loader.file,
            "import('../../../core/orchestrator/AppOrchestrator');",
            'no-restricted-syntax',
        ],
        [
            'loader static exact specifier',
            loader.file,
            `import { AppOrchestrator } from ${JSON.stringify(loader.dynamicImport)};\nvoid AppOrchestrator;`,
            'no-restricted-imports',
        ],
        [
            'loader static JavaScript specifier',
            loader.file,
            "import { AppOrchestrator } from '../../orchestrator/AppOrchestrator.js';\nvoid AppOrchestrator;",
            'no-restricted-imports',
        ],
    ]) {
        const messages = await lintArchitectureSource(filePath, source);
        assert.ok(
            messages.some((message) => message.ruleId === ruleId),
            `${label}: expected ${ruleId}`
        );
    }
});
