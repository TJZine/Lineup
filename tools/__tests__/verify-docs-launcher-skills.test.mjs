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

const launcherSkillNames = [
    'lineup-cleanup-plan',
    'lineup-cleanup-implement',
    'lineup-cleanup-review',
    'lineup-cleanup-loop',
    'lineup-feature-plan',
    'lineup-feature-implement',
    'lineup-feature-review',
    'lineup-workflow-harness-review',
    'repo-production-review',
];

function writeLauncherSkill(tmpRoot, skillName, readList) {
    const skillDir = path.join(tmpRoot, '.agents', 'skills', skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), readList.join('\n'), 'utf8');
}

function writeValidLauncherSkills(tmpRoot) {
    for (const skillName of launcherSkillNames) {
        writeLauncherSkill(tmpRoot, skillName, [
            'Read these files in order:',
            '',
            '1. `docs/AGENTIC_DEV_WORKFLOW.md`',
            '2. `agents.md`',
            '',
        ]);
    }
}

test('checkRepoLocalLauncherSkillReadOrders rejects ignored entrypoint and document-map reads', async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-launchers-'));
    writeValidLauncherSkills(tmpRoot);
    writeLauncherSkill(
        tmpRoot,
        'lineup-cleanup-plan',
        [
            'Read these files in order:',
            '',
            '1. `AGENTS.md`',
            '2. `docs/agentic/document-map.md`',
            '3. `docs/AGENTIC_DEV_WORKFLOW.md`',
            '4. `docs/agentic/session-prompts/cleanup-plan.md`',
            '',
        ],
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
    writeValidLauncherSkills(tmpRoot);

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

test('checkRepoLocalLauncherSkillReadOrders rejects reversed workflow and entrypoint read order', async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-launchers-'));
    writeValidLauncherSkills(tmpRoot);
    writeLauncherSkill(
        tmpRoot,
        'lineup-cleanup-plan',
        [
            'Read these files in order:',
            '',
            '1. `agents.md`',
            '2. `docs/AGENTIC_DEV_WORKFLOW.md`',
            '3. `docs/agentic/session-prompts/cleanup-plan.md`',
            '',
        ],
    );

    const previousCwd = process.cwd();
    try {
        process.chdir(tmpRoot);

        const { checkRepoLocalLauncherSkillReadOrders } = await import(verifyDocsUrl().href);

        const errors = [];
        checkRepoLocalLauncherSkillReadOrders(errors);

        assert(
            errors.some((message) => message.includes('canonical launcher bootstrap order')),
            `Expected a read-order error, got:\n${errors.map((message) => `- ${message}`).join('\n')}`,
        );
    } finally {
        process.chdir(previousCwd);
        rmSync(tmpRoot, { recursive: true, force: true });
    }
});
