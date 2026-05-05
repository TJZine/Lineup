import { chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const sourceScriptPath = path.resolve(process.cwd(), 'scripts/sync_agent_skills.sh');

function writeFile(filePath: string, content: string): void {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
}

describe('sync_agent_skills.sh', () => {
    const tempRoots: string[] = [];

    afterEach(() => {
        for (const tempRoot of tempRoots.splice(0)) {
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('waits for the skill lock before swapping the mirror directory', () => {
        const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-sync-skills-'));
        const codexHome = mkdtempSync(path.join(os.tmpdir(), 'lineup-sync-skills-home-'));
        tempRoots.push(repoRoot, codexHome);

        const scriptPath = path.join(repoRoot, 'scripts/sync_agent_skills.sh');
        mkdirSync(path.dirname(scriptPath), { recursive: true });
        copyFileSync(sourceScriptPath, scriptPath);
        chmodSync(scriptPath, 0o755);

        writeFile(
            path.join(repoRoot, '.codex/skills/repo-skill/SKILL.md'),
            '# Repo skill\n'
        );
        writeFile(
            path.join(repoRoot, 'docs/agentic/skill-mirror-allowlist.txt'),
            'global:global-skill\n'
        );
        writeFile(
            path.join(codexHome, 'skills/global-skill/SKILL.md'),
            '# Global skill\n'
        );

        const lockDir = path.join(repoRoot, '.agent/.skills.lock');
        mkdirSync(lockDir, { recursive: true });

        const releaser = spawn('/bin/sh', ['-c', `sleep 0.3 && rmdir "${lockDir}"`], {
            stdio: 'ignore',
        });

        const startedAt = Date.now();
        const result = spawnSync('/bin/bash', [scriptPath], {
            cwd: repoRoot,
            env: {
                ...process.env,
                CODEX_HOME: codexHome,
            },
            encoding: 'utf8',
        });
        const elapsedMs = Date.now() - startedAt;

        releaser.kill();

        expect(result.status).toBe(0);
        expect(elapsedMs).toBeGreaterThanOrEqual(250);
        expect(existsSync(path.join(repoRoot, '.agent/skills/repo-skill/SKILL.md'))).toBe(true);
        expect(existsSync(path.join(repoRoot, '.agent/skills/global-skill/SKILL.md'))).toBe(true);
        expect(readFileSync(path.join(repoRoot, '.agent/skills/repo-skill/SKILL.md'), 'utf8')).toContain('Repo skill');
    });

    it('does not mirror tracked doc drafts when the canonical .codex skill is missing', () => {
        const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-sync-skills-'));
        const codexHome = mkdtempSync(path.join(os.tmpdir(), 'lineup-sync-skills-home-'));
        tempRoots.push(repoRoot, codexHome);

        const scriptPath = path.join(repoRoot, 'scripts/sync_agent_skills.sh');
        mkdirSync(path.dirname(scriptPath), { recursive: true });
        copyFileSync(sourceScriptPath, scriptPath);
        chmodSync(scriptPath, 0o755);

        writeFile(
            path.join(repoRoot, '.codex/skills/repo-skill/SKILL.md'),
            '# Repo skill\n'
        );
        writeFile(
            path.join(repoRoot, 'docs/agentic/skills/draft-only/SKILL.md'),
            '# Draft-only skill\n'
        );
        writeFile(
            path.join(repoRoot, 'docs/agentic/skill-mirror-allowlist.txt'),
            'global:global-skill\n'
        );
        writeFile(
            path.join(codexHome, 'skills/global-skill/SKILL.md'),
            '# Global skill\n'
        );

        const result = spawnSync('/bin/bash', [scriptPath], {
            cwd: repoRoot,
            env: {
                ...process.env,
                CODEX_HOME: codexHome,
            },
            encoding: 'utf8',
        });

        expect(result.status).toBe(0);
        expect(existsSync(path.join(repoRoot, '.agent/skills/repo-skill/SKILL.md'))).toBe(true);
        expect(existsSync(path.join(repoRoot, '.agent/skills/global-skill/SKILL.md'))).toBe(true);
        expect(existsSync(path.join(repoRoot, '.agent/skills/draft-only/SKILL.md'))).toBe(false);
    });

    it('rejects unsupported mirror sources', () => {
        const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-sync-skills-'));
        const codexHome = mkdtempSync(path.join(os.tmpdir(), 'lineup-sync-skills-home-'));
        tempRoots.push(repoRoot, codexHome);

        const scriptPath = path.join(repoRoot, 'scripts/sync_agent_skills.sh');
        mkdirSync(path.dirname(scriptPath), { recursive: true });
        copyFileSync(sourceScriptPath, scriptPath);
        chmodSync(scriptPath, 0o755);

        writeFile(
            path.join(repoRoot, 'docs/agentic/skill-mirror-allowlist.txt'),
            'unsupported:legacy-skill\n'
        );

        const result = spawnSync('/bin/bash', [scriptPath], {
            cwd: repoRoot,
            env: {
                ...process.env,
                CODEX_HOME: codexHome,
            },
            encoding: 'utf8',
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Invalid skill mirror entry');
        expect(result.stderr).toContain('unsupported:legacy-skill');
        expect(existsSync(path.join(repoRoot, '.agent/skills/legacy-skill/SKILL.md'))).toBe(false);
    });
});
