import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (root, relative) => fs.readFileSync(path.join(root, relative));
const listFiles = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? listFiles(path.join(dir, entry.name), relative) : [relative];
});

const NOTICE_SOURCES = [
    { source: 'LICENSE', packaged: 'notices/Lineup-Apache-2.0.txt', name: 'Lineup', version: '1.0.0', license: 'Apache-2.0' },
    { source: 'public/vendor/webostvjs-1.2.13/LICENSE-2.0.txt', packaged: 'vendor/webostvjs-1.2.13/LICENSE-2.0.txt', name: 'LG webOSTV.js', version: '1.2.13', license: 'Apache-2.0' },
    { source: 'src/assets/fonts/Inter-OFL.txt', packaged: 'notices/Inter-OFL.txt', name: 'Inter', version: 'variable bundled font', license: 'SIL OFL 1.1' },
    { source: 'src/assets/fonts/InstrumentSans-OFL.txt', packaged: 'notices/InstrumentSans-OFL.txt', name: 'Instrument Sans', version: 'variable bundled font', license: 'SIL OFL 1.1' },
    { source: 'src/assets/licenses/vite-8.2.2-MIT.txt', packaged: 'notices/vite-8.2.2-MIT.txt', name: 'Vite generated runtime helpers', version: '8.2.2', license: 'MIT' },
    { source: 'src/assets/licenses/rolldown-1.2.5-MIT.txt', packaged: 'notices/rolldown-1.2.5-MIT.txt', name: 'Rolldown generated runtime helpers', version: '1.2.5', license: 'MIT' },
];

const GENERATED_HELPER_LICENSES = [
    { packageName: 'vite', version: '8.2.2', installedLicense: 'LICENSE.md', coreEnd: '# Licenses of bundled dependencies', notice: 'src/assets/licenses/vite-8.2.2-MIT.txt' },
    { packageName: 'rolldown', version: '1.2.5', installedLicense: 'LICENSE', coreEnd: 'end of terms and conditions', notice: 'src/assets/licenses/rolldown-1.2.5-MIT.txt' },
];

const PUBLIC_FILES = [
    'appinfo.json', 'icon.png', 'largeIcon.png', 'lineup-logo-mark.png',
    'lineup-wordmark-cropped.png', 'lineup-wordmark.png', 'splashBackground.png',
    'notices/Lineup-Apache-2.0.txt', 'notices/Inter-OFL.txt', 'notices/InstrumentSans-OFL.txt',
    'notices/vite-8.2.2-MIT.txt', 'notices/rolldown-1.2.5-MIT.txt',
    'vendor/webostvjs-1.2.13/webOSTV.js',
    'vendor/webostvjs-1.2.13/SOURCE.md',
    'vendor/webostvjs-1.2.13/LICENSE-2.0.txt',
];

export function verifyOfflineNotices(root, dist, approvedInventory = null) {
    const manifest = JSON.parse(read(root, 'package.json').toString('utf8'));
    const lock = JSON.parse(read(root, 'package-lock.json').toString('utf8'));
    if (Object.keys(manifest.dependencies ?? {}).length > 0 || Object.keys(lock.packages?.['']?.dependencies ?? {}).length > 0) {
        throw new Error('Runtime dependency notices need inventory before packaging');
    }
    if (manifest.version !== '1.0.0' || lock.packages?.['']?.version !== manifest.version) {
        throw new Error('Lineup notice version differs from package manifest/lock');
    }

    for (const helper of GENERATED_HELPER_LICENSES) {
        const installed = JSON.parse(read(root, `node_modules/${helper.packageName}/package.json`).toString('utf8'));
        const locked = lock.packages?.[`node_modules/${helper.packageName}`];
        if (installed.version !== helper.version || locked?.version !== helper.version
            || installed.license !== 'MIT' || locked.license !== 'MIT') {
            throw new Error(`${helper.packageName} generated-helper notice version/license differs from installed package or lock`);
        }
        const sourceLicense = read(root, `node_modules/${helper.packageName}/${helper.installedLicense}`).toString('utf8');
        const start = sourceLicense.indexOf('MIT License');
        const end = sourceLicense.indexOf(helper.coreEnd, start);
        if (start < 0 || end < 0) throw new Error(`${helper.packageName} installed core MIT license boundaries changed`);
        const coreLicense = `${sourceLicense.slice(start, end).trim()}\n`;
        if (coreLicense !== read(root, helper.notice).toString('utf8')) {
            throw new Error(`${helper.packageName} generated-helper core MIT notice differs from installed license`);
        }
    }

    const sourceNote = read(root, 'public/vendor/webostvjs-1.2.13/SOURCE.md').toString('utf8');
    if (!sourceNote.startsWith('# webOSTV.js 1.2.13')) throw new Error('LG vendor version/source changed');
    for (const name of ['webOSTV.js', 'LICENSE-2.0.txt']) {
        const expected = sourceNote.match(new RegExp('`' + name.replace('.', '\\.') + '` SHA-256: `([a-f0-9]{64})`'))?.[1];
        if (!expected || hash(read(root, `public/vendor/webostvjs-1.2.13/${name}`)) !== expected) {
            throw new Error(`LG vendor ${name} differs from pinned source hash`);
        }
    }

    const reader = read(root, 'src/modules/ui/support/OfflineNotices.ts').toString('utf8');
    const expectedReader = [
        '/** Offline notices copied from the distributed source licenses. */',
        'export const OFFLINE_NOTICES = [',
        ...NOTICE_SOURCES.map((entry) =>
            `    { name: ${JSON.stringify(entry.name)}, version: ${JSON.stringify(entry.version)}, license: ${JSON.stringify(entry.license)}, source: ${JSON.stringify(entry.source)}, text: ${JSON.stringify(read(root, entry.source).toString('utf8'))} },`),
        '] as const;',
        '',
    ].join('\n');
    if (reader !== expectedReader) {
        throw new Error('Reader notice entries differ from exact source metadata/text tuples');
    }
    for (const entry of NOTICE_SOURCES) {
        const bytes = read(root, entry.source);
        if (hash(bytes) !== hash(read(root, `public/${entry.packaged}`))) {
            throw new Error(`Packaged notice differs from source: ${entry.packaged}`);
        }
    }

    const sourcePublic = listFiles(path.join(root, 'public')).sort();
    if (JSON.stringify(sourcePublic) !== JSON.stringify([...PUBLIC_FILES].sort())) {
        throw new Error('Public assets changed; review offline inventory');
    }
    const builtPublic = PUBLIC_FILES.map((relative) => ({
        path: relative,
        sha256: hash(read(dist, relative)),
    }));
    for (const entry of builtPublic) {
        if (entry.sha256 !== hash(read(root, `public/${entry.path}`))) {
            throw new Error(`Built public asset differs from source: ${entry.path}`);
        }
    }

    const builtFiles = listFiles(dist).sort();
    const generated = builtFiles.filter((relative) => !PUBLIC_FILES.includes(relative));
    if (!generated.includes('index.html') || !generated.some((relative) => /^assets\/.*\.js$/u.test(relative))) {
        throw new Error('Expected index and bundled JavaScript are absent');
    }
    const unexpected = generated.filter((relative) =>
        relative !== 'index.html' && relative !== 'build-provenance.json'
        && !/^assets\/[^/]+\.(?:js|css|ttf|map)$/u.test(relative));
    if (unexpected.length > 0) throw new Error(`Unexpected generated files: ${unexpected.join(', ')}`);

    const assetFiles = generated.filter((relative) => relative.endsWith('.ttf'));
    const expectedFontHashes = [
        hash(read(root, 'src/assets/fonts/inter-variable.ttf')),
        hash(read(root, 'src/assets/fonts/instrument-sans-variable.ttf')),
    ].sort();
    const actualFontHashes = assetFiles.map((relative) => hash(read(dist, relative))).sort();
    if (JSON.stringify(actualFontHashes) !== JSON.stringify(expectedFontHashes)) {
        throw new Error('Bundled font bytes differ from the two inventoried fonts');
    }

    const js = generated.filter((relative) => relative.endsWith('.js'))
        .map((relative) => read(dist, relative).toString('utf8')).join('\n');
    for (const marker of [
        'SIL OPEN FONT LICENSE', 'LG webOSTV.js', 'Apache License',
        'Copyright (c) 2019-present, VoidZero Inc. and Vite contributors',
        'Copyright (c) 2024-present VoidZero Inc. & Contributors',
    ]) {
        if (!js.includes(marker)) throw new Error(`Reader notice marker absent from built JavaScript: ${marker}`);
    }
    const generatedFiles = generated.map((relative) => ({ path: relative, sha256: hash(read(dist, relative)) }));
    const sourceInventorySha256 = hash(Buffer.from(JSON.stringify([
        'package.json', 'package-lock.json', 'src/modules/ui/support/OfflineNotices.ts',
        ...NOTICE_SOURCES.map((entry) => entry.source),
        'public/vendor/webostvjs-1.2.13/SOURCE.md',
        'src/assets/fonts/inter-variable.ttf', 'src/assets/fonts/instrument-sans-variable.ttf',
        ...GENERATED_HELPER_LICENSES.flatMap((helper) => [
            `node_modules/${helper.packageName}/package.json`,
            `node_modules/${helper.packageName}/${helper.installedLicense}`,
        ]),
        ...PUBLIC_FILES.map((relative) => `public/${relative}`),
    ].map((relative) => [relative, hash(read(root, relative))]))));
    if (approvedInventory && (
        approvedInventory.sourceInventorySha256 !== sourceInventorySha256
        || JSON.stringify(approvedInventory.generatedFiles) !== JSON.stringify(generatedFiles)
    )) {
        throw new Error('Generated JavaScript/assets differ from approved build inventory');
    }
    return {
        schemaVersion: 1,
        status: approvedInventory ? 'approved-inventory-match' : 'inventory-only-generated-code-review-required',
        sourceInventorySha256,
        runtimeDependencies: [],
        notices: NOTICE_SOURCES.map((entry) => ({ ...entry, sha256: hash(read(root, entry.source)) })),
        publicFiles: builtPublic,
        generatedFiles,
        generatedCodeProvenance: 'Review generated JavaScript chunks and source maps against build provenance before approving this inventory; source equality cannot be inferred from asset presence.',
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const dist = path.resolve(process.argv[2] ?? path.join(PROJECT_ROOT, 'dist'));
    const approvedInventory = process.argv[3] ? JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), 'utf8')) : null;
    console.log(JSON.stringify(verifyOfflineNotices(PROJECT_ROOT, dist, approvedInventory), null, 2));
}
