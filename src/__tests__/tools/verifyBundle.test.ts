import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const verifierPath = path.resolve(process.cwd(), 'tools/verify-bundle.mjs');

const requiredDeferredModules = [
    'src/modules/ui/auth/AuthScreen',
    'src/modules/ui/profile-select/ProfileSelectScreen',
    'src/modules/ui/server-select/ServerSelectScreen',
    'src/modules/ui/audio-setup',
    'src/modules/ui/settings/SettingsScreen',
    'src/modules/ui/settings/SettingsStore',
    'src/modules/ui/channel-setup/ChannelSetupScreen',
    'src/modules/ui/epg/component/EPGComponent',
];

interface ModuleFixture {
    uid: string;
    id: string;
    chunk: string;
    imported?: Array<{ uid?: string; dynamic?: true }> | null;
    includeModuleParts?: boolean;
}

function writeAsset(distDir: string, relativePath: string, byteCount: number): void {
    const fullPath = path.join(distDir, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, 'x'.repeat(byteCount), 'utf8');
}

function moduleId(normalizedModulePath: string): string {
    return `/${normalizedModulePath}.ts`;
}

function htmlEntryFixture(imported: ModuleFixture['imported'] = [{ uid: 'index' }]): ModuleFixture {
    return {
        uid: 'html-entry',
        id: '/index.html',
        chunk: 'assets/main.js',
        imported,
    };
}

function buildStats(modules: ModuleFixture[]): unknown {
    const nodeMetas: Record<string, unknown> = {};
    const nodeParts: Record<string, unknown> = {};
    const chunkNames = new Set<string>();

    for (const module of modules) {
        const partUid = `${module.uid}-part`;
        chunkNames.add(module.chunk);
        nodeMetas[module.uid] = {
            id: module.id,
            ...(module.includeModuleParts === false
                ? {}
                : {
                    moduleParts: {
                        [module.chunk]: partUid,
                    },
                }),
            imported: module.imported ?? [],
            importedBy: [],
        };
        if (module.imported === null) {
            delete (nodeMetas[module.uid] as Record<string, unknown>).imported;
        }
        nodeParts[partUid] = {
            renderedLength: 1,
            gzipLength: 1,
            brotliLength: 1,
            metaUid: module.uid,
        };
    }

    return {
        version: 2,
        tree: {
            name: 'root',
            children: [...chunkNames].map((name) => ({ name, children: [] })),
            isRoot: true,
        },
        nodeParts,
        nodeMetas,
    };
}

function writeBundleFixture(
    tempRoot: string,
    modules: ModuleFixture[],
    assetSizes: Record<string, number>
): string {
    const distDir = path.join(tempRoot, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(
        path.join(distDir, 'index.html'),
        [
            '<!doctype html>',
            '<html>',
            '<head>',
            '<script type="module" crossorigin src="./assets/main.js"></script>',
            '<link rel="stylesheet" crossorigin href="./assets/main.css">',
            '</head>',
            '<body><div id="app"></div></body>',
            '</html>',
        ].join('\n'),
        'utf8'
    );
    for (const [relativePath, byteCount] of Object.entries(assetSizes)) {
        writeAsset(distDir, relativePath, byteCount);
    }
    writeFileSync(
        path.join(distDir, 'bundle-stats.json'),
        JSON.stringify(buildStats(modules), null, 2),
        'utf8'
    );
    return distDir;
}

function requiredDeferredModuleFixtures(): ModuleFixture[] {
    return requiredDeferredModules.map((modulePath, index) => ({
        uid: `deferred-${index}`,
        id: modulePath.endsWith('audio-setup')
            ? moduleId(`${modulePath}/index`)
            : moduleId(modulePath),
        chunk: `assets/deferred-${index}.js`,
    }));
}

function runVerifier(distDir: string): ReturnType<typeof spawnSync> {
    return spawnSync(
        process.execPath,
        [verifierPath, '--skip-build', '--dist-dir', distDir],
        {
            cwd: process.cwd(),
            encoding: 'utf8',
        }
    );
}

function runVerifierWithBuild(cwd: string): ReturnType<typeof spawnSync> {
    return spawnSync(
        process.execPath,
        [verifierPath],
        {
            cwd,
            encoding: 'utf8',
        }
    );
}

describe('verify-bundle', () => {
    const tempRoots: string[] = [];

    afterEach(() => {
        for (const tempRoot of tempRoots.splice(0)) {
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('measures eager JS from HTML module scripts plus static import closure only', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                    imported: [
                        { uid: 'static-feature' },
                        { uid: 'lazy-feature', dynamic: true },
                    ],
                },
                {
                    uid: 'static-feature',
                    id: moduleId('src/static-feature'),
                    chunk: 'assets/static-feature.js',
                },
                {
                    uid: 'lazy-feature',
                    id: moduleId('src/lazy-feature'),
                    chunk: 'assets/lazy-feature.js',
                },
                {
                    uid: 'unreferenced-resident',
                    id: moduleId('src/unreferenced-resident'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'resident-extra' }],
                },
                {
                    uid: 'resident-extra',
                    id: moduleId('src/resident-extra'),
                    chunk: 'assets/resident-extra.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/static-feature.js': 50,
                'assets/lazy-feature.js': 70,
                'assets/resident-extra.js': 90,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('eager JS bytes: 150');
        expect(result.stdout).toContain('eager CSS bytes: 20');
        expect(result.stdout).toContain('bootstrap entry bytes: 100');
        expect(result.stdout).toContain('dynamic JS chunks:');
        expect(result.stdout).toContain('- assets/lazy-feature.js: 70 bytes');
        expect(result.stdout).not.toContain('assets/resident-extra.js');
    });

    it('fails when a required deferred module is reachable through the eager static closure', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const leakedDeferredModules = requiredDeferredModuleFixtures();
        const leakedDeferredModule = leakedDeferredModules[0];
        if (leakedDeferredModule === undefined) {
            throw new Error('Expected at least one required deferred module fixture.');
        }
        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: leakedDeferredModule.uid }],
                },
                ...leakedDeferredModules,
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Deferred module leaked into eager startup closure');
        expect(result.stderr).toContain('src/modules/ui/auth/AuthScreen');
    });

    it('fails when a dynamically imported required deferred module is emitted in an eager JS chunk', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const deferredModules = requiredDeferredModuleFixtures();
        const authModule = deferredModules[0];
        if (authModule === undefined) {
            throw new Error('Expected at least one required deferred module fixture.');
        }
        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: authModule.uid, dynamic: true }],
                },
                {
                    ...authModule,
                    chunk: 'assets/main.js',
                },
                ...deferredModules.slice(1),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.slice(1).map((_modulePath, index) => [`assets/deferred-${index + 1}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Deferred module leaked into eager startup chunk');
        expect(result.stderr).toContain('assets/main.js');
        expect(result.stderr).toContain('src/modules/ui/auth/AuthScreen');
    });

    it('fails when a required deferred directory child is reachable through the eager static closure', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const deferredModules = requiredDeferredModuleFixtures();
        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'audio-screen' }],
                },
                {
                    uid: 'audio-screen',
                    id: moduleId('src/modules/ui/audio-setup/AudioSetupScreen'),
                    chunk: 'assets/main.js',
                },
                ...deferredModules.filter((module) => !module.id.includes('/audio-setup/')),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Deferred module leaked into eager startup closure');
        expect(result.stderr).toContain('src/modules/ui/audio-setup');
        expect(result.stderr).toContain('AudioSetupScreen');
    });

    it('does not treat eager CSS under a required deferred directory as a deferred JS leak', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'audio-styles' }],
                },
                {
                    uid: 'audio-styles',
                    id: '/src/modules/ui/audio-setup/styles.css',
                    chunk: 'assets/main.css',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('verify:bundle PASS');
    });

    it('fails when eager startup JS exceeds the byte guard even if bootstrap chunk is under the guard', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'static-feature' }],
                },
                {
                    uid: 'static-feature',
                    id: moduleId('src/static-feature'),
                    chunk: 'assets/static-feature.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/static-feature.js': 500000,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stdout).toContain('bootstrap entry bytes: 100');
        expect(result.stdout).toContain('eager JS bytes: 500100');
        expect(result.stderr).toContain('Eager startup JS is 500100 bytes');
        expect(result.stderr).not.toContain('Bootstrap-containing startup entry');
    });

    it('fails when eager startup CSS exceeds the byte guard', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                htmlEntryFixture(),
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 100000,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stdout).toContain('eager CSS bytes: 100000');
        expect(result.stderr).toContain('Eager startup CSS is 100000 bytes');
    });

    it('stops when an HTML module script cannot be mapped to bundle metadata', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            requiredDeferredModuleFixtures(),
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Cannot map HTML module script to bundle metadata');
        expect(result.stderr).toContain('assets/main.js');
    });

    it('stops when the HTML entry root has no static edge into the startup graph', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture([]),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('HTML entry metadata root');
        expect(result.stderr).toContain('has no static import edges');
    });

    it('stops when a metadata node is missing moduleParts', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                    includeModuleParts: false,
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('missing module chunk mapping');
    });

    it('stops when one HTML script maps to multiple entry roots', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'extra-html-entry',
                    id: '/nested.html',
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'index' }],
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Cannot map HTML module script to a single entry metadata root');
        expect(result.stderr).toContain('found 2');
    });

    it('stops when static import edges are absent from raw-data metadata', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: null,
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Static import closure cannot be mapped soundly');
        expect(result.stderr).toContain('missing import edges');
    });

    it('stops when a static import edge is malformed', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{}],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('malformed import edge');
    });

    it('stops when a static import edge targets a missing metadata node', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'missing-bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('imports missing node missing-bootstrap');
    });

    it('reports nested dynamic import chunks without counting them as eager JS', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        const distDir = writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'lazy-feature', dynamic: true }],
                },
                {
                    uid: 'lazy-feature',
                    id: moduleId('src/lazy-feature'),
                    chunk: 'assets/lazy-feature.js',
                    imported: [{ uid: 'nested-lazy-feature', dynamic: true }],
                },
                {
                    uid: 'nested-lazy-feature',
                    id: moduleId('src/nested-lazy-feature'),
                    chunk: 'assets/nested-lazy-feature.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/lazy-feature.js': 70,
                'assets/nested-lazy-feature.js': 80,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );

        const result = runVerifier(distDir);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('eager JS bytes: 100');
        expect(result.stdout).toContain('- assets/lazy-feature.js: 70 bytes');
        expect(result.stdout).toContain('- assets/nested-lazy-feature.js: 80 bytes');
    });

    it('does not kill noisy build analysis output at the default spawnSync buffer limit', () => {
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-bundle-'));
        tempRoots.push(tempRoot);

        writeBundleFixture(
            tempRoot,
            [
                {
                    ...htmlEntryFixture(),
                },
                {
                    uid: 'index',
                    id: moduleId('src/index'),
                    chunk: 'assets/main.js',
                    imported: [{ uid: 'bootstrap' }],
                },
                {
                    uid: 'bootstrap',
                    id: moduleId('src/bootstrap'),
                    chunk: 'assets/main.js',
                },
                ...requiredDeferredModuleFixtures(),
            ],
            {
                'assets/main.js': 100,
                'assets/main.css': 20,
                ...Object.fromEntries(requiredDeferredModules.map((_modulePath, index) => [`assets/deferred-${index}.js`, 10])),
            }
        );
        writeFileSync(
            path.join(tempRoot, 'package.json'),
            JSON.stringify({
                type: 'module',
                scripts: {
                    'build:analyze': 'node noisy-build.mjs',
                },
            }),
            'utf8'
        );
        writeFileSync(
            path.join(tempRoot, 'noisy-build.mjs'),
            "process.stdout.write('x'.repeat(2 * 1024 * 1024));\n",
            'utf8'
        );

        const result = runVerifierWithBuild(tempRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('verify:bundle PASS');
    });
});
