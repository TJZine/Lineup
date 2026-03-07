import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
    checkPlanConformance,
    EXPECTED_EVAL_PROMPT_FILES,
    EXPECTED_SESSION_PROMPT_FILES,
    extractChecklistPlanPaths,
    parseSkillMirrorManifest,
    SKILL_MIRROR_MANIFEST_PATH,
} from './harness-docs-lib.mjs';

const repoRoot = process.cwd();
const expectedSessionPromptFiles = [...EXPECTED_SESSION_PROMPT_FILES, 'feature-plan.md', 'feature-review.md'];

const requiredFiles = [
    'agents.md',
    'ARCHITECTURE_CLEANUP_CHECKLIST.md',
    'docs/AGENTIC_DEV_WORKFLOW.md',
    'docs/agentic/document-map.md',
    'docs/agentic/codanna-playbook.md',
    'docs/agentic/doc-gardening-checklist.md',
    'docs/agentic/evals/README.md',
    'docs/agentic/evals/baselines/README.md',
    'docs/agentic/evals/baseline-summaries/README.md',
    'docs/agentic/evals/baseline-summary-template.md',
    'docs/agentic/evals/rubric.md',
    'docs/agentic/evals/scorecard-template.md',
    'docs/agentic/historical-plan-corpus-review.md',
    'docs/agentic/plan-authoring-standard.md',
    'docs/agentic/session-prompts/README.md',
    'docs/agentic/session-prompts/cleanup-plan.md',
    'docs/agentic/session-prompts/cleanup-implement.md',
    'docs/agentic/session-prompts/cleanup-review.md',
    'docs/agentic/session-prompts/cleanup-loop.md',
    'docs/agentic/session-prompts/feature-plan.md',
    'docs/agentic/session-prompts/feature-review.md',
    'docs/agentic/session-prompts/workflow-harness-review.md',
    'docs/agentic/skill-strategy.md',
    'docs/agentic/evals-roadmap.md',
    'docs/agentic/phase-2-steady-state-plan.md',
    'docs/architecture/README.md',
    'docs/architecture/CURRENT_STATE.md',
    'docs/architecture/modules.md',
    'docs/decisions/README.md',
    'docs/plans/README.md',
    'docs/archive/plans/README.md',
    'docs/runs/README.md',
    SKILL_MIRROR_MANIFEST_PATH,
];

const markdownRoots = [
    'agents.md',
    '.codex/skills',
    'docs/AGENTIC_DEV_WORKFLOW.md',
    'docs/agentic',
    'docs/archive/plans',
    'docs/architecture',
    'docs/decisions',
    'docs/development',
    'docs/plans',
    'docs/runs/README.md',
    'docs/runs/_template',
    'ARCHITECTURE_CLEANUP_CHECKLIST.md',
];

const localOnlyMarkdownDirs = ['docs/agentic/evals/baselines'];
const trackedLocalOnlyAllowlist = new Set([
    'docs/agentic/evals/baselines/README.md',
    'docs/runs/README.md',
    'docs/runs/_template',
]);
const trackedLocalOnlyPrefixAllowlist = ['docs/runs/_template/'];
const literalLocalOnlyPatternAllowlist = new Set([
    'agents.md',
    'docs/agentic/document-map.md',
    'docs/agentic/evals/README.md',
    'docs/agentic/evals/baseline-summaries/README.md',
    'docs/agentic/historical-plan-corpus-review.md',
    'docs/agentic/skill-strategy.md',
    'docs/runs/README.md',
]);

function recordFsError(errors, operation, targetPath, error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Unable to ${operation} ${targetPath}: ${message}`);
}

function toRepoRelativePath(absolutePath) {
    return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function readRepoFile(relativePath, errors) {
    try {
        return readFileSync(path.join(repoRoot, relativePath), 'utf8');
    } catch (error) {
        recordFsError(errors, 'read', relativePath, error);
        return null;
    }
}

function safeReadDir(relativeDir, errors, options = { requireExists: true }) {
    const fullPath = path.join(repoRoot, relativeDir);
    if (!existsSync(fullPath)) {
        if (options.requireExists) {
            errors.push(`Missing directory: ${relativeDir}`);
        }
        return [];
    }
    try {
        return readdirSync(fullPath);
    } catch (error) {
        recordFsError(errors, 'read directory', relativeDir, error);
        return [];
    }
}

function isForbiddenLocalOnlyTarget(relativePath) {
    if (trackedLocalOnlyAllowlist.has(relativePath)) {
        return false;
    }

    if (trackedLocalOnlyPrefixAllowlist.some((prefix) => relativePath.startsWith(prefix))) {
        return false;
    }

    return (
        relativePath === '.agent/skills' ||
        relativePath.startsWith('.agent/skills/') ||
        relativePath.startsWith('docs/agentic/evals/baselines/') ||
        relativePath === 'docs/runs' ||
        relativePath.startsWith('docs/runs/')
    );
}

function collectMarkdownFiles(entry, errors) {
    if (localOnlyMarkdownDirs.includes(entry)) {
        const readmeEntry = path.join(entry, 'README.md');
        return existsSync(path.join(repoRoot, readmeEntry)) ? [readmeEntry] : [];
    }

    const fullPath = path.join(repoRoot, entry);
    if (!existsSync(fullPath)) {
        return [];
    }

    let stats;
    try {
        stats = statSync(fullPath);
    } catch (error) {
        recordFsError(errors, 'stat', entry, error);
        return [];
    }

    if (stats.isFile()) {
        return entry.endsWith('.md') ? [entry] : [];
    }

    const results = [];
    const children = safeReadDir(entry, errors);

    for (const child of children) {
        results.push(...collectMarkdownFiles(path.join(entry, child), errors));
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
    return Array.from(content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)).map((match) => match[1].trim());
}

function checkRequiredFiles(errors) {
    for (const file of requiredFiles) {
        if (!existsSync(path.join(repoRoot, file))) {
            errors.push(`Missing required control-plane file: ${file}`);
        }
    }
}

function checkRequiredRunTemplate(errors) {
    const templateDir = 'docs/runs/_template';
    const expectedTemplateFiles = ['Prompt.md', 'Plan.md', 'Implement.md', 'Documentation.md'];
    const fullTemplateDir = path.join(repoRoot, templateDir);
    if (!existsSync(fullTemplateDir)) {
        errors.push(`Missing required control-plane directory: ${templateDir}`);
        return;
    }

    for (const file of expectedTemplateFiles) {
        const relativePath = `${templateDir}/${file}`;
        if (!existsSync(path.join(repoRoot, relativePath))) {
            errors.push(`Missing required run template file: ${relativePath}`);
        }
    }
}

function checkMarkdownLinks(errors) {
    const files = Array.from(new Set(markdownRoots.flatMap((entry) => collectMarkdownFiles(entry, errors))));

    for (const file of files) {
        const content = readRepoFile(file, errors);
        if (content === null) {
            continue;
        }

        for (const rawTarget of extractMarkdownLinks(content)) {
            const resolved = resolveLocalLink(file, rawTarget);
            if (resolved === null) {
                continue;
            }

            const relativeTarget = toRepoRelativePath(resolved);

            if (isForbiddenLocalOnlyTarget(relativeTarget)) {
                errors.push(`Tracked doc ${file} links to local-only artifact: ${rawTarget}`);
                continue;
            }

            if (!existsSync(resolved)) {
                errors.push(`Broken link in ${file}: ${rawTarget}`);
            }
        }
    }
}

function checkForbiddenLiteralReferences(errors) {
    const files = Array.from(new Set(markdownRoots.flatMap((entry) => collectMarkdownFiles(entry, errors))));
    const patterns = [
        {
            description: 'local-only mirrored skill file',
            regex: /\.agent\/skills\/[a-z0-9._-]+\/SKILL\.md/giu,
        },
        {
            description: 'local-only run instance',
            regex: /docs\/runs\/\d{4}-\d{2}-\d{2}-[a-z0-9._-]+\/[^\s)]+/giu,
        },
        {
            description: 'raw eval baseline artifact',
            regex: /docs\/agentic\/evals\/baselines\/(?!README\.md)[^\s)]+/giu,
        },
    ];

    for (const file of files) {
        if (file.startsWith('docs/archive/plans/')) {
            continue;
        }

        if (literalLocalOnlyPatternAllowlist.has(file)) {
            continue;
        }

        const content = readRepoFile(file, errors);
        if (content === null) {
            continue;
        }

        for (const { description, regex } of patterns) {
            regex.lastIndex = 0;
            const match = regex.exec(content);
            if (match !== null) {
                errors.push(`Tracked doc ${file} references ${description}: ${match[0]}`);
            }
        }
    }
}

function checkDecisionIndex(errors) {
    const actual = safeReadDir('docs/decisions', errors)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort();

    const readme = readRepoFile('docs/decisions/README.md', errors);
    if (readme === null) {
        return;
    }

    const indexed = extractMarkdownLinks(readme)
        .map((target) => target.split('#')[0])
        .map((target) => resolveLocalLink('docs/decisions/README.md', target))
        .filter((resolved) => resolved !== null)
        .map((resolved) => toRepoRelativePath(resolved))
        .filter((target) => target.startsWith('docs/decisions/') && target.endsWith('.md'))
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

function checkInventory(errors, directory, expectedFiles, description) {
    const actual = safeReadDir(directory, errors)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort();

    if (actual.length !== expectedFiles.length) {
        errors.push(
            `${description} inventory mismatch: expected ${expectedFiles.length} markdown files, found ${actual.length}`
        );
    }

    for (const file of expectedFiles) {
        if (!actual.includes(file)) {
            errors.push(`Missing ${description} file ${directory}/${file}`);
        }
    }

    for (const file of actual) {
        if (!expectedFiles.includes(file)) {
            errors.push(`Unexpected ${description} file ${directory}/${file}`);
        }
    }
}

function checkSessionPromptReadme(errors) {
    const readme = readRepoFile('docs/agentic/session-prompts/README.md', errors);
    if (readme === null) {
        return;
    }

    for (const file of expectedSessionPromptFiles) {
        if (!readme.includes(`./${file}`)) {
            errors.push(`Session prompt README is missing launcher link for ${file}`);
        }
    }
}

function checkWorkflowRoutingSplit(errors) {
    const readme = readRepoFile('docs/agentic/session-prompts/README.md', errors);
    if (readme !== null) {
        if (!readme.includes('## Routing (Authoritative)')) {
            errors.push('Session prompt README must contain the authoritative routing split section.');
        }

        const requiredReadmeRoutingMarkers = ['cleanup/refactor', 'feature/design', 'mixed', 'feature-plan', 'feature-review'];
        for (const marker of requiredReadmeRoutingMarkers) {
            if (!readme.includes(marker)) {
                errors.push(`Session prompt README routing split is missing required marker: ${marker}`);
            }
        }
    }

    const workflow = readRepoFile('docs/AGENTIC_DEV_WORKFLOW.md', errors);
    if (workflow !== null) {
        const requiredWorkflowMarkers = [
            'cleanup-plan.md',
            'cleanup-review.md',
            'feature-plan.md',
            'feature-review.md',
            'Route task family before choosing a tier.',
        ];

        for (const marker of requiredWorkflowMarkers) {
            if (!workflow.includes(marker)) {
                errors.push(`Workflow doc is missing required cleanup/feature routing marker: ${marker}`);
            }
        }
    }
}

function checkChecklistPlanPaths(errors) {
    const checklist = readRepoFile('ARCHITECTURE_CLEANUP_CHECKLIST.md', errors);
    if (checklist === null) {
        return;
    }

    for (const relativePath of extractChecklistPlanPaths(checklist)) {
        if (!existsSync(path.join(repoRoot, relativePath))) {
            errors.push(`Checklist references missing tracked plan path: ${relativePath}`);
        }
    }
}

function checkPlanArchiveCoherence(errors) {
    const activeFiles = safeReadDir('docs/plans', errors).filter((name) => name.endsWith('.md') && name !== 'README.md');
    const archivedFiles = safeReadDir('docs/archive/plans', errors).filter(
        (name) => name.endsWith('.md') && name !== 'README.md'
    );
    const archivedSet = new Set(archivedFiles);

    for (const file of activeFiles) {
        if (archivedSet.has(file)) {
            errors.push(`Plan exists in both active and archived locations: ${file}`);
        }
    }
}

function checkSkillMirrorManifest(errors) {
    const manifestContent = readRepoFile(SKILL_MIRROR_MANIFEST_PATH, errors);
    if (manifestContent === null) {
        return;
    }

    let entries;
    try {
        entries = parseSkillMirrorManifest(manifestContent);
    } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        return;
    }

    const seenEntries = new Set();
    for (const entry of entries) {
        const key = `${entry.source}:${entry.skill}`;
        if (seenEntries.has(key)) {
            errors.push(`Duplicate skill mirror allowlist entry: ${key}`);
        }
        seenEntries.add(key);
    }

    const strategyDoc = readRepoFile('docs/agentic/skill-strategy.md', errors);
    if (strategyDoc !== null) {
        if (!strategyDoc.includes(SKILL_MIRROR_MANIFEST_PATH)) {
            errors.push(`Skill strategy must reference the tracked mirror allowlist: ${SKILL_MIRROR_MANIFEST_PATH}`);
        }
    }

    const syncScript = readRepoFile('scripts/sync_agent_skills.sh', errors);
    if (syncScript !== null && !syncScript.includes(SKILL_MIRROR_MANIFEST_PATH)) {
        errors.push(`sync_agent_skills.sh must read the tracked mirror allowlist: ${SKILL_MIRROR_MANIFEST_PATH}`);
    }
}

function checkSeriousPlanConformance(errors) {
    const planFiles = safeReadDir('docs/plans', errors)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort();

    for (const fileName of planFiles) {
        const relativePath = `docs/plans/${fileName}`;
        const content = readRepoFile(relativePath, errors);
        if (content === null) {
            continue;
        }

        const result = checkPlanConformance({ filePath: relativePath, content });
        if (result.isSerious && result.missingSections.length > 0) {
            errors.push(`${relativePath} is missing required serious-plan sections: ${result.missingSections.join(', ')}`);
        }
    }
}

const errors = [];

checkRequiredFiles(errors);
checkRequiredRunTemplate(errors);
checkMarkdownLinks(errors);
checkForbiddenLiteralReferences(errors);
checkDecisionIndex(errors);
checkInventory(errors, 'docs/agentic/evals/prompts', EXPECTED_EVAL_PROMPT_FILES, 'eval prompt');
checkInventory(errors, 'docs/agentic/session-prompts', expectedSessionPromptFiles, 'session prompt');
checkSessionPromptReadme(errors);
checkWorkflowRoutingSplit(errors);
checkChecklistPlanPaths(errors);
checkPlanArchiveCoherence(errors);
checkSkillMirrorManifest(errors);
checkSeriousPlanConformance(errors);

if (errors.length > 0) {
    console.error('Documentation verification failed:\n');
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exit(1);
}

console.log('Documentation verification passed.');
