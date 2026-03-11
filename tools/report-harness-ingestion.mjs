import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
    buildHarnessIngestionReport,
    checkArchiveSectionSummaryConformance,
} from './harness-docs-lib.mjs';

const repoRoot = process.cwd();

function listTrackedArchiveSummaries() {
    const output = execFileSync('git', ['ls-files', '--', 'docs/archive/plans'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });

    return output
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.endsWith('section-summary.md'))
        .sort();
}

function readRepoFile(relativePath) {
    return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function main() {
    const summaryFiles = listTrackedArchiveSummaries();
    const triageEntries = [];
    const errors = [];

    for (const relativePath of summaryFiles) {
        const result = checkArchiveSectionSummaryConformance({
            filePath: relativePath,
            content: readRepoFile(relativePath),
        });
        if (result.errors.length > 0) {
            for (const error of result.errors) {
                errors.push(`${relativePath} harness-ingestion triage ${error}`);
            }
            continue;
        }

        triageEntries.push({
            filePath: relativePath,
            ...result.triage,
        });
    }

    if (errors.length > 0) {
        console.error('Harness-ingestion report failed:\n');
        for (const error of errors) {
            console.error(`- ${error}`);
        }
        process.exit(1);
    }

    console.log(buildHarnessIngestionReport(triageEntries));
}

main();
