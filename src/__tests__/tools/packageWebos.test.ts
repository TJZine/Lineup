import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const packageToolPath = path.resolve(process.cwd(), 'tools/package-webos.mjs');
const packageToolUrl = pathToFileURL(packageToolPath).href;
const TEST_SUBPROCESS_TIMEOUT_MS = 10_000;

function createCandidate(root: string): string {
    const distDir = path.join(root, 'dist');
    mkdirSync(path.join(distDir, 'assets'), { recursive: true });
    writeFileSync(path.join(distDir, 'appinfo.json'), JSON.stringify({
        id: 'com.lineup.app',
        version: '1.0.0',
        main: 'index.html',
    }));
    writeFileSync(path.join(distDir, 'index.html'), '<script src="assets/app.js"></script>');
    writeFileSync(path.join(distDir, 'assets/app.js'), 'console.log("lean");');
    return distDir;
}

function writeFakeCli(root: string, body: string): string {
    const cliPath = path.join(root, 'fake-ares-package.mjs');
    writeFileSync(cliPath, `#!/usr/bin/env node\n${body}\n`);
    chmodSync(cliPath, 0o755);
    return cliPath;
}

function writeFakeWindowsCli(root: string): string {
    // Mirror a real npm .cmd shim: forward %* to a script file. Inlining the
    // payload via `node -e` is not faithful — tool flags such as --no-minify
    // would be parsed as node options instead of script arguments.
    const targetPath = path.join(root, 'fake-ares-package-target.mjs');
    writeFileSync(targetPath, [
        "import { writeFileSync } from 'node:fs';",
        "import path from 'node:path';",
        "if (!process.argv.includes('--no-minify')) process.exit(18);",
        "const output = process.argv[process.argv.indexOf('-o') + 1];",
        "writeFileSync(path.join(output, 'com.lineup.app_1.0.0_all.ipk'), 'ipk');",
    ].join('\n'));
    const cliPath = path.join(root, 'fake-ares-package.cmd');
    writeFileSync(cliPath, [
        '@echo off',
        'node "%~dp0fake-ares-package-target.mjs" %*',
    ].join('\r\n'));
    return cliPath;
}

function runPackageTool(
    root: string,
    cliPath: string,
    outputDir = path.join(root, 'packages')
): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [
        packageToolPath,
        '--ares-package', cliPath,
        '--dist-dir', path.join(root, 'dist'),
        '--output-dir', outputDir,
    ], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: TEST_SUBPROCESS_TIMEOUT_MS,
    });
}

function runPackageFunctionWithTimeout(root: string, cliPath: string): ReturnType<typeof spawnSync> {
    const options = JSON.stringify({
        aresPackage: cliPath,
        distDir: path.join(root, 'dist'),
        outputDir: path.join(root, 'packages'),
        timeoutMs: 50,
    });
    const script = `import { packageWebos } from ${JSON.stringify(packageToolUrl)}; packageWebos(${options});`;
    return spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: TEST_SUBPROCESS_TIMEOUT_MS,
    });
}

describe('package-webos public CLI', () => {
    const roots: string[] = [];

    function tempRoot(): string {
        const root = mkdtempSync(path.join(os.tmpdir(), 'lineup-package-webos-'));
        roots.push(root);
        createCandidate(root);
        return root;
    }

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    it('fails when ares-package is missing', () => {
        const root = tempRoot();
        const result = runPackageTool(root, path.join(root, 'missing-ares-package'));
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/Failed to run ares-package/iu);
    });

    it('fails when ares-package exits nonzero', () => {
        const root = tempRoot();
        const cli = writeFakeCli(root, 'process.exitCode = 17;');
        const result = runPackageTool(root, cli);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/failed with exit code 17/iu);
    });

    it('bounds a nonterminating ares-package process', () => {
        const root = tempRoot();
        const cli = writeFakeCli(root, 'setInterval(() => undefined, 1_000);');
        const result = runPackageFunctionWithTimeout(root, cli);

        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/timed out after 50ms/iu);
    });

    it('fails when ares-package produces no IPK', () => {
        const root = tempRoot();
        const cli = writeFakeCli(root, 'process.exitCode = 0;');
        const result = runPackageTool(root, cli);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/produced no output/iu);
    });

    it('fails on unexpected package output', () => {
        const root = tempRoot();
        const cli = writeFakeCli(root, [
            "import { writeFileSync } from 'node:fs';",
            "import path from 'node:path';",
            "const output = process.argv[process.argv.indexOf('-o') + 1];",
            "writeFileSync(path.join(output, 'wrong.ipk'), 'ipk');",
        ].join('\n'));
        const result = runPackageTool(root, cli);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/unexpected output/iu);
    });

    it('accepts exactly the expected nonempty IPK', () => {
        const root = tempRoot();
        const cli = writeFakeCli(root, [
            "import { writeFileSync } from 'node:fs';",
            "import path from 'node:path';",
            "if (!process.argv.includes('--no-minify')) process.exit(18);",
            "const output = process.argv[process.argv.indexOf('-o') + 1];",
            "writeFileSync(path.join(output, 'com.lineup.app_1.0.0_all.ipk'), 'ipk');",
        ].join('\n'));
        const result = runPackageTool(root, cli);
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/Candidate tree SHA-256: [a-f0-9]{64}/u);
        expect(result.stdout).toMatch(/com\.lineup\.app_1\.0\.0_all\.ipk/u);
    });

    it('fails if the packager mutates the verified candidate', () => {
        const root = tempRoot();
        const cli = writeFakeCli(root, [
            "import { writeFileSync } from 'node:fs';",
            "import path from 'node:path';",
            "const dist = process.argv[process.argv.indexOf('--no-minify') + 1];",
            "const output = process.argv[process.argv.indexOf('-o') + 1];",
            "writeFileSync(path.join(output, 'com.lineup.app_1.0.0_all.ipk'), 'ipk');",
            "writeFileSync(path.join(dist, 'assets/app.js'), 'mutated');",
        ].join('\n'));
        const result = runPackageTool(root, cli);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/mutated the verified release candidate/iu);
    });

    it.each([
        ['equal', (root: string): string => path.join(root, 'dist')],
        ['descendant', (root: string): string => path.join(root, 'dist/packages')],
        ['dot-dot-prefixed descendant', (root: string): string => path.join(root, 'dist/..packages')],
        ['ancestor', (root: string): string => root],
    ])('rejects %s candidate/output overlap', (_name, getOutputDir) => {
        const root = tempRoot();
        const cli = writeFakeCli(root, 'process.exitCode = 0;');
        const result = runPackageTool(root, cli, getOutputDir(root));
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/must not overlap/iu);
    });

    it('rejects overlap through a symlinked output parent', () => {
        const root = tempRoot();
        const cli = writeFakeCli(root, 'process.exitCode = 0;');
        const aliasPath = path.join(root, 'candidate-alias');
        symlinkSync(path.join(root, 'dist'), aliasPath);
        const result = runPackageTool(root, cli, path.join(aliasPath, 'packages'));
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/must not overlap/iu);
    });

    (process.platform === 'win32' ? it : it.skip)(
        'executes a Windows npm .cmd shim without shell-string construction',
        () => {
            const root = tempRoot();
            const result = runPackageTool(root, writeFakeWindowsCli(root));

            expect(result.status).toBe(0);
            expect(result.stdout).toContain('com.lineup.app_1.0.0_all.ipk');
        }
    );
});
