import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CODEX_ROLE_CONTRACTS } from '../codex-role-contracts.mjs';

const requiredRoles = CODEX_ROLE_CONTRACTS.map(({ role }) => role);
const roleConfigFiles = new Map(CODEX_ROLE_CONTRACTS.map(({ role, configFile }) => [role, configFile]));
const readOnlyRoles = new Set(CODEX_ROLE_CONTRACTS.filter(({ readOnly }) => readOnly).map(({ role }) => role));
const roleModels = new Map(CODEX_ROLE_CONTRACTS.map(({ role, supportedModels }) => [role, supportedModels[0]]));

const roleDescriptionMarkers = new Map([
    ['maintainability_reviewer', 'read-only reviewer code-health no style-only blocking'],
    ['architecture_reviewer', 'read-only reviewer hotspots security-adjacent architecture risk'],
    ['planner_deep', 'deep planning writer tier 3 not product-code implementation'],
    ['worker_luna', 'cost-optimized write-capable implementer approved cheap-to-verify'],
    ['cleanup_worker', 'cleanup-loop-specific implementer approved tier 3 cleanup-loop implementation passes'],
]);

const roleContractMarkers = new Map([
    [
        'planner',
        [
            'Own bounded planning work, not product-code implementation.',
            'Planning artifacts and execution-ready handoffs.',
            'Leave implementation to the worker role.',
        ],
    ],
    [
        'planner_deep',
        [
            'Deep planning work for Tier 3 and unresolved architecture/product seam planning.',
            'Planning artifacts.',
            'Do not implement product code.',
        ],
    ],
    [
        'worker_luna',
        [
            'Own approved, bounded, exact, cheap-to-verify execution units.',
            'Use the current execution packet.',
            'Stop and escalate on ambiguity, plan contradiction, or verification failure that needs diagnosis.',
        ],
    ],
    [
        'maintainability_reviewer',
        [
            'Review code-health, slop, file shape, test brittleness, and unnecessary indirection.',
            'Do not block on style-only preferences.',
            'Do not edit files.',
        ],
    ],
    [
        'architecture_reviewer',
        [
            'Review hotspots, owner seams, cross-module coupling, public contracts, priority-exit, and security-adjacent architecture risk.',
            'Do not edit files.',
        ],
    ],
    [
        'cleanup_worker',
        [
            'Own a bounded cleanup-loop implementation write scope.',
            'Make the smallest defensible cleanup change inside the approved execution unit.',
            'Use this role only for Tier 3 cleanup-loop implementation passes; leave general implementation routing to the worker role.',
        ],
    ],
]);

let verifierImportCounter = 0;
const GIT_TIMEOUT_MS = 5_000;
const GIT_MAX_BUFFER_BYTES = 1024 * 1024;

function git(cwd, args) {
    execFileSync('git', args, {
        cwd,
        stdio: 'ignore',
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: GIT_MAX_BUFFER_BYTES,
    });
}

function configuredRoleInstruction(role) {
    return `Begin your first assistant response with \`CONFIGURED ROLE: ${role}\` on its own line. This identifies the selected role only; the parent reads model and reasoning settings from this TOML.`;
}

function roleConfigContent(role) {
    return [
        `model = "${roleModels.get(role)}"`,
        'model_reasoning_effort = "medium"',
        ...(readOnlyRoles.has(role) ? ['sandbox_mode = "read-only"'] : []),
        'developer_instructions = """',
        configuredRoleInstruction(role),
        ...(roleContractMarkers.get(role) ?? []),
        '"""',
        '',
    ].join('\n');
}

function roleDescription(role) {
    return roleDescriptionMarkers.get(role) ?? `${role} role`;
}

function writeTrackedRoleConfigFixture(tmpRoot) {
    const codexDir = path.join(tmpRoot, '.codex');
    const agentsDir = path.join(codexDir, 'agents');
    mkdirSync(agentsDir, { recursive: true });
    mkdirSync(path.join(tmpRoot, 'docs', 'agentic', 'session-prompts'), { recursive: true });

    writeFileSync(
        path.join(tmpRoot, 'docs', 'AGENTIC_DEV_WORKFLOW.md'),
        'Role config lives at .codex/config.toml and .codex/agents/.\n',
        'utf8',
    );
    writeFileSync(
        path.join(tmpRoot, 'docs', 'agentic', 'skill-strategy.md'),
        'Tracked skill strategy. Role config lives at .codex/config.toml and .codex/agents/.\n',
        'utf8',
    );
    writeFileSync(
        path.join(tmpRoot, 'docs', 'agentic', 'session-prompts', 'workflow-harness-review.md'),
        'Workflow harness review reads .codex/config.toml and .codex/agents/.\n',
        'utf8',
    );

    const configLines = ['[agents]', 'max_depth = 1', ''];
    for (const role of requiredRoles) {
        configLines.push(`[agents.${role}]`);
        configLines.push(`description = "${roleDescription(role)}"`);
        configLines.push(`config_file = "${roleConfigFiles.get(role)}"`);
        configLines.push('');
    }
    writeFileSync(path.join(codexDir, 'config.toml'), configLines.join('\n'), 'utf8');

    for (const [role, configFile] of roleConfigFiles.entries()) {
        writeFileSync(path.join(codexDir, configFile), roleConfigContent(role), 'utf8');
    }

    git(tmpRoot, ['init']);
    git(tmpRoot, [
        'add',
        '.codex/config.toml',
        '.codex/agents',
        'docs/AGENTIC_DEV_WORKFLOW.md',
        'docs/agentic/skill-strategy.md',
        'docs/agentic/session-prompts/workflow-harness-review.md',
    ]);
}

function createFixture() {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-'));
    writeTrackedRoleConfigFixture(tmpRoot);
    return tmpRoot;
}

async function checkTrackedRoleConfig(tmpRoot) {
    const previousCwd = process.cwd();
    try {
        process.chdir(tmpRoot);
        const verifyDocsUrl = new URL(
            `../verify-docs.mjs?cacheBust=role-config-${Date.now()}-${verifierImportCounter++}`,
            import.meta.url,
        );
        const { checkTrackedCodexRoleConfig } = await import(verifyDocsUrl.href);
        const errors = [];
        checkTrackedCodexRoleConfig(errors);
        return errors;
    } finally {
        process.chdir(previousCwd);
    }
}

test('checkTrackedCodexRoleConfig accepts the complete mapped role-config contract', async () => {
    const tmpRoot = createFixture();
    try {
        const errors = await checkTrackedRoleConfig(tmpRoot);
        assert.deepEqual(errors, [], `Expected a clean role-config fixture, got:\n${errors.join('\n')}`);
    } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});

test('checkTrackedCodexRoleConfig rejects targeted role-config contract mutations', async () => {
    const mutations = [
        {
            name: 'wrong config_file mapping',
            relativePath: '.codex/config.toml',
            mutate: (content) => content.replace(
                'config_file = "agents/worker-luna.toml"',
                'config_file = "agents/worker.toml"',
            ),
            expected: 'Codex role worker_luna must use config_file="agents/worker-luna.toml"',
        },
        {
            name: 'unexpected role declaration',
            relativePath: '.codex/config.toml',
            mutate: (content) => `${content}\n[agents.unapproved_worker]\ndescription = "Unapproved worker"\n`,
            expected: 'Unexpected Codex agent role declarations in .codex/config.toml: unapproved_worker',
        },
        {
            name: 'missing exact configured-role marker',
            relativePath: '.codex/agents/worker-luna.toml',
            mutate: (content) => content.replace('CONFIGURED ROLE: worker_luna', 'CONFIGURED ROLE: worker'),
            expected: 'Codex role config is missing exact CONFIGURED ROLE marker for worker_luna',
        },
        {
            name: 'configured-role marker spoofed by a comment',
            relativePath: '.codex/agents/worker-luna.toml',
            mutate: (content) => {
                const marker = configuredRoleInstruction('worker_luna');
                return `${content.replace(marker, 'Execute the approved worker_luna unit.')}\n# ${marker}\n`;
            },
            expected: 'Codex role config is missing exact CONFIGURED ROLE marker for worker_luna',
        },
        {
            name: 'malformed tracked config',
            relativePath: '.codex/config.toml',
            mutate: (content) => content.replace('max_depth = 1', 'max_depth = 1\nmax_depth = 1'),
            expected: 'Invalid TOML syntax in .codex/config.toml:',
        },
        {
            name: 'malformed role config',
            relativePath: '.codex/agents/worker.toml',
            mutate: (content) => content.replace(
                'model = "gpt-5.6-sol"',
                'model = "gpt-5.6-sol"\nmodel = "gpt-5.6-sol"',
            ),
            expected: 'Invalid TOML syntax in .codex/agents/worker.toml:',
        },
        {
            name: 'unsupported model',
            relativePath: '.codex/agents/worker.toml',
            mutate: (content) => content.replace('gpt-5.6-sol', 'gpt-unknown'),
            expected: 'Codex role config uses unsupported model "gpt-unknown"',
        },
        {
            name: 'unsupported effort',
            relativePath: '.codex/agents/worker.toml',
            mutate: (content) => content.replace('model_reasoning_effort = "medium"', 'model_reasoning_effort = "ultra"'),
            expected: 'Codex role config uses unsupported model_reasoning_effort "ultra"',
        },
        {
            name: 'invalid model type',
            relativePath: '.codex/agents/worker.toml',
            mutate: (content) => content.replace('model = "gpt-5.6-sol"', 'model = 56'),
            expected: 'Codex role config model must be a string',
        },
        {
            name: 'invalid effort type',
            relativePath: '.codex/agents/worker.toml',
            mutate: (content) => content.replace('model_reasoning_effort = "medium"', 'model_reasoning_effort = ["medium"]'),
            expected: 'Codex role config model_reasoning_effort must be a string',
        },
        {
            name: 'unsupported role and model combination',
            relativePath: '.codex/agents/planner.toml',
            mutate: (content) => content.replace('gpt-5.6-sol', 'gpt-5.6-luna'),
            expected: 'Codex role planner does not support model "gpt-5.6-luna"',
        },
        {
            name: 'unsupported model and effort combination',
            relativePath: '.codex/agents/worker-luna.toml',
            mutate: (content) => content
                .replace('gpt-5.6-luna', 'gpt-5.4-mini')
                .replace('model_reasoning_effort = "medium"', 'model_reasoning_effort = "xhigh"'),
            expected: 'Codex role config does not support model/effort combination "gpt-5.4-mini"/"xhigh"',
        },
        {
            name: 'retired role in tracked config',
            relativePath: '.codex/config.toml',
            mutate: (content) => `${content}\n[agents.worker_54_high]\ndescription = "Retired role"\n`,
            expected: 'Tracked Codex role config must not mention retired role worker_54_high',
        },
        {
            name: 'retired role in agent instructions',
            relativePath: '.codex/agents/worker.toml',
            mutate: (content) => content.replace('\n"""\n', '\nDo not delegate this unit to worker_terra.\n"""\n'),
            expected: 'Codex role config must not mention retired role worker_terra',
        },
        {
            name: 'read-only enforcement',
            relativePath: '.codex/agents/reviewer.toml',
            mutate: (content) => content.replace('sandbox_mode = "read-only"\n', ''),
            expected: 'Read-only Codex role config must set sandbox_mode = "read-only"',
        },
        {
            name: 'write-capable role permission mismatch',
            relativePath: '.codex/agents/worker.toml',
            mutate: (content) => content.replace(
                'model_reasoning_effort = "medium"\n',
                'model_reasoning_effort = "medium"\nsandbox_mode = "read-only"\n',
            ),
            expected: 'Write-capable Codex role config must not declare sandbox_mode',
        },
        {
            name: 'elevated sandbox mode',
            relativePath: '.codex/agents/reviewer.toml',
            mutate: (content) => content.replace('sandbox_mode = "read-only"', 'sandbox_mode = "danger-full-access"'),
            expected: 'Read-only Codex role config must set sandbox_mode = "read-only"',
        },
        {
            name: 'worker_luna role contract',
            relativePath: '.codex/agents/worker-luna.toml',
            mutate: (content) => content.replace('Stop and escalate on ambiguity, ', ''),
            expected: 'Codex role config is missing required worker_luna boundary marker (stop and escalate on ambiguity)',
        },
        {
            name: 'specialized reviewer role contract',
            relativePath: '.codex/agents/maintainability-reviewer.toml',
            mutate: (content) => content.replace('Do not edit files.\n', ''),
            expected: 'Codex role config is missing required maintainability_reviewer boundary marker (do not edit files)',
        },
        {
            name: 'role declaration contract',
            relativePath: '.codex/config.toml',
            mutate: (content) => content.replace(
                'cost-optimized write-capable implementer approved cheap-to-verify',
                'worker luna',
            ),
            expected: 'Codex role declaration is missing required worker_luna scope marker',
        },
    ];

    for (const mutationCase of mutations) {
        const tmpRoot = createFixture();
        try {
            const targetPath = path.join(tmpRoot, mutationCase.relativePath);
            const original = readFileSync(targetPath, 'utf8');
            const mutated = mutationCase.mutate(original);
            assert.notEqual(mutated, original, `${mutationCase.name} did not mutate its fixture`);
            writeFileSync(targetPath, mutated, 'utf8');

            const errors = await checkTrackedRoleConfig(tmpRoot);
            assert(
                errors.some((message) => message.includes(mutationCase.expected)),
                `Expected ${mutationCase.name} to produce ${mutationCase.expected}, got:\n${errors.join('\n')}`,
            );
        } finally {
            rmSync(tmpRoot, { recursive: true, force: true });
        }
    }
});

test('checkTrackedCodexRoleConfig accepts equivalent TOML syntax and supported tuning alternatives', async () => {
    const tmpRoot = createFixture();
    try {
        const configPath = path.join(tmpRoot, '.codex/config.toml');
        writeFileSync(
            configPath,
            `${readFileSync(configPath, 'utf8')
                .replace('max_depth = 1', 'max_depth = 1 # conservative nesting')
                .replace('config_file = "agents/worker.toml"', "config_file = 'agents/worker.toml'")}\n# worker_terra is retired\n`,
            'utf8',
        );

        const plannerPath = path.join(tmpRoot, '.codex/agents/planner.toml');
        writeFileSync(
            plannerPath,
            readFileSync(plannerPath, 'utf8')
                .replace('gpt-5.6-sol', 'gpt-5.5')
                .replace('model_reasoning_effort = "medium"', 'model_reasoning_effort = "max"')
                .replaceAll('"""', "'''"),
            'utf8',
        );

        const workerLunaPath = path.join(tmpRoot, '.codex/agents/worker-luna.toml');
        writeFileSync(
            workerLunaPath,
            readFileSync(workerLunaPath, 'utf8').replace('gpt-5.6-luna', 'gpt-5.4-mini'),
            'utf8',
        );

        const errors = await checkTrackedRoleConfig(tmpRoot);
        assert.deepEqual(errors, [], `Expected equivalent TOML and supported alternatives to pass, got:\n${errors.join('\n')}`);
    } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});

test('checkTrackedCodexRoleConfig rejects a symlinked role config that escapes .codex/agents', async () => {
    const tmpRoot = createFixture();
    try {
        const escapedPath = path.join(tmpRoot, 'escaped-worker.toml');
        writeFileSync(escapedPath, roleConfigContent('worker'), 'utf8');
        const workerPath = path.join(tmpRoot, '.codex/agents/worker.toml');
        rmSync(workerPath);
        symlinkSync('../../escaped-worker.toml', workerPath);

        const errors = await checkTrackedRoleConfig(tmpRoot);
        assert(
            errors.some((message) => message.includes(
                'Codex role config must be a regular, non-symlink file: .codex/agents/worker.toml',
            )),
            `Expected symlink escape rejection, got:\n${errors.join('\n')}`,
        );
    } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});

test('checkTrackedCodexRoleConfig rejects a primary config symlink that escapes .codex', async () => {
    const tmpRoot = createFixture();
    try {
        const configPath = path.join(tmpRoot, '.codex/config.toml');
        const escapedPath = path.join(tmpRoot, 'escaped-config.toml');
        writeFileSync(escapedPath, readFileSync(configPath, 'utf8'), 'utf8');
        rmSync(configPath);
        symlinkSync('../escaped-config.toml', configPath);

        const errors = await checkTrackedRoleConfig(tmpRoot);
        assert(
            errors.some((message) => message.includes(
                'Tracked Codex role config must be a regular, non-symlink file: .codex/config.toml',
            )),
            `Expected primary symlink rejection, got:\n${errors.join('\n')}`,
        );
    } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});

test('checkTrackedCodexRoleConfig rejects a role symlink to an internal untracked target', async () => {
    const tmpRoot = createFixture();
    try {
        const agentsDir = path.join(tmpRoot, '.codex/agents');
        const targetPath = path.join(agentsDir, 'untracked-worker.toml');
        writeFileSync(targetPath, roleConfigContent('worker'), 'utf8');
        const workerPath = path.join(agentsDir, 'worker.toml');
        rmSync(workerPath);
        symlinkSync('untracked-worker.toml', workerPath);

        const errors = await checkTrackedRoleConfig(tmpRoot);
        assert(
            errors.some((message) => message.includes(
                'Codex role config must be a regular, non-symlink file: .codex/agents/worker.toml',
            )),
            `Expected internal untracked symlink rejection, got:\n${errors.join('\n')}`,
        );
    } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});

test('checkTrackedCodexRoleConfig rejects special files without reading them', async () => {
    const tmpRoot = createFixture();
    try {
        const workerPath = path.join(tmpRoot, '.codex/agents/worker.toml');
        rmSync(workerPath);
        execFileSync('mkfifo', [workerPath], {
            timeout: GIT_TIMEOUT_MS,
            maxBuffer: GIT_MAX_BUFFER_BYTES,
        });

        const errors = await checkTrackedRoleConfig(tmpRoot);
        assert(
            errors.some((message) => message.includes(
                'Codex role config must be a regular, non-symlink file: .codex/agents/worker.toml',
            )),
            `Expected special-file rejection, got:\n${errors.join('\n')}`,
        );
    } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});
