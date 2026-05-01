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
    return entry.rules['no-restricted-imports'][1].patterns;
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
        (entry) => Array.isArray(entry.files)
            && entry.files.includes('src/**/*.ts')
            && entry.ignores?.includes('src/bootstrap.ts')
    );
    const runtimeUiRestrictionIndex = config.findIndex(
        (entry) => entry.files === lineupArchitectureRules.runtimeUiBoundary.nonUiRuntimeModuleGlobs
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
