import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STARTUP_MAX_BYTES = 500000;
const STARTUP_ENTRY_MODULE = normalizeModulePath('src/bootstrap.ts');
const REQUIRED_DEFERRED_MODULES = [
    '../../modules/ui/auth/AuthScreen',
    '../../modules/ui/profile-select/ProfileSelectScreen',
    '../../modules/ui/server-select/ServerSelectScreen',
    '../../modules/ui/audio-setup',
    '../../modules/ui/settings/SettingsScreen',
    '../../modules/ui/settings/SettingsStore',
    '../../modules/ui/channel-setup/ChannelSetupScreen',
    '../../modules/ui/epg/component/EPGComponent',
].map((specifier) => normalizeLazyModuleSpecifier(specifier));

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function fail(message) {
    throw new Error(message);
}

function normalizeModulePath(modulePath) {
    return String(modulePath)
        .replace(/\\/gu, '/')
        .replace(/^\//u, '')
        .replace(/\.(?:[cm]?[jt]sx?)$/u, '');
}

function normalizeStatsModuleId(moduleId) {
    const withoutQuery = String(moduleId)
        .replace(/\\/gu, '/')
        .replace(/^\0/u, '')
        .split('?')[0]
        .split('#')[0];
    const parts = withoutQuery.split('/').filter((part) => part.length > 0);
    const srcIndex = parts.indexOf('src');
    if (srcIndex >= 0) {
        return normalizeModulePath(parts.slice(srcIndex).join('/'));
    }
    return normalizeModulePath(withoutQuery);
}

function normalizeLazyModuleSpecifier(specifier) {
    return normalizeModulePath(path.posix.join('src/core/app-shell', specifier));
}

function normalizeHtmlAssetPath(assetPath) {
    const withoutHash = String(assetPath).split('#')[0].split('?')[0];
    if (/^[a-z][a-z0-9+.-]*:/iu.test(withoutHash) || withoutHash.startsWith('//')) {
        fail(`External asset references are not supported in bundle verification: ${assetPath}`);
    }
    const normalized = path.posix.normalize(withoutHash.replace(/^\.\//u, '').replace(/^\//u, ''));
    if (normalized.startsWith('../')) {
        fail(`HTML asset reference escapes dist/: ${assetPath}`);
    }
    return normalized;
}

function getAttribute(tag, attributeName) {
    const pattern = new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu');
    const match = pattern.exec(tag);
    return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function parseIndexHtmlAssets(indexHtml) {
    const moduleScripts = [];
    const stylesheets = [];

    for (const match of indexHtml.matchAll(/<script\b[^>]*>/giu)) {
        const tag = match[0];
        const type = getAttribute(tag, 'type');
        const src = getAttribute(tag, 'src');
        if (type?.toLowerCase() === 'module' && src !== null) {
            moduleScripts.push(normalizeHtmlAssetPath(src));
        }
    }

    for (const match of indexHtml.matchAll(/<link\b[^>]*>/giu)) {
        const tag = match[0];
        const rel = getAttribute(tag, 'rel');
        const href = getAttribute(tag, 'href');
        const relTokens = rel?.toLowerCase().split(/\s+/u) ?? [];
        if (href !== null && relTokens.includes('stylesheet')) {
            stylesheets.push(normalizeHtmlAssetPath(href));
        }
    }

    return { moduleScripts, stylesheets };
}

function parseOptions(argv) {
    const options = {
        distDir: path.resolve(process.cwd(), 'dist'),
        runBuild: true,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--skip-build') {
            options.runBuild = false;
        } else if (arg === '--dist-dir') {
            const value = argv[index + 1];
            if (value === undefined) {
                fail('Missing value for --dist-dir.');
            }
            options.distDir = path.resolve(process.cwd(), value);
            index += 1;
        } else {
            fail(`Unknown verify-bundle option: ${arg}`);
        }
    }

    return options;
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

function readJsonFile(filePath, description) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail(`Failed to parse ${description} ${filePath}: ${message}`);
    }
}

function buildBundleMetadata(stats) {
    if (stats?.version !== 2 || typeof stats.nodeMetas !== 'object' || stats.nodeMetas === null) {
        fail('bundle-stats.json is not rollup-plugin-visualizer raw-data v2 output.');
    }

    const metasByUid = new Map();
    const rawIdByUid = new Map();
    const modulePathByUid = new Map();
    const chunksByUid = new Map();
    const uidsByChunk = new Map();
    const uidsByModulePath = new Map();

    for (const [uid, meta] of Object.entries(stats.nodeMetas)) {
        if (typeof meta !== 'object' || meta === null || typeof meta.id !== 'string') {
            fail(`Cannot map bundle metadata node ${uid}: missing module id.`);
        }

        if (typeof meta.moduleParts !== 'object' || meta.moduleParts === null) {
            fail(`Cannot map bundle metadata node ${uid}: missing module chunk mapping.`);
        }
        if (!Array.isArray(meta.imported)) {
            fail(`Static import closure cannot be mapped soundly: missing import edges for ${uid}.`);
        }

        const modulePath = normalizeStatsModuleId(meta.id);
        const moduleParts = Object.keys(meta.moduleParts);
        const chunks = new Set(moduleParts.map(normalizeHtmlAssetPath));

        metasByUid.set(uid, meta);
        rawIdByUid.set(uid, meta.id);
        modulePathByUid.set(uid, modulePath);
        chunksByUid.set(uid, chunks);

        if (!uidsByModulePath.has(modulePath)) {
            uidsByModulePath.set(modulePath, new Set());
        }
        uidsByModulePath.get(modulePath).add(uid);

        for (const chunkName of chunks) {
            if (!uidsByChunk.has(chunkName)) {
                uidsByChunk.set(chunkName, new Set());
            }
            uidsByChunk.get(chunkName).add(uid);
        }
    }

    return {
        metasByUid,
        rawIdByUid,
        modulePathByUid,
        chunksByUid,
        uidsByChunk,
        uidsByModulePath,
    };
}

function isHtmlEntryFacadeId(moduleId) {
    const withoutHash = String(moduleId)
        .replace(/\\/gu, '/')
        .replace(/^\0/u, '')
        .split('#')[0];
    const [withoutQuery] = withoutHash.split('?');
    return !withoutHash.includes('?') && withoutQuery.endsWith('.html');
}

function getHtmlEntryUidForScript(moduleScript, metadata) {
    const scriptUids = metadata.uidsByChunk.get(moduleScript);
    if (scriptUids === undefined || scriptUids.size === 0) {
        fail(`Cannot map HTML module script to bundle metadata: ${moduleScript}`);
    }

    const entryUids = [...scriptUids].filter((uid) => (
        isHtmlEntryFacadeId(metadata.rawIdByUid.get(uid))
    ));
    if (entryUids.length !== 1) {
        const names = entryUids
            .map((uid) => String(metadata.rawIdByUid.get(uid)))
            .sort()
            .join(', ') || '(none)';
        fail(
            `Cannot map HTML module script to a single entry metadata root: ${moduleScript}; ` +
            `found ${entryUids.length}: ${names}`
        );
    }

    const [entryUid] = entryUids;
    const meta = metadata.metasByUid.get(entryUid);
    const staticImports = meta.imported.filter((importRef) => importRef?.dynamic !== true);
    if (staticImports.length === 0) {
        fail(`HTML entry metadata root for ${moduleScript} has no static import edges.`);
    }

    return entryUid;
}

function getStaticClosure(rootUids, metadata, options = {}) {
    const closure = new Set();
    const queue = [...rootUids];
    const dynamicRoots = new Set();

    while (queue.length > 0) {
        const uid = queue.shift();
        if (uid === undefined || closure.has(uid)) {
            continue;
        }

        const meta = metadata.metasByUid.get(uid);
        if (meta === undefined) {
            fail(`Static import closure cannot be mapped soundly: missing bundle metadata node ${uid}.`);
        }

        closure.add(uid);

        for (const importRef of meta.imported) {
            const importedUid = importRef?.uid;
            if (typeof importedUid !== 'string') {
                fail(`Static import closure cannot be mapped soundly: malformed import edge from ${uid}.`);
            }
            if (!metadata.metasByUid.has(importedUid)) {
                fail(`Static import closure cannot be mapped soundly: ${uid} imports missing node ${importedUid}.`);
            }
            if (importRef.dynamic === true) {
                dynamicRoots.add(importedUid);
                options.onDynamicImport?.(importedUid);
            } else {
                queue.push(importedUid);
            }
        }
    }

    return { closure, dynamicRoots };
}

function getDynamicClosure(rootUids, eagerUids, metadata) {
    const dynamicUids = new Set();
    const visitedRoots = new Set();
    const rootQueue = [...rootUids];

    while (rootQueue.length > 0) {
        const rootUid = rootQueue.shift();
        if (rootUid === undefined || visitedRoots.has(rootUid)) {
            continue;
        }
        visitedRoots.add(rootUid);

        const { closure } = getStaticClosure([rootUid], metadata, {
            onDynamicImport(uid) {
                rootQueue.push(uid);
            },
        });
        for (const uid of closure) {
            if (!eagerUids.has(uid)) {
                dynamicUids.add(uid);
            }
        }
    }

    return dynamicUids;
}

function getChunksForUids(uids, metadata, predicate) {
    const chunks = new Set();
    for (const uid of uids) {
        const moduleChunks = metadata.chunksByUid.get(uid) ?? new Set();
        for (const chunkName of moduleChunks) {
            if (predicate(chunkName)) {
                chunks.add(chunkName);
            }
        }
    }
    return chunks;
}

function getAssetBytes(distDir, assetPath) {
    const fullPath = path.join(distDir, assetPath);
    if (!existsSync(fullPath)) {
        fail(`Bundle asset does not exist on disk: ${assetPath}`);
    }
    return statSync(fullPath).size;
}

function sumAssetBytes(distDir, assetPaths) {
    let total = 0;
    for (const assetPath of assetPaths) {
        total += getAssetBytes(distDir, assetPath);
    }
    return total;
}

function getSortedAssetBytes(distDir, assetPaths) {
    return [...assetPaths]
        .sort((left, right) => left.localeCompare(right))
        .map((assetPath) => ({
            assetPath,
            bytes: getAssetBytes(distDir, assetPath),
        }));
}

function moduleMatchesRequiredDeferred(modulePath, requiredModulePath) {
    return modulePath === requiredModulePath ||
        modulePath === `${requiredModulePath}/index` ||
        (
            modulePath.startsWith(`${requiredModulePath}/`) &&
            !modulePath.endsWith('.css')
        );
}

function findModuleUids(metadata, predicate) {
    const matches = [];
    for (const [uid, modulePath] of metadata.modulePathByUid.entries()) {
        if (predicate(modulePath)) {
            matches.push(uid);
        }
    }
    return matches;
}

function buildBundleReport(distDir, stats) {
    const indexHtmlPath = path.join(distDir, 'index.html');
    if (!existsSync(indexHtmlPath)) {
        fail(`Missing dist index.html: ${indexHtmlPath}`);
    }

    const { moduleScripts, stylesheets } = parseIndexHtmlAssets(readFileSync(indexHtmlPath, 'utf8'));
    if (moduleScripts.length === 0) {
        fail('No module script entries found in dist/index.html.');
    }

    const metadata = buildBundleMetadata(stats);
    const entryUids = new Set();
    for (const moduleScript of moduleScripts) {
        entryUids.add(getHtmlEntryUidForScript(moduleScript, metadata));
    }

    const directDynamicRoots = new Set();
    const { closure: eagerUids } = getStaticClosure(entryUids, metadata, {
        onDynamicImport(uid) {
            directDynamicRoots.add(uid);
        },
    });

    const eagerJsChunks = getChunksForUids(eagerUids, metadata, (chunkName) => chunkName.endsWith('.js'));
    for (const moduleScript of moduleScripts) {
        if (!moduleScript.endsWith('.js')) {
            fail(`HTML module script is not a .js asset: ${moduleScript}`);
        }
        eagerJsChunks.add(moduleScript);
    }

    const bootstrapUids = findModuleUids(
        metadata,
        (modulePath) => modulePath === STARTUP_ENTRY_MODULE
    );
    const eagerBootstrapUids = bootstrapUids.filter((uid) => eagerUids.has(uid));
    if (eagerBootstrapUids.length === 0) {
        fail(
            `${STARTUP_ENTRY_MODULE} is not reachable from dist/index.html as eager startup code. ` +
            'Stop and replan verify-bundle entry detection.'
        );
    }

    const bootstrapChunks = getChunksForUids(eagerBootstrapUids, metadata, (chunkName) => chunkName.endsWith('.js'));
    if (bootstrapChunks.size !== 1) {
        const names = [...bootstrapChunks].sort().join(', ') || '(none)';
        fail(
            `Expected exactly one eager bootstrap-containing .js asset; found ${bootstrapChunks.size}: ${names}. ` +
            'Stop and replan verify-bundle entry detection.'
        );
    }
    const [bootstrapChunk] = [...bootstrapChunks];
    if (!eagerJsChunks.has(bootstrapChunk)) {
        fail(
            `Bootstrap-containing asset ${bootstrapChunk} is not in the eager startup closure. ` +
            'Stop and replan verify-bundle entry detection.'
        );
    }

    const dynamicUids = getDynamicClosure(directDynamicRoots, eagerUids, metadata);
    const dynamicJsChunks = getChunksForUids(dynamicUids, metadata, (chunkName) => (
        chunkName.endsWith('.js') && !eagerJsChunks.has(chunkName)
    ));

    const eagerModulePaths = new Map();
    for (const uid of eagerUids) {
        eagerModulePaths.set(uid, metadata.modulePathByUid.get(uid));
    }

    const deferredChunkMap = new Map();
    for (const requiredModulePath of REQUIRED_DEFERRED_MODULES) {
        const eagerLeak = [...eagerModulePaths.values()].find((modulePath) => (
            typeof modulePath === 'string' && moduleMatchesRequiredDeferred(modulePath, requiredModulePath)
        ));
        if (eagerLeak !== undefined) {
            fail(`Deferred module leaked into eager startup closure: ${requiredModulePath} (${eagerLeak})`);
        }

        const emittedChunks = new Set();
        for (const uid of findModuleUids(
            metadata,
            (modulePath) => moduleMatchesRequiredDeferred(modulePath, requiredModulePath)
        )) {
            for (const chunkName of metadata.chunksByUid.get(uid) ?? new Set()) {
                if (chunkName.endsWith('.js')) {
                    emittedChunks.add(chunkName);
                }
            }
        }
        if (emittedChunks.size === 0) {
            fail(`Required deferred module was not emitted in any .js chunk: ${requiredModulePath}`);
        }
        const eagerChunkLeak = [...emittedChunks].find((chunkName) => eagerJsChunks.has(chunkName));
        if (eagerChunkLeak !== undefined) {
            fail(`Deferred module leaked into eager startup chunk ${eagerChunkLeak}: ${requiredModulePath}`);
        }
        deferredChunkMap.set(requiredModulePath, [...emittedChunks].sort());
    }

    const eagerCssAssets = new Set(stylesheets);
    const eagerCssModules = [...eagerUids]
        .map((uid) => metadata.modulePathByUid.get(uid))
        .filter((modulePath) => typeof modulePath === 'string' && modulePath.endsWith('.css'))
        .sort();

    const eagerJsBytes = sumAssetBytes(distDir, eagerJsChunks);
    const eagerCssBytes = sumAssetBytes(distDir, eagerCssAssets);
    const bootstrapBytes = getAssetBytes(distDir, bootstrapChunk);
    const dynamicChunkBytes = getSortedAssetBytes(distDir, dynamicJsChunks);

    return {
        moduleScripts: [...moduleScripts],
        eagerJsChunks: getSortedAssetBytes(distDir, eagerJsChunks),
        eagerJsBytes,
        stylesheets: [...stylesheets],
        eagerCssBytes,
        eagerCssModules,
        bootstrapChunk,
        bootstrapBytes,
        dynamicChunkBytes,
        deferredChunkMap,
    };
}

function printBundleReport(report) {
    console.log('verify:bundle metrics');
    console.log(`entry module scripts: ${report.moduleScripts.join(', ')}`);
    console.log(`eager JS bytes: ${report.eagerJsBytes}`);
    console.log('eager JS chunks:');
    for (const { assetPath, bytes } of report.eagerJsChunks) {
        console.log(`- ${assetPath}: ${bytes} bytes`);
    }
    console.log(`eager CSS bytes: ${report.eagerCssBytes}`);
    console.log(`entry CSS assets: ${report.stylesheets.join(', ') || '(none)'}`);
    console.log(`eager CSS modules from metadata: ${report.eagerCssModules.length}`);
    console.log(`bootstrap entry: ${report.bootstrapChunk}`);
    console.log(`bootstrap entry bytes: ${report.bootstrapBytes}`);
    console.log('dynamic JS chunks:');
    if (report.dynamicChunkBytes.length === 0) {
        console.log('- (none)');
    } else {
        for (const { assetPath, bytes } of report.dynamicChunkBytes) {
            console.log(`- ${assetPath}: ${bytes} bytes`);
        }
    }
    console.log('deferred module chunks:');
    for (const [modulePath, chunkNames] of report.deferredChunkMap.entries()) {
        console.log(`- ${modulePath}: ${chunkNames.join(', ')}`);
    }
}

function verifyReport(report) {
    if (report.eagerJsBytes >= STARTUP_MAX_BYTES) {
        fail(
            `Eager startup JS is ${report.eagerJsBytes} bytes ` +
            `(must be < ${STARTUP_MAX_BYTES}).`
        );
    }
    if (report.bootstrapBytes >= STARTUP_MAX_BYTES) {
        fail(
            `Bootstrap-containing startup entry ${report.bootstrapChunk} is ${report.bootstrapBytes} bytes ` +
            `(must be < ${STARTUP_MAX_BYTES}).`
        );
    }
}

function main() {
    const options = parseOptions(process.argv.slice(2));
    if (options.runBuild) {
        runBuildAnalyze();
    }

    const statsPath = path.join(options.distDir, 'bundle-stats.json');
    if (!existsSync(statsPath)) {
        fail(`Missing bundle stats file: ${statsPath}`);
    }

    const stats = readJsonFile(statsPath, 'bundle stats file');
    const report = buildBundleReport(options.distDir, stats);
    printBundleReport(report);
    verifyReport(report);
    console.log('verify:bundle PASS');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
    }
}
