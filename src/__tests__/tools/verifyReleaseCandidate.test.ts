import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const verifierPath = path.resolve(process.cwd(), 'tools/verify-release-candidate.mjs');
const TEST_SUBPROCESS_TIMEOUT_MS = 10_000;

function createCandidate(root: string): string {
    const distDir = path.join(root, 'dist');
    mkdirSync(path.join(distDir, 'assets'), { recursive: true });
    writeFileSync(path.join(distDir, 'appinfo.json'), JSON.stringify({
        id: 'com.lineup.app',
        version: '1.0.0',
        main: 'index.html',
    }));
    writeFileSync(path.join(distDir, 'index.html'), '<script src="./assets/app.js"></script>');
    writeFileSync(path.join(distDir, 'assets/app.js'), 'console.log("lean");');
    return distDir;
}

function runVerifier(distDir: string, options: string[] = []): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [verifierPath, '--dist-dir', distDir, ...options], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: TEST_SUBPROCESS_TIMEOUT_MS,
    });
}

describe('verify-release-candidate public CLI', () => {
    const roots: string[] = [];

    function tempRoot(): string {
        const root = mkdtempSync(path.join(os.tmpdir(), 'lineup-candidate-'));
        roots.push(root);
        return root;
    }

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    it('accepts a valid candidate and prints a stable tree SHA-256 that changes with content', () => {
        const distDir = createCandidate(tempRoot());
        const first = runVerifier(distDir);
        const second = runVerifier(distDir);

        expect(first.status).toBe(0);
        expect(first.stdout).toMatch(/Candidate tree SHA-256: [a-f0-9]{64}/u);
        expect(second.stdout).toBe(first.stdout);

        writeFileSync(path.join(distDir, 'assets/app.js'), 'console.log("changed");');
        const changed = runVerifier(distDir);
        expect(changed.status).toBe(0);
        expect(changed.stdout).not.toBe(first.stdout);
    });

    it('accepts a matching expected digest and rejects mismatched or malformed digests', () => {
        const distDir = createCandidate(tempRoot());
        const digestResult = runVerifier(distDir, ['--digest-only']);
        const digest = String(digestResult.stdout).trim();
        expect(digestResult.status).toBe(0);
        expect(digest).toMatch(/^[a-f0-9]{64}$/u);

        const matching = runVerifier(distDir, ['--expected-digest', digest]);
        expect(matching.status).toBe(0);
        expect(matching.stdout).toContain(`Candidate tree SHA-256: ${digest}`);

        const mismatched = runVerifier(distDir, ['--expected-digest', '0'.repeat(64)]);
        expect(mismatched.status).toBe(1);
        expect(mismatched.stderr).toMatch(/SHA-256 mismatch/iu);

        const invalid = runVerifier(distDir, ['--expected-digest', 'not-a-digest']);
        expect(invalid.status).toBe(1);
        expect(invalid.stderr).toMatch(/exactly 64 hexadecimal/iu);
    });

    it('includes hidden files in the candidate tree digest', () => {
        const distDir = createCandidate(tempRoot());
        const before = String(runVerifier(distDir, ['--digest-only']).stdout).trim();
        writeFileSync(path.join(distDir, '.release-proof'), 'hidden');
        const after = String(runVerifier(distDir, ['--digest-only']).stdout).trim();
        expect(after).toMatch(/^[a-f0-9]{64}$/u);
        expect(after).not.toBe(before);
    });

    it.each([
        ['missing metadata', (distDir: string): void => rmSync(path.join(distDir, 'appinfo.json')), /missing appinfo\.json/iu],
        ['malformed metadata', (distDir: string): void => writeFileSync(path.join(distDir, 'appinfo.json'), '{'), /Invalid appinfo\.json/iu],
        ['missing main', (distDir: string): void => rmSync(path.join(distDir, 'index.html')), /missing its declared main/iu],
        ['analyzer metadata', (distDir: string): void => writeFileSync(path.join(distDir, 'bundle-stats.json'), '{}'), /analyzer metadata/iu],
        ['nested analyzer metadata', (distDir: string): void => writeFileSync(path.join(distDir, 'assets/bundle-stats.json'), '{}'), /analyzer metadata/iu],
        ['source map', (distDir: string): void => writeFileSync(path.join(distDir, 'assets/app.js.map'), '{}'), /source map/iu],
        ['source-map reference', (distDir: string): void => writeFileSync(path.join(distDir, 'assets/app.js'), '//# sourceMappingURL=app.js.map'), /source-map reference/iu],
        ['raw source', (distDir: string): void => writeFileSync(path.join(distDir, 'assets/app.ts'), 'const value = 1;'), /raw source file/iu],
        ['unexpanded build marker', (distDir: string): void => writeFileSync(path.join(distDir, 'assets/app.js'), '__LINEUP_DEV_BUILD__'), /build-profile marker/iu],
    ])('rejects %s', (_name, mutate, expectedError) => {
        const distDir = createCandidate(tempRoot());
        mutate(distDir);
        const result = runVerifier(distDir);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(expectedError);
    });

    it('rejects symlinks that could escape the candidate tree', () => {
        const root = tempRoot();
        const distDir = createCandidate(root);
        const outsidePath = path.join(root, 'outside.txt');
        writeFileSync(outsidePath, 'outside');
        symlinkSync(outsidePath, path.join(distDir, 'assets/escape.txt'));

        const result = runVerifier(distDir);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/symbolic link/iu);
    });
});
