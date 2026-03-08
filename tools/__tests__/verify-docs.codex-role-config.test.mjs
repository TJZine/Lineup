import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
        'docs_researcher',
        'worker',
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
            `sandbox_mode = "${role === 'worker' ? 'workspace-write' : 'read-only'}"\n`,
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
    }
});
