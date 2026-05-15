import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

let importCounter = 0;

function verifyDocsUrl() {
    importCounter += 1;
    return new URL(`../verify-docs.mjs?cacheBust=launcher-${importCounter}`, import.meta.url);
}

test('checkRepoLocalLauncherSkillReadOrders rejects ignored entrypoint and document-map reads', async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-launchers-'));
    const skillDir = path.join(tmpRoot, '.codex', 'skills', 'lineup-cleanup-plan');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        [
            'Read these files in order:',
            '',
            '1. `AGENTS.md`',
            '2. `docs/agentic/document-map.md`',
            '3. `docs/AGENTIC_DEV_WORKFLOW.md`',
            '4. `docs/agentic/session-prompts/cleanup-plan.md`',
            '',
        ].join('\n'),
        'utf8',
    );

    const previousCwd = process.cwd();
    try {
        process.chdir(tmpRoot);

        const { checkRepoLocalLauncherSkillReadOrders } = await import(verifyDocsUrl().href);

        const errors = [];
        checkRepoLocalLauncherSkillReadOrders(errors);

        assert(
            errors.some((message) => message.includes('tracked agents.md') && message.includes('ignored AGENTS.md')),
            `Expected an ignored AGENTS.md error, got:\n${errors.map((message) => `- ${message}`).join('\n')}`,
        );
        assert(
            errors.some((message) => message.includes('must not require docs/agentic/document-map.md')),
            `Expected a document-map read-order error, got:\n${errors.map((message) => `- ${message}`).join('\n')}`,
        );
    } finally {
        process.chdir(previousCwd);
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});

test('checkRepoLocalLauncherSkillReadOrders accepts tracked entrypoint and workflow reads', async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-launchers-'));
    const skillDir = path.join(tmpRoot, '.codex', 'skills', 'lineup-cleanup-plan');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        [
            'Read these files in order:',
            '',
            '1. `agents.md`',
            '2. `docs/AGENTIC_DEV_WORKFLOW.md`',
            '3. `docs/agentic/session-prompts/cleanup-plan.md`',
            '',
        ].join('\n'),
        'utf8',
    );

    const previousCwd = process.cwd();
    try {
        process.chdir(tmpRoot);

        const { checkRepoLocalLauncherSkillReadOrders } = await import(verifyDocsUrl().href);

        const errors = [];
        checkRepoLocalLauncherSkillReadOrders(errors);

        assert.deepEqual(errors, []);
    } finally {
        process.chdir(previousCwd);
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});
