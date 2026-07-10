import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const requiredRoles = [
    'explorer',
    'explorer_fallback',
    'reviewer',
    'maintainability_reviewer',
    'architecture_reviewer',
    'docs_researcher',
    'planner',
    'planner_deep',
    'worker',
    'worker_luna',
    'cleanup_worker',
    'monitor',
    'monitor_fallback',
];

const roleConfigFiles = new Map([
    ['explorer', 'agents/explorer.toml'],
    ['explorer_fallback', 'agents/explorer-fallback.toml'],
    ['reviewer', 'agents/reviewer.toml'],
    ['maintainability_reviewer', 'agents/maintainability-reviewer.toml'],
    ['architecture_reviewer', 'agents/architecture-reviewer.toml'],
    ['docs_researcher', 'agents/docs-researcher.toml'],
    ['planner', 'agents/planner.toml'],
    ['planner_deep', 'agents/planner-deep.toml'],
    ['worker', 'agents/worker.toml'],
    ['worker_luna', 'agents/worker-luna.toml'],
    ['cleanup_worker', 'agents/cleanup-worker.toml'],
    ['monitor', 'agents/monitor.toml'],
    ['monitor_fallback', 'agents/monitor-fallback.toml'],
]);

const readOnlyRoles = new Set([
    'explorer',
    'explorer_fallback',
    'reviewer',
    'maintainability_reviewer',
    'architecture_reviewer',
    'docs_researcher',
    'monitor',
    'monitor_fallback',
]);

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

function git(cwd, args) {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function configuredRoleInstruction(role) {
    return `Begin your first assistant response with \`CONFIGURED ROLE: ${role}\` on its own line. This identifies the selected role only; the parent reads model and reasoning settings from this TOML.`;
}

function roleConfigContent(role) {
    return [
        'model = "test-model"',
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
            name: 'missing exact configured-role marker',
            relativePath: '.codex/agents/worker-luna.toml',
            mutate: (content) => content.replace('CONFIGURED ROLE: worker_luna', 'CONFIGURED ROLE: worker'),
            expected: 'Codex role config is missing exact CONFIGURED ROLE marker for worker_luna',
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
            mutate: (content) => `${content}Do not delegate this unit to worker_terra.\n`,
            expected: 'Codex role config must not mention retired role worker_terra',
        },
        {
            name: 'read-only enforcement',
            relativePath: '.codex/agents/reviewer.toml',
            mutate: (content) => content.replace('sandbox_mode = "read-only"\n', ''),
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
