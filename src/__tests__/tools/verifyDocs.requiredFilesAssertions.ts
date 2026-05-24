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

    it('fails when a tracked doc links to a legacy singular-agent artifact', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\n[Legacy mirror](../../.agent/skills/foo/SKILL.md)\n',
            '.agent/skills/foo/SKILL.md': '# Local legacy mirror\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Tracked doc docs/development/testing.md links to local-only artifact');
        expect(result.stderr).toContain('../../.agent/skills/foo/SKILL.md');
    });

    it('fails when a tracked doc contains a concrete legacy skill mirror path', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\nRaw mirror artifact: .agent/skills/foo/SKILL.md\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('.agent/skills/foo/SKILL.md');
    });

    it('fails when an active tracked doc contains a raw obsolete .codex skill source path', () => {
        const repoRoot = createRepoFixture({
            '.agents/skills/verification-strategy/SKILL.md':
                '# verification-strategy\n\nRaw obsolete skill source: .codex/skills/foo/SKILL.md\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('.codex/skills/foo/SKILL.md');
    });

    it('allows historical baseline summaries to mention obsolete .codex skill source paths', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/evals/baseline-summaries/2026-01-01-historical.md':
                '# Historical\n\nPast evidence read `.codex/skills/foo/SKILL.md`.\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('allows tracked policy docs to mention obsolete .codex skill source paths only as forbidden examples', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/doc-gardening-checklist.md':
                '# Gardening\n\n- no legacy singular-agent mirror or `.codex/skills` source has reappeared\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when an active tracked plan contains a raw obsolete .codex skill source path', () => {
        const repoRoot = createRepoFixture({
            'docs/plans/2026-01-01-example-plan.md':
                '**Plan Status:** active\n\n# Example\n\nRequired read: `.codex/skills/foo/SKILL.md`\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('docs/plans/2026-01-01-example-plan.md');
        expect(result.stderr).toContain('.codex/skills/foo/SKILL.md');
    });

    it('fails when a tracked doc depends on ignored local desloppify skill files', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md':
                '# Testing\n\n[Ignored local skill](../../.agents/skills/desloppify/SKILL.md)\n',
            '.agents/skills/desloppify/SKILL.md': '# Local desloppify skill\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Tracked doc docs/development/testing.md links to local-only artifact');
        expect(result.stderr).toContain('../../.agents/skills/desloppify/SKILL.md');
    });

    it('does not scan ignored local desloppify skill contents as tracked markdown', () => {
        const repoRoot = createRepoFixture({
            '.agents/skills/desloppify/SKILL.md': '# Local desloppify skill\n\n[Broken](./missing.md)\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
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

        rmSync(path.join(repoRoot, '.agents/skills/verification-strategy'), { recursive: true, force: true });

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Missing required repo-local canonical skill `verification-strategy`: .agents/skills/verification-strategy/SKILL.md'
        );
    });

    it('fails when a required repo-local launcher skill file is missing', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        rmSync(path.join(repoRoot, '.agents/skills/lineup-feature-plan'), { recursive: true, force: true });

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Missing required repo-local canonical skill `lineup-feature-plan`: .agents/skills/lineup-feature-plan/SKILL.md'
        );
    });

    it('fails when a required repo-local canonical skill file exists locally but is not tracked', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        runGit(['rm', '--cached', '--quiet', '.agents/skills/verification-strategy/SKILL.md'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Required repo-local canonical skill is not tracked: .agents/skills/verification-strategy/SKILL.md'
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
