import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    scanSourceText,
    sortPrivateProbes,
    sortSleepProbes,
    type PrivateProbe,
    type SleepProbe,
} from './antiPatternsScanner';

const FROZEN_SUITES = [
    'src/__tests__/Orchestrator.test.ts',
    'src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts',
    'src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts',
    'src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts',
    'src/modules/ui/auth/__tests__/AuthScreen.test.ts',
    'src/modules/ui/epg/__tests__/EPGComponent.test.ts',
    'src/modules/ui/epg/__tests__/EPGBackgroundWarmQueue.test.ts',
    'src/modules/ui/epg/__tests__/EPGCoordinator.test.ts',
    'src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts',
    'src/modules/navigation/__tests__/NavigationCoordinator.test.ts',
    'src/modules/navigation/__tests__/RemoteHandler.test.ts',
    'src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts',
    'src/modules/player/__tests__/PlaybackRecoveryManager.test.ts',
    'src/modules/player/__tests__/SubtitleManager.test.ts',
    'src/modules/player/__tests__/VideoPlayer.test.ts',
    'src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts',
    'src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts',
];

const CURRENT_PRIVATE_REPORT = path.join(os.tmpdir(), 'current-private-probes.json');
const CURRENT_SLEEP_REPORT = path.join(os.tmpdir(), 'current-sleeps.txt');
const CURRENT_PRIVATE_ALLOWLIST = path.join(os.tmpdir(), 'current-private-probes.allowlist.txt');
const BASELINE_PRIVATE_ALLOWLIST = path.join(process.cwd(), 'src/__tests__/policy/baselines/private-probes.allowlist.txt');
const BASELINE_SLEEP_REPORT = path.join(process.cwd(), 'src/__tests__/policy/baselines/sleeps-ast.txt');
const PRIVATE_OWNER_NOTES = path.join(process.cwd(), 'src/__tests__/policy/baselines/private-probes.owner-notes.md');
const SLEEP_OWNER_NOTES = path.join(process.cwd(), 'src/__tests__/policy/baselines/sleeps.owner-notes.md');

// Keep these mirrors explicit when Jest ownership changes:
// - `jest.config.js`
// - `jest.contracts.config.js`
const WHOLE_SUITE_UNIT_PATH_MATCHERS = [
    /\.test\.ts$/,
];
const WHOLE_SUITE_UNIT_PATH_EXCLUDES = [
    /^src\/__tests__\/tools\//,
    /[.-](?:contract|contracts|policy)\.test\.ts$/,
    /\/types\.test\.ts$/,
];
const WHOLE_SUITE_CONTRACTS_PATH_MATCHERS = [
    /\.contract\.test\.ts$/,
    /\.contracts\.test\.ts$/,
    /-contract\.test\.ts$/,
    /-contracts\.test\.ts$/,
    /\.policy\.test\.ts$/,
    /-policy\.test\.ts$/,
    /\/types\.test\.ts$/,
];

type PrivateProbeBaseline = {
    allowlist: Set<string>;
    maxCount: number;
};

type OwnerNoteRow = {
    id: string;
    owner: string;
    rationale: string;
    revisitTrigger: string;
    cleanupLane: string;
};

const toAbsolute = (file: string): string => path.join(process.cwd(), file);

const stripCodeTicks = (value: string): string => {
    const trimmed = value.trim();
    return trimmed.startsWith('`') && trimmed.endsWith('`')
        ? trimmed.slice(1, -1)
        : trimmed;
};

const splitMarkdownRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';

    for (let i = 0; i < line.length; i += 1) {
        const character = line[i];
        if (character === '\\' && line[i + 1] === '|') {
            current += '|';
            i += 1;
            continue;
        }

        if (character === '|') {
            cells.push(current.trim());
            current = '';
            continue;
        }

        current += character;
    }

    cells.push(current.trim());
    return cells;
};

const readPrivateBaseline = (): PrivateProbeBaseline => {
    if (!fs.existsSync(BASELINE_PRIVATE_ALLOWLIST)) {
        throw new Error(
            'Missing policy baseline file. Expected:\n' +
            `- ${BASELINE_PRIVATE_ALLOWLIST}\n` +
            'Re-generate baselines by running:\n' +
            '  npm run test:contracts -- --runInBand src/__tests__/policy/AntiPatterns.policy.test.ts\n' +
            'Then copy the generated allowlist from:\n' +
            `- ${CURRENT_PRIVATE_ALLOWLIST}`
        );
    }

    const allowlist: Set<string> = new Set();
    let maxCount: number | null = null;
    const lines = fs.readFileSync(BASELINE_PRIVATE_ALLOWLIST, 'utf8').split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('#')) {
            const match = line.match(/^#\s*maxCount\s*=\s*(\d+)\s*$/i);
            if (match) {
                maxCount = Number.parseInt(match[1]!, 10);
            }
            continue;
        }
        allowlist.add(line);
    }

    if (maxCount === null || !Number.isFinite(maxCount)) {
        throw new Error(`Invalid allowlist header: expected "# maxCount=<number>" in ${BASELINE_PRIVATE_ALLOWLIST}`);
    }

    return { allowlist, maxCount };
};

const readTextBaseline = (baselinePath: string, label: string): Set<string> => {
    if (!fs.existsSync(baselinePath)) {
        throw new Error(
            `Missing ${label} baseline file. Expected:\n` +
            `- ${baselinePath}\n` +
            'Re-generate baselines by running:\n' +
            '  npm run test:contracts -- --runInBand src/__tests__/policy/AntiPatterns.policy.test.ts'
        );
    }

    return new Set(
        fs.readFileSync(baselinePath, 'utf8')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
    );
};

const readOwnerNotes = (notesPath: string, label: string): OwnerNoteRow[] => {
    if (!fs.existsSync(notesPath)) {
        throw new Error(`Missing ${label} owner-notes file: ${notesPath}`);
    }

    const tableLines = fs.readFileSync(notesPath, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('|'));

    if (tableLines.length < 3) {
        throw new Error(`Expected a Markdown owner-notes table in ${notesPath}`);
    }

    const rows = tableLines
        .slice(2)
        .filter((line) => !/^\|\s*-/.test(line))
        .map((line) => {
            const cells = splitMarkdownRow(line)
                .slice(1, -1)
                .map((cell) => stripCodeTicks(cell));

            if (cells.length < 5 || cells.slice(0, 5).some((cell) => cell.length === 0)) {
                throw new Error(`Invalid ${label} owner-notes row in ${notesPath}: ${line}`);
            }

            return {
                id: cells[0]!,
                owner: cells[1]!,
                rationale: cells[2]!,
                revisitTrigger: cells[3]!,
                cleanupLane: cells[4]!,
            };
        });

    const uniqueIds = new Set(rows.map((row) => row.id));
    if (uniqueIds.size !== rows.length) {
        throw new Error(`Duplicate ${label} owner-notes rows found in ${notesPath}`);
    }

    return rows;
};

const listTrackedSrcFiles = (): string[] => {
    return execFileSync('git', ['ls-files', '--', 'src'], {
        cwd: process.cwd(),
        encoding: 'utf8',
    })
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
};

const isWholeSuiteFile = (file: string): boolean => {
    if (!file.startsWith('src/')) {
        return false;
    }

    const inUnitSurface = WHOLE_SUITE_UNIT_PATH_MATCHERS.some((pattern) => pattern.test(file))
        && !WHOLE_SUITE_UNIT_PATH_EXCLUDES.some((pattern) => pattern.test(file));
    const inContractsSurface = WHOLE_SUITE_CONTRACTS_PATH_MATCHERS.some((pattern) => pattern.test(file));
    return inUnitSurface || inContractsSurface;
};

const listTrackedWholeSuiteFiles = (): string[] => {
    return listTrackedSrcFiles().filter(isWholeSuiteFile).sort();
};

const scanFiles = (files: string[]): { privateProbes: PrivateProbe[]; sleepProbes: SleepProbe[] } => {
    const privateProbes: PrivateProbe[] = [];
    const sleepProbes: SleepProbe[] = [];

    for (const file of files) {
        const sourceText = fs.readFileSync(toAbsolute(file), 'utf8');
        const scan = scanSourceText({ file, sourceText });
        privateProbes.push(...scan.privateProbes);
        sleepProbes.push(...scan.sleepProbes);
    }

    return {
        privateProbes: sortPrivateProbes(privateProbes),
        sleepProbes: sortSleepProbes(sleepProbes),
    };
};

const toPrivateProbeKey = (probe: PrivateProbe): string => `${probe.file}|${probe.receiver}|${probe.property}`;

const writeWholeSuiteDebugReports = (privateProbes: PrivateProbe[], sleepProbes: SleepProbe[]): void => {
    fs.writeFileSync(CURRENT_PRIVATE_REPORT, JSON.stringify({
        probes: privateProbes,
        count: privateProbes.length,
    }, null, 2));

    const privateKeys = Array.from(new Set(privateProbes.map(toPrivateProbeKey))).sort();
    fs.writeFileSync(
        CURRENT_PRIVATE_ALLOWLIST,
        `# maxCount=${privateKeys.length}\n` + privateKeys.join('\n')
    );

    const sleepLines = sleepProbes.map(
        (probe) => `${probe.id} ${probe.file}:${probe.line}:${probe.column} [${probe.kind}] ${probe.snippet}`
    );
    fs.writeFileSync(CURRENT_SLEEP_REPORT, sleepLines.join('\n'));
};

describe('AntiPatterns policy', () => {
    it('keeps the frozen suites at zero private probes and zero sleep probes', () => {
        const scan = scanFiles(FROZEN_SUITES);

        expect(scan.privateProbes).toEqual([]);
        expect(scan.sleepProbes).toEqual([]);
    });

    it('discovers the tracked whole-suite surface from the unit + contracts Jest ownership rules', () => {
        const files = listTrackedWholeSuiteFiles();

        expect(files.length).toBeGreaterThan(0);
        expect(files.every((file) => file.startsWith('src/'))).toBe(true);
        expect(files).toContain('src/__tests__/policy/AntiPatterns.policy.test.ts');
        expect(files).toContain('src/__tests__/helpers.test.ts');
        expect(files).toContain('src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts');
        expect(files).toContain('src/modules/player/__tests__/subtitleFallbackPipeline.test.ts');
        expect(files).toContain('src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts');
        expect(files).toContain('src/modules/ui/__tests__/runtime-token-style-contracts.test.ts');
        expect(files).not.toContain('src/__tests__/tools/verifyDocs.test.ts');
    });

    it('keeps hyphenated contract suite names on the contracts surface instead of unit', () => {
        expect(isWholeSuiteFile('src/modules/ui/__tests__/runtime-token-style-contracts.test.ts')).toBe(true);
        expect(WHOLE_SUITE_UNIT_PATH_EXCLUDES.some((pattern) => pattern.test(
            'src/modules/ui/__tests__/runtime-token-style-contracts.test.ts'
        ))).toBe(true);
        expect(WHOLE_SUITE_CONTRACTS_PATH_MATCHERS.some((pattern) => pattern.test(
            'src/modules/ui/__tests__/runtime-token-style-contracts.test.ts'
        ))).toBe(true);

        expect(isWholeSuiteFile('src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts')).toBe(true);
        expect(WHOLE_SUITE_UNIT_PATH_EXCLUDES.some((pattern) => pattern.test(
            'src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts'
        ))).toBe(true);
        expect(WHOLE_SUITE_CONTRACTS_PATH_MATCHERS.some((pattern) => pattern.test(
            'src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts'
        ))).toBe(true);
    });

    it('ratchets whole-suite private probes and approved sleep ids with synchronized owner notes', () => {
        const files = listTrackedWholeSuiteFiles();
        const scan = scanFiles(files);
        writeWholeSuiteDebugReports(scan.privateProbes, scan.sleepProbes);

        const privateKeys = Array.from(new Set(scan.privateProbes.map(toPrivateProbeKey))).sort();
        const sleepIds = scan.sleepProbes.map((probe) => probe.id);
        const sleepOwnerFiles = Array.from(new Set(scan.sleepProbes.map((probe) => probe.file))).sort();

        const privateBaseline = readPrivateBaseline();
        const privateOwnerNotes = readOwnerNotes(PRIVATE_OWNER_NOTES, 'private-probe');
        const sleepBaseline = Array.from(readTextBaseline(BASELINE_SLEEP_REPORT, 'sleep-id')).sort();
        const sleepOwnerNotes = readOwnerNotes(SLEEP_OWNER_NOTES, 'sleep');

        expect(privateKeys.length).toBeLessThanOrEqual(privateBaseline.maxCount);
        expect(privateKeys).toEqual(Array.from(privateBaseline.allowlist).sort());
        expect(privateOwnerNotes.map((row) => row.id).sort()).toEqual(privateKeys);

        expect(sleepIds).toEqual(sleepBaseline);
        expect(sleepOwnerNotes.map((row) => row.id).sort()).toEqual(sleepBaseline);
        expect(sleepOwnerFiles).toEqual(['src/__tests__/helpers.test.ts']);
    });
});
