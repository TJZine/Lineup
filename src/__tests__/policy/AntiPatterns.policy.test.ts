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
    'src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts',
    'src/modules/ui/auth/__tests__/AuthScreen.test.ts',
    'src/modules/ui/epg/__tests__/EPGComponent.test.ts',
    'src/modules/navigation/__tests__/RemoteHandler.test.ts',
];

const CURRENT_PRIVATE_REPORT = path.join(os.tmpdir(), 'current-private-probes.json');
const CURRENT_SLEEP_REPORT = path.join(os.tmpdir(), 'current-sleeps.txt');
const CURRENT_PRIVATE_ALLOWLIST = path.join(os.tmpdir(), 'current-private-probes.allowlist.txt');
const BASELINE_PRIVATE_ALLOWLIST = path.join(process.cwd(), 'src/__tests__/policy/baselines/private-probes.allowlist.txt');
const BASELINE_SLEEP_REPORT = path.join(process.cwd(), 'src/__tests__/policy/baselines/sleeps-ast.txt');

const toAbsolute = (file: string): string => path.join(process.cwd(), file);

type PrivateProbeBaseline = {
    allowlist: Set<string>;
    maxCount: number;
};

const readPrivateBaseline = (): PrivateProbeBaseline | null => {
    if (!fs.existsSync(BASELINE_PRIVATE_ALLOWLIST)) {
        return null;
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

describe('AntiPatterns policy (frozen suites)', () => {
    it('tracks private probes and sleep-based waits', () => {
        const privateProbes: PrivateProbe[] = [];
        const sleepProbes: SleepProbe[] = [];

        for (const file of FROZEN_SUITES) {
            const sourceText = fs.readFileSync(toAbsolute(file), 'utf8');
            const scan = scanSourceText({ file, sourceText });
            privateProbes.push(...scan.privateProbes);
            sleepProbes.push(...scan.sleepProbes);
        }

        const sortedPrivateProbes = sortPrivateProbes(privateProbes);
        const sortedSleepProbes = sortSleepProbes(sleepProbes);

        const privateReport = {
            probes: sortedPrivateProbes,
            count: sortedPrivateProbes.length,
        };
        fs.writeFileSync(CURRENT_PRIVATE_REPORT, JSON.stringify(privateReport, null, 2));

        const currentKeys = Array.from(
            new Set(sortedPrivateProbes.map((probe) => `${probe.file}|${probe.receiver}|${probe.property}`))
        ).sort();
        fs.writeFileSync(
            CURRENT_PRIVATE_ALLOWLIST,
            `# maxCount=${sortedPrivateProbes.length}\n` + currentKeys.join('\n')
        );

        const sleepLines = sortedSleepProbes.map(
            (probe) => `${probe.file}:${probe.line}:${probe.column} [${probe.kind}] ${probe.snippet}`
        );
        fs.writeFileSync(CURRENT_SLEEP_REPORT, sleepLines.join('\n'));

        const baseline = readPrivateBaseline();
        if (!baseline) {
            throw new Error(
                'Missing policy baseline file. Expected:\n' +
                `- ${BASELINE_PRIVATE_ALLOWLIST}\n` +
                'Re-generate baselines by running:\n' +
                '  npm run test:contracts -- src/__tests__/policy/AntiPatterns.policy.test.ts\n' +
                'Then copy the generated allowlist from:\n' +
                `- ${CURRENT_PRIVATE_ALLOWLIST}`
            );
        }

        // Equality is permitted: we ratchet by disallowing count increases and by asserting
        // that no new probe keys were introduced (see `newProbes` below).
        expect(sortedPrivateProbes.length).toBeLessThanOrEqual(baseline.maxCount);

        const newProbes = sortedPrivateProbes.filter(
            (probe) => !baseline.allowlist.has(`${probe.file}|${probe.receiver}|${probe.property}`)
        );
        expect(newProbes).toEqual([]);

        if (!fs.existsSync(BASELINE_SLEEP_REPORT)) {
            throw new Error(
                'Missing sleep-probes baseline file. Expected:\n' +
                `- ${BASELINE_SLEEP_REPORT}\n` +
                'Re-generate baselines by running:\n' +
                '  npm run test:contracts -- src/__tests__/policy/AntiPatterns.policy.test.ts\n' +
                'Then copy the generated report from:\n' +
                `- ${CURRENT_SLEEP_REPORT}`
            );
        }
        // Sleep-based waits are zero-tolerance once a baseline is established.
        // (Unlike private probes, which are ratcheted by baseline comparison + new-probe detection.)
        expect(sortedSleepProbes.length).toBe(0);
    });
});
