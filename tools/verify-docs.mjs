import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const requiredFiles = [
    'agents.md',
    'ARCHITECTURE_CLEANUP_CHECKLIST.md',
    'docs/AGENTIC_DEV_WORKFLOW.md',
    'docs/agentic/document-map.md',
    'docs/agentic/codanna-playbook.md',
    'docs/agentic/doc-gardening-checklist.md',
    'docs/agentic/evals/README.md',
    'docs/agentic/evals/baselines/README.md',
    'docs/agentic/evals/rubric.md',
    'docs/agentic/evals/scorecard-template.md',
    'docs/agentic/historical-plan-corpus-review.md',
    'docs/agentic/plan-authoring-standard.md',
    'docs/agentic/skill-strategy.md',
    'docs/agentic/evals-roadmap.md',
    'docs/agentic/phase-2-steady-state-plan.md',
    'docs/architecture/README.md',
    'docs/architecture/CURRENT_STATE.md',
    'docs/architecture/modules.md',
    'docs/decisions/README.md',
    'docs/plans/README.md',
    'docs/archive/plans/README.md',
    'docs/runs/README.md'
];

const markdownRoots = [
    'docs/AGENTIC_DEV_WORKFLOW.md',
    'docs/agentic',
    'docs/archive/plans',
    'docs/architecture',
    'docs/decisions/README.md',
    'docs/plans',
    'docs/runs/README.md',
    'docs/runs/_template',
    'ARCHITECTURE_CLEANUP_CHECKLIST.md'
];

const expectedEvalPromptFiles = [
    '01-app-container-extraction-no-ui-drift.md',
    '02-lazy-screen-registry-no-dual-ownership.md',
    '03-overlay-toast-extraction-no-timer-leaks.md',
    '04-diagnostics-surface-isolation-no-storage-slop.md',
    '05-app-shell-cleanup-no-behavior-regression.md',
    '06-orchestrator-hotspot-extraction.md',
    '07-settings-storage-boundary.md',
    '08-server-selection-storage-boundary.md',
    '09-channel-persistence-boundary.md',
    '10-settings-screen-split.md',
    '11-plex-subtitle-policy.md',
    '12-architecture-doc-refresh.md'
];

const localOnlyMarkdownDirs = ['docs/agentic/evals/baselines'];

function collectMarkdownFiles(entry) {
    if (localOnlyMarkdownDirs.includes(entry)) {
        const readmeEntry = path.join(entry, 'README.md');
        return existsSync(path.join(repoRoot, readmeEntry)) ? [readmeEntry] : [];
    }

    const fullPath = path.join(repoRoot, entry);
    const stats = statSync(fullPath);

    if (stats.isFile()) {
        return entry.endsWith('.md') ? [entry] : [];
    }

    const results = [];
    for (const child of readdirSync(fullPath)) {
        const childEntry = path.join(entry, child);
        results.push(...collectMarkdownFiles(childEntry));
    }
    return results;
}

function resolveLocalLink(sourceFile, rawTarget) {
    if (
        rawTarget.startsWith('http://') ||
        rawTarget.startsWith('https://') ||
        rawTarget.startsWith('mailto:') ||
        rawTarget.startsWith('#')
    ) {
        return null;
    }

    const target = rawTarget.split('#')[0];
    if (target.length === 0) {
        return null;
    }

    if (target.startsWith('/')) {
        return path.join(repoRoot, target.slice(1));
    }

    return path.resolve(path.dirname(path.join(repoRoot, sourceFile)), target);
}

function extractMarkdownLinks(content) {
    const links = [];
    const regex = /\[[^\]]+\]\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        links.push(match[1].trim());
    }
    return links;
}

function checkRequiredFiles(errors) {
    for (const file of requiredFiles) {
        if (!existsSync(path.join(repoRoot, file))) {
            errors.push(`Missing required control-plane file: ${file}`);
        }
    }
}

function checkMarkdownLinks(errors) {
    const files = markdownRoots.flatMap(collectMarkdownFiles);

    for (const file of files) {
        const content = readFileSync(path.join(repoRoot, file), 'utf8');
        for (const rawTarget of extractMarkdownLinks(content)) {
            const resolved = resolveLocalLink(file, rawTarget);
            if (resolved !== null && !existsSync(resolved)) {
                errors.push(`Broken link in ${file}: ${rawTarget}`);
            }
        }
    }
}

function checkDecisionIndex(errors) {
    const decisionDir = path.join(repoRoot, 'docs/decisions');
    const actual = readdirSync(decisionDir)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort();

    const readme = readFileSync(path.join(decisionDir, 'README.md'), 'utf8');
    const indexed = extractMarkdownLinks(readme)
        .map((target) => target.split('#')[0])
        .filter((target) => target.endsWith('.md'))
        .map((target) => path.basename(target))
        .sort();

    for (const file of actual) {
        if (!indexed.includes(file)) {
            errors.push(`Decision index missing entry for docs/decisions/${file}`);
        }
    }

    for (const file of indexed) {
        if (!actual.includes(file)) {
            errors.push(`Decision index references missing file docs/decisions/${file}`);
        }
    }
}

function checkEvalPromptInventory(errors) {
    const promptDir = path.join(repoRoot, 'docs/agentic/evals/prompts');

    if (!existsSync(promptDir)) {
        errors.push('Missing eval prompt directory: docs/agentic/evals/prompts');
        return;
    }

    const actual = readdirSync(promptDir)
        .filter((name) => name.endsWith('.md'))
        .sort();

    if (actual.length !== expectedEvalPromptFiles.length) {
        errors.push(
            `Eval prompt inventory mismatch: expected ${expectedEvalPromptFiles.length} markdown files, found ${actual.length}`
        );
    }

    for (const file of expectedEvalPromptFiles) {
        if (!actual.includes(file)) {
            errors.push(`Missing eval prompt file docs/agentic/evals/prompts/${file}`);
        }
    }

    for (const file of actual) {
        if (!expectedEvalPromptFiles.includes(file)) {
            errors.push(`Unexpected eval prompt file docs/agentic/evals/prompts/${file}`);
        }
    }
}

const errors = [];

checkRequiredFiles(errors);
checkMarkdownLinks(errors);
checkDecisionIndex(errors);
checkEvalPromptInventory(errors);

if (errors.length > 0) {
    console.error('Documentation verification failed:\n');
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exit(1);
}

console.log('Documentation verification passed.');
