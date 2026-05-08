import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
    summarizeBundle,
    summarizeTimingSamples,
} from '../measure-runtime-chunk-performance.mjs';

function writeAsset(distDir, relativePath, byteCount) {
    const fullPath = path.join(distDir, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, 'x'.repeat(byteCount), 'utf8');
}

function writeFixture(tempRoot) {
    const distDir = path.join(tempRoot, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(
        path.join(distDir, 'index.html'),
        [
            '<!doctype html>',
            '<html>',
            '<head>',
            '<script type="module" src="./assets/index-entry.js"></script>',
            '<link rel="stylesheet" href="./assets/index.css">',
            '</head>',
            '<body><div id="app"></div></body>',
            '</html>',
        ].join('\n'),
        'utf8'
    );
    writeAsset(distDir, 'assets/index-entry.js', 100);
    writeAsset(distDir, 'assets/index-static.js', 40);
    writeAsset(distDir, 'assets/index.css', 30);
    writeAsset(distDir, 'assets/Orchestrator-test.js', 500);

    writeFileSync(
        path.join(distDir, 'bundle-stats.json'),
        JSON.stringify({
            version: 2,
            nodeParts: {
                'html-part': { renderedLength: 1 },
                'entry-part': { renderedLength: 10 },
                'static-part': { renderedLength: 15 },
                'orchestrator-part': { renderedLength: 90 },
                'plex-part': { renderedLength: 120 },
                'player-part': { renderedLength: 50 },
            },
            nodeMetas: {
                html: {
                    id: '/index.html',
                    moduleParts: { 'assets/index-entry.js': 'html-part' },
                    imported: [{ uid: 'entry' }],
                    importedBy: [],
                },
                entry: {
                    id: '/src/bootstrap.ts',
                    moduleParts: { 'assets/index-entry.js': 'entry-part' },
                    imported: [
                        { uid: 'static' },
                        { uid: 'orchestrator', dynamic: true },
                    ],
                    importedBy: [],
                },
                static: {
                    id: '/src/static.ts',
                    moduleParts: { 'assets/index-static.js': 'static-part' },
                    imported: [],
                    importedBy: [],
                },
                orchestrator: {
                    id: '/src/core/orchestrator/AppOrchestrator.ts',
                    moduleParts: { 'assets/Orchestrator-test.js': 'orchestrator-part' },
                    imported: [],
                    importedBy: [],
                },
                plex: {
                    id: '/src/modules/plex/library/PlexLibrary.ts',
                    moduleParts: { 'assets/Orchestrator-test.js': 'plex-part' },
                    imported: [],
                    importedBy: [],
                },
                player: {
                    id: '/src/modules/player/VideoPlayer.ts',
                    moduleParts: { 'assets/Orchestrator-test.js': 'player-part' },
                    imported: [],
                    importedBy: [],
                },
            },
        }),
        'utf8'
    );

    return distDir;
}

test('summarizeBundle reports runtime chunk bytes and top attribution', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-runtime-measure-test-'));
    try {
        const distDir = writeFixture(tempRoot);
        const summary = summarizeBundle(distDir, 2);

        assert.equal(summary.entry_js_bytes, 140);
        assert.equal(summary.bootstrap_entry_bytes, 100);
        assert.equal(summary.eager_css_bytes, 30);
        assert.equal(summary.runtime_chunk_file, 'assets/Orchestrator-test.js');
        assert.equal(summary.runtime_chunk_bytes, 500);
        assert.equal(summary.top_modules[0].path, 'src/modules/plex/library/PlexLibrary.ts');
        assert.equal(summary.top_modules[0].rendered_bytes, 120);
        assert.deepEqual(summary.top_owners, [
            { owner: 'modules/plex', rendered_bytes: 120 },
            { owner: 'core/orchestrator', rendered_bytes: 90 },
        ]);
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('summarizeTimingSamples requires every RC-S1 timing field', () => {
    const samples = [
        {
            measures: {
                'lineup.runtime_import': 10,
                'lineup.orchestrator_initialize': 40,
                'lineup.orchestrator_start': 80,
                'lineup.app_start_to_first_actionable': 140,
            },
        },
        {
            measures: {
                'lineup.runtime_import': 14,
                'lineup.orchestrator_initialize': 44,
                'lineup.orchestrator_start': 84,
                'lineup.app_start_to_first_actionable': 144,
            },
        },
        {
            measures: {
                'lineup.runtime_import': 12,
                'lineup.orchestrator_initialize': 42,
                'lineup.orchestrator_start': 82,
                'lineup.app_start_to_first_actionable': 142,
            },
        },
    ];

    assert.deepEqual(summarizeTimingSamples(samples), {
        sample_count: 3,
        timing_source: 'performance_api_marks',
        runtime_import_ms: { median: 12, min: 10, max: 14 },
        orchestrator_initialize_ms: { median: 42, min: 40, max: 44 },
        orchestrator_start_ms: { median: 82, min: 80, max: 84 },
        app_start_to_first_actionable_ms: { median: 142, min: 140, max: 144 },
    });

    assert.throws(
        () => summarizeTimingSamples([{ measures: { 'lineup.runtime_import': 1 } }]),
        /Missing required timing field orchestrator_initialize_ms/u
    );
});
