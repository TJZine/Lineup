import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { checkPlanConformance } from './harness-docs-lib.mjs';

const repoRoot = process.cwd();
const planDir = path.join(repoRoot, 'docs/plans');

if (!existsSync(planDir)) {
    console.error('Missing docs/plans directory.');
    process.exit(1);
}

const planFiles = readdirSync(planDir)
    .filter((fileName) => fileName.endsWith('.md') && fileName !== 'README.md')
    .sort();

const issues = [];

for (const fileName of planFiles) {
    const relativePath = `docs/plans/${fileName}`;
    const content = readFileSync(path.join(planDir, fileName), 'utf8');
    const result = checkPlanConformance({ filePath: relativePath, content });

    if (result.isSerious && result.missingSections.length > 0) {
        issues.push(result);
    }
}

if (issues.length > 0) {
    console.error('Serious active plan conformance failed:\n');
    for (const issue of issues) {
        console.error(`- ${issue.filePath} is missing: ${issue.missingSections.join(', ')}`);
    }
    process.exit(1);
}

console.log('Serious active plan conformance passed.');
