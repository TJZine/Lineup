import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    type VerifyDocsTestContext,
    buildChecklistLinkedPackageDecomposition,
    createRepoFixture,
    runGit,
    runVerifier,
    writeRepoFile,
} from './verifyDocsTestHelpers';

export function registerVerifyDocsActivePlanChecklistAssertions({ tempRoots }: VerifyDocsTestContext): void {
    it('workspace mode warns but does not fail for untracked checklist plan refs with draft content', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '- Cleanup slice execution template:',
                '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
                '- Priority exit command checklist:',
                '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
                '',
                '- [x] Example done item (plan: docs/archive/plans/example-summary.md)',
                '- [ ] Local draft item (plan: docs/plans/example-draft.md)',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
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

    it('strict mode warns but does not fail for untracked checklist plan refs with draft content', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '- Cleanup slice execution template:',
                '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
                '- Priority exit command checklist:',
                '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
                '',
                '- [x] Example done item (plan: docs/archive/plans/example-summary.md)',
                '- [ ] Local draft item (plan: docs/plans/example-draft.md)',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
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

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed with warnings:');
        expect(result.stdout).toContain('docs/plans/example-draft.md');
        expect(result.stderr).not.toContain('Checklist references untracked plan path');
    });

    it('fails when a checklist-linked tracked plan omits the exact active marker', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-active.md', '# Example Implementation Plan\n\n**Goal:** Do the thing.\n');
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('docs/plans/example-active.md');
        expect(result.stderr).toContain('must include exact active plan marker');
        expect(result.stderr).not.toContain('missing required serious-plan sections');
    });

    it('fails when an active tracked plan omits the verification classification marker', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition(),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'verification commands section must classify verification strategy with one exact plan-standard marker'
        );
    });

    it('fails when an active tracked plan declares more than one verification classification marker', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '- Verification classification: `no new automated test needed`',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition(),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'verification commands section must classify verification strategy with one exact plan-standard marker'
        );
    });

    it('passes when an active tracked plan uses an inline Required Skills block', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '**Required Skills:**',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition(),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
    });

    it('passes when a checklist-linked tracked plan uses the exact active marker and full serious-plan structure', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition(),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when a checklist-linked tracked plan omits ready_now_execution_unit', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition().replace(
                    '- `ready_now_execution_unit`: `P1-W1-S1`\n',
                    ''
                ),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'docs/plans/example-active.md checklist-linked plans must include `ready_now_execution_unit` in `## Package Decomposition`'
        );
    });

    it('fails when a checklist-linked tracked plan omits required slice_table execution fields', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition().replace(
                    '- `verification`:\n  - `npm run verify:docs`\n',
                    ''
                ),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'docs/plans/example-active.md P1-W1-S1 in `slice_table` must include `verification`'
        );
    });

    it('fails when an active tracked plan omits required classification fields', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
            ].join('\n')
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('missing required plan classification field: **Task family:**');
    });

    it('deduplicates repeated checklist diagnostics when multiple items share one plan path', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '- Cleanup slice execution template:',
                '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
                '- Priority exit command checklist:',
                '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
                '',
                '- [ ] Local draft item A (plan: docs/plans/example-draft.md)',
                '- [ ] Local draft item B (plan: docs/plans/example-draft.md)',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
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

    it('fails fast when git fixture bootstrap fails', () => {
        const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-git-fail-'));
        try {
            const missingGitBinDir = path.join(repoRoot, 'no-git-bin');
            mkdirSync(missingGitBinDir, { recursive: true });
            const env = { ...process.env, PATH: missingGitBinDir };

            expect(() => runGit(['status'], repoRoot, env)).toThrow(/git status failed/u);
        } finally {
            rmSync(repoRoot, { recursive: true, force: true });
        }
    });

    it('does not emit plan-related diagnostics when tracked-plan lookup fails', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '- [ ] Local draft item (plan: docs/plans/example-draft.md)',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-draft.md', '# Draft scratch plan\n');

        const missingGitBinDir = path.join(repoRoot, 'no-git-bin');
        mkdirSync(missingGitBinDir, { recursive: true });
        const env = { ...process.env, PATH: missingGitBinDir };

        const result = runVerifier(repoRoot, [], env);
        const stderr = String(result.stderr);

        expect(result.status).toBe(1);
        expect(stderr).toContain('list tracked plan files via git');
        expect(stderr).not.toContain('Checklist references untracked plan path');
        expect(stderr).not.toContain('missing required serious-plan sections');
    });

    it('fails when an archived section summary omits the harness-ingestion triage block', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);
        writeRepoFile(
            repoRoot,
            'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
            ['# Priority 7 Example Section Summary', '', 'Tracked summary placeholder.', ''].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [x] Example done item (plan: docs/archive/plans/2026-03-11-priority-7-example-section-summary.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('harness-ingestion triage');
        expect(result.stderr).toContain('2026-03-11-priority-7-example-section-summary.md');
    });

    it('fails when an archived section summary defers harness ingestion without the local holding convention', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);
        writeRepoFile(
            repoRoot,
            'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
            [
                '# Priority 7 Example Section Summary',
                '',
                '## Harness Ingestion Triage',
                '',
                '- status: `deferred`',
                '- recommended action: `targeted-eval`',
                '- why: Interesting but not durable yet.',
                '- tracked follow-up: `none`',
                '- local-only holding note: `none`',
                '- revisit trigger: `none`',
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [x] Example done item (plan: docs/archive/plans/2026-03-11-priority-7-example-section-summary.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('local-only holding-note convention');
        expect(result.stderr).toContain('revisit trigger');
    });

    it('fails when an archived section summary requests a harness update loop without tracked follow-up paths', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);
        writeRepoFile(
            repoRoot,
            'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
            [
                '# Priority 7 Example Section Summary',
                '',
                '## Harness Ingestion Triage',
                '',
                '- status: `pending`',
                '- recommended action: `harness-update-loop`',
                '- why: The same verifier blind spot appeared across multiple work units.',
                '- tracked follow-up: `none`',
                '- local-only holding note: `none`',
                '- revisit trigger: `none`',
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [x] Example done item (plan: docs/archive/plans/2026-03-11-priority-7-example-section-summary.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('tracked follow-up');
        expect(result.stderr).toContain('harness-update-loop');
    });

    it('fails when the checklist does not repeat the required exit-enforcement line for every priority', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '- [ ] `P3-EXIT`',
                '- [ ] `P4-EXIT`',
                '- [ ] `P5-EXIT`',
                '- [ ] `P6-EXIT`',
                '- [ ] `P7-EXIT`',
                '- [ ] `P8-EXIT`',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Checklist doc is missing the required line inside `P2-EXIT` block');
    });

    it('fails when a checklist repeats the exit requirement globally but omits it inside a specific `P#-EXIT` block', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - other: no exit marker here',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Checklist doc is missing the required line inside `P2-EXIT` block');
    });

    it('fails when the cleanup slice execution template uses generic security wording', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '- Cleanup slice execution template:',
                '  - `security triage`: `none open`, or the deferred/resolved security findings for this slice',
                '- Priority exit command checklist:',
                '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
                '',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Checklist doc is missing required cleanup-slice security marker');
    });

    it('fails when a checklist mini-record uses a non-canonical Status token', () => {
        const checklistContent = [
            '# Checklist',
            '',
            '## Execution Hygiene',
            '',
            '- Disposition vocabulary:',
            '  - `owned follow-up`: assign one single final owner.',
            '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
            '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
            '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
            '- Cleanup slice execution template:',
            '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
            '- Priority exit command checklist:',
            '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
            '',
            '## Mini-Record Contract',
            '',
            '- `Status`: `not started`, `in progress`, `blocked`, or `completed`',
            '',
            '- [ ] `P1-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [x] `P2-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: complete',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: next owner',
            '- [ ] `P3-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P4-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P5-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P6-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P7-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P8-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '',
        ].join('\n');
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': checklistContent,
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Checklist mini-record `Status` must be one of: `not started`, `in progress`, `blocked`, `completed`'
        );
        expect(result.stderr).toContain('found `complete`');
    });

    it('accepts canonical checklist mini-record Status tokens', () => {
        const checklistContent = [
            '# Checklist',
            '',
            '## Execution Hygiene',
            '',
            '- Disposition vocabulary:',
            '  - `owned follow-up`: assign one single final owner.',
            '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
            '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
            '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
            '- Cleanup slice execution template:',
            '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
            '- Priority exit command checklist:',
            '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
            '',
            '## Mini-Record Contract',
            '',
            '- `Status`: `not started`, `in progress`, `blocked`, or `completed`',
            '',
            '- [ ] `P1-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [x] `P2-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: completed',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: next owner',
            '- [ ] `P3-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P4-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P5-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P6-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P7-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P8-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '',
        ].join('\n');
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': checklistContent,
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
    });

    it('ignores non-mini-record `Status` examples outside `P#-EXIT` blocks', () => {
        const checklistContent = [
            '# Checklist',
            '',
            '## Execution Hygiene',
            '',
            '- Disposition vocabulary:',
            '  - `owned follow-up`: assign one single final owner.',
            '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
            '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
            '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
            '- Cleanup slice execution template:',
            '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
            '- Priority exit command checklist:',
            '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
            '',
            '## Mini-Record Contract',
            '',
            '- `Status`: `not started`, `in progress`, `blocked`, or `completed`',
            '- Example:',
            '  - Status: complete',
            '',
            '- [ ] `P1-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [x] `P2-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: completed',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: next owner',
            '- [ ] `P3-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P4-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P5-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P6-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P7-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P8-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '',
        ].join('\n');
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': checklistContent,
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
    });

    it('fails when a later `P10-EXIT` mini-record uses a non-canonical Status token', () => {
        const checklistContent = [
            '# Checklist',
            '',
            '## Execution Hygiene',
            '',
            '- Disposition vocabulary:',
            '  - `owned follow-up`: assign one single final owner.',
            '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
            '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
            '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
            '- Cleanup slice execution template:',
            '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
            '- Priority exit command checklist:',
            '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
            '',
            '## Mini-Record Contract',
            '',
            '- `Status`: `not started`, `in progress`, `blocked`, or `completed`',
            '',
            '- [x] `P9-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: completed',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: next owner',
            '- [x] `P10-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: complete',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: checklist complete only when this gate is satisfied',
            '',
        ].join('\n');
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': checklistContent,
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Checklist mini-record `Status` must be one of: `not started`, `in progress`, `blocked`, `completed`'
        );
        expect(result.stderr).toContain('found `complete`');
    });

    it('fails when `P2-EXIT` is mentioned in `P1-EXIT` prose before the real heading', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '  - note: revisit `P2-EXIT` before shipping',
                '- [ ] `P2-EXIT`',
                '  - other: no exit marker here',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Checklist doc is missing the required line inside `P2-EXIT` block');
    });
}
