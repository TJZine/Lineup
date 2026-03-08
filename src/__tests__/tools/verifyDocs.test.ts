import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const verifierPath = path.resolve(process.cwd(), 'tools/verify-docs.mjs');

type PromptInventories = {
    expectedEvalPromptFiles: string[];
    expectedSessionPromptFiles: string[];
    skillMirrorManifestPath: string;
    sessionPromptSetStartMarker: string;
    sessionPromptSetEndMarker: string;
    evalPromptInventoryStartMarker: string;
    evalPromptInventoryEndMarker: string;
    renderedSessionPromptSet: string;
    renderedEvalPromptInventory: string;
};

function loadPromptInventoriesFromHarnessDocsLib(): PromptInventories {
    const harnessDocsLibPath = path.resolve(process.cwd(), 'tools/harness-docs-lib.mjs');
    const harnessDocsLibUrl = pathToFileURL(harnessDocsLibPath).href;
    const script = [
        `const lib = await import(${JSON.stringify(harnessDocsLibUrl)});`,
        'const payload = {',
        '  expectedEvalPromptFiles: lib.EXPECTED_EVAL_PROMPT_FILES,',
        '  expectedSessionPromptFiles: lib.EXPECTED_SESSION_PROMPT_FILES,',
        '  skillMirrorManifestPath: lib.SKILL_MIRROR_MANIFEST_PATH,',
        '  sessionPromptSetStartMarker: lib.SESSION_PROMPT_SET_START_MARKER,',
        '  sessionPromptSetEndMarker: lib.SESSION_PROMPT_SET_END_MARKER,',
        '  evalPromptInventoryStartMarker: lib.EVAL_PROMPT_INVENTORY_START_MARKER,',
        '  evalPromptInventoryEndMarker: lib.EVAL_PROMPT_INVENTORY_END_MARKER,',
        '  renderedSessionPromptSet: lib.renderSessionPromptSet(),',
        '  renderedEvalPromptInventory: lib.renderEvalPromptInventory(),',
        '};',
        'console.log(JSON.stringify(payload));',
    ].join('\n');

    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        const errorOutput = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
        throw new Error(`Failed to load expected prompt inventories from harness-docs-lib.mjs: ${errorOutput}`);
    }

    const parsed = JSON.parse(result.stdout) as PromptInventories;
    return parsed;
}

const {
    expectedEvalPromptFiles,
    expectedSessionPromptFiles,
    skillMirrorManifestPath,
    sessionPromptSetStartMarker,
    sessionPromptSetEndMarker,
    evalPromptInventoryStartMarker,
    evalPromptInventoryEndMarker,
    renderedSessionPromptSet,
    renderedEvalPromptInventory,
} = loadPromptInventoriesFromHarnessDocsLib();

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
            '## Prompt Set',
            '',
            sessionPromptSetStartMarker,
            renderedSessionPromptSet,
            sessionPromptSetEndMarker,
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

function writeValidEvalPromptFixture(repoRoot: string): void {
    writeRepoFile(
        repoRoot,
        'docs/agentic/evals/README.md',
        [
            '# Agent Evals',
            '',
            '## Prompt Inventory',
            '',
            evalPromptInventoryStartMarker,
            renderedEvalPromptInventory,
            evalPromptInventoryEndMarker,
            '',
        ].join('\n')
    );
}

function writeMutatedEvalPromptFixture(repoRoot: string): void {
    const mutatedEvalPromptInventory = renderedEvalPromptInventory.replace(
        /11 Plex Subtitle Policy/u,
        '11 Plex Subtitle Policy (MUTATED)'
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/evals/README.md',
        [
            '# Agent Evals',
            '',
            '## Prompt Inventory',
            '',
            evalPromptInventoryStartMarker,
            mutatedEvalPromptInventory,
            evalPromptInventoryEndMarker,
            '',
        ].join('\n')
    );
}

function createRepoFixture(
    overrides: Partial<Record<string, string>> = {},
): string {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-'));

    for (const file of requiredFiles) {
        writeRepoFile(repoRoot, file);
    }

    writeRepoFile(repoRoot, 'docs/runs/_template/Plan.md');
    writeRepoFile(repoRoot, 'docs/runs/_template/Prompt.md');
    writeRepoFile(repoRoot, 'docs/runs/_template/Implement.md');
    writeRepoFile(repoRoot, 'docs/runs/_template/Documentation.md');
    writeRepoFile(repoRoot, 'docs/development/setup.md');
    writeRepoFile(repoRoot, 'docs/development/debugging.md');
    writeRepoFile(repoRoot, 'docs/development/subtitles.md');
    writeRepoFile(repoRoot, 'docs/development/testing.md');
    writeValidSkillMirrorFixture(repoRoot);
    writeValidSessionPromptFixture(repoRoot);
    writeValidEvalPromptFixture(repoRoot);

    for (const prompt of expectedEvalPromptFiles) {
        writeRepoFile(repoRoot, `docs/agentic/evals/prompts/${prompt}`);
    }

    for (const [relativePath, content] of Object.entries(overrides)) {
        writeRepoFile(repoRoot, relativePath, content);
    }

    spawnSync('git', ['init', '-q'], { cwd: repoRoot, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.email', 'verify-docs@test.local'], { cwd: repoRoot, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.name', 'Verify Docs Test'], { cwd: repoRoot, encoding: 'utf8' });
    spawnSync('git', ['add', '.'], { cwd: repoRoot, encoding: 'utf8' });

    return repoRoot;
}

function runVerifier(
    repoRoot: string,
    args: string[] = [],
    env: NodeJS.ProcessEnv | undefined = undefined
): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [verifierPath, ...args], {
        cwd: repoRoot,
        encoding: 'utf8',
        env,
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

    it('fails when eval README managed prompt-inventory section is out of sync', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeMutatedEvalPromptFixture(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Eval README managed prompt-inventory section is out of sync');
    });

    it('fails when a tracked doc links to a local-only run artifact', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\n[Local run](../runs/2026-03-06-smoke/Plan.md)\n',
            'docs/runs/2026-03-06-smoke/Plan.md': '# Local run artifact\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('local-only');
        expect(result.stderr).toContain('docs/development/testing.md');
    });

    it('fails when one tracked doc contains multiple raw local-only baseline references', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': [
                '# Testing',
                '',
                'First raw artifact: docs/agentic/evals/baselines/2026-03-06-a.md',
                'Second raw artifact: docs/agentic/evals/baselines/2026-03-06-b.md',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('docs/agentic/evals/baselines/2026-03-06-a.md');
        expect(result.stderr).toContain('docs/agentic/evals/baselines/2026-03-06-b.md');
    });

    it('allows placeholder local-only paths that do not point to concrete artifacts', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': [
                '# Testing',
                '',
                '- Keep raw artifacts local-only under `docs/agentic/evals/baselines/<run-id>.md`.',
                '- Keep run bundles local-only under `docs/runs/<date>-<topic>/Plan.md`.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
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

    it('fails when docs/runs/_template is missing', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        rmSync(path.join(repoRoot, 'docs/runs/_template'), { recursive: true, force: true });

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Missing required control-plane directory: docs/runs/_template');
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

    it('workspace mode warns but does not fail for untracked checklist plan refs with draft content', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '- [x] Example done item (plan: docs/archive/plans/example-summary.md)',
                '- [ ] Local draft item (plan: docs/plans/example-draft.md)',
                '',
            ].join('\n'),
            'docs/archive/plans/example-summary.md': [
                '# Example Summary',
                '',
                'Tracked summary placeholder.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-draft.md', '# Draft scratch plan\n');

        const result = runVerifier(repoRoot, ['--workspace']);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed with warnings:');
        expect(result.stdout).toContain('docs/plans/example-draft.md');
        expect(result.stdout).not.toContain('missing required serious-plan sections');
    });

    it('deduplicates repeated checklist diagnostics when multiple items share one plan path', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '- [ ] Local draft item A (plan: docs/plans/example-draft.md)',
                '- [ ] Local draft item B (plan: docs/plans/example-draft.md)',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-draft.md', '# Draft scratch plan\n');

        const result = runVerifier(repoRoot, ['--workspace']);
        const stdout = String(result.stdout);

        expect(result.status).toBe(0);
        expect(stdout).toContain('Documentation verification passed with warnings:');
        expect(stdout.match(/example-draft\.md/g)?.length).toBe(1);
    });

    it('deduplicates tracked-plan git errors when git is unavailable', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        const missingGitBinDir = path.join(repoRoot, 'no-git-bin');
        mkdirSync(missingGitBinDir, { recursive: true });
        const env = { ...process.env, PATH: missingGitBinDir };

        const result = runVerifier(repoRoot, [], env);
        const stderr = String(result.stderr);

        expect(result.status).toBe(1);
        expect(stderr).toContain('list tracked plan files via git');
        expect(stderr.match(/list tracked plan files via git/g)?.length).toBe(1);
    });
});
