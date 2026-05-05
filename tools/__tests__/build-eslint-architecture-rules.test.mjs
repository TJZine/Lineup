import test from 'node:test';
import assert from 'node:assert/strict';

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

test('storage ownership allowlist names the channel persistence owner, not ChannelManager', () => {
    assert.ok(
        lineupArchitectureRules.storageOwnership.allowedFiles.includes(
            'src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts'
        )
    );
    assert.ok(
        !lineupArchitectureRules.storageOwnership.allowedFiles.includes(
            'src/modules/scheduler/channel-manager/ChannelManager.ts'
        )
    );
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
