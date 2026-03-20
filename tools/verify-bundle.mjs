import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const STARTUP_MAX_BYTES = 500000;
const REQUIRED_DEFERRED_MODULES = [
    '/src/modules/ui/auth/AuthScreen.ts',
    '/src/modules/ui/profile-select/ProfileSelectScreen.ts',
    '/src/modules/ui/server-select/ServerSelectScreen.ts',
    '/src/modules/ui/settings/SettingsScreen.ts',
    '/src/modules/ui/channel-setup/ChannelSetupScreen.ts',
    '/src/modules/ui/epg/EPGComponent.ts',
];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function fail(message) {
    throw new Error(message);
}

function runBuildAnalyze() {
    const result = spawnSync(npmCommand, ['run', 'build:analyze'], {
        cwd: process.cwd(),
        encoding: 'utf8',
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    if (result.status !== 0) {
        fail(`build:analyze failed with exit code ${result.status}\n${output}`);
    }
    if (output.includes('Circular chunk:')) {
        fail(`Detected circular chunk warning in build output.\n${output}`);
    }
}

function walk(node, onVisit, pathParts = []) {
    const next = [...pathParts, String(node?.name ?? '')];
    onVisit(node, next);
    const children = Array.isArray(node?.children) ? node.children : [];
    for (const child of children) {
        walk(child, onVisit, next);
    }
}

function collectModulePaths(assetNode) {
    const modules = new Set();
    walk(assetNode, (_node, pathParts) => {
        const normalizedParts = pathParts.flatMap((part) =>
            String(part)
                .split('/')
                .filter((segment) => segment.length > 0)
        );
        const srcIndex = normalizedParts.indexOf('src');
        if (srcIndex >= 0) {
            modules.add(normalizedParts.slice(srcIndex).join('/'));
        }
    });
    return modules;
}

function isJsAsset(node) {
    return typeof node?.name === 'string' && node.name.endsWith('.js');
}

function getJsAssets(stats) {
    const rootChildren = Array.isArray(stats?.tree?.children) ? stats.tree.children : [];
    return rootChildren.filter(isJsAsset);
}

function main() {
    runBuildAnalyze();

    const distDir = path.resolve(process.cwd(), 'dist');
    const statsPath = path.join(distDir, 'bundle-stats.json');
    if (!existsSync(statsPath)) {
        fail(`Missing bundle stats file: ${statsPath}`);
    }

    const stats = JSON.parse(readFileSync(statsPath, 'utf8'));
    const jsAssets = getJsAssets(stats);
    if (jsAssets.length === 0) {
        fail('No emitted .js assets found in bundle-stats.json tree.');
    }

    const bootstrapOwners = jsAssets.filter((asset) => collectModulePaths(asset).has('src/bootstrap.ts'));
    if (bootstrapOwners.length !== 1) {
        const names = bootstrapOwners.map((asset) => String(asset.name)).join(', ') || '(none)';
        fail(
            `Expected exactly one startup entry .js asset containing src/bootstrap.ts; found ${bootstrapOwners.length}: ${names}. ` +
            'Refresh verify-bundle entry asset detection.'
        );
    }

    const startupAsset = bootstrapOwners[0];
    const startupAssetName = String(startupAsset.name);
    const startupAssetPath = path.join(distDir, startupAssetName);
    if (!existsSync(startupAssetPath)) {
        fail(`Startup entry asset does not exist on disk: ${startupAssetName}`);
    }

    const startupBytes = statSync(startupAssetPath).size;
    if (startupBytes >= STARTUP_MAX_BYTES) {
        fail(`Startup entry asset ${startupAssetName} is ${startupBytes} bytes (must be < ${STARTUP_MAX_BYTES}).`);
    }

    const assetsDir = path.join(distDir, 'assets');
    if (existsSync(assetsDir)) {
        const engineAssets = readdirSync(assetsDir).filter((name) => /^engine-.*\.js$/u.test(name));
        if (engineAssets.length > 0) {
            fail(`Unexpected engine chunk(s) emitted: ${engineAssets.join(', ')}`);
        }
    }

    const startupModules = collectModulePaths(startupAsset);
    const deferredChunkMap = new Map();
    for (const modulePath of REQUIRED_DEFERRED_MODULES) {
        const normalized = modulePath.replace(/^\//u, '');
        if (startupModules.has(normalized)) {
            fail(`Deferred module leaked into startup entry ${startupAssetName}: ${modulePath}`);
        }

        const emittedIn = jsAssets
            .filter((asset) => collectModulePaths(asset).has(normalized))
            .map((asset) => String(asset.name));
        if (emittedIn.length === 0) {
            fail(`Required deferred module was not emitted in any .js chunk: ${modulePath}`);
        }
        deferredChunkMap.set(modulePath, emittedIn);
    }

    console.log(`verify:bundle PASS`);
    console.log(`startup entry: ${startupAssetName}`);
    console.log(`startup bytes: ${startupBytes}`);
    console.log('deferred module chunks:');
    for (const [modulePath, chunkNames] of deferredChunkMap.entries()) {
        console.log(`- ${modulePath}: ${chunkNames.join(', ')}`);
    }
}

main();
