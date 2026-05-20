import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    ACTIVE_PLAN_MARKER,
    buildChecklistPlanPathMessages,
    checkArchiveSectionSummaryConformance,
    checkPlanConformance,
    classifyChecklistPlanPathStatus,
    EVAL_PROMPT_INVENTORY_END_MARKER,
    EVAL_PROMPT_INVENTORY_START_MARKER,
    EXPECTED_EVAL_PROMPT_FILES,
    EXPECTED_SESSION_PROMPT_FILES,
    extractChecklistPlanPaths,
    hasActivePlanMarker,
    renderEvalPromptInventory,
    REQUIRED_REPO_LOCAL_SKILL_FILES,
    REQUIRED_REPO_LOCAL_SKILLS,
    renderSessionPromptSet,
    SESSION_PROMPT_SET_END_MARKER,
    SESSION_PROMPT_SET_START_MARKER,
} from './harness-docs-lib.mjs';

const repoRoot = process.cwd();
const verificationMode = process.argv.includes('--workspace') ? 'workspace' : 'strict';
const expectedSessionPromptFiles = EXPECTED_SESSION_PROMPT_FILES;

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
];

const markdownRoots = [
    'agents.md',
    '.agents/skills',
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
    // Reserved for true tracked-file exceptions where an exact local-only artifact path must be shown verbatim.
]);
const requiredCodexAgentRoles = [
    'explorer',
    'explorer_fallback',
    'reviewer',
    'docs_researcher',
    'planner',
    'worker',
    'cleanup_worker',
    'monitor',
    'monitor_fallback',
];
const readOnlyCodexAgentRoles = [
    'explorer',
    'explorer_fallback',
    'reviewer',
    'docs_researcher',
    'monitor',
    'monitor_fallback',
];
const codexRoleWorkflowMarkerFiles = [
    'docs/AGENTIC_DEV_WORKFLOW.md',
    'docs/agentic/skill-strategy.md',
    'docs/agentic/session-prompts/workflow-harness-review.md',
];
const repoLocalLauncherSkillReadOrderFiles = [
    '.agents/skills/lineup-cleanup-plan/SKILL.md',
    '.agents/skills/lineup-cleanup-implement/SKILL.md',
    '.agents/skills/lineup-cleanup-review/SKILL.md',
    '.agents/skills/lineup-cleanup-loop/SKILL.md',
    '.agents/skills/lineup-feature-plan/SKILL.md',
    '.agents/skills/lineup-feature-implement/SKILL.md',
    '.agents/skills/lineup-feature-review/SKILL.md',
    '.agents/skills/lineup-workflow-harness-review/SKILL.md',
    '.agents/skills/repo-production-review/SKILL.md',
];
const requiredCodexRoleContracts = new Map([
    [
        'planner',
        {
            requiredMarkers: [
                'own bounded planning work',
                'not product-code implementation',
                'planning artifacts',
                'execution-ready handoffs',
                'leave implementation to the worker role',
            ],
        },
    ],
    [
        'cleanup_worker',
        {
            requiredMarkers: [
                'bounded cleanup-loop implementation write scope',
                'smallest defensible cleanup change',
                'approved execution unit',
                'tier 3 cleanup-loop implementation passes',
                'leave general implementation routing to the worker role',
            ],
        },
    ],
]);
const requiredCodexRoleDescriptionMarkers = new Map([
    ['cleanup_worker', ['cleanup-loop-specific implementer', 'approved tier 3 cleanup-loop implementation passes']],
]);

function recordFsError(errors, operation, targetPath, error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Unable to ${operation} ${targetPath}: ${message}`);
}

const FAILED_GIT = Symbol('FAILED_GIT');

let cachedTrackedPlanPaths = null;
let cachedTrackedCodexPaths = null;
let cachedTrackedRepoLocalSkillPaths = null;

function getTrackedPlanPaths(errors) {
    if (cachedTrackedPlanPaths !== null) {
        return cachedTrackedPlanPaths;
    }

    try {
        const output = execFileSync('git', ['ls-files', '--', 'docs/plans', 'docs/archive/plans'], {
            cwd: repoRoot,
            encoding: 'utf8',
        });
        cachedTrackedPlanPaths = new Set(
            output
                .split(/\r?\n/u)
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
        );
        return cachedTrackedPlanPaths;
    } catch (error) {
        recordFsError(errors, 'list tracked plan files via git', 'docs/plans docs/archive/plans', error);
        cachedTrackedPlanPaths = FAILED_GIT;
        return cachedTrackedPlanPaths;
    }
}

function getTrackedCodexPaths(errors) {
    if (cachedTrackedCodexPaths !== null) {
        return cachedTrackedCodexPaths;
    }

    try {
        const output = execFileSync('git', ['ls-files', '--', '.codex/config.toml', '.codex/agents'], {
            cwd: repoRoot,
            encoding: 'utf8',
        });
        cachedTrackedCodexPaths = new Set(
            output
                .split(/\r?\n/u)
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
        );
        return cachedTrackedCodexPaths;
    } catch (error) {
        recordFsError(errors, 'list tracked codex role files via git', '.codex/config.toml .codex/agents', error);
        cachedTrackedCodexPaths = FAILED_GIT;
        return cachedTrackedCodexPaths;
    }
}

function getTrackedRepoLocalSkillPaths(errors) {
    if (cachedTrackedRepoLocalSkillPaths !== null) {
        return cachedTrackedRepoLocalSkillPaths;
    }

    try {
        const output = execFileSync('git', ['ls-files', '--', ...REQUIRED_REPO_LOCAL_SKILL_FILES], {
            cwd: repoRoot,
            encoding: 'utf8',
        });
        cachedTrackedRepoLocalSkillPaths = new Set(
            output
                .split(/\r?\n/u)
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
        );
        return cachedTrackedRepoLocalSkillPaths;
    } catch (error) {
        recordFsError(errors, 'list tracked repo-local skill files via git', '.agents/skills', error);
        cachedTrackedRepoLocalSkillPaths = FAILED_GIT;
        return cachedTrackedRepoLocalSkillPaths;
    }
}

function toRepoRelativePath(absolutePath) {
    return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function normalizeRepoPath(relativePath) {
    return relativePath.split(/[\\/]+/u).join('/');
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

    if (
        relativePath === '.agents/skills/desloppify' ||
        relativePath.startsWith('.agents/skills/desloppify/')
    ) {
        return true;
    }

    if (relativePath === '.agents/skills' || relativePath.startsWith('.agents/skills/')) {
        return false;
    }

    return (
        relativePath === '.agent' ||
        relativePath.startsWith('.agent/') ||
        relativePath === '.agents' ||
        relativePath.startsWith('.agents/') ||
        relativePath === '.codex/skills' ||
        relativePath.startsWith('.codex/skills/') ||
        relativePath.startsWith('docs/agentic/evals/baselines/') ||
        relativePath === 'docs/runs' ||
        relativePath.startsWith('docs/runs/')
    );
}

function collectMarkdownFiles(entry, errors) {
    if (entry === '.agents/skills/desloppify' || entry.startsWith('.agents/skills/desloppify/')) {
        return [];
    }

    if (localOnlyMarkdownDirs.includes(entry)) {
        const readmeEntry = normalizeRepoPath(path.join(entry, 'README.md'));
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
        return entry.endsWith('.md') ? [normalizeRepoPath(entry)] : [];
    }

    const results = [];
    const children = safeReadDir(entry, errors);

    for (const child of children) {
        results.push(...collectMarkdownFiles(normalizeRepoPath(path.join(entry, child)), errors));
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

function extractManagedSection(content, { startMarker, endMarker }) {
    const lines = content.split(/\r?\n/u);
    const startIndex = lines.indexOf(startMarker);
    const endIndex = lines.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        return null;
    }

    return lines.slice(startIndex + 1, endIndex).join('\n').trim();
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
    const pathChars = '[A-Za-z0-9._/-]+';
    const patterns = [
        {
            description: 'local-only mirrored skill file',
            regex: /\.agent\/skills(?:\/[a-z0-9._/-]+)?/giu,
        },
        {
            description: 'ignored local desloppify skill',
            regex: /\.agents\/skills\/desloppify(?:\/[a-z0-9._/-]+)?/giu,
        },
        {
            description: 'obsolete .codex skill source',
            regex: /\.codex\/skills(?:\/[a-z0-9._/-]+)?/giu,
            includePrefixes: [
                '.agents/skills/',
                'docs/AGENTIC_DEV_WORKFLOW.md',
                'docs/agentic/session-prompts/',
                'docs/agentic/skill-strategy.md',
            ],
        },
        {
            description: 'local-only .agents artifact',
            regex: /\.agents(?!\/skills(?:\/|$|[^A-Za-z0-9._-]))(?:\/[a-z0-9._/-]+)?/giu,
        },
        {
            description: 'local-only run instance',
            regex: new RegExp(`docs\\/runs\\/\\d{4}-\\d{2}-\\d{2}-[a-z0-9._-]+\\/${pathChars}`, 'giu'),
        },
        {
            description: 'raw eval baseline artifact',
            regex: new RegExp(`docs\\/agentic\\/evals\\/baselines\\/(?!README\\.md)${pathChars}`, 'giu'),
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

        for (const { description, regex, skipPrefixes = [], includePrefixes = [] } of patterns) {
            if (
                includePrefixes.length > 0 &&
                !includePrefixes.some((prefix) => file === prefix || file.startsWith(prefix))
            ) {
                continue;
            }

            if (skipPrefixes.some((prefix) => file.startsWith(prefix))) {
                continue;
            }

            regex.lastIndex = 0;
            const seenMatches = new Set();
            let match = regex.exec(content);
            while (match !== null) {
                const value = match[0];
                if (!seenMatches.has(value)) {
                    seenMatches.add(value);
                    errors.push(`Tracked doc ${file} references ${description}: ${value}`);
                }
                match = regex.exec(content);
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

    const managedSection = extractManagedSection(readme, {
        startMarker: SESSION_PROMPT_SET_START_MARKER,
        endMarker: SESSION_PROMPT_SET_END_MARKER,
    });
    if (managedSection === null) {
        errors.push('Session prompt README is missing the managed prompt-set markers.');
        return;
    }

    const expected = renderSessionPromptSet().trim();
    if (managedSection !== expected) {
        errors.push('Session prompt README managed prompt-set section is out of sync; run `npm run docs:sync`.');
    }

    const normalizedLines = normalizeDocLines(readme);
    const hasPlannerRoleIntent = normalizedLines.some(
        (line) => includesAllMarkers(line, ['cleanup-plan.md', 'feature-plan.md', 'planner role'])
    );
    const hasWorkerRoleIntent = normalizedLines.some(
        (line) => includesAllMarkers(line, ['cleanup-implement.md', 'feature-implement.md', 'worker role'])
    );
    const hasCleanupWorkerRoleIntent = normalizedLines.some(
        (line) => includesAllMarkers(line, ['cleanup-loop.md', 'cleanup worker', 'implementation passes'])
    );
    const hasReviewerRoleIntent = normalizedLines.some(
        (line) =>
            includesAllMarkers(line, [
                'cleanup-review.md',
                'feature-review.md',
                'workflow-harness-review.md',
                'read-only',
                'reviewer role',
            ])
    );

    if (!hasPlannerRoleIntent || !hasWorkerRoleIntent || !hasCleanupWorkerRoleIntent || !hasReviewerRoleIntent) {
        errors.push(
            'Session prompt README must keep the tracked role intent explicit: planner for planning launchers, worker for general implementers, cleanup_worker only for Tier 3 cleanup-loop implementation passes, reviewer read-only for review launchers.'
        );
    }
}

function checkEvalPromptReadme(errors) {
    const readme = readRepoFile('docs/agentic/evals/README.md', errors);
    if (readme === null) {
        return;
    }

    const managedSection = extractManagedSection(readme, {
        startMarker: EVAL_PROMPT_INVENTORY_START_MARKER,
        endMarker: EVAL_PROMPT_INVENTORY_END_MARKER,
    });
    if (managedSection === null) {
        errors.push('Eval README is missing the managed prompt-inventory markers.');
        return;
    }

    const expected = renderEvalPromptInventory().trim();
    if (managedSection !== expected) {
        errors.push('Eval README managed prompt-inventory section is out of sync; run `npm run docs:sync`.');
    }
}

function checkControlPlaneAuthorityModel(errors) {
    const agents = readRepoFile('agents.md', errors);
    if (agents !== null) {
        const normalizedLines = normalizeDocLines(agents);
        if (
            !normalizedLines.some(
                (line) =>
                    line.includes('docs/agentic dev workflow.md') &&
                    line.includes('operating runbook')
            )
        ) {
            errors.push('agents.md must point to docs/AGENTIC_DEV_WORKFLOW.md as the operating runbook.');
        }

        if (hasPositiveDocumentMapAuthorityReference(agents)) {
            errors.push('agents.md must not send readers to docs/agentic/document-map.md as an authority surface.');
        }
    }

    const workflow = readRepoFile('docs/AGENTIC_DEV_WORKFLOW.md', errors);
    if (workflow !== null) {
        const requiredWorkflowMarkers = [
            '## Authority And Document Roles',
            '## Document Precedence',
            'docs/agentic/codanna-playbook.md',
            'docs/agentic/session-prompts/README.md',
            'docs/architecture/CURRENT_STATE.md',
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            'docs/plans/',
            'docs/archive/plans/',
            'docs/runs/',
            'docs/agentic/skill-strategy.md',
            'docs/agentic/evals/README.md',
            'docs/agentic/evals-roadmap.md',
            'docs/agentic/evals/baseline-summaries/',
            'docs/agentic/historical-plan-corpus-review.md',
            'docs/agentic/plan-authoring-standard.md',
            'docs/agentic/doc-gardening-checklist.md',
            'docs/agentic/phase-2-steady-state-plan.md',
        ];

        for (const marker of requiredWorkflowMarkers) {
            if (!workflow.includes(marker)) {
                errors.push(`Workflow doc is missing required control-plane authority marker: ${marker}`);
            }
        }

        const precedenceSection = extractMarkdownSection(workflow, 'Document Precedence');
        if (precedenceSection === null) {
            errors.push('Workflow doc is missing the Document Precedence section content.');
        } else {
            const precedenceLines = normalizeDocLines(precedenceSection);
            const workflowIndex = precedenceLines.findIndex((line) =>
                line.includes('this file for operating workflow, precedence, and where-to-look-next')
            );
            const agentsIndex = precedenceLines.findIndex((line) =>
                line.includes('agents.md') && line.includes('entrypoint defaults')
            );

            if (workflowIndex === -1 || agentsIndex === -1 || workflowIndex > agentsIndex) {
                errors.push('Workflow doc must give docs/AGENTIC_DEV_WORKFLOW.md higher precedence than agents.md.');
            }
        }
    }

    const skillStrategy = readRepoFile('docs/agentic/skill-strategy.md', errors);
    if (skillStrategy !== null) {
        if (skillStrategy.includes('`AGENTS.md`')) {
            errors.push('Skill strategy must not name ignored AGENTS.md as the stable entrypoint doc.');
        }
    }

    const documentMap = readRepoFile('docs/agentic/document-map.md', errors);
    if (documentMap !== null) {
        const requiredDocumentMapMarkers = [
            'Compatibility stub',
            'AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles',
            'Do not treat it as a second authority surface.',
        ];

        for (const marker of requiredDocumentMapMarkers) {
            if (!documentMap.includes(marker)) {
                errors.push(`document-map.md is missing required compatibility-stub marker: ${marker}`);
            }
        }

        const normalizedDocumentMap = normalizeDocText(documentMap);
        if (
            includesAnyMarker(normalizedDocumentMap, [
                'use the workflow doc for',
                'current truth reminders',
                'current architecture truth surface',
                'active cleanup and live-status surface',
            ])
        ) {
            errors.push('document-map.md must remain a minimal compatibility stub without extra guidance sections.');
        }
    }

    const sessionReadme = readRepoFile('docs/agentic/session-prompts/README.md', errors);
    if (sessionReadme !== null) {
        const normalizedReadmeLines = normalizeDocLines(sessionReadme);
        if (
            !normalizedReadmeLines.some(
                (line) =>
                    line.includes('authority, read order, and document precedence now live in') &&
                    line.includes('docs/agentic dev workflow.md')
            )
        ) {
            errors.push(
                'Session prompt README must state that authority, read order, and document precedence now live in docs/AGENTIC_DEV_WORKFLOW.md.'
            );
        }

        if (
            !normalizedReadmeLines.some(
                (line) =>
                    line.includes('load') &&
                    line.includes('agents.md') &&
                    line.includes('docs/agentic dev workflow.md')
            )
        ) {
            errors.push(
                'Session prompt README must require launcher read order to load agents.md and docs/AGENTIC_DEV_WORKFLOW.md.'
            );
        }

        if (hasPositiveDocumentMapAuthorityReference(sessionReadme)) {
            errors.push('Session prompt README must not require docs/agentic/document-map.md in launcher read order.');
        }
    }

    for (const fileName of expectedSessionPromptFiles) {
        const relativePath = `docs/agentic/session-prompts/${fileName}`;
        const content = readRepoFile(relativePath, errors);
        if (content === null) {
            continue;
        }

        if (hasPositiveDocumentMapAuthorityReference(content)) {
            errors.push(`${relativePath} must not require docs/agentic/document-map.md in its launcher read order.`);
        }
    }
}

export function checkRepoLocalLauncherSkillReadOrders(errors) {
    for (const relativePath of repoLocalLauncherSkillReadOrderFiles) {
        const content = readRepoFile(relativePath, errors);
        if (content === null) {
            continue;
        }

        if (content.includes('AGENTS.md')) {
            errors.push(`${relativePath} must reference tracked agents.md, not ignored AGENTS.md.`);
        }

        if (hasPositiveDocumentMapAuthorityReference(content)) {
            errors.push(`${relativePath} must not require docs/agentic/document-map.md in its launcher read order.`);
        }

        const normalizedLines = normalizeDocLines(content);
        const hasTrackedEntrypointRead = normalizedLines.some((line) =>
            /^(?:\d+\.|-)\s+agents\.md$/u.test(line)
        );
        const hasWorkflowRead = normalizedLines.some((line) =>
            /^(?:\d+\.|-)\s+docs\/agentic dev workflow\.md$/u.test(line)
        );

        if (!hasTrackedEntrypointRead || !hasWorkflowRead) {
            errors.push(`${relativePath} must include agents.md and docs/AGENTIC_DEV_WORKFLOW.md in its read list.`);
        }
    }
}

function checkWorkflowRoutingSplit(errors) {
    const readme = readRepoFile('docs/agentic/session-prompts/README.md', errors);
    if (readme !== null) {
        if (!readme.includes('## Routing (Authoritative)')) {
            errors.push('Session prompt README must contain the authoritative routing split section.');
        }

        const requiredReadmeRoutingMarkers = ['cleanup/refactor', 'feature/design', 'mixed'];
        for (const marker of requiredReadmeRoutingMarkers) {
            if (!readme.includes(marker)) {
                errors.push(`Session prompt README routing split is missing required marker: ${marker}`);
            }
        }

        const normalizedLines = normalizeDocLines(readme);
        const featureDesignRoutingRow = normalizedLines.find((line) => line.includes('| feature/design |'));
        if (
            featureDesignRoutingRow === undefined ||
            !includesAllMarkers(featureDesignRoutingRow, ['feature-plan', 'feature-implement', 'feature-review'])
        ) {
            errors.push(
                'Session prompt README feature/design routing row must include feature-plan, feature-implement, and feature-review'
            );
        }
    }

    const workflow = readRepoFile('docs/AGENTIC_DEV_WORKFLOW.md', errors);
    if (workflow !== null) {
        const requiredWorkflowMarkers = [
            'cleanup-plan.md',
            'cleanup-review.md',
            'feature-plan.md',
            'feature-implement.md',
            'feature-review.md',
            'Route task family before choosing a tier.',
        ];

        for (const marker of requiredWorkflowMarkers) {
            if (!workflow.includes(marker)) {
                errors.push(`Workflow doc is missing required cleanup/feature routing marker: ${marker}`);
            }
        }

        const normalizedLines = normalizeDocLines(workflow);
        const hasFeatureTierTwoSequence = normalizedLines.some(
            (line) =>
                (line.includes('feature tier 2 work') || line.includes('tier 2 feature')) &&
                includesMarkersInOrder(line, [
                    'feature-plan',
                    'feature-review',
                    'feature-implement',
                    'feature-review',
                ])
        );
        if (!hasFeatureTierTwoSequence) {
            errors.push(
                'Workflow doc Feature Tier 2 workflow sequence must keep feature-plan -> feature-review -> feature-implement -> feature-review ordering'
            );
        }
    }
}

function normalizeDocText(content) {
    return content
        .toLowerCase()
        .replace(/[`*_]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
}

function normalizeDocLines(content) {
    return content
        .split(/\r?\n/u)
        .map((line) => normalizeDocText(line))
        .filter((line) => line.length > 0);
}

function includesAllMarkers(content, markers) {
    return markers.every((marker) => content.includes(marker));
}

function includesAnyMarker(content, markers) {
    return markers.some((marker) => content.includes(marker));
}

function includesMarkersInOrder(content, markers) {
    let cursor = 0;

    for (const marker of markers) {
        const index = content.indexOf(marker, cursor);
        if (index === -1) {
            return false;
        }

        cursor = index + marker.length;
    }

    return true;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function extractMarkdownSection(content, heading) {
    const headingPattern = new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, 'mu');
    const match = headingPattern.exec(content);
    if (match === null) {
        return null;
    }

    const sectionStart = match.index + match[0].length;
    const remaining = content.slice(sectionStart);
    const nextHeadingIndex = remaining.search(/^##\s+/mu);
    const sectionContent = nextHeadingIndex === -1 ? remaining : remaining.slice(0, nextHeadingIndex);
    return sectionContent.trim();
}

function isCompatibilityStubReferenceLine(line) {
    return includesAnyMarker(line, [
        'compatibility stub',
        'older inbound',
        'do not treat',
        'do not use it as a second authority surface',
    ]);
}

function isPositiveDocumentMapAuthorityLine(line) {
    if (!line.includes('docs/agentic/document-map.md')) {
        return false;
    }

    if (isCompatibilityStubReferenceLine(line)) {
        return false;
    }

    if (
        includesAnyMarker(line, [
            'do not',
            "don't",
            'never load',
            'never read',
            'never include',
            'must not load',
            'must not read',
            'must not include',
        ])
    ) {
        return false;
    }

    return (
        /^\d+\./u.test(line) ||
        includesAnyMarker(line, ['load ', 'read order', 'document precedence', 'authority surface'])
    );
}

function hasPositiveDocumentMapAuthorityReference(content) {
    return normalizeDocLines(content).some((line) => isPositiveDocumentMapAuthorityLine(line));
}

function checkFeatureRemediationPromptContracts(errors) {
    const featurePlan = readRepoFile('docs/agentic/session-prompts/feature-plan.md', errors);
    if (featurePlan !== null) {
        const normalized = normalizeDocText(featurePlan);
        const normalizedLines = normalizeDocLines(featurePlan);
        const hasPlannerRoleBoundary = normalizedLines.some(
            (line) =>
                includesAllMarkers(line, [
                    'tracked write-capable',
                    'planner role',
                    'bounded planning discovery',
                    'tracked plan artifacts',
                    'execution-ready handoffs',
                ]) && includesAnyMarker(line, ['not product-code implementation', 'rather than product-code implementation'])
        );

        if (!hasPlannerRoleBoundary) {
            errors.push(
                'feature-plan prompt doc must explicitly bind the planner role to bounded planning discovery, plan artifacts, and execution-ready handoffs rather than product-code implementation'
            );
        }

        if (!normalized.includes('keep write activity confined to planning surfaces')) {
            errors.push(
                'feature-plan prompt doc must keep planner write scope confined to planning surfaces unless the parent explicitly narrows the task to a planning-doc edit'
            );
        }
    }

    const implement = readRepoFile('docs/agentic/session-prompts/feature-implement.md', errors);
    if (implement !== null) {
        const normalized = normalizeDocText(implement);
        const normalizedLines = normalizeDocLines(implement);
        const outgoingHandoffMarkers = [
            'outgoing review',
            'next review',
            'review handoff',
            'next handoff',
            'next session handoff',
            'next-session-handoff',
        ];
        const patchedArtifactMarkers = [
            'patched implementation artifact',
            'diff target',
            'actual changes',
            'reviewed commit',
            'patched diff',
        ];
        const findingsArtifactMarkers = ['findings artifact', 'implementation-findings', 'remediation findings'];
        const reuseMarkers = ['keep', 'reuse', 'same', 'still', 'set to', 'point back'];
        const reuseNegationMarkers = ['do not', "don't", 'dont', 'never', 'must not'];

        function includesArtifactToken(content) {
            return /\bartifact\b/u.test(content);
        }

        const outgoingHandoffLookahead = 12;
        const hasPatchedArtifactGuidanceInOutgoingHandoffContext = normalizedLines.some((line, index) => {
            if (!includesAnyMarker(line, outgoingHandoffMarkers)) {
                return false;
            }

            const blockText = normalizedLines.slice(index, index + outgoingHandoffLookahead + 1).join(' ');
            return includesAnyMarker(blockText, patchedArtifactMarkers) && includesArtifactToken(blockText);
        });

        const implementHasReplanTrigger = normalizedLines.some(
            (line) =>
                line.includes('lineup-feature-plan') &&
                (/\bre-?plan\b/u.test(line) ||
                    includesAnyMarker(line, ['bounce back', 'route back', 'send the work back', 'update the plan first']))
        );
        const implementContractSatisfied =
            includesArtifactToken(normalized) &&
            implementHasReplanTrigger &&
            includesAnyMarker(normalized, ['remediation', 'fix session', 'fix-session', 'defect remediation', 'findings']) &&
            includesAnyMarker(normalized, [
                'implementation defects',
                'reviewed defects',
                'listed fixes',
                'listed implementation defects',
                'implementation findings',
                'fix session',
            ]) &&
            hasPatchedArtifactGuidanceInOutgoingHandoffContext;
        const reusesFindingsArtifactForOutgoingReview = normalizedLines.some((line, index) => {
            if (!includesAnyMarker(line, outgoingHandoffMarkers)) {
                return false;
            }

            const blockLines = normalizedLines.slice(index, index + outgoingHandoffLookahead + 1);
            return blockLines.some((blockLine) => {
                if (!includesArtifactToken(blockLine)) {
                    return false;
                }
                if (!includesAnyMarker(blockLine, findingsArtifactMarkers)) {
                    return false;
                }
                if (!includesAnyMarker(blockLine, reuseMarkers)) {
                    return false;
                }
                if (includesAnyMarker(blockLine, reuseNegationMarkers)) {
                    return false;
                }
                return true;
            });
        });

        if (!implementContractSatisfied) {
            errors.push(
                'feature-implement prompt doc must describe a remediation/fix path that uses ARTIFACT as the fix-session input, routes plan/decision defects back to lineup-feature-plan, and points the outgoing review handoff at the patched implementation artifact or diff target'
            );
        }

        if (reusesFindingsArtifactForOutgoingReview) {
            errors.push(
                'feature-implement prompt doc contains contradictory outgoing review guidance: the outgoing review handoff must not keep ARTIFACT pointed at a findings artifact'
            );
        }
    }

    const review = readRepoFile('docs/agentic/session-prompts/feature-review.md', errors);
    if (review !== null) {
        const normalized = normalizeDocText(review);
        const normalizedLines = normalizeDocLines(review);
        const planRoutingLinePresent = normalizedLines.some(
            (line) =>
                line.includes('lineup-feature-plan') && includesAnyMarker(line, ['planning', 'decision', 'boundary'])
        );
        const implementRoutingLinePresent = normalizedLines.some(
            (line) =>
                line.includes('lineup-feature-implement') &&
                includesAnyMarker(line, [
                    'implementation defects',
                    'implementation defect',
                    'localized implementation',
                    'localized code defects',
                    'bugs',
                    'missing tests',
                    'missed requirements',
                    'localized refactors',
                ])
        );
        const reviewContractSatisfied =
            includesAllMarkers(normalized, ['artifact', 'lineup-feature-plan', 'lineup-feature-implement']) &&
            planRoutingLinePresent &&
            implementRoutingLinePresent;

        if (!reviewContractSatisfied) {
            errors.push(
                'feature-review prompt doc must split implementation-review remediation between lineup-feature-plan for plan/decision defects and lineup-feature-implement for localized implementation defects'
            );
        }
    }
}

function checkCleanupPriorityExitContracts(errors) {
    const checklist = readRepoFile('ARCHITECTURE_CLEANUP_CHECKLIST.md', errors);
    if (checklist !== null) {
        const normalized = normalizeDocText(checklist);
        const requiredChecklistMarkers = [
            'disposition vocabulary',
            'owned follow-up',
            'single final owner',
            'priority-exit review',
            'mark progress on p(n+1) work until the current priority',
            'p#-exit record is complete',
        ];

        for (const marker of requiredChecklistMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`Checklist doc is missing required priority-exit enforcement marker: ${marker}`);
            }
        }

        const cleanupSliceStartMarker = '- Cleanup slice execution template:';
        const cleanupSliceEndMarker = '- Priority exit command checklist:';
        const cleanupSliceStartIndex = checklist.indexOf(cleanupSliceStartMarker);
        if (cleanupSliceStartIndex === -1) {
            errors.push('Checklist doc is missing the cleanup slice execution template section.');
        } else {
            const cleanupSliceEndIndex = checklist.indexOf(
                cleanupSliceEndMarker,
                cleanupSliceStartIndex + cleanupSliceStartMarker.length
            );
            const cleanupSliceBlock = checklist.slice(
                cleanupSliceStartIndex,
                cleanupSliceEndIndex === -1 ? checklist.length : cleanupSliceEndIndex
            );
            if (!normalizeDocText(cleanupSliceBlock).includes('no open p0 security findings')) {
                errors.push('Checklist doc is missing required cleanup-slice security marker: no open P0 security findings');
            }
        }

        const exitRequirementMarker = 'required: record every mapped imported issue with an exact disposition';
        const exitLineRe = /(^|\n)\s*-\s*\[[ xX]\]\s*`P([1-8])-EXIT`/g;
        const exitMatches = [...checklist.matchAll(exitLineRe)].map((match) => ({
            priority: Number(match[2]),
            index: (match.index ?? 0) + match[1].length,
        }));
        const exitIndexByPriority = new Map(exitMatches.map((match) => [match.priority, match.index]));
        for (let priority = 1; priority <= 8; priority += 1) {
            const blockMarker = `\`P${priority}-EXIT\``;
            const startIndex = exitIndexByPriority.get(priority);
            if (startIndex == null) {
                errors.push(`Checklist doc is missing the ${blockMarker} gate.`);
                continue;
            }

            let endIndex = checklist.length;
            for (let nextPriority = priority + 1; nextPriority <= 8; nextPriority += 1) {
                const nextIndex = exitIndexByPriority.get(nextPriority);
                if (nextIndex != null && nextIndex < endIndex) {
                    endIndex = nextIndex;
                }
            }

            const block = checklist.slice(startIndex, endIndex);
            if (!block.includes(exitRequirementMarker)) {
                errors.push(`Checklist doc is missing the required line inside ${blockMarker} block`);
            }
        }
    }

    const workflow = readRepoFile('docs/AGENTIC_DEV_WORKFLOW.md', errors);
    if (workflow !== null) {
        const normalized = normalizeDocText(workflow);
        const requiredWorkflowMarkers = [
            'priority-exit readiness section',
            'single final owner',
            'starting or planning the next priority',
            'p(n+1) checklist item',
            'implementation work',
            'p#-exit',
            'unresolved',
            'checklist-linked',
            'standalone remediation',
        ];

        for (const marker of requiredWorkflowMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`Workflow doc is missing required priority-exit alignment marker: ${marker}`);
            }
        }
    }

    const planStandard = readRepoFile('docs/agentic/plan-authoring-standard.md', errors);
    if (planStandard !== null) {
        const normalized = normalizeDocText(planStandard);
        const requiredPlanMarkers = [
            'exact issue id',
            'single final owner',
            'revisit trigger',
            'the exact p#-exit checklist update',
        ];

        for (const marker of requiredPlanMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`Plan authoring standard doc is missing required priority-exit marker: ${marker}`);
            }
        }
    }

    const cleanupPlan = readRepoFile('docs/agentic/session-prompts/cleanup-plan.md', errors);
    if (cleanupPlan !== null) {
        const normalized = normalizeDocText(cleanupPlan);
        const requiredCleanupPlanMarkers = [
            'priority-exit readiness',
            'single final owner',
            'exact p0 security issue ids',
            'p#-exit checklist update',
            'priority closeout',
            'checklist-linked',
            'standalone remediation',
        ];

        for (const marker of requiredCleanupPlanMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`cleanup-plan prompt doc is missing required priority-exit planning marker: ${marker}`);
            }
        }
    }

    const cleanupImplement = readRepoFile('docs/agentic/session-prompts/cleanup-implement.md', errors);
    if (cleanupImplement !== null) {
        const normalized = normalizeDocText(cleanupImplement);
        const requiredCleanupImplementMarkers = [
            'prepare the p#-exit evidence and checklist update',
            'exact issue id',
            'single final owner',
            'reason and revisit trigger',
            'priority-exit review',
            'do not start p(n+1) work in the same session',
            'standalone remediation',
            'no checklist update applies',
        ];

        for (const marker of requiredCleanupImplementMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`cleanup-implement prompt doc is missing required priority-exit execution marker: ${marker}`);
            }
        }
    }

    const cleanupReview = readRepoFile('docs/agentic/session-prompts/cleanup-review.md', errors);
    if (cleanupReview !== null) {
        const normalized = normalizeDocText(cleanupReview);
        const requiredCleanupReviewMarkers = [
            'owned follow-up',
            'single final owner',
            'no open p0 security findings',
            'exact p0 security issue ids',
            'revisit trigger',
            'priority-exit review',
            'no p(n+1) plan or implementation work is being approved while p#-exit is still unresolved',
        ];

        for (const marker of requiredCleanupReviewMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`cleanup-review prompt doc is missing required priority-exit review marker: ${marker}`);
            }
        }
    }
}

function checkChecklistMiniRecordStatusVocabulary(errors) {
    const checklist = readRepoFile('ARCHITECTURE_CLEANUP_CHECKLIST.md', errors);
    if (checklist === null) {
        return;
    }

    const validStatuses = new Set(['not started', 'in progress', 'blocked', 'completed']);
    const exitLineRe = /(^|\n)\s*-\s*\[[ xX]\]\s*`P\d+-EXIT`/g;
    const exitMatches = [...checklist.matchAll(exitLineRe)].map((match) => ({
        index: (match.index ?? 0) + match[1].length,
    }));

    for (let index = 0; index < exitMatches.length; index += 1) {
        const startIndex = exitMatches[index].index;
        const endIndex = exitMatches[index + 1]?.index ?? checklist.length;
        const block = checklist.slice(startIndex, endIndex);
        const statusLineRe = /^\s*-\s+Status:\s*(.+?)\s*$/gmu;
        for (const match of block.matchAll(statusLineRe)) {
            const rawStatus = match[1].trim().replace(/`([^`]+)`/gu, '$1').trim();
            if (validStatuses.has(rawStatus)) {
                continue;
            }

            const lineNumber = checklist.slice(0, startIndex + (match.index ?? 0)).split(/\r?\n/u).length;
            errors.push(
                'Checklist mini-record `Status` must be one of: `not started`, `in progress`, `blocked`, `completed`; ' +
                    `found \`${rawStatus}\` on line ${lineNumber}`
            );
        }
    }
}

function checkCleanupExecutionUnitContracts(errors) {
    const planStandard = readRepoFile('docs/agentic/plan-authoring-standard.md', errors);
    if (planStandard !== null) {
        const normalized = normalizeDocText(planStandard);
        const requiredPlanMarkers = [
            'slice table remains the atomic ownership map',
            'execution unit is the execution/review surface',
            'ready now execution unit',
            'execution waves',
            'coverage ledger',
            'absorb now scope',
            'replan triggers',
            'absorb now only when newly discovered residue stays within the same approved execution unit goal',
            'replan required when current-source proof shows a new owner',
        ];

        for (const marker of requiredPlanMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`Plan authoring standard doc is missing required execution-unit marker: ${marker}`);
            }
        }
    }

    const workflow = readRepoFile('docs/AGENTIC_DEV_WORKFLOW.md', errors);
    if (workflow !== null) {
        const normalized = normalizeDocText(workflow);
        const requiredWorkflowMarkers = [
            'ready now execution unit',
            'execution unit',
            'execution waves',
            'wave review is the default approval gate',
            'large-package execution should review coherent retirement batches',
            'delegated planner pass is active, keep it authoritative for plan authoring until it finishes, explicitly blocks, fails, or is abandoned after wait/status-check/wait with no usable progress signal',
            'limit controller-side inspection to explicit blocker or seam resolution',
            'do not do competing local plan drafting or redundant planning discovery',
        ];

        for (const marker of requiredWorkflowMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`Workflow doc is missing required execution-unit marker: ${marker}`);
            }
        }
    }

    const cleanupPlan = readRepoFile('docs/agentic/session-prompts/cleanup-plan.md', errors);
    if (cleanupPlan !== null) {
        const normalized = normalizeDocText(cleanupPlan);
        const requiredCleanupPlanMarkers = [
            'ready now execution unit',
            'execution waves',
            'coverage ledger',
            'absorb now scope',
            'replan triggers',
            'package decomposition decisions with ready now execution unit',
            'large-package execution should review coherent retirement batches',
            'tracked write-capable planner role',
            'not product-code implementation',
            'write activity confined to planning surfaces',
        ];

        for (const marker of requiredCleanupPlanMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`cleanup-plan prompt doc is missing required execution-unit planning marker: ${marker}`);
            }
        }
    }

    const cleanupLoop = readRepoFile('docs/agentic/session-prompts/cleanup-loop.md', errors);
    if (cleanupLoop !== null) {
        const normalized = normalizeDocText(cleanupLoop);
        const requiredCleanupLoopMarkers = [
            'execution-unit-select',
            'ready now execution unit',
            'when a wave is selected, the controller stays inside that wave',
            'wave review is the default approval gate',
            'each implemented approved execution unit or standalone execution target has a clean implementation review loop',
            'completed checklist-linked execution unit closes the final planned',
            'large-package execution should review coherent retirement batches',
            'tracked write-capable planner role',
            'use planner for bounded planning artifacts, cleanup worker for tier 3 cleanup-loop implementation write passes, worker for general implementation outside that loop, and reviewer for adversarial review passes',
            'for tier 3 cleanup-loop implementation passes, use the tracked cleanup worker role instead of worker',
            'planner is the authoritative plan author until it finishes, explicitly blocks, fails, or is abandoned',
            'long wait, a direct status check, and a follow-up wait',
            'must not do planner-grade repo discovery, redundant package-local scoping, issue reconciliation, or tracked plan drafting locally',
            'minimum needed to answer an explicit blocker question or resolve a controller-only seam decision',
            'must not author the execution-grade checklist-linked package plan itself just because it now has enough local context',
            'do not treat planner latency, controller curiosity, or newly gathered local context as a valid reason to reclaim planning',
        ];

        for (const marker of requiredCleanupLoopMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`cleanup-loop prompt doc is missing required execution-unit orchestration marker: ${marker}`);
            }
        }
    }

    const cleanupReview = readRepoFile('docs/agentic/session-prompts/cleanup-review.md', errors);
    if (cleanupReview !== null) {
        const normalized = normalizeDocText(cleanupReview);
        const requiredCleanupReviewMarkers = [
            'execution unit',
            'slice-level accounting is still mandatory',
            'wave review is acting as the default approval gate',
        ];

        for (const marker of requiredCleanupReviewMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`cleanup-review prompt doc is missing required execution-unit review marker: ${marker}`);
            }
        }
    }

    const cleanupImplement = readRepoFile('docs/agentic/session-prompts/cleanup-implement.md', errors);
    if (cleanupImplement !== null) {
        const normalized = normalizeDocText(cleanupImplement);
        const requiredCleanupImplementMarkers = [
            'execution unit',
            'absorb now only when newly discovered residue stays within the same approved execution unit goal',
            'replan required when current-source proof shows a new owner',
        ];

        for (const marker of requiredCleanupImplementMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`cleanup-implement prompt doc is missing required execution-unit execution marker: ${marker}`);
            }
        }
    }

    const readme = readRepoFile('docs/agentic/session-prompts/README.md', errors);
    if (readme !== null) {
        const normalized = normalizeDocText(readme);
        const requiredReadmeMarkers = [
            'execution unit',
            'ready now execution unit',
            'execution waves',
            'coverage ledger',
            'large-package execution should review coherent retirement batches',
            'route tier 3 cleanup-loop.md implementation passes through the tracked cleanup worker role only',
            'cleanup-loop is the exception: tier 3 cleanup implementation inside that loop routes to cleanup worker while tier 2 cleanup and feature implementation stay on worker',
        ];

        for (const marker of requiredReadmeMarkers) {
            if (!normalized.includes(marker)) {
                errors.push(`Session prompt README is missing required execution-unit routing marker: ${marker}`);
            }
        }
    }
}

function checkChecklistPlanPaths(errors, warnings) {
    const checklist = readRepoFile('ARCHITECTURE_CLEANUP_CHECKLIST.md', errors);
    if (checklist === null) {
        return;
    }

    const trackedPlanPaths = getTrackedPlanPaths(errors);
    if (trackedPlanPaths === FAILED_GIT) {
        return;
    }
    const entries = extractChecklistPlanPaths(checklist).map((relativePath) => ({
        relativePath,
        status: classifyChecklistPlanPathStatus({
            exists: existsSync(path.join(repoRoot, relativePath)),
            tracked: trackedPlanPaths.has(relativePath),
        }),
    }));
    const messages = buildChecklistPlanPathMessages(entries, { mode: verificationMode });
    errors.push(...messages.errors);
    warnings.push(...messages.warnings);
}

function getChecklistLinkedTrackedPlanPaths(errors) {
    const checklist = readRepoFile('ARCHITECTURE_CLEANUP_CHECKLIST.md', errors);
    if (checklist === null) {
        return new Set();
    }

    const trackedPlanPaths = getTrackedPlanPaths(errors);
    if (trackedPlanPaths === FAILED_GIT) {
        return FAILED_GIT;
    }

    return new Set(
        extractChecklistPlanPaths(checklist).filter((relativePath) => trackedPlanPaths.has(relativePath))
    );
}

function checkPlanArchiveCoherence(errors) {
    const trackedPlanPaths = getTrackedPlanPaths(errors);
    if (trackedPlanPaths === FAILED_GIT) {
        return;
    }
    const activeFiles = Array.from(trackedPlanPaths)
        .filter((relativePath) => relativePath.startsWith('docs/plans/'))
        .filter((relativePath) => path.basename(relativePath) !== 'README.md')
        .map((relativePath) => path.basename(relativePath));
    const archivedFiles = Array.from(trackedPlanPaths)
        .filter((relativePath) => relativePath.startsWith('docs/archive/plans/'))
        .filter((relativePath) => path.basename(relativePath) !== 'README.md')
        .map((relativePath) => path.basename(relativePath));
    const archivedSet = new Set(archivedFiles);

    for (const file of activeFiles) {
        if (archivedSet.has(file)) {
            errors.push(`Plan exists in both active and archived locations: ${file}`);
        }
    }
}

function checkArchivedSectionSummaryConformance(errors) {
    const trackedPlanPaths = getTrackedPlanPaths(errors);
    if (trackedPlanPaths === FAILED_GIT) {
        return;
    }

    const summaryFiles = Array.from(trackedPlanPaths)
        .filter((relativePath) => relativePath.startsWith('docs/archive/plans/'))
        .filter((relativePath) => relativePath.endsWith('section-summary.md'))
        .sort();

    for (const relativePath of summaryFiles) {
        const content = readRepoFile(relativePath, errors);
        if (content === null) {
            continue;
        }

        const result = checkArchiveSectionSummaryConformance({ filePath: relativePath, content });
        if (!result.isSectionSummary || result.errors.length === 0) {
            continue;
        }

        for (const error of result.errors) {
            errors.push(`${relativePath} harness-ingestion triage ${error}`);
        }
    }
}

function checkRequiredRepoLocalSkills(errors) {
    const trackedSkillPaths = getTrackedRepoLocalSkillPaths(errors);
    for (const skill of REQUIRED_REPO_LOCAL_SKILLS) {
        const relativePath = `.agents/skills/${skill}/SKILL.md`;
        if (!existsSync(path.join(repoRoot, relativePath))) {
            errors.push(`Missing required repo-local canonical skill \`${skill}\`: ${relativePath}`);
            continue;
        }
        if (trackedSkillPaths !== FAILED_GIT && !trackedSkillPaths.has(relativePath)) {
            errors.push(`Required repo-local canonical skill is not tracked: ${relativePath}`);
        }
    }
}

function isCodexRoleWorkflowTracked(errors) {
    let foundConfig = false;
    let foundAgents = false;

    for (const relativePath of codexRoleWorkflowMarkerFiles) {
        const content = readRepoFile(relativePath, errors);
        if (content === null) {
            continue;
        }

        foundConfig ||= content.includes('.codex/config.toml');
        foundAgents ||= content.includes('.codex/agents/');
    }

    return foundConfig && foundAgents;
}

function parseCodexRoleConfig(configContent) {
    const declaredRoles = new Set();
    const roleConfigFiles = new Map();
    const roleSections = new Map();
    let currentRole = null;
    let currentSection = null;
    let maxDepth = null;

    for (const rawLine of configContent.split(/\r?\n/u)) {
        const line = rawLine.trim();

        const sectionMatch = line.match(/^\[([^\]]+)\]$/u);
        if (sectionMatch !== null) {
            currentSection = sectionMatch[1];
        }

        const roleMatch = line.match(/^\[agents\.([a-z0-9_]+)\]$/u);
        if (roleMatch !== null) {
            currentRole = roleMatch[1];
            declaredRoles.add(currentRole);
            roleSections.set(currentRole, []);
            continue;
        }

        if (sectionMatch !== null) {
            currentRole = null;
            continue;
        }

        if (currentSection === 'agents') {
            const maxDepthMatch = line.match(/^max_depth\s*=\s*(\d+)$/u);
            if (maxDepthMatch !== null) {
                maxDepth = Number.parseInt(maxDepthMatch[1], 10);
            }
        }

        if (currentRole === null) {
            continue;
        }

        roleSections.get(currentRole)?.push(line);

        const configFileMatch = line.match(/^config_file\s*=\s*"([^"]+)"$/u);
        if (configFileMatch !== null) {
            roleConfigFiles.set(currentRole, configFileMatch[1]);
        }
    }

    return { declaredRoles, roleConfigFiles, roleSections, maxDepth };
}

export function checkTrackedCodexRoleConfig(errors) {
    const configRelativePath = '.codex/config.toml';
    const configFullPath = path.join(repoRoot, configRelativePath);
    const workflowTracked = isCodexRoleWorkflowTracked(errors);
    const configExists = existsSync(configFullPath);

    if (!workflowTracked && !configExists) {
        return;
    }

    if (!configExists) {
        errors.push(`Missing tracked Codex role config: ${configRelativePath}`);
        return;
    }

    const trackedCodexPaths = getTrackedCodexPaths(errors);

    const configContent = readRepoFile(configRelativePath, errors);
    if (configContent === null) {
        return;
    }

    if (trackedCodexPaths !== FAILED_GIT && !trackedCodexPaths.has(configRelativePath)) {
        errors.push(`Tracked Codex role config is not tracked by git: ${configRelativePath}`);
    }

    const { declaredRoles, roleConfigFiles, roleSections, maxDepth } = parseCodexRoleConfig(configContent);
    const missingRoles = requiredCodexAgentRoles.filter((role) => !declaredRoles.has(role));
    if (missingRoles.length > 0) {
        errors.push(
            `Missing required Codex agent role declarations in .codex/config.toml: ${missingRoles.join(', ')}`
        );
    }

    const rolesMissingConfigFiles = requiredCodexAgentRoles.filter(
        (role) => declaredRoles.has(role) && !roleConfigFiles.has(role)
    );
    if (rolesMissingConfigFiles.length > 0) {
        errors.push(
            `Codex role declarations missing config_file entries in .codex/config.toml: ${rolesMissingConfigFiles.join(', ')}`
        );
    }

    if (maxDepth !== 1) {
        errors.push('Tracked Codex role config must set agents.max_depth = 1 to preserve conservative nesting');
    }

    for (const [role, markers] of requiredCodexRoleDescriptionMarkers.entries()) {
        const normalizedRoleSection = normalizeDocText((roleSections.get(role) ?? []).join('\n'));
        for (const marker of markers) {
            if (!normalizedRoleSection.includes(marker)) {
                errors.push(
                    `Codex role declaration is missing required ${role} scope marker (${marker}) in .codex/config.toml`
                );
            }
        }
    }

    const missingRoleConfigPaths = new Set();
    const untrackedRoleConfigPaths = new Set();
    const invalidRoleConfigFiles = [];
    for (const [role, configFile] of roleConfigFiles.entries()) {
        // Hard-fail malformed or path-traversal config_file entries. The tracked workflow
        // assumes role configs live under `.codex/agents/*.toml`.
        if (!/^agents\/[a-z0-9_.-]+\.toml$/iu.test(configFile)) {
            invalidRoleConfigFiles.push({ role, configFile });
            continue;
        }

        const relativePath = `.codex/${configFile}`;
        if (!existsSync(path.join(repoRoot, relativePath))) {
            missingRoleConfigPaths.add(relativePath);
            continue;
        }

        if (trackedCodexPaths !== FAILED_GIT && !trackedCodexPaths.has(relativePath)) {
            untrackedRoleConfigPaths.add(relativePath);
        }
    }

    for (const missingPath of Array.from(missingRoleConfigPaths).sort()) {
        errors.push(`Codex role config file declared in .codex/config.toml is missing: ${missingPath}`);
    }

    for (const entry of invalidRoleConfigFiles) {
        errors.push(
            `Codex role config_file entries must use agents/*.toml (under .codex/agents): role=${entry.role} config_file="${entry.configFile}"`
        );
    }

    for (const untrackedPath of Array.from(untrackedRoleConfigPaths).sort()) {
        errors.push(`Codex role config file declared in .codex/config.toml is not tracked: ${untrackedPath}`);
    }

    for (const role of readOnlyCodexAgentRoles) {
        const configFile = roleConfigFiles.get(role);
        if (configFile === undefined || !configFile.startsWith('agents/') || !configFile.endsWith('.toml')) {
            continue;
        }

        const relativePath = `.codex/${configFile}`;
        if (!existsSync(path.join(repoRoot, relativePath))) {
            continue;
        }

        const roleConfigContent = readRepoFile(relativePath, errors);
        if (roleConfigContent === null) {
            continue;
        }

        if (!/^sandbox_mode\s*=\s*"read-only"$/mu.test(roleConfigContent)) {
            errors.push(`Read-only Codex role config must set sandbox_mode = "read-only": ${relativePath}`);
        }
    }

    for (const [role, contract] of requiredCodexRoleContracts.entries()) {
        const configFile = roleConfigFiles.get(role);
        if (configFile === undefined || !configFile.startsWith('agents/') || !configFile.endsWith('.toml')) {
            continue;
        }

        const relativePath = `.codex/${configFile}`;
        if (!existsSync(path.join(repoRoot, relativePath))) {
            continue;
        }

        const roleConfigContent = readRepoFile(relativePath, errors);
        if (roleConfigContent === null) {
            continue;
        }

        const normalizedRoleConfig = normalizeDocText(roleConfigContent);

        for (const requiredLinePattern of contract.requiredLinePatterns ?? []) {
            if (!requiredLinePattern.pattern.test(roleConfigContent)) {
                errors.push(
                    `Codex role config is missing required ${role} contract line (${requiredLinePattern.label}): ${relativePath}`
                );
            }
        }

        for (const requiredMarker of contract.requiredMarkers ?? []) {
            if (!normalizedRoleConfig.includes(requiredMarker)) {
                errors.push(
                    `Codex role config is missing required ${role} boundary marker (${requiredMarker}): ${relativePath}`
                );
            }
        }
    }
}

function checkSeriousPlanConformance(errors) {
    const trackedPlanPaths = getTrackedPlanPaths(errors);
    if (trackedPlanPaths === FAILED_GIT) {
        return;
    }
    const checklistLinkedTrackedPlanPaths = getChecklistLinkedTrackedPlanPaths(errors);
    if (checklistLinkedTrackedPlanPaths === FAILED_GIT) {
        return;
    }
    const planFiles = Array.from(trackedPlanPaths)
        .filter((relativePath) => relativePath.startsWith('docs/plans/'))
        .filter((relativePath) => relativePath.endsWith('.md'))
        .filter((relativePath) => path.basename(relativePath) !== 'README.md')
        .sort();

    for (const relativePath of planFiles) {
        const content = readRepoFile(relativePath, errors);
        if (content === null) {
            continue;
        }

        if (checklistLinkedTrackedPlanPaths.has(relativePath) && !hasActivePlanMarker(content)) {
            errors.push(
                `${relativePath} is referenced by ARCHITECTURE_CLEANUP_CHECKLIST.md and must include exact active plan marker near the top of the file: ${ACTIVE_PLAN_MARKER}`
            );
        }

        const result = checkPlanConformance({ filePath: relativePath, content });
        if (result.isSerious && result.errors.length > 0) {
            for (const error of result.errors) {
                errors.push(`${relativePath} ${error}`);
            }
        }

        if (
            checklistLinkedTrackedPlanPaths.has(relativePath) &&
            result.isSerious &&
            (result.taskFamily !== 'cleanup/refactor' || result.cleanupSubtype !== 'checklist-linked')
        ) {
            errors.push(
                `${relativePath} is referenced by ARCHITECTURE_CLEANUP_CHECKLIST.md and must declare **Task family:** cleanup/refactor plus **Cleanup subtype:** checklist-linked`
            );
        }

        if (result.isSerious && result.missingSections.length > 0) {
            errors.push(`${relativePath} is missing required serious-plan sections: ${result.missingSections.join(', ')}`);
        }
    }
}

function main() {
    const errors = [];
    const warnings = [];

    checkRequiredFiles(errors);
    checkRequiredRunTemplate(errors);
    checkMarkdownLinks(errors);
    checkForbiddenLiteralReferences(errors);
    checkDecisionIndex(errors);
    checkInventory(errors, 'docs/agentic/evals/prompts', EXPECTED_EVAL_PROMPT_FILES, 'eval prompt');
    checkInventory(errors, 'docs/agentic/session-prompts', expectedSessionPromptFiles, 'session prompt');
    checkSessionPromptReadme(errors);
    checkEvalPromptReadme(errors);
    checkControlPlaneAuthorityModel(errors);
    checkRepoLocalLauncherSkillReadOrders(errors);
    checkWorkflowRoutingSplit(errors);
    checkFeatureRemediationPromptContracts(errors);
    checkCleanupPriorityExitContracts(errors);
    checkChecklistMiniRecordStatusVocabulary(errors);
    checkCleanupExecutionUnitContracts(errors);
    checkChecklistPlanPaths(errors, warnings);
    checkPlanArchiveCoherence(errors);
    checkArchivedSectionSummaryConformance(errors);
    checkRequiredRepoLocalSkills(errors);
    checkTrackedCodexRoleConfig(errors);
    checkSeriousPlanConformance(errors);

    if (errors.length > 0) {
        console.error('Documentation verification failed:\n');
        for (const error of errors) {
            console.error(`- ${error}`);
        }
        process.exit(1);
    }

    if (warnings.length > 0) {
        console.log('Documentation verification passed with warnings:\n');
        for (const warning of warnings) {
            console.log(`- ${warning}`);
        }
    } else {
        console.log('Documentation verification passed.');
    }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath !== null && pathToFileURL(entryPath).href === import.meta.url) {
    main();
}
