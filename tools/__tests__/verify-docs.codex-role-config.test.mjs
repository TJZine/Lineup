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

    // Minimal role config: one required role points to an invalid config_file path.
    // This should be rejected rather than silently skipped.
    writeFileSync(
        path.join(codexDir, 'config.toml'),
        [
            '[agents]',
            'max_depth = 1',
            '',
            '[agents.worker]',
            'config_file = "worker.toml"',
            '',
        ].join('\n'),
        'utf8',
    );

    // Provide a real tracked agents file for at least one role so the verifier can proceed.
    writeFileSync(path.join(agentsDir, 'worker.toml'), 'sandbox_mode = "workspace-write"\n', 'utf8');

    git(tmpRoot, ['init']);
    git(tmpRoot, ['add', '.codex/config.toml', '.codex/agents/worker.toml']);

    const previousCwd = process.cwd();
    try {
        process.chdir(tmpRoot);

        const verifyDocsUrl = new URL(`../verify-docs.mjs?cacheBust=${Date.now()}`, import.meta.url);
        const { checkTrackedCodexRoleConfig } = await import(verifyDocsUrl.href);

        const errors = [];
        checkTrackedCodexRoleConfig(errors);

        assert(
            errors.some((message) => message.includes('config_file') && message.includes('agents/')),
            `Expected an invalid config_file error, got:\n${errors.map((m) => `- ${m}`).join('\n')}`
        );
    } finally {
        process.chdir(previousCwd);
    }
});

