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
