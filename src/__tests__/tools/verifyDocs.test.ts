import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const verifierPath = path.resolve(process.cwd(), 'tools/verify-docs.mjs');
const skillMirrorManifestPath = 'docs/agentic/skill-mirror-allowlist.txt';

const requiredFiles = [
    'agents.md',
    'ARCHITECTURE_CLEANUP_CHECKLIST.md',
    'docs/AGENTIC_DEV_WORKFLOW.md',
    'docs/agentic/document-map.md',
    'docs/agentic/codanna-playbook.md',
    'docs/agentic/doc-gardening-checklist.md',
    'docs/agentic/evals/README.md',
    'docs/agentic/evals/baselines/README.md',
    'docs/agentic/evals/baseline-summaries/README.md',
    'docs/agentic/evals/baseline-summary-template.md',
    'docs/agentic/evals/rubric.md',
    'docs/agentic/evals/scorecard-template.md',
    'docs/agentic/historical-plan-corpus-review.md',
    'docs/agentic/plan-authoring-standard.md',
    'docs/agentic/session-prompts/README.md',
    'docs/agentic/session-prompts/cleanup-plan.md',
    'docs/agentic/session-prompts/cleanup-implement.md',
    'docs/agentic/session-prompts/cleanup-review.md',
    'docs/agentic/session-prompts/cleanup-loop.md',
    'docs/agentic/session-prompts/feature-plan.md',
    'docs/agentic/session-prompts/feature-review.md',
    'docs/agentic/session-prompts/workflow-harness-review.md',
    'docs/agentic/skill-strategy.md',
    'docs/agentic/evals-roadmap.md',
    'docs/agentic/phase-2-steady-state-plan.md',
    'docs/architecture/README.md',
    'docs/architecture/CURRENT_STATE.md',
    'docs/architecture/modules.md',
    'docs/decisions/README.md',
    'docs/plans/README.md',
    'docs/archive/plans/README.md',
    'docs/runs/README.md',
    skillMirrorManifestPath,
];

const expectedEvalPromptFiles = [
    '01-app-container-extraction-no-ui-drift.md',
    '02-lazy-screen-registry-no-dual-ownership.md',
    '03-overlay-toast-extraction-no-timer-leaks.md',
    '04-diagnostics-surface-isolation-no-storage-slop.md',
    '05-app-shell-cleanup-no-behavior-regression.md',
    '06-orchestrator-hotspot-extraction.md',
    '07-settings-storage-boundary.md',
    '08-server-selection-storage-boundary.md',
    '09-channel-persistence-boundary.md',
    '10-settings-screen-split.md',
    '11-plex-subtitle-policy.md',
    '12-architecture-doc-refresh.md',
    '13-risk-tiered-orchestration-and-local-only-absorption.md',
];

const expectedSessionPromptFiles = [
    'cleanup-plan.md',
    'cleanup-implement.md',
    'cleanup-review.md',
    'cleanup-loop.md',
    'feature-plan.md',
    'feature-review.md',
    'workflow-harness-review.md',
];

function writeRepoFile(repoRoot: string, relativePath: string, content = '# Placeholder\n'): void {
    const fullPath = path.join(repoRoot, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
}

function writeValidSkillMirrorFixture(repoRoot: string): void {
    writeRepoFile(repoRoot, skillMirrorManifestPath, 'superpowers:brainstorming\n');
    writeRepoFile(
        repoRoot,
        'docs/agentic/skill-strategy.md',
        [
            '# Skill Strategy',
            '',
            `Tracked mirror allowlist: ${skillMirrorManifestPath}`,
            '',
            '- `brainstorming`',
            '',
        ].join('\n')
    );
    writeRepoFile(
        repoRoot,
        'scripts/sync_agent_skills.sh',
        `#!/usr/bin/env bash\nskill_manifest_path="${skillMirrorManifestPath}"\n`
    );
}

function writeValidSessionPromptFixture(repoRoot: string): void {
    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/README.md',
        [
            '# Session Prompt Launchers',
            '',
            '- [cleanup-plan](./cleanup-plan.md)',
            '- [cleanup-implement](./cleanup-implement.md)',
            '- [cleanup-review](./cleanup-review.md)',
            '- [cleanup-loop](./cleanup-loop.md)',
            '- [feature-plan](./feature-plan.md)',
            '- [feature-review](./feature-review.md)',
            '- [workflow-harness-review](./workflow-harness-review.md)',
            '',
            '## Routing (Authoritative)',
            '',
            'cleanup/refactor',
            'feature/design',
            'mixed',
            'feature-plan',
            'feature-review',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/AGENTIC_DEV_WORKFLOW.md',
        [
            '# Workflow',
            '',
            'Route task family before choosing a tier.',
            '',
            '[cleanup-plan](./agentic/session-prompts/cleanup-plan.md)',
            '[cleanup-review](./agentic/session-prompts/cleanup-review.md)',
            '[feature-plan](./agentic/session-prompts/feature-plan.md)',
            '[feature-review](./agentic/session-prompts/feature-review.md)',
            '',
        ].join('\n')
    );

    for (const prompt of expectedSessionPromptFiles) {
        writeRepoFile(repoRoot, `docs/agentic/session-prompts/${prompt}`);
    }
}

function createRepoFixture(
    overrides: Partial<Record<string, string>> = {},
): string {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-'));

    for (const file of requiredFiles) {
        writeRepoFile(repoRoot, file);
    }

    writeRepoFile(repoRoot, 'docs/runs/_template/Plan.md');
    writeRepoFile(repoRoot, 'docs/development/setup.md');
    writeRepoFile(repoRoot, 'docs/development/debugging.md');
    writeRepoFile(repoRoot, 'docs/development/subtitles.md');
    writeRepoFile(repoRoot, 'docs/development/testing.md');
    writeValidSkillMirrorFixture(repoRoot);
    writeValidSessionPromptFixture(repoRoot);

    for (const prompt of expectedEvalPromptFiles) {
        writeRepoFile(repoRoot, `docs/agentic/evals/prompts/${prompt}`);
    }

    for (const [relativePath, content] of Object.entries(overrides)) {
        writeRepoFile(repoRoot, relativePath, content);
    }

    return repoRoot;
}

function runVerifier(repoRoot: string): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [verifierPath], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
}

describe('verify-docs', () => {
    const tempRoots: string[] = [];

    afterEach(() => {
        for (const tempRoot of tempRoots.splice(0)) {
            chmodSync(path.join(tempRoot, 'docs/AGENTIC_DEV_WORKFLOW.md'), 0o644);
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('fails when docs/development/testing.md contains a broken tracked link', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\n[Broken](./missing-guide.md)\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('docs/development/testing.md');
        expect(result.stderr).toContain('./missing-guide.md');
    });

    it('fails when a tracked doc links to a local-only run artifact', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/evals/README.md': '# Agent Evals\n\n[Local run](../../runs/2026-03-06-smoke/Plan.md)\n',
            'docs/runs/2026-03-06-smoke/Plan.md': '# Local run artifact\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('local-only');
        expect(result.stderr).toContain('docs/agentic/evals/README.md');
    });

    it('allows links to tracked docs/runs template surfaces', () => {
        const repoRoot = createRepoFixture({
            'docs/runs/README.md': '# Runs\n\n[Template](./_template)\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when a tracked markdown file cannot be read', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        chmodSync(path.join(repoRoot, 'docs/AGENTIC_DEV_WORKFLOW.md'), 0);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('read');
        expect(result.stderr).toContain('docs/AGENTIC_DEV_WORKFLOW.md');
    });

    it('ignores non-decision markdown links in the decisions index', () => {
        const repoRoot = createRepoFixture({
            'docs/decisions/README.md': [
                '# Decisions',
                '',
                '- [Real decision](./2026-03-06-real-decision.md)',
                '- [Plans README](../plans/README.md)',
                '',
            ].join('\n'),
            'docs/decisions/2026-03-06-real-decision.md': '# Real decision\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });
});
