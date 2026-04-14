import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ACTIVE_PLAN_MARKER, checkPlanConformance, extractChecklistPlanPaths, hasActivePlanMarker } from './harness-docs-lib.mjs';

const repoRoot = process.cwd();
const planDir = path.join(repoRoot, 'docs/plans');
const checklistPath = path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md');

if (!existsSync(planDir)) {
    console.error('Missing docs/plans directory.');
    process.exit(1);
}

function getTrackedPlanPaths() {
    const output = execFileSync('git', ['ls-files', '--', 'docs/plans'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });

    return output
        .split(/\r?\n/u)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .filter((relativePath) => relativePath.endsWith('.md'))
        .filter((relativePath) => path.basename(relativePath) !== 'README.md')
        .sort();
}

function getChecklistLinkedTrackedPlanPaths(trackedPlanPaths) {
    if (!existsSync(checklistPath)) {
        return new Set();
    }

    const checklist = readFileSync(checklistPath, 'utf8');
    return new Set(extractChecklistPlanPaths(checklist).filter((relativePath) => trackedPlanPaths.includes(relativePath)));
}

const trackedPlanPaths = getTrackedPlanPaths();
const checklistLinkedTrackedPlanPaths = getChecklistLinkedTrackedPlanPaths(trackedPlanPaths);

const issues = [];
const markerIssues = [];

for (const relativePath of trackedPlanPaths) {
    const content = readFileSync(path.join(repoRoot, relativePath), 'utf8');

    if (checklistLinkedTrackedPlanPaths.has(relativePath) && !hasActivePlanMarker(content)) {
        markerIssues.push(
            `${relativePath} is referenced by ARCHITECTURE_CLEANUP_CHECKLIST.md and must include exact active plan marker near the top of the file: ${ACTIVE_PLAN_MARKER}`
        );
    }

    const result = checkPlanConformance({ filePath: relativePath, content });

    if (result.isSerious && result.missingSections.length > 0) {
        issues.push(result);
    }
}

if (markerIssues.length > 0 || issues.length > 0) {
    console.error('Serious active plan conformance failed:\n');
    for (const issue of markerIssues) {
        console.error(`- ${issue}`);
    }
    for (const issue of issues) {
        console.error(`- ${issue.filePath} is missing: ${issue.missingSections.join(', ')}`);
    }
    process.exit(1);
}

console.log('Serious active plan conformance passed.');
