import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    containsRetiredWorkerRole,
    hasExplicitOnlyPolicy,
    isValidMaxDepth,
    isValidMaxThreads,
    requiresExplicitInvocation,
    validateCodexRoleConfig,
} from '../verify-docs.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const codexFiles = [
    '.codex/config.toml',
    '.codex/agents/docs-researcher.toml',
    '.codex/agents/explorer.toml',
    '.codex/agents/monitor.toml',
    '.codex/agents/planner.toml',
    '.codex/agents/reviewer.toml',
    '.codex/agents/worker-luna.toml',
    '.codex/agents/worker.toml',
];

function createRoleFixture() {
    const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-role-config-'));
    for (const relativePath of codexFiles) {
        const target = path.join(fixtureRoot, relativePath);
        mkdirSync(path.dirname(target), { recursive: true });
        copyFileSync(path.join(repoRoot, relativePath), target);
    }
    execFileSync('git', ['init', '--quiet'], { cwd: fixtureRoot });
    execFileSync('git', ['add', '.codex'], { cwd: fixtureRoot });
    return fixtureRoot;
}

function mutateFile(fixtureRoot, relativePath, mutate) {
    const target = path.join(fixtureRoot, relativePath);
    const original = readFileSync(target, 'utf8');
    const mutated = mutate(original);
    assert.notEqual(mutated, original, `mutation did not change ${relativePath}`);
    writeFileSync(target, mutated, 'utf8');
}

function assertCategory(errors, category) {
    assert(
        errors.some((message) => message.startsWith(`codex-config: ${category}`)),
        `Expected ${category}, got:\n${errors.join('\n')}`
    );
}

test('accepts only finite non-negative integer delegation depths no greater than one', () => {
    for (const value of [0, 1]) assert.equal(isValidMaxDepth(value), true, String(value));
    for (const value of [undefined, null, '1', -1, 0.5, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(isValidMaxDepth(value), false, String(value));
    }
});

test('accepts only bounded positive integer thread counts', () => {
    for (const value of [1, 6]) assert.equal(isValidMaxThreads(value), true, String(value));
    for (const value of [undefined, null, '6', 0, -1, 1.5, 7, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(isValidMaxThreads(value), false, String(value));
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

test('accepts the valid tracked role configuration', () => {
    assert.deepEqual(validateCodexRoleConfig(repoRoot), []);
});

test('identifies retired worker role references without matching the Luna role', () => {
    assert.equal(containsRetiredWorkerRole('Use worker_sol_low here.'), true);
    assert.equal(containsRetiredWorkerRole('agents/worker-sol-low.toml'), true);
    assert.equal(containsRetiredWorkerRole('Use worker_luna here.'), false);
});

test('rejects a primary config symlink before parsing it', () => {
    const fixtureRoot = createRoleFixture();
    try {
        const configPath = path.join(fixtureRoot, '.codex/config.toml');
        const escapedPath = path.join(fixtureRoot, 'escaped-config.toml');
        copyFileSync(configPath, escapedPath);
        rmSync(configPath);
        symlinkSync('../escaped-config.toml', configPath);
        assertCategory(validateCodexRoleConfig(fixtureRoot), 'primary-file');
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('rejects missing, renamed, and unknown role declarations', () => {
    const mutations = [
        (content) => content.replace(/\n\[agents\.monitor\][\s\S]*?config_file = "agents\/monitor\.toml"\n/u, '\n'),
        (content) => content.replace('[agents.monitor]', '[agents.observer]'),
        (content) => `${content}\n[agents.unknown]\ndescription = "Unknown"\nconfig_file = "agents/worker.toml"\n`,
    ];
    for (const [index, mutate] of mutations.entries()) {
        const fixtureRoot = createRoleFixture();
        try {
            mutateFile(fixtureRoot, '.codex/config.toml', mutate);
            const errors = validateCodexRoleConfig(fixtureRoot);
            assertCategory(errors, index === 0 ? 'role-inventory missing' : 'role-inventory unknown');
            if (index === 1) assertCategory(errors, 'role-inventory missing');
        } finally {
            rmSync(fixtureRoot, { recursive: true, force: true });
        }
    }
});

test('rejects unsupported role model, effort, sandbox, and keys', () => {
    const mutations = [
        ['.codex/agents/worker.toml', (content) => content.replace('gpt-5.6-sol', 'gpt-unknown'), 'role model unsupported'],
        ['.codex/agents/worker.toml', (content) => content.replace('model_reasoning_effort = "medium"', 'model_reasoning_effort = "ultra"'), 'role effort unsupported'],
        ['.codex/agents/worker-luna.toml', (content) => content.replace('model_reasoning_effort = "max"', 'model_reasoning_effort = "high"'), 'role effort unsupported'],
        ['.codex/agents/reviewer.toml', (content) => content.replace('sandbox_mode = "read-only"', 'sandbox_mode = "danger-full-access"'), 'role sandbox unsupported'],
        ['.codex/agents/worker.toml', (content) => `${content}\napproval_policy = "never"\n`, 'role keys unsupported'],
    ];
    for (const [relativePath, mutate, category] of mutations) {
        const fixtureRoot = createRoleFixture();
        try {
            mutateFile(fixtureRoot, relativePath, mutate);
            assertCategory(validateCodexRoleConfig(fixtureRoot), category);
        } finally {
            rmSync(fixtureRoot, { recursive: true, force: true });
        }
    }
});

test('rejects invalid max_threads values through the production validation seam', () => {
    for (const value of ['0', '7', '1.5', '"6"']) {
        const fixtureRoot = createRoleFixture();
        try {
            mutateFile(fixtureRoot, '.codex/config.toml', (content) =>
                content.replace('max_threads = 6', `max_threads = ${value}`)
            );
            assertCategory(validateCodexRoleConfig(fixtureRoot), 'invalid max_threads');
        } finally {
            rmSync(fixtureRoot, { recursive: true, force: true });
        }
    }
});

test('sanitizes malformed TOML diagnostics', () => {
    const fixtureRoot = createRoleFixture();
    try {
        mutateFile(fixtureRoot, '.codex/config.toml', (content) =>
            content.replace('max_threads = 6', 'max_threads = "SECRET_SOURCE_CONTENT')
        );
        const errors = validateCodexRoleConfig(fixtureRoot);
        assertCategory(errors, 'invalid TOML');
        assert.equal(errors.join('\n').includes('SECRET_SOURCE_CONTENT'), false);
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});
