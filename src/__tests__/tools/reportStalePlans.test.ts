import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const reporterPath = path.resolve(process.cwd(), 'tools/report-stale-plans.mjs');

function writeRepoFile(repoRoot: string, relativePath: string, content = '# Placeholder\n') {
    const fullPath = path.join(repoRoot, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
}

describe('report-stale-plans', () => {
    const tempRoots: string[] = [];

    afterEach(() => {
        for (const tempRoot of tempRoots.splice(0)) {
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('lists archive-review candidates without failing the run', () => {
        const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-stale-plans-'));
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/README.md');
        writeRepoFile(repoRoot, 'docs/plans/2026-02-01-old-plan.md');
        writeRepoFile(repoRoot, 'docs/plans/2026-03-05-recent-plan.md');

        const result = spawnSync(
            process.execPath,
            [reporterPath, '--today=2026-03-06', '--max-age-days=7'],
            {
                cwd: repoRoot,
                encoding: 'utf8',
            }
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Archive-review candidates');
        expect(result.stdout).toContain('2026-02-01-old-plan.md');
        expect(result.stdout).not.toContain('2026-03-05-recent-plan.md');
    });
});
