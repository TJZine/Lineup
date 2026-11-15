import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyOfflineNotices } from '../verify-offline-notices.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function fixture() {
    const base = mkdtempSync(path.join(os.tmpdir(), 'lineup-notices-'));
    const root = path.join(base, 'source');
    const dist = path.join(base, 'dist');
    mkdirSync(root); mkdirSync(dist);
    for (const relative of [
        'LICENSE', 'package.json', 'package-lock.json',
        'src/modules/ui/support/OfflineNotices.ts',
        'src/assets/fonts/Inter-OFL.txt', 'src/assets/fonts/InstrumentSans-OFL.txt',
        'src/assets/fonts/inter-variable.ttf', 'src/assets/fonts/instrument-sans-variable.ttf',
        'src/assets/licenses/vite-8.2.2-MIT.txt', 'src/assets/licenses/rolldown-1.2.5-MIT.txt',
        'node_modules/vite/package.json', 'node_modules/vite/LICENSE.md',
        'node_modules/rolldown/package.json', 'node_modules/rolldown/LICENSE',
    ]) {
        mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
        cpSync(path.join(project, relative), path.join(root, relative));
    }
    cpSync(path.join(project, 'public'), path.join(root, 'public'), { recursive: true });
    cpSync(path.join(project, 'public'), dist, { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), '<script src="assets/index.js"></script>');
    mkdirSync(path.join(dist, 'assets'));
    writeFileSync(path.join(dist, 'assets', 'index.js'),
        'SIL OPEN FONT LICENSE LG webOSTV.js Apache License ' +
        'Copyright (c) 2019-present, VoidZero Inc. and Vite contributors ' +
        'Copyright (c) 2024-present VoidZero Inc. & Contributors');
    cpSync(path.join(root, 'src/assets/fonts/inter-variable.ttf'), path.join(dist, 'assets/inter.ttf'));
    cpSync(path.join(root, 'src/assets/fonts/instrument-sans-variable.ttf'), path.join(dist, 'assets/instrument.ttf'));
    return { root, dist, dispose: () => rmSync(base, { recursive: true, force: true }) };
}

test('inventories exact public bytes, license texts, source hashes, font bytes and generated files', () => {
    const item = fixture();
    try {
        const result = verifyOfflineNotices(item.root, item.dist);
        assert.equal(result.notices.length, 6);
        assert.equal(result.runtimeDependencies.length, 0);
        assert.ok(result.generatedFiles.some((entry) => entry.path === 'assets/index.js'));
        assert.equal(result.status, 'inventory-only-generated-code-review-required');
        assert.equal(verifyOfflineNotices(item.root, item.dist, result).status, 'approved-inventory-match');
    } finally { item.dispose(); }
});

test('pins generated-helper notices to installed and locked versions and exact core MIT text', () => {
    const item = fixture();
    try {
        const lockPath = path.join(item.root, 'package-lock.json');
        const originalLock = readFileSync(lockPath, 'utf8');
        const lock = JSON.parse(originalLock);
        lock.packages['node_modules/vite'].version = '8.2.3';
        writeFileSync(lockPath, JSON.stringify(lock));
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /vite generated-helper notice version\/license/);
        writeFileSync(lockPath, originalLock);

        const notice = path.join(item.root, 'src/assets/licenses/rolldown-1.2.5-MIT.txt');
        writeFileSync(notice, readFileSync(notice, 'utf8').replace('2024-present', '2025-present'));
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /rolldown generated-helper core MIT notice differs/);
    } finally { item.dispose(); }
});

test('rejects missing or changed helper package identity in the lock and installed package', () => {
    const item = fixture();
    try {
        const lockPath = path.join(item.root, 'package-lock.json');
        const originalLock = readFileSync(lockPath, 'utf8');
        const lock = JSON.parse(originalLock);
        delete lock.packages['node_modules/rolldown'];
        writeFileSync(lockPath, JSON.stringify(lock));
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /rolldown generated-helper notice version\/license/);
        writeFileSync(lockPath, originalLock);
        writeFileSync(lockPath, '{bad JSON');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), SyntaxError);
        writeFileSync(lockPath, originalLock);

        const installedPath = path.join(item.root, 'node_modules/vite/package.json');
        const installed = JSON.parse(readFileSync(installedPath, 'utf8'));
        installed.version = '8.2.3';
        writeFileSync(installedPath, JSON.stringify(installed));
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /vite generated-helper notice version\/license/);
        installed.version = '8.2.2';
        installed.license = 'Apache-2.0';
        writeFileSync(installedPath, JSON.stringify(installed));
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /vite generated-helper notice version\/license/);
    } finally { item.dispose(); }
});

test('rejects swapped, duplicated, or altered reader entries as complete tuples', () => {
    const item = fixture();
    try {
        const readerPath = path.join(item.root, 'src/modules/ui/support/OfflineNotices.ts');
        const original = readFileSync(readerPath, 'utf8');
        const viteName = 'name: "Vite generated runtime helpers"';
        const rolldownName = 'name: "Rolldown generated runtime helpers"';
        const swapped = original.replace(viteName, 'name: "temporary"')
            .replace(rolldownName, viteName).replace('name: "temporary"', rolldownName);
        writeFileSync(readerPath, swapped);
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Reader notice entries differ/);

        const duplicated = original.replace('] as const;', `${original.slice(original.indexOf('    { name: "Vite generated runtime helpers"'), original.indexOf('    { name: "Rolldown generated runtime helpers"'))}] as const;`);
        writeFileSync(readerPath, duplicated);
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Reader notice entries differ/);

        const missingBody = original.replace('Copyright (c) 2024-present VoidZero Inc. & Contributors', 'Copyright removed');
        writeFileSync(readerPath, missingBody);
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Reader notice entries differ/);
    } finally { item.dispose(); }
});

test('rejects changed public helper copy and missing bundled helper notice', () => {
    const item = fixture();
    try {
        const sourcePublic = path.join(item.root, 'public/notices/vite-8.2.2-MIT.txt');
        writeFileSync(sourcePublic, readFileSync(sourcePublic, 'utf8').replace('2019-present', '2020-present'));
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Packaged notice differs from source/);
        cpSync(path.join(project, 'public/notices/vite-8.2.2-MIT.txt'), sourcePublic);

        const jsPath = path.join(item.dist, 'assets/index.js');
        writeFileSync(jsPath, readFileSync(jsPath, 'utf8').replace('Copyright (c) 2024-present VoidZero Inc. & Contributors', 'copyright removed'));
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Reader notice marker absent from built JavaScript/);
    } finally { item.dispose(); }
});

test('rejects modified or added bundled JavaScript against an approved generated inventory', () => {
    const item = fixture();
    try {
        const approved = verifyOfflineNotices(item.root, item.dist);
        const indexPath = path.join(item.dist, 'assets/index.js');
        const originalIndex = readFileSync(indexPath);
        writeFileSync(indexPath, originalIndex + '\n// altered helper');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist, approved), /Generated JavaScript\/assets differ/);
        writeFileSync(indexPath, originalIndex);
        writeFileSync(path.join(item.dist, 'assets/helper.js'), 'extra helper');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist, approved), /Generated JavaScript\/assets differ/);
    } finally { item.dispose(); }
});

test('rejects changed vendor code even when the bundled text markers remain', () => {
    const item = fixture();
    try {
        const vendor = path.join(item.dist, 'vendor/webostvjs-1.2.13/webOSTV.js');
        writeFileSync(vendor, readFileSync(vendor) + '\n// changed\n');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Built public asset differs/);
        cpSync(path.join(item.root, 'public/vendor/webostvjs-1.2.13/webOSTV.js'), vendor);
        const sourceVendor = path.join(item.root, 'public/vendor/webostvjs-1.2.13/webOSTV.js');
        writeFileSync(sourceVendor, readFileSync(sourceVendor) + '\n// changed\n');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /pinned source hash/);
    } finally { item.dispose(); }
});

test('rejects omitted or altered full notice text and altered font bytes', () => {
    const item = fixture();
    try {
        writeFileSync(path.join(item.dist, 'notices/Inter-OFL.txt'), 'SIL OPEN FONT LICENSE');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Built public asset differs/);
        cpSync(path.join(item.root, 'public/notices/Inter-OFL.txt'), path.join(item.dist, 'notices/Inter-OFL.txt'));
        writeFileSync(path.join(item.dist, 'assets/inter.ttf'), 'wrong font');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Bundled font bytes differ/);
    } finally { item.dispose(); }
});

test('rejects uninventoried public assets and generated file types', () => {
    const item = fixture();
    try {
        writeFileSync(path.join(item.root, 'public/unknown.png'), 'unknown');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Public assets changed/);
        rmSync(path.join(item.root, 'public/unknown.png'));
        writeFileSync(path.join(item.dist, 'assets/helper.wasm'), 'unknown');
        assert.throws(() => verifyOfflineNotices(item.root, item.dist), /Unexpected generated files/);
    } finally { item.dispose(); }
});
