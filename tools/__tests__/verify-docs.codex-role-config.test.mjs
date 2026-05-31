import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function git(cwd, args) {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
}

test('checkTrackedCodexRoleConfig reports invalid config_file paths (must be agents/*.toml)', async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-'));
    const codexDir = path.join(tmpRoot, '.codex');
    const agentsDir = path.join(codexDir, 'agents');
    mkdirSync(agentsDir, { recursive: true });

    // Create minimal marker docs so isCodexRoleWorkflowTracked() doesn't add noise.
    mkdirSync(path.join(tmpRoot, 'docs', 'agentic'), { recursive: true });
    writeFileSync(
        path.join(tmpRoot, 'docs', 'AGENTIC_DEV_WORKFLOW.md'),
        'This workflow is tracked. See .codex/config.toml and .codex/agents/ for role config.\n',
        'utf8',
    );
    writeFileSync(
        path.join(tmpRoot, 'docs', 'agentic', 'skill-strategy.md'),
        'Tracked skill strategy. Role config lives at .codex/config.toml and .codex/agents/.\n',
        'utf8',
    );

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
        'worker_54_high',
        'cleanup_worker',
        'monitor',
        'monitor_fallback',
    ];

    // One required role points to an invalid config_file path. This should be rejected rather
    // than silently skipped.
    const configLines = ['[agents]', 'max_depth = 1', ''];
    for (const role of requiredRoles) {
        configLines.push(`[agents.${role}]`);
        configLines.push(`config_file = "${role === 'worker' ? 'worker.toml' : `agents/${role}.toml`}"`);
        configLines.push('');
    }
    writeFileSync(path.join(codexDir, 'config.toml'), configLines.join('\n'), 'utf8');

    // Provide tracked agents files for the valid declarations.
    for (const role of requiredRoles) {
        writeFileSync(
            path.join(agentsDir, `${role}.toml`),
            role === 'worker' || role === 'worker_54_high' || role === 'cleanup_worker' || role === 'planner' || role === 'planner_deep'
                ? 'developer_instructions = """\nown bounded planning work\nnot product-code implementation\nplanning artifacts\nexecution-ready handoffs\nleave implementation to the worker role\ndeep planning work\ntier 3\nunresolved architecture/product seam\ndo not implement product code\napproved, bounded, exact, cheap-to-verify execution units\ncurrent execution packet\nstop and escalate on ambiguity\nplan contradiction\nverification failure that needs diagnosis\nbounded cleanup-loop implementation write scope\nsmallest defensible cleanup change\napproved execution unit\ntier 3 cleanup-loop implementation passes\nleave general implementation routing to the worker role\n"""\n'
                : 'sandbox_mode = "read-only"\n',
            'utf8',
        );
    }

    git(tmpRoot, ['init']);
    git(tmpRoot, [
        'add',
        '.codex/config.toml',
        '.codex/agents',
        'docs/AGENTIC_DEV_WORKFLOW.md',
        'docs/agentic/skill-strategy.md',
    ]);

    const previousCwd = process.cwd();
    try {
        process.chdir(tmpRoot);

        const verifyDocsUrl = new URL(`../verify-docs.mjs?cacheBust=${Date.now()}`, import.meta.url);
        const { checkTrackedCodexRoleConfig } = await import(verifyDocsUrl.href);

        const errors = [];
        checkTrackedCodexRoleConfig(errors);

        assert(
            errors.some(
                (message) =>
                    message.includes('config_file') &&
                    message.includes('agents/*.toml') &&
                    message.includes('role=worker'),
            ),
            `Expected an invalid config_file error, got:\n${errors.map((m) => `- ${m}`).join('\n')}`
        );
    } finally {
        process.chdir(previousCwd);
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});

test('checkTrackedCodexRoleConfig requires specialized reviewer roles to be read-only and role-specific without pinning exact models', async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-'));
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
        ['worker_54_high', 'agents/worker-54-high.toml'],
        ['cleanup_worker', 'agents/cleanup-worker.toml'],
        ['monitor', 'agents/monitor.toml'],
        ['monitor_fallback', 'agents/monitor-fallback.toml'],
    ]);

    const configLines = ['[agents]', 'max_depth = 1', ''];
    for (const [role, configFile] of roleConfigFiles.entries()) {
        configLines.push(`[agents.${role}]`);
        configLines.push('description = "tracked role marker cleanup-loop-specific implementer approved tier 3 cleanup-loop implementation passes deep planning writer tier 3 not product-code implementation cost-optimized write-capable implementer approved cheap-to-verify read-only reviewer code-health no style-only blocking hotspots security-adjacent architecture risk"');
        configLines.push(`config_file = "${configFile}"`);
        configLines.push('');
    }
    writeFileSync(path.join(codexDir, 'config.toml'), configLines.join('\n'), 'utf8');

    for (const [role, configFile] of roleConfigFiles.entries()) {
        const filePath = path.join(codexDir, configFile);
        const writeCapableContent = 'model = "intentionally-not-enforced"\ndeveloper_instructions = """\nown bounded planning work\nnot product-code implementation\nplanning artifacts\nexecution-ready handoffs\nleave implementation to the worker role\ndeep planning work\ntier 3\nunresolved architecture/product seam\ndo not implement product code\napproved, bounded, exact, cheap-to-verify execution units\ncurrent execution packet\nstop and escalate on ambiguity\nplan contradiction\nverification failure that needs diagnosis\nbounded cleanup-loop implementation write scope\nsmallest defensible cleanup change\napproved execution unit\ntier 3 cleanup-loop implementation passes\nleave general implementation routing to the worker role\n"""\n';
        const readOnlyContent = role === 'architecture_reviewer' ? 'model = "not-checked"\n' : 'model = "not-checked"\nsandbox_mode = "read-only"\n';
        writeFileSync(
            filePath,
            role === 'worker' || role === 'worker_54_high' || role === 'cleanup_worker' || role === 'planner' || role === 'planner_deep'
                ? writeCapableContent
                : readOnlyContent,
            'utf8',
        );
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

    const previousCwd = process.cwd();
    try {
        process.chdir(tmpRoot);

        const verifyDocsUrl = new URL(`../verify-docs.mjs?cacheBust=${Date.now()}-readonly`, import.meta.url);
        const { checkTrackedCodexRoleConfig } = await import(verifyDocsUrl.href);

        const errors = [];
        checkTrackedCodexRoleConfig(errors);

        assert(
            errors.some(
                (message) =>
                    message.includes('Read-only Codex role config must set sandbox_mode = "read-only"') &&
                    message.includes('.codex/agents/architecture-reviewer.toml'),
            ),
            `Expected a read-only sandbox error for architecture_reviewer, got:\n${errors.map((m) => `- ${m}`).join('\n')}`
        );
        assert(
            errors.some(
                (message) =>
                    message.includes('Codex role config is missing required maintainability_reviewer boundary marker') &&
                    message.includes('.codex/agents/maintainability-reviewer.toml'),
            ),
            `Expected maintainability_reviewer role-contract errors, got:\n${errors.map((m) => `- ${m}`).join('\n')}`
        );
        assert(
            errors.some(
                (message) =>
                    message.includes('Codex role config is missing required architecture_reviewer boundary marker') &&
                    message.includes('.codex/agents/architecture-reviewer.toml'),
            ),
            `Expected architecture_reviewer role-contract errors, got:\n${errors.map((m) => `- ${m}`).join('\n')}`
        );
        assert(
            errors.every((message) => !message.includes('model')),
            `Expected no exact model enforcement errors, got:\n${errors.map((m) => `- ${m}`).join('\n')}`
        );
    } finally {
        process.chdir(previousCwd);
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});
