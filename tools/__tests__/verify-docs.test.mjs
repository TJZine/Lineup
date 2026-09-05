import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
const verifyDocsPath = path.join(repoRoot, 'tools/verify-docs.mjs');
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

function writeFixtureFile(fixtureRoot, relativePath, content) {
    const target = path.join(fixtureRoot, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
}

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

function createVerifierFixture() {
    const fixtureRoot = createRoleFixture();
    const markdownFiles = [
        'AGENTS.md',
        'ARCHITECTURE_CLEANUP_CHECKLIST.md',
        'docs/AGENTIC_DEV_WORKFLOW.md',
        'docs/architecture/CURRENT_STATE.md',
        'docs/agentic/session-prompts/README.md',
    ];
    for (const relativePath of markdownFiles) {
        writeFixtureFile(fixtureRoot, relativePath, `# ${path.basename(relativePath, '.md')}\n`);
    }
    writeFixtureFile(
        fixtureRoot,
        '.agents/skills/test-skill/SKILL.md',
        [
            '---',
            'name: test-skill',
            'description: Test fixture skill for verifier integration coverage.',
            '---',
            '',
            '# Test Skill',
            '',
        ].join('\n')
    );
    execFileSync('git', ['add', '.'], { cwd: fixtureRoot });
    return fixtureRoot;
}

function runVerifier(fixtureRoot) {
    return spawnSync(process.execPath, [verifyDocsPath], {
        cwd: fixtureRoot,
        encoding: 'utf8',
    });
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

test('keeps program orchestration explicit without requiring ordinary launchers', () => {
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

test('accepts renamed and additional roles with valid declared configurations', () => {
    const mutations = [
        (content) => content.replace('[agents.monitor]', '[agents.observer]'),
        (content) => `${content}\n[agents.builder]\ndescription = "Additional builder"\nconfig_file = "agents/worker.toml"\n`,
    ];
    for (const mutate of mutations) {
        const fixtureRoot = createRoleFixture();
        try {
            mutateFile(fixtureRoot, '.codex/config.toml', mutate);
            assert.deepEqual(validateCodexRoleConfig(fixtureRoot), []);
        } finally {
            rmSync(fixtureRoot, { recursive: true, force: true });
        }
    }
});

test('accepts a reduced role roster and no local skills through the verifier entry point', () => {
    const fixtureRoot = createVerifierFixture();
    try {
        mutateFile(fixtureRoot, '.codex/config.toml', (content) =>
            content.replace(/\n\[agents\.monitor\][\s\S]*?config_file = "agents\/monitor\.toml"\n/u, '\n')
        );
        rmSync(path.join(fixtureRoot, '.agents'), { recursive: true });
        execFileSync('git', ['rm', '-f', '--quiet', '.codex/agents/monitor.toml'], { cwd: fixtureRoot });
        const result = runVerifier(fixtureRoot);
        assert.equal(result.status, 0, result.stderr);
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('rejects missing and escaping declared role paths', () => {
    for (const [configFile, category] of [
        ['agents/missing.toml', 'role-path'],
        ['../escaped.toml', 'declaration config_file invalid'],
        ['agents/../escaped.toml', 'declaration config_file invalid'],
    ]) {
        const fixtureRoot = createRoleFixture();
        try {
            mutateFile(fixtureRoot, '.codex/config.toml', (content) =>
                content.replace('config_file = "agents/monitor.toml"', `config_file = "${configFile}"`)
            );
            assertCategory(validateCodexRoleConfig(fixtureRoot), category);
        } finally {
            rmSync(fixtureRoot, { recursive: true, force: true });
        }
    }
});

test('rejects symlinked role files before reading them', () => {
    const fixtureRoot = createRoleFixture();
    try {
        const rolePath = path.join(fixtureRoot, '.codex/agents/monitor.toml');
        copyFileSync(rolePath, path.join(fixtureRoot, '.codex/escaped.toml'));
        rmSync(rolePath);
        symlinkSync('../escaped.toml', rolePath);
        assertCategory(validateCodexRoleConfig(fixtureRoot), 'role-path');
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('keeps exact model and effort defaults owned by each role TOML', () => {
    const fixtureRoot = createRoleFixture();
    try {
        mutateFile(fixtureRoot, '.codex/agents/worker-luna.toml', (content) =>
            content
                .replace('model = "gpt-5.6-luna"', 'model = "gpt-5.6-sol"')
                .replace('model_reasoning_effort = "max"', 'model_reasoning_effort = "high"')
        );

        assert.deepEqual(validateCodexRoleConfig(fixtureRoot), []);
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('rejects invalid role model, effort, sandbox, and keys', () => {
    const mutations = [
        ['.codex/agents/worker.toml', (content) => content.replace('gpt-5.6-sol', ' '), 'role model invalid'],
        ['.codex/agents/worker.toml', (content) => content.replace('model_reasoning_effort = "medium"', 'model_reasoning_effort = "ultra"'), 'role effort unsupported'],
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

test('rejects an extra tracked retired role file through the verifier entry point', () => {
    const fixtureRoot = createVerifierFixture();
    try {
        writeFixtureFile(
            fixtureRoot,
            '.codex/agents/worker-sol-low.toml',
            'model = "gpt-5.6-sol"\nmodel_reasoning_effort = "low"\n'
        );
        execFileSync('git', ['add', '.codex/agents/worker-sol-low.toml'], { cwd: fixtureRoot });

        const result = runVerifier(fixtureRoot);

        assert.equal(result.status, 1, result.stdout);
        assert.match(
            result.stderr,
            /codex-config: tracked role files unreferenced: \.codex\/agents\/worker-sol-low\.toml/u
        );
        assert.match(
            result.stderr,
            /\.codex\/agents\/worker-sol-low\.toml: current authority references retired worker role/u
        );
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('rejects retired role references in tracked agentic docs outside session prompts', () => {
    const fixtureRoot = createVerifierFixture();
    try {
        const relativePath = 'docs/agentic/skill-strategy.md';
        writeFixtureFile(fixtureRoot, relativePath, '# Skill Strategy\n\nUse worker_sol_low.\n');
        execFileSync('git', ['add', relativePath], { cwd: fixtureRoot });

        const result = runVerifier(fixtureRoot);

        assert.equal(result.status, 1, result.stdout);
        assert.match(
            result.stderr,
            /docs\/agentic\/skill-strategy\.md: current authority references retired worker role/u
        );
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('permits retired role references in tracked historical agentic evidence', () => {
    for (const relativePath of [
        'docs/agentic/evals/baseline-summaries/2026-01-01-history.md',
        'docs/agentic/historical-plan-corpus-review.md',
    ]) {
        const fixtureRoot = createVerifierFixture();
        try {
            writeFixtureFile(fixtureRoot, relativePath, '# Historical Evidence\n\nUsed worker_sol_low.\n');
            execFileSync('git', ['add', relativePath], { cwd: fixtureRoot });

            const result = runVerifier(fixtureRoot);

            assert.equal(result.status, 0, `${relativePath}: ${result.stderr}`);
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
