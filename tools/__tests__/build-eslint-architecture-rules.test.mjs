import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEslintArchitectureRules } from '../architecture-rules/buildEslintArchitectureRules.mjs';
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
            && getNoRestrictedImportPatterns(entry).some((pattern) => pattern.regex?.includes('Orchestrator'))
    );
    const runtimeUiRestrictionIndex = config.findIndex(
        (entry) => includesAllValues(entry.files, lineupArchitectureRules.runtimeUiBoundary.nonUiRuntimeModuleGlobs)
            && includesAllValues(entry.ignores, ['src/**/__tests__/**'])
            && getNoRestrictedImportPatterns(entry).some((pattern) => pattern.group?.includes('../ui/**'))
    );

    assert.ok(rootRestrictionIndex > -1, 'expected generic composition-root restriction block');
    assert.ok(runtimeUiRestrictionIndex > rootRestrictionIndex, 'runtime block must win flat-config overlap');

    const patterns = getNoRestrictedImportPatterns(config[runtimeUiRestrictionIndex]);
    assert.ok(
        patterns.some((pattern) => pattern.group?.includes('../ui/**')),
        'expected runtime UI import restriction'
    );
    assert.ok(
        patterns.some((pattern) => pattern.regex?.includes('Orchestrator')),
        'expected composition-root import restriction'
    );
});
