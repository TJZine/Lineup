import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_TIMING_MEASURES = [
    'lineup.runtime_import',
    'lineup.orchestrator_initialize',
    'lineup.orchestrator_start',
    'lineup.app_start_to_first_actionable',
];

const TIMING_FIELD_BY_MEASURE = new Map([
    ['lineup.runtime_import', 'runtime_import_ms'],
    ['lineup.orchestrator_initialize', 'orchestrator_initialize_ms'],
    ['lineup.orchestrator_start', 'orchestrator_start_ms'],
    ['lineup.app_start_to_first_actionable', 'app_start_to_first_actionable_ms'],
]);

const DEFAULT_TOP_LIMIT = 10;
const DEFAULT_BUILD_PROFILE = 'lean';

function fail(message) {
    throw new Error(message);
}

function normalizeModulePath(modulePath) {
    return String(modulePath)
        .replace(/\\/gu, '/')
        .replace(/^\0/u, '')
        .split('?')[0]
        .split('#')[0]
        .replace(/^\//u, '');
}

function normalizeHtmlAssetPath(assetPath) {
    const withoutHash = String(assetPath).split('#')[0].split('?')[0];
    if (/^[a-z][a-z0-9+.-]*:/iu.test(withoutHash) || withoutHash.startsWith('//')) {
        fail(`External asset references are not supported: ${assetPath}`);
    }
    const normalized = path.posix.normalize(withoutHash.replace(/^\.\//u, '').replace(/^\//u, ''));
    if (normalized.startsWith('../')) {
        fail(`Asset reference escapes dist/: ${assetPath}`);
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
        if (getAttribute(tag, 'type')?.toLowerCase() === 'module') {
            const src = getAttribute(tag, 'src');
            if (src !== null) {
                moduleScripts.push(normalizeHtmlAssetPath(src));
            }
        }
    }

    for (const match of indexHtml.matchAll(/<link\b[^>]*>/giu)) {
        const tag = match[0];
        const relTokens = getAttribute(tag, 'rel')?.toLowerCase().split(/\s+/u) ?? [];
        const href = getAttribute(tag, 'href');
        if (href !== null && relTokens.includes('stylesheet')) {
            stylesheets.push(normalizeHtmlAssetPath(href));
        }
    }

    return { moduleScripts, stylesheets };
}

function normalizeStatsModuleId(moduleId) {
    const normalized = normalizeModulePath(moduleId);
    const parts = normalized.split('/').filter((part) => part.length > 0);
    const srcIndex = parts.indexOf('src');
    return srcIndex >= 0 ? parts.slice(srcIndex).join('/') : normalized;
}

function stripSourceExtension(modulePath) {
    return modulePath.replace(/\.(?:[cm]?[jt]sx?)$/u, '');
}

function ownerForModule(modulePath) {
    const normalized = stripSourceExtension(normalizeStatsModuleId(modulePath));
    const parts = normalized.split('/');

    if (parts[0] !== 'src') {
        return parts[0] || 'unknown';
    }
    if (parts[1] === 'modules' && typeof parts[2] === 'string') {
        if (parts[2] === 'ui' && typeof parts[3] === 'string') {
            return `modules/ui/${parts[3]}`;
        }
        return `modules/${parts[2]}`;
    }
    if (parts[1] === 'core' && typeof parts[2] === 'string') {
        return `core/${parts[2]}`;
    }
    return parts.slice(0, 2).join('/') || 'unknown';
}

function readJsonFile(filePath, description) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        fail(`Failed to parse ${description} ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function buildBundleMetadata(stats) {
    if (stats?.version !== 2 || typeof stats.nodeMetas !== 'object' || stats.nodeMetas === null) {
        fail('bundle-stats.json is not rollup-plugin-visualizer raw-data v2 output.');
    }

    const metasByUid = new Map();
    const rawIdByUid = new Map();
    const modulePathByUid = new Map();
    const partByUid = new Map();
    const uidsByChunk = new Map();

    for (const [uid, meta] of Object.entries(stats.nodeMetas)) {
        if (typeof meta !== 'object' || meta === null || typeof meta.id !== 'string') {
            fail(`Cannot map bundle metadata node ${uid}: missing module id.`);
        }
        if (typeof meta.moduleParts !== 'object' || meta.moduleParts === null) {
            fail(`Cannot map bundle metadata node ${uid}: missing module chunk mapping.`);
        }
        if (!Array.isArray(meta.imported)) {
            fail(`Cannot map static closure soundly: missing import edges for ${uid}.`);
        }

        metasByUid.set(uid, meta);
        rawIdByUid.set(uid, meta.id);
        modulePathByUid.set(uid, normalizeStatsModuleId(meta.id));

        for (const [chunkName, partUid] of Object.entries(meta.moduleParts)) {
            if (typeof partUid !== 'string') {
                fail(`Cannot map bundle metadata node ${uid}: malformed module part for ${chunkName}.`);
            }
            const normalizedChunk = normalizeHtmlAssetPath(chunkName);
            partByUid.set(`${uid}:${normalizedChunk}`, partUid);
            if (!uidsByChunk.has(normalizedChunk)) {
                uidsByChunk.set(normalizedChunk, new Set());
            }
            uidsByChunk.get(normalizedChunk).add(uid);
        }
    }

    return {
        metasByUid,
        rawIdByUid,
        modulePathByUid,
        partByUid,
        uidsByChunk,
        nodeParts: stats.nodeParts ?? {},
    };
}

function isHtmlEntryFacadeId(moduleId) {
    const withoutHash = String(moduleId).replace(/\\/gu, '/').replace(/^\0/u, '').split('#')[0];
    const [withoutQuery] = withoutHash.split('?');
    return !withoutHash.includes('?') && withoutQuery.endsWith('.html');
}

function getHtmlEntryUidForScript(moduleScript, metadata) {
    const scriptUids = metadata.uidsByChunk.get(moduleScript);
    if (scriptUids === undefined || scriptUids.size === 0) {
        fail(`Cannot map HTML module script to bundle metadata: ${moduleScript}`);
    }

    const entryUids = [...scriptUids].filter((uid) => isHtmlEntryFacadeId(metadata.rawIdByUid.get(uid)));
    if (entryUids.length !== 1) {
        fail(`Cannot map HTML module script to a single entry metadata root: ${moduleScript}`);
    }
    return entryUids[0];
}

function getStaticClosure(rootUids, metadata) {
    const closure = new Set();
    const queue = [...rootUids];

    while (queue.length > 0) {
        const uid = queue.shift();
        if (uid === undefined || closure.has(uid)) {
            continue;
        }
        const meta = metadata.metasByUid.get(uid);
        if (meta === undefined) {
            fail(`Cannot map static closure soundly: missing bundle metadata node ${uid}.`);
        }
        closure.add(uid);
        for (const importRef of meta.imported) {
            if (importRef?.dynamic === true) {
                continue;
            }
            if (typeof importRef?.uid !== 'string') {
                fail(`Cannot map static closure soundly: malformed import edge from ${uid}.`);
            }
            queue.push(importRef.uid);
        }
    }

    return closure;
}

function getAssetBytes(distDir, relativeAssetPath) {
    const fullPath = path.join(distDir, relativeAssetPath);
    if (!existsSync(fullPath)) {
        fail(`Expected asset is missing from dist/: ${relativeAssetPath}`);
    }
    return statSync(fullPath).size;
}

function getPartRenderedBytes(metadata, uid, chunkName) {
    const partUid = metadata.partByUid.get(`${uid}:${chunkName}`);
    if (partUid === undefined) {
        return 0;
    }
    const part = metadata.nodeParts[partUid];
    if (typeof part !== 'object' || part === null) {
        return 0;
    }
    return Number(part.renderedLength ?? 0);
}

function sortRenderedRows(rows) {
    return rows
        .filter((row) => Number.isFinite(row.rendered_bytes) && row.rendered_bytes > 0)
        .sort((left, right) => right.rendered_bytes - left.rendered_bytes);
}

export function summarizeBundle(distDir, topLimit = DEFAULT_TOP_LIMIT) {
    const indexHtmlPath = path.join(distDir, 'index.html');
    const statsPath = path.join(distDir, 'bundle-stats.json');
    if (!existsSync(indexHtmlPath)) {
        fail(`Missing dist index.html at ${indexHtmlPath}`);
    }
    if (!existsSync(statsPath)) {
        fail(`Missing bundle stats at ${statsPath}`);
    }

    const assets = parseIndexHtmlAssets(readFileSync(indexHtmlPath, 'utf8'));
    const stats = readJsonFile(statsPath, 'bundle stats');
    const metadata = buildBundleMetadata(stats);
    const entryUids = assets.moduleScripts.map((script) => getHtmlEntryUidForScript(script, metadata));
    const staticClosure = getStaticClosure(entryUids, metadata);
    const staticChunks = new Set();

    for (const uid of staticClosure) {
        const meta = metadata.metasByUid.get(uid);
        for (const chunkName of Object.keys(meta.moduleParts)) {
            staticChunks.add(normalizeHtmlAssetPath(chunkName));
        }
    }

    const entryJsBytes = [...staticChunks].reduce((total, chunk) => total + getAssetBytes(distDir, chunk), 0);
    const bootstrapEntryBytes = assets.moduleScripts.reduce(
        (total, script) => total + getAssetBytes(distDir, script),
        0
    );
    const eagerCssBytes = assets.stylesheets.reduce(
        (total, stylesheet) => total + getAssetBytes(distDir, stylesheet),
        0
    );

    const runtimeChunkFiles = [...metadata.uidsByChunk.keys()]
        .filter((chunkName) => /^assets\/Orchestrator-[^/]+\.js$/u.test(chunkName))
        .sort();
    if (runtimeChunkFiles.length !== 1) {
        fail(`Expected exactly one Orchestrator runtime chunk, found ${runtimeChunkFiles.length}.`);
    }
    const runtimeChunkFile = runtimeChunkFiles[0];
    const runtimeChunkPath = path.join(distDir, runtimeChunkFile);
    const runtimeChunkBytes = getAssetBytes(distDir, runtimeChunkFile);
    const runtimeChunkGzipBytes = gzipSync(readFileSync(runtimeChunkPath)).length;
    const runtimeUids = metadata.uidsByChunk.get(runtimeChunkFile) ?? new Set();

    const topModules = sortRenderedRows([...runtimeUids].map((uid) => ({
        path: metadata.modulePathByUid.get(uid),
        rendered_bytes: getPartRenderedBytes(metadata, uid, runtimeChunkFile),
    }))).slice(0, topLimit);

    const ownerBytes = new Map();
    for (const uid of runtimeUids) {
        const modulePath = metadata.modulePathByUid.get(uid);
        const owner = ownerForModule(modulePath);
        ownerBytes.set(owner, (ownerBytes.get(owner) ?? 0) + getPartRenderedBytes(metadata, uid, runtimeChunkFile));
    }
    const topOwners = sortRenderedRows([...ownerBytes.entries()].map(([owner, renderedBytes]) => ({
        owner,
        rendered_bytes: renderedBytes,
    }))).slice(0, topLimit);

    return {
        entry_js_bytes: entryJsBytes,
        bootstrap_entry_bytes: bootstrapEntryBytes,
        eager_css_bytes: eagerCssBytes,
        runtime_chunk_file: runtimeChunkFile,
        runtime_chunk_bytes: runtimeChunkBytes,
        runtime_chunk_gzip_bytes: runtimeChunkGzipBytes,
        top_modules: topModules,
        top_owners: topOwners,
    };
}

export function summarizeTimingSamples(samples) {
    const summary = {
        sample_count: samples.length,
        timing_source: 'performance_api_marks',
    };

    for (const [measureName, fieldName] of TIMING_FIELD_BY_MEASURE.entries()) {
        const values = samples
            .map((sample) => sample.measures[measureName])
            .filter((value) => Number.isFinite(value))
            .sort((left, right) => left - right);
        if (values.length !== samples.length || values.length === 0) {
            fail(`Missing required timing field ${fieldName}; collected ${values.length}/${samples.length} samples.`);
        }
        const midpoint = Math.floor(values.length / 2);
        const median = values.length % 2 === 0
            ? (values[midpoint - 1] + values[midpoint]) / 2
            : values[midpoint];
        summary[fieldName] = {
            median: Number(median.toFixed(2)),
            min: Number(values[0].toFixed(2)),
            max: Number(values[values.length - 1].toFixed(2)),
        };
    }

    return summary;
}

function parseOptions(argv) {
    const options = {
        distDir: path.resolve(process.cwd(), 'dist'),
        url: 'http://127.0.0.1:5173/',
        runs: 7,
        viewport: '1280x720',
        cachePolicy: 'cold',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const value = argv[index + 1];
        if (arg === '--dist') {
            if (value === undefined) fail('Missing value for --dist.');
            options.distDir = path.resolve(process.cwd(), value);
            index += 1;
        } else if (arg === '--url') {
            if (value === undefined) fail('Missing value for --url.');
            options.url = value;
            index += 1;
        } else if (arg === '--runs') {
            if (value === undefined) fail('Missing value for --runs.');
            options.runs = Number(value);
            index += 1;
        } else if (arg === '--viewport') {
            if (value === undefined) fail('Missing value for --viewport.');
            options.viewport = value;
            index += 1;
        } else if (arg === '--cache') {
            if (value === undefined) fail('Missing value for --cache.');
            options.cachePolicy = value;
            index += 1;
        } else {
            fail(`Unknown measure-runtime-chunk-performance option: ${arg}`);
        }
    }

    if (!Number.isInteger(options.runs) || options.runs < 1) {
        fail('--runs must be a positive integer.');
    }
    if (options.runs < 7) {
        fail('--runs must be at least 7 for RC-S1 timing evidence.');
    }
    if (!/^\d+x\d+$/u.test(options.viewport)) {
        fail('--viewport must be formatted as WIDTHxHEIGHT.');
    }
    if (!['cold', 'warm'].includes(options.cachePolicy)) {
        fail('--cache must be cold or warm.');
    }

    return options;
}

function getGitOutput(args, fallback) {
    try {
        const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
        return result.status === 0 ? result.stdout.trim() : fallback;
    } catch {
        return fallback;
    }
}

function findChromeExecutable() {
    const candidates = [
        process.env.CHROME_PATH,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ].filter(Boolean);
    const executable = candidates.find((candidate) => existsSync(candidate));
    if (!executable) {
        fail('Cannot find Chrome/Chromium executable for production timing collection.');
    }
    return executable;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForProcessExit(childProcess, timeoutMs = 3000) {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const timeout = setTimeout(resolve, timeoutMs);
        childProcess.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
    });
}

async function readDevToolsUrl(userDataDir, chromeProcess) {
    const portFile = path.join(userDataDir, 'DevToolsActivePort');
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        if (chromeProcess.exitCode !== null) {
            fail(`Chrome exited before DevTools became available with code ${chromeProcess.exitCode}.`);
        }
        if (existsSync(portFile)) {
            const [port, browserPath] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/u);
            if (port && browserPath) {
                return `ws://127.0.0.1:${port}${browserPath}`;
            }
        }
        await wait(50);
    }
    fail('Timed out waiting for Chrome DevTools endpoint.');
}

async function getTargetWebSocketUrl(browserWsUrl, targetId) {
    const browserUrl = new URL(browserWsUrl);
    const response = await fetch(`http://${browserUrl.host}/json/list`);
    if (!response.ok) {
        fail(`Cannot list Chrome DevTools targets: HTTP ${response.status}.`);
    }
    const targets = await response.json();
    const target = targets.find((candidate) => candidate.id === targetId);
    if (typeof target?.webSocketDebuggerUrl !== 'string') {
        fail(`Cannot find Chrome DevTools websocket URL for target ${targetId}.`);
    }
    return target.webSocketDebuggerUrl;
}

function connectWebSocket(url) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url);
        socket.addEventListener('open', () => resolve(socket), { once: true });
        socket.addEventListener('error', () => reject(new Error(`Failed to connect to ${url}`)), { once: true });
    });
}

class CdpConnection {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.eventWaiters = [];
        socket.addEventListener('message', (event) => this.handleMessage(event));
        socket.addEventListener('close', () => {
            for (const { reject } of this.pending.values()) {
                reject(new Error('DevTools connection closed.'));
            }
            this.pending.clear();
        });
    }

    handleMessage(event) {
        const payload = JSON.parse(event.data);
        if (typeof payload.id === 'number') {
            const pending = this.pending.get(payload.id);
            if (pending === undefined) {
                return;
            }
            this.pending.delete(payload.id);
            if (payload.error) {
                pending.reject(new Error(payload.error.message ?? JSON.stringify(payload.error)));
            } else {
                pending.resolve(payload.result ?? {});
            }
            return;
        }

        for (const waiter of [...this.eventWaiters]) {
            if (waiter.method === payload.method && waiter.predicate(payload.params ?? {})) {
                clearTimeout(waiter.timeout);
                this.eventWaiters.splice(this.eventWaiters.indexOf(waiter), 1);
                waiter.resolve(payload.params ?? {});
            }
        }
    }

    send(method, params = {}) {
        const id = this.nextId;
        this.nextId += 1;
        this.socket.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
        });
    }

    waitFor(method, predicate = () => true, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const waiter = {
                method,
                predicate,
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.eventWaiters.splice(this.eventWaiters.indexOf(waiter), 1);
                    reject(new Error(`Timed out waiting for ${method}.`));
                }, timeoutMs),
            };
            this.eventWaiters.push(waiter);
        });
    }

    close() {
        this.socket.close();
    }
}

async function collectBrowserTimings(options) {
    const [viewportWidth, viewportHeight] = options.viewport.split('x').map(Number);
    const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'lineup-runtime-measure-'));
    const chrome = spawn(findChromeExecutable(), [
        '--headless=new',
        '--remote-debugging-port=0',
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-popup-blocking',
        '--disable-sync',
        'about:blank',
    ], { stdio: 'ignore' });

    try {
        const browserWsUrl = await readDevToolsUrl(userDataDir, chrome);
        const browser = new CdpConnection(await connectWebSocket(browserWsUrl));
        const browserVersion = await browser.send('Browser.getVersion');
        const samples = [];

        for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
            const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
            const pageWs = await getTargetWebSocketUrl(browserWsUrl, targetId);
            const page = new CdpConnection(await connectWebSocket(pageWs));
            try {
                await page.send('Page.enable');
                await page.send('Runtime.enable');
                await page.send('Network.enable');
                await page.send('Emulation.setDeviceMetricsOverride', {
                    width: viewportWidth,
                    height: viewportHeight,
                    deviceScaleFactor: 1,
                    mobile: false,
                });
                if (options.cachePolicy === 'cold') {
                    await page.send('Network.clearBrowserCache');
                    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
                } else {
                    await page.send('Network.setCacheDisabled', { cacheDisabled: false });
                }

                const loadEvent = page.waitFor('Page.loadEventFired');
                await page.send('Page.navigate', { url: options.url });
                await loadEvent;
                await wait(100);

                const timingResult = await page.send('Runtime.evaluate', {
                    returnByValue: true,
                    expression: `(() => {
                        const measures = {};
                        for (const name of ${JSON.stringify(REQUIRED_TIMING_MEASURES)}) {
                            const entries = performance.getEntriesByName(name, 'measure');
                            const latest = entries[entries.length - 1];
                            if (!latest) return { ok: false, missing: name, measures };
                            measures[name] = latest.duration;
                        }
                        return { ok: true, measures };
                    })()`,
                });
                const value = timingResult.result?.value;
                if (!value?.ok) {
                    fail(`Missing browser timing measure ${value?.missing ?? '(unknown)'}.`);
                }
                samples.push({ measures: value.measures });
            } finally {
                page.close();
                await browser.send('Target.closeTarget', { targetId });
            }
        }

        browser.close();
        return {
            browserUserAgent: browserVersion.userAgent,
            samples,
        };
    } finally {
        chrome.kill('SIGTERM');
        await waitForProcessExit(chrome);
        rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
}

function buildDisposition(bundle, timing) {
    const topOwner = bundle.top_owners[0];
    const runtimeImportMedian = timing.runtime_import_ms.median;
    const firstActionableMedian = timing.app_start_to_first_actionable_ms.median;

    return {
        outcome: 'next_plan_lazy_boundary',
        owner: 'src/modules/plex/stream/diagnostics',
        expected_value: (
            `${bundle.runtime_chunk_file} is ${bundle.runtime_chunk_bytes} bytes ` +
            `(${bundle.runtime_chunk_gzip_bytes} gzip); top owner ${topOwner?.owner ?? 'unknown'} ` +
            `accounts for ${topOwner?.rendered_bytes ?? 0} rendered bytes; median runtime import ` +
            `${runtimeImportMedian} ms and app start to first actionable ${firstActionableMedian} ms.`
        ),
        next_plan_trigger: (
            'Draft a reviewed owner-boundary split plan only if source audit confirms a Plex diagnostics/debug/recovery ' +
            'lazy boundary can reduce the deferred Orchestrator chunk while preserving these timing medians and bundle guards.'
        ),
    };
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    const bundle = summarizeBundle(options.distDir);
    const { browserUserAgent, samples } = await collectBrowserTimings(options);
    const timingSummary = summarizeTimingSamples(samples);
    const result = {
        build_profile: process.env.LINEUP_BUILD_PROFILE ?? DEFAULT_BUILD_PROFILE,
        git_head: getGitOutput(['rev-parse', 'HEAD'], 'unknown'),
        git_dirty_summary: getGitOutput(['status', '--short'], ''),
        node_version: process.version,
        timestamp: new Date().toISOString(),
        bundle,
        timing: {
            url: options.url,
            browser_user_agent: browserUserAgent,
            viewport: options.viewport,
            cache_policy: options.cachePolicy,
            run_count: options.runs,
            ...timingSummary,
        },
        disposition: buildDisposition(bundle, timingSummary),
    };

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main()
        .catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        });
}
