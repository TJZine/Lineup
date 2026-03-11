import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    buildChecklistPlanPathMessages,
    checkPlanConformance,
    classifyChecklistPlanPathStatus,
    EVAL_PROMPT_INVENTORY_END_MARKER,
    EVAL_PROMPT_INVENTORY_START_MARKER,
    EXPECTED_EVAL_PROMPT_FILES,
    EXPECTED_SESSION_PROMPT_FILES,
    extractChecklistPlanPaths,
    parseSkillMirrorManifest,
    renderEvalPromptInventory,
    renderSessionPromptSet,
    SESSION_PROMPT_SET_END_MARKER,
    SESSION_PROMPT_SET_START_MARKER,
    SKILL_MIRROR_MANIFEST_PATH,
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
    // Reserved for true tracked-file exceptions where an exact local-only artifact path must be shown verbatim.
]);
const requiredCodexAgentRoles = [
    'explorer',
    'explorer_fallback',
    'reviewer',
    'docs_researcher',
    'worker',
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

function recordFsError(errors, operation, targetPath, error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Unable to ${operation} ${targetPath}: ${message}`);
}

const FAILED_GIT = Symbol('FAILED_GIT');

let cachedTrackedPlanPaths = null;
let cachedTrackedCodexPaths = null;

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
            regex: /\.agent\/skills\/[a-z0-9._-]+\/SKILL\.md/giu,
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

        for (const { description, regex } of patterns) {
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

function checkFeatureRemediationPromptContracts(errors) {
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

        const configFileMatch = line.match(/^config_file\s*=\s*"([^"]+)"$/u);
        if (configFileMatch !== null) {
            roleConfigFiles.set(currentRole, configFileMatch[1]);
        }
    }

    return { declaredRoles, roleConfigFiles, maxDepth };
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

    const { declaredRoles, roleConfigFiles, maxDepth } = parseCodexRoleConfig(configContent);
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
}

function checkSeriousPlanConformance(errors) {
    const trackedPlanPaths = getTrackedPlanPaths(errors);
    if (trackedPlanPaths === FAILED_GIT) {
        return;
    }
    const planFiles = Array.from(trackedPlanPaths)
        .filter((relativePath) => relativePath.startsWith('docs/plans/'))
        .map((relativePath) => path.basename(relativePath))
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
    checkWorkflowRoutingSplit(errors);
    checkFeatureRemediationPromptContracts(errors);
    checkCleanupPriorityExitContracts(errors);
    checkChecklistPlanPaths(errors, warnings);
    checkPlanArchiveCoherence(errors);
    checkSkillMirrorManifest(errors);
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
