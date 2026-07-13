import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    distributionContractErrors,
    hasExplicitOnlyPolicy,
    isValidMaxDepth,
    pqrHandoffContractErrors,
    remoteKeyContractErrors,
    requiresExplicitInvocation,
} from '../verify-docs.mjs';

const validPqrChecklist = `
## Fresh-Session Handoff

- Next safe start: \`PQR-EXIT\` is the sole open PQR cleanup gate.

## Rubric Basis

${Array.from({ length: 7 }, (_, index) => `### [x] \`PQR-${index + 1}\``).join('\n')}
### [ ] \`PQR-EXIT\`
`;

const validRemoteKeyContract = {
    developmentSetup: 'The remote media Play/Pause keys do not have a keyboard alias.',
    guide: `
| **Red** | F1 | Toggle the Now Playing information overlay |
| **Info** | \`I\` | Open server selection or sign-in |
| **Blue** | F4 | Same server-selection action as Info |
| **Yellow** | F3 | Open Settings from the Player or EPG |
| **CH +** | Page Up | Previous channel; page up |
| **CH -** | Page Down | Next channel; page down |
| **Player, no overlay open** | Down or OK opens Player controls | Opens Exit confirmation |
| **Now Playing information** | OK closes Now Playing and opens Playback Options | Closes Now Playing |
| **Protected recovery modal** | Only D-Pad and OK are accepted | Suppressed |
`,
    inputRouter: `case 'guide': case 'green': this.deps.emitGuide(); case 'yellow': this.deps.emitSettings();`,
    keyModeRouter: `
case 'red': this.deps.nowPlayingInfo.toggleOverlay();
case 'channelUp': this.deps.channelSwitching.switchToPreviousChannel();
case 'channelDown': this.deps.channelSwitching.switchToNextChannel();
case 'info': case 'blue': if (!isAuthenticatedForServerSelection()) navigation.goTo('auth'); else navigation.goTo('server-select');
isNowPlayingModalOpen && event.button === 'ok'; this.deps.modals.playbackOptions.prepare('subtitles');
const prep = this.deps.modals.exitConfirm.prepare();
`,
    platformKeyMap: "[33, 'channelUp'] [34, 'channelDown'] [73, 'info'] [71, 'guide']",
    navigationCoordinator: "if (currentScreen === 'player' || currentScreen === 'guide') navigation.goTo('settings');",
};

const validDistributionContract = {
    installation: `
Lineup does not currently publish a prebuilt IPK on GitHub Releases.
npm ci
npm install -g @webos-tools/cli@3.2.5
npm run package:webos
packages/com.lineup.app_<VERSION>_all.ipk
Download webos-ipk when branch is **main**. Retained for seven days.
`,
    readme: 'No prebuilt Lineup IPK is currently published on GitHub Releases.',
    workflow: `
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
name: webos-ipk
path: packages/*.ipk
retention-days: 7
`,
};

test('accepts only finite non-negative integer delegation depths no greater than one', () => {
    for (const value of [0, 1]) assert.equal(isValidMaxDepth(value), true, String(value));
    for (const value of [undefined, null, '1', -1, 0.5, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(isValidMaxDepth(value), false, String(value));
    }
});

test('identifies explicit-only launcher names without maintaining an inventory', () => {
    assert.equal(requiresExplicitInvocation('lineup-feature-plan'), true);
    assert.equal(requiresExplicitInvocation('large-task-orchestration'), true);
    assert.equal(requiresExplicitInvocation('typescript-test-design'), false);
});

test('requires explicit-only launcher policy to be present and false', () => {
    assert.equal(hasExplicitOnlyPolicy('interface:\n  display_name: "Example"\n'), false);
    assert.equal(
        hasExplicitOnlyPolicy('policy:\n  allow_implicit_invocation: true\n'),
        false
    );
    assert.equal(
        hasExplicitOnlyPolicy('policy:\n  allow_implicit_invocation: false\n'),
        true
    );
});

test('accepts the truthful no-prebuilt distribution contract', () => {
    assert.deepEqual(distributionContractErrors(validDistributionContract), []);
});

test('rejects a nonexistent Release promise and incomplete source or Actions paths', () => {
    const errors = distributionContractErrors({
        installation: 'Use an IPK downloaded from Lineup Releases. npm ci',
        readme: 'Download the latest release.',
        workflow: 'name: build-only',
    });

    assert.ok(errors.some((error) => error.includes('no prebuilt IPK')));
    assert.ok(errors.some((error) => error.includes('nonexistent Lineup Release')));
    assert.ok(errors.some((error) => error.includes('npm run package:webos')));
    assert.ok(errors.some((error) => error.includes('seven days')));
    assert.ok(errors.some((error) => error.includes('no-prebuilt distribution policy')));
    assert.ok(errors.some((error) => error.includes('retention-days: 7')));
});

test('rejects alternate release-download wording and a Lineup Releases link', () => {
    for (const contradictoryGuidance of [
        'Download the latest Lineup IPK from GitHub Releases.',
        'Get the package from [Lineup Releases](https://github.com/TJZine/Lineup/releases).',
        'Install the Lineup IPK from GitHub Releases.',
        'Use the Lineup package from GitHub Releases.',
        'The latest package is available on GitHub Releases.',
        'The latest Lineup IPK is available from\nGitHub Releases.',
        'Use the Lineup package from\nGitHub Releases.',
        'GitHub Releases provides\nthe Lineup IPK.',
    ]) {
        const errors = distributionContractErrors({
            ...validDistributionContract,
            installation: `${validDistributionContract.installation}\n${contradictoryGuidance}`,
        });
        assert.ok(errors.some((error) => error.includes('nonexistent Lineup Release')));
    }
});

test('allows the unrelated webOS Dev Manager releases link', () => {
    const errors = distributionContractErrors({
        ...validDistributionContract,
        installation: `${validDistributionContract.installation}\nDownload webOS Dev Manager from https://github.com/webosbrew/dev-manager-desktop/releases.`,
    });
    assert.deepEqual(errors, []);
});

test('rejects Actions artifacts that are no longer limited to main pushes', () => {
    for (const incompatibleCondition of [
        "if: github.ref == 'refs/heads/develop' && github.event_name == 'push'",
        "if: github.ref == 'refs/heads/main' && github.event_name == 'pull_request'",
    ]) {
        const errors = distributionContractErrors({
            ...validDistributionContract,
            workflow: validDistributionContract.workflow.replace(
                "if: github.ref == 'refs/heads/main' && github.event_name == 'push'",
                incompatibleCondition
            ),
        });
        assert.ok(errors.some((error) => error.includes("github.ref == 'refs/heads/main'")));
    }
});

test('accepts the PQR-EXIT fresh-session handoff without changing package state', () => {
    assert.deepEqual(pqrHandoffContractErrors(validPqrChecklist), []);
});

test('rejects stale PQR-1 routing and PQR status drift', () => {
    const errors = pqrHandoffContractErrors(
        validPqrChecklist
            .replace('`PQR-EXIT` is the sole open PQR cleanup gate', '`PQR-1` is the next cleanup start')
            .replace('### [x] `PQR-4`', '### [ ] `PQR-4`')
            .replace('### [ ] `PQR-EXIT`', '### [x] `PQR-EXIT`')
            .concat('\n### [ ] `PQR-8`\n')
    );
    assert.ok(errors.some((error) => error.includes('sole open PQR-EXIT')));
    assert.ok(errors.some((error) => error.includes('completed PQR-1')));
    assert.ok(errors.some((error) => error.includes('PQR-4 must remain complete')));
    assert.ok(errors.some((error) => error.includes('PQR-EXIT must remain open')));
    assert.ok(errors.some((error) => error.includes('sole open PQR gate')));
});

test('accepts the context-aware remote-key contract', () => {
    assert.deepEqual(remoteKeyContractErrors(validRemoteKeyContract), []);
});

test('rejects remote-guide, keyboard-alias, and router drift', () => {
    const errors = remoteKeyContractErrors({
        ...validRemoteKeyContract,
        developmentSetup: 'Space: Play/Pause',
        guide: validRemoteKeyContract.guide.replace('Previous channel; page up', 'Next channel'),
        keyModeRouter: validRemoteKeyContract.keyModeRouter.replace(
            'switchToPreviousChannel()',
            'switchToNextChannel()'
        ).replace("navigation.goTo('auth');", ''),
        navigationCoordinator: "navigation.goTo('settings');",
    });
    assert.ok(errors.some((error) => error.includes('CH+ must mean previous/page up')));
    assert.ok(errors.some((error) => error.includes('Space Play/Pause alias')));
    assert.ok(errors.some((error) => error.includes('missing media-key alias')));
    assert.ok(errors.some((error) => error.includes('router CH+ binding changed')));
    assert.ok(errors.some((error) => error.includes('sign-in fallback changed')));
    assert.ok(errors.some((error) => error.includes('Yellow screen gate changed')));
});
