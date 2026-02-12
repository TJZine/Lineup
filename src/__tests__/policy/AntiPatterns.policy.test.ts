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
const BASELINE_PRIVATE_REPORT = path.join(os.tmpdir(), 'baseline-private-probes.json');
const BASELINE_SLEEP_REPORT = path.join(os.tmpdir(), 'baseline-sleeps-ast.txt');

const toAbsolute = (file: string): string => path.join(process.cwd(), file);

const readPrivateBaseline = (): PrivateProbe[] | null => {
    if (!fs.existsSync(BASELINE_PRIVATE_REPORT)) {
        return null;
    }
    const parsed = JSON.parse(fs.readFileSync(BASELINE_PRIVATE_REPORT, 'utf8')) as { probes?: PrivateProbe[] };
    return parsed.probes ?? [];
};

const readSleepBaseline = (): string[] | null => {
    if (!fs.existsSync(BASELINE_SLEEP_REPORT)) {
        return null;
    }
    const content = fs.readFileSync(BASELINE_SLEEP_REPORT, 'utf8');
    return content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
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

        const sleepLines = sortedSleepProbes.map(
            (probe) => `${probe.file}:${probe.line}:${probe.column} [${probe.kind}] ${probe.snippet}`
        );
        fs.writeFileSync(CURRENT_SLEEP_REPORT, sleepLines.join('\n'));

        const baselinePrivateProbes = readPrivateBaseline();
        if (baselinePrivateProbes) {
            const baselineCount = baselinePrivateProbes.length;
            // Equality is permitted: we ratchet by disallowing count increases and by asserting
            // that no new probe keys were introduced (see `newProbes` below).
            expect(sortedPrivateProbes.length).toBeLessThanOrEqual(baselineCount);

            const baselineSet = new Set(
                baselinePrivateProbes.map((probe) => `${probe.file}|${probe.receiver}|${probe.property}`)
            );
            const newProbes = sortedPrivateProbes.filter(
                (probe) => !baselineSet.has(`${probe.file}|${probe.receiver}|${probe.property}`)
            );
            expect(newProbes).toEqual([]);
        }

        const baselineSleepLines = readSleepBaseline();
        if (baselineSleepLines) {
            expect(sortedSleepProbes.length).toBe(0);
        }
    });
});
