import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import {
    type VerifyDocsTestContext,
    createRepoFixture,
    runGit,
    runVerifier,
    writeMutatedEvalPromptFixture,
} from './verifyDocsTestHelpers';

export function registerVerifyDocsRequiredFilesAssertions({ tempRoots }: VerifyDocsTestContext): void {
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

    it('fails when a tracked doc links to a concrete .agents artifact', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\n[Local agent note](../../.agents/run-logs/session.md)\n',
            '.agents/run-logs/session.md': '# Local agent note\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Tracked doc docs/development/testing.md links to local-only artifact');
        expect(result.stderr).toContain('../../.agents/run-logs/session.md');
    });

    it('fails when a tracked doc contains a raw .agents literal path', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\nRaw local agent artifact: .agents/run-logs/session.md\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('.agents/run-logs/session.md');
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

        const workflowPath = path.join(repoRoot, 'docs/AGENTIC_DEV_WORKFLOW.md');
        rmSync(workflowPath, { force: true });
        mkdirSync(workflowPath, { recursive: true });

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

    it('fails when a required repo-local canonical skill file is missing', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        rmSync(path.join(repoRoot, '.codex/skills/verification-strategy'), { recursive: true, force: true });

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Missing required repo-local canonical skill `verification-strategy`: .codex/skills/verification-strategy/SKILL.md'
        );
    });

    it('fails when a required repo-local canonical skill file exists locally but is not tracked', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        runGit(['rm', '--cached', '--quiet', '.codex/skills/verification-strategy/SKILL.md'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Required repo-local canonical skill is not tracked: .codex/skills/verification-strategy/SKILL.md'
        );
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
}
