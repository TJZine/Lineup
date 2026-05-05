export const SKILL_MIRROR_MANIFEST_PATH = 'docs/agentic/skill-mirror-allowlist.txt';

export const SESSION_PROMPT_SET_START_MARKER = '<!-- BEGIN MANAGED SESSION PROMPT SET -->';
export const SESSION_PROMPT_SET_END_MARKER = '<!-- END MANAGED SESSION PROMPT SET -->';
export const EVAL_PROMPT_INVENTORY_START_MARKER = '<!-- BEGIN MANAGED EVAL PROMPT INVENTORY -->';
export const EVAL_PROMPT_INVENTORY_END_MARKER = '<!-- END MANAGED EVAL PROMPT INVENTORY -->';
export const REQUIRED_REPO_LOCAL_SKILLS = [
    'architecture-boundaries',
    'bounded-worker-execution',
    'closeout-verification',
    'debugging-remediation',
    'execution-plan-authoring',
    'model-selection',
    'parallel-sidecars',
    'persistence-boundaries',
    'plex-integration-boundaries',
    'review-adjudication',
    'review-request',
    'ui-composition-patterns',
    'verification-strategy',
];
export const REQUIRED_REPO_LOCAL_SKILL_FILES = REQUIRED_REPO_LOCAL_SKILLS.map(
    (skill) => `.codex/skills/${skill}/SKILL.md`
);

export const SESSION_PROMPT_INVENTORY = [
    {
        file: 'cleanup-plan.md',
        linkText: 'cleanup-plan.md',
        description: 'Tier 2 planner session for writing or refreshing a serious cleanup plan',
    },
    {
        file: 'cleanup-implement.md',
        linkText: 'cleanup-implement.md',
        description: 'Tier 2 implementer session for executing an approved plan in a repo-local worktree',
    },
    {
        file: 'cleanup-review.md',
        linkText: 'cleanup-review.md',
        description: 'reusable adversarial review session for either a plan or an implementation',
    },
    {
        file: 'cleanup-loop.md',
        linkText: 'cleanup-loop.md',
        description:
            'Tier 3 cleanup/refactor/remediation-only session for package-scoped planning/closeout and execution-unit orchestration',
    },
    {
        file: 'feature-plan.md',
        linkText: 'feature-plan.md',
        description: 'Tier 2 or Tier 3 planner session for serious feature/design planning',
    },
    {
        file: 'feature-implement.md',
        linkText: 'feature-implement.md',
        description: 'approved feature/design implementer session; Tier 2 default, reusable in Tier 3 when a run bundle already exists',
    },
    {
        file: 'feature-review.md',
        linkText: 'feature-review.md',
        description: 'reusable adversarial review session for feature/design plans and implementations',
    },
    {
        file: 'workflow-harness-review.md',
        linkText: 'workflow-harness-review.md',
        description: 'adversarial whole-system review of the repo harness against current OpenAI and Anthropic guidance',
    },
];

export const EVAL_PROMPT_INVENTORY = [
    {
        file: '01-app-container-extraction-no-ui-drift.md',
        linkText: '01-app-container-extraction-no-ui-drift',
        title: '01 App Container Extraction No UI Drift',
    },
    {
        file: '02-lazy-screen-registry-no-dual-ownership.md',
        linkText: '02-lazy-screen-registry-no-dual-ownership',
        title: '02 Lazy Screen Registry No Dual Ownership',
    },
    {
        file: '03-overlay-toast-extraction-no-timer-leaks.md',
        linkText: '03-overlay-toast-extraction-no-timer-leaks',
        title: '03 Overlay Toast Extraction No Timer Leaks',
    },
    {
        file: '04-diagnostics-surface-isolation-no-storage-slop.md',
        linkText: '04-diagnostics-surface-isolation-no-storage-slop',
        title: '04 Diagnostics Surface Isolation No Storage Slop',
    },
    {
        file: '05-app-shell-cleanup-no-behavior-regression.md',
        linkText: '05-app-shell-cleanup-no-behavior-regression',
        title: '05 App Shell Cleanup No Behavior Regression',
    },
    {
        file: '06-orchestrator-hotspot-extraction.md',
        linkText: '06-orchestrator-hotspot-extraction',
        title: '06 Orchestrator Hotspot Extraction',
    },
    {
        file: '07-settings-storage-boundary.md',
        linkText: '07-settings-storage-boundary',
        title: '07 Settings Storage Boundary',
    },
    {
        file: '08-server-selection-storage-boundary.md',
        linkText: '08-server-selection-storage-boundary',
        title: '08 Server Selection Storage Boundary',
    },
    {
        file: '09-channel-persistence-boundary.md',
        linkText: '09-channel-persistence-boundary',
        title: '09 Channel Persistence Boundary',
    },
    {
        file: '10-settings-screen-split.md',
        linkText: '10-settings-screen-split',
        title: '10 Settings Screen Split',
    },
    {
        file: '11-plex-subtitle-policy.md',
        linkText: '11-plex-subtitle-policy',
        title: '11 Plex Subtitle Policy',
    },
    {
        file: '12-architecture-doc-refresh.md',
        linkText: '12-architecture-doc-refresh',
        title: '12 Architecture Doc Refresh',
    },
    {
        file: '13-risk-tiered-orchestration-and-local-only-absorption.md',
        linkText: '13-risk-tiered-orchestration-and-local-only-absorption',
        title: '13 Risk-Tiered Orchestration And Local-Only Absorption',
    },
    {
        file: '14-epg-info-panel-orchestration-no-host-drift.md',
        linkText: '14-epg-info-panel-orchestration-no-host-drift',
        title: '14 EPG Info-Panel Orchestration No Host Drift',
    },
    {
        file: '15-channel-setup-session-owner-no-step-controller-bleed.md',
        linkText: '15-channel-setup-session-owner-no-step-controller-bleed',
        title: '15 Channel Setup Session Owner No Step-Controller Bleed',
    },
    {
        file: '16-shared-ui-primitives-no-policy-centralization.md',
        linkText: '16-shared-ui-primitives-no-policy-centralization',
        title: '16 Shared UI Primitives No Policy Centralization',
    },
    {
        file: '17-priority-4-cleanup-pass-no-premature-glue-removal.md',
        linkText: '17-priority-4-cleanup-pass-no-premature-glue-removal',
        title: '17 Priority 4 Cleanup Pass No Premature Glue Removal',
    },
    {
        file: '18-detect-unresolved-seam-before-freezing-plan.md',
        linkText: '18-detect-unresolved-seam-before-freezing-plan',
        title: '18 Detect Unresolved Seam Before Freezing Plan',
    },
    {
        file: '19-multi-agent-role-selection-and-delegation-discipline.md',
        linkText: '19-multi-agent-role-selection-and-delegation-discipline',
        title: '19 Multi-Agent Role Selection And Delegation Discipline',
    },
    {
        file: '20-skill-routing-interface-vs-frontend.md',
        linkText: '20-skill-routing-interface-vs-frontend',
        title: '20 Skill Routing Interface-vs-Frontend',
    },
];

export const EXPECTED_SESSION_PROMPT_FILES = SESSION_PROMPT_INVENTORY.map(({ file }) => file);
export const EXPECTED_EVAL_PROMPT_FILES = EVAL_PROMPT_INVENTORY.map(({ file }) => file);
export const HARNESS_INGESTION_TRIAGE_STATUSES = ['none', 'deferred', 'pending', 'absorbed'];
export const HARNESS_INGESTION_TRIAGE_ACTIONS = [
    'none',
    'historical-corpus',
    'targeted-eval',
    'workflow-docs',
    'harness-update-loop',
];
export const ACTIVE_PLAN_MARKER = '**Plan Status:** active';
const VALID_TASK_FAMILIES = new Set(['feature/design', 'cleanup/refactor']);
const VALID_CLEANUP_SUBTYPES = new Set(['checklist-linked', 'standalone remediation']);
const PLAN_VERIFICATION_CLASSIFICATIONS = [
    'new regression/contract test required',
    'existing coverage sufficient',
    'broader integration/manual proof required',
    'no new automated test needed',
];
const VERIFICATION_CLASSIFICATION_LINE_RE =
    /^\s*(?:[-*]|\d+\.)\s+Verification classification:\s*`([^`]+)`\s*$/gmu;
const PLAN_LIST_ENTRY_RE = /^\s*(?:[-*]|\d+\.)\s+\S+/mu;
const PLAN_RUN_LINE_RE = /^\s*(?:[-*]|\d+\.)?\s*Run:\s*`[^`]+`/imu;
const PLAN_EXPECTED_LINE_RE = /^\s*(?:[-*]|\d+\.)?\s*Expected:\s*.+$/imu;
const FCP_CHECKLIST_TOKEN_RE = /^FCP-(?:\d+|EXIT)$/u;
const LEGACY_CHECKLIST_SLICE_ID_PATTERN = '[PS]\\d+-W\\d+-S\\d+';
const DCR_CHECKLIST_SLICE_ID_PATTERN = 'DCR-(?:\\d+|EXIT)-S\\d+';
const FCP_CHECKLIST_SLICE_ID_PATTERN = 'FCP-(?:\\d+|EXIT)-S\\d+';
const CHECKLIST_SLICE_ID_PATTERN = `(?:${LEGACY_CHECKLIST_SLICE_ID_PATTERN}|${DCR_CHECKLIST_SLICE_ID_PATTERN})`;
const CHECKLIST_SLICE_ID_RE = new RegExp(`^${CHECKLIST_SLICE_ID_PATTERN}$`, 'u');
const FCP_CHECKLIST_SLICE_ID_RE = new RegExp(`^${FCP_CHECKLIST_SLICE_ID_PATTERN}$`, 'u');
const FCP_FORBIDDEN_IMPORTED_ID_RE = /\b[A-Za-z][A-Za-z0-9_-]*::/u;
const FCP_FORBIDDEN_DESLOPPIFY_RE = /\b(?:desloppify|\.desloppify)\b/iu;
const FCP_FORBIDDEN_PACKAGE_MAP_RE = /\bpackage[-_\s]?map\b/iu;
const FCP_FORBIDDEN_EVIDENCE_MESSAGE =
    'detector/imported issue ids, package-map evidence, or Desloppify evidence';
const PRIORITY_EXIT_ISSUE_HEADER_RE =
    /^\s*(?:[-*]|\d+\.)\s+`?([A-Za-z0-9/._:-]*[._:-][A-Za-z0-9/._:-]*)`?\s*$/iu;
const PRIORITY_EXIT_DISPOSITION_RE =
    /(?:expected|planned)?\s*disposition(?:\s+(?:after\s+this\s+plan|at\s+[^:]+))?\s*:\s*`?(?:resolved(?:\s+(?:on|by)\s+[^`\n]+)?|deferred|split follow-up|owned follow-up|stale-proven|accepted residue|retired)`?[ \t]*(?:\r?\n|$)/iu;
const PRIORITY_EXIT_DEFERRED_RE =
    /(?:expected|planned)?\s*disposition(?:\s+(?:after\s+this\s+plan|at\s+[^:]+))?\s*:\s*`?(?:deferred|split follow-up|owned follow-up)`?[ \t]*(?:\r?\n|$)/iu;
const PRIORITY_EXIT_FINAL_OWNER_RE =
    /(?:exact\s+)?(?:current\s+or\s+follow-up\s+owner|current\s+owner|final\s+owner|residual\s+final\s+owner|exact\s+final\s+owner|owned\s+follow-up)(?:\s+if\s+[^:]+)?\s*:\s*`?[^`\n]+`?/giu;
const PRIORITY_EXIT_REVISIT_TRIGGER_RE = /revisit trigger:\s*.+/iu;
const PRIORITY_EXIT_SECURITY_RE =
    /\b(?:security triage(?: expectation)?|security gate|security output)\b/iu;
const PRIORITY_EXIT_SECURITY_DISPOSITION_RE =
    /(?:no\s+open\s+`?P0`?\s+security\s+findings|none\s+open|exact(?:\s+open\/deferred)?\s+(?:`?P0`?\s+)?security\s+issue\s+ids|list\s+the\s+exact(?:\s+open\/deferred)?\s+(?:`?P0`?\s+)?security\s+issue\s+ids|`?P0`?\s+security\s+issue\s+ids|no\s+`?P0`?\s+security\s+issue\s+id\s+is\s+currently\s+mapped)/iu;
const PRIORITY_EXIT_NEXT_PRIORITY_GATE_RE =
    /(?:priority-exit\s+review|P#-EXIT|P\(n\+1\)|FCP-\(n\+1\)|FCP-n|(?:before|no)\s+`?(?:P\d+(?:-EXIT)?|FCP-(?:\d+|EXIT))`?.*?\b(?:(?:should\s+)?(?:begin|begins|start|starts))\b|until\s+`?(?:P\d+(?:-EXIT)?|FCP-(?:\d+|EXIT))`?.*?\b(?:is\s+)?unresolved\b)/iu;

const PLAN_SECTION_RULES = [
    { label: 'goal', patterns: [/^\*\*Goal:\*\*/im, /^## Goal$/im] },
    { label: 'non-goals', patterns: [/^## Non-Goals$/im, /^\*\*Non-Goals:\*\*/im] },
    {
        label: 'parent alignment',
        patterns: [
            /^## Parent Priority Alignment$/im,
            /^## Parent Architecture Alignment$/im,
            /^\*\*Architecture:\*\*/im,
        ],
    },
    {
        label: 'required reading',
        patterns: [/^## Required Reading$/im, /^## Fresh-Session Bootstrap$/im],
    },
    { label: 'required skills', patterns: [/^## Required Skills$/im, /^\*\*Required Skills:\*\*/im] },
    { label: 'Codanna discovery', patterns: [/^## Codanna Discovery$/im] },
    { label: 'impact snapshot', patterns: [/^## Impact Snapshot$/im, /^## Evidence To Preserve$/im] },
    { label: 'files in scope', patterns: [/^## Files In Scope$/im, /^## Allowed File Changes$/im] },
    { label: 'files out of scope', patterns: [/^## Files Out Of Scope$/im] },
    { label: 'planner self-check', patterns: [/^## Planner Self-Check$/im] },
    { label: 'architecture seam decision gate', patterns: [/^## Architecture Seam Decision Gate$/im] },
    { label: 'verification commands', patterns: [/^## Verification Commands$/im] },
    { label: 'rollback notes', patterns: [/^## Rollback Notes$/im] },
    { label: 'commit checkpoints', patterns: [/^## Commit Checkpoints$/im] },
];
const PLAN_SECTION_CONTENT_RULES = [
    {
        label: 'planner self-check',
        patterns: [/^## Planner Self-Check$/im],
        error: 'planner self-check section must contain substantive content',
    },
    {
        label: 'architecture seam decision gate',
        patterns: [/^## Architecture Seam Decision Gate$/im],
        error: 'architecture seam decision gate section must contain substantive content',
    },
    {
        label: 'verification commands',
        patterns: [/^## Verification Commands$/im],
        error: 'verification commands section must contain substantive content',
    },
];

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

function extractInlinePlanSection(content, label) {
    const inlineFieldPattern = new RegExp(`^\\*\\*${escapeRegExp(label)}:\\*\\*\\s*(.*)$`, 'mu');
    const inlineFieldMatch = inlineFieldPattern.exec(content);
    if (inlineFieldMatch === null) {
        return null;
    }

    const inlineValue = inlineFieldMatch[1].trim();
    if (inlineValue.length > 0) {
        return inlineValue;
    }

    const remaining = content.slice(inlineFieldMatch.index + inlineFieldMatch[0].length);
    const nextBoundaryIndex = remaining.search(/^(?:\*\*[A-Z][^:\n]*:\*\*|##\s+)/mu);
    const sectionContent = nextBoundaryIndex === -1 ? remaining : remaining.slice(0, nextBoundaryIndex);

    return sectionContent.trim();
}

function extractFirstMatchingMarkdownSection(content, headings) {
    for (const heading of headings) {
        const section = extractMarkdownSection(content, heading);
        if (section !== null) {
            return section;
        }
    }

    return null;
}

function extractPlanSectionContent(content, { patterns }) {
    const markdownHeadings = patterns
        .map((pattern) => pattern.source.match(/\^##\s+(.+)\$/u)?.[1] ?? null)
        .filter((heading) => heading !== null);
    const markdownSection = extractFirstMatchingMarkdownSection(content, markdownHeadings);
    if (markdownSection !== null) {
        return markdownSection;
    }

    const inlineLabels = patterns
        .map((pattern) => pattern.source.match(/\^\\\*\\\*(.+):\\\*\\\*/u)?.[1] ?? null)
        .filter((label) => label !== null);

    for (const label of inlineLabels) {
        const inlineSection = extractInlinePlanSection(content, label);
        if (inlineSection !== null) {
            return inlineSection;
        }
    }

    return null;
}

function hasExactVerificationClassificationMarker(section) {
    const matches = Array.from(section.matchAll(VERIFICATION_CLASSIFICATION_LINE_RE), (match) => match[1]);
    return matches.length === 1 && PLAN_VERIFICATION_CLASSIFICATIONS.includes(matches[0]);
}

function parseInlineField(section, label) {
    const pattern = new RegExp(`^- ${escapeRegExp(label)}:[ \\t]*(.+)$`, 'mu');
    const match = pattern.exec(section);
    if (match === null) {
        return null;
    }

    return match[1].trim().replace(/`([^`]+)`/gu, '$1').trim();
}

function extractChecklistPackageFieldBlock(section, label, nextLabels = null) {
    const lines = section.split(/\r?\n/u);
    const fieldPattern = new RegExp(`^- ${escapeRegExp(label)}:\\s*(.*)$`, 'u');
    const nextFieldPatterns = nextLabels === null
        ? [/^- `[^`]+`:\s*/u]
        : nextLabels.map((nextLabel) => new RegExp(`^- ${escapeRegExp(nextLabel)}:\\s*(.*)$`, 'u'));
    let startIndex = -1;

    for (let index = 0; index < lines.length; index += 1) {
        if (fieldPattern.test(lines[index])) {
            startIndex = index;
            break;
        }
    }

    if (startIndex === -1) {
        return null;
    }

    const collected = [lines[startIndex]];
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        if (nextFieldPatterns.some((pattern) => pattern.test(lines[index]))) {
            break;
        }
        collected.push(lines[index]);
    }

    return collected.join('\n').trim();
}

function extractChecklistFieldValues(block) {
    if (block === null) {
        return [];
    }

    const values = [];
    const lines = block.split(/\r?\n/u);

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const valueText = index === 0 ? (line.match(/^[^:]+:\s*(.*)$/u)?.[1] ?? '') : line;
        const backtickValues = Array.from(valueText.matchAll(/`([^`]+)`/gu), (match) => match[1].trim());
        if (backtickValues.length > 0) {
            values.push(...backtickValues);
            continue;
        }

        const bulletValue = valueText.match(/^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/u)?.[1]?.trim() ?? '';
        if (bulletValue.length === 0 || bulletValue.endsWith(':')) {
            continue;
        }

        values.push(...bulletValue.split(/\s*,\s*/u).map((value) => value.replace(/^`(.+)`$/u, '$1').trim()));
    }

    return values.filter((value) => value.length > 0);
}

function hasFcpForbiddenImportedEvidence(section) {
    return (
        FCP_FORBIDDEN_IMPORTED_ID_RE.test(section)
        || FCP_FORBIDDEN_DESLOPPIFY_RE.test(section)
        || FCP_FORBIDDEN_PACKAGE_MAP_RE.test(section)
    );
}

function getRequiredInlineScalarFieldValue(section, label, errors, missingError, blockOnlyError) {
    const inlineFieldPattern = new RegExp(`^- ${escapeRegExp(label)}:[ \\t]*(.*)$`, 'mu');
    const inlineFieldMatch = inlineFieldPattern.exec(section);
    if (inlineFieldMatch !== null) {
        const inlineValue = inlineFieldMatch[1].trim().replace(/`([^`]+)`/gu, '$1').trim();
        if (inlineValue.length > 0) {
            return inlineValue;
        }

        errors.push(blockOnlyError);
        return null;
    }

    if (extractChecklistPackageFieldBlock(section, label) !== null) {
        errors.push(blockOnlyError);
        return null;
    }

    errors.push(missingError);
    return null;
}

function getChecklistSliceSections(sliceTableBlock, sliceIdPattern) {
    const sliceHeadingRe = new RegExp(`^###\\s+\`(${sliceIdPattern})\`[^\\n]*$`, 'gmu');
    const matches = Array.from(sliceTableBlock.matchAll(sliceHeadingRe));
    if (matches.length === 0) {
        return [];
    }

    return matches.map((match, index) => {
        const start = match.index + match[0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index : sliceTableBlock.length;
        return {
            sliceId: match[1],
            content: sliceTableBlock.slice(start, end).trim(),
        };
    });
}

function getExecutionWaveEntries(executionWavesBlock) {
    const matches = Array.from(
        executionWavesBlock.matchAll(/^[ \t]*(?:[-*]|\d+\.)[ \t]+`wave_id`:\s*`?([^`\n]+)`?.*$/gmu)
    );
    if (matches.length === 0) {
        return [];
    }

    return matches.map((match, index) => {
        const start = match.index;
        const end = index + 1 < matches.length ? matches[index + 1].index : executionWavesBlock.length;

        return {
            waveId: match[1].trim(),
            content: executionWavesBlock.slice(start, end).trim(),
        };
    });
}

function getDeclaredExecutionWaveSliceIds(waveContent, sliceIdPattern) {
    const lines = waveContent.split(/\r?\n/u);
    let collecting = false;
    const sliceIds = [];
    const inlineSliceIdRe = new RegExp(sliceIdPattern, 'gu');
    const nestedSliceIdRe = new RegExp(`^[ \\t]+(?:[-*]|\\d+\\.)[ \\t]+\`(${sliceIdPattern})\``, 'u');

    for (const line of lines) {
        if (!collecting) {
            const sliceIdsLineMatch = line.match(/^[ \t]*(?:[-*]|\d+\.)[ \t]+`slice_ids`:\s*(.*)$/u);
            if (sliceIdsLineMatch === null) {
                continue;
            }

            const inlineIds = Array.from(sliceIdsLineMatch[1].matchAll(inlineSliceIdRe), (match) => match[0]);
            if (inlineIds.length > 0) {
                return inlineIds;
            }

            collecting = true;
            continue;
        }

        const nestedSliceId = line.match(nestedSliceIdRe)?.[1] ?? null;
        if (nestedSliceId !== null) {
            sliceIds.push(nestedSliceId);
            continue;
        }

        if (line.trim().length === 0) {
            continue;
        }

        break;
    }

    return sliceIds;
}

function getChecklistLinkedPackagePlanErrors(content) {
    const errors = [];
    const packageDecomposition = extractFirstMatchingMarkdownSection(content, ['Package Decomposition']);
    if (packageDecomposition === null) {
        return ['checklist-linked plans must include `## Package Decomposition`'];
    }

    const checklistToken = parseInlineField(packageDecomposition, '`checklist_token`');
    const isFcpPackage = checklistToken !== null && FCP_CHECKLIST_TOKEN_RE.test(checklistToken);
    const packageIssueField = isFcpPackage ? '`source_finding_ids`' : '`package_issue_ids`';
    const sliceIssueField = isFcpPackage ? '`source_finding_ids`' : '`exact_issue_ids`';
    const fcpSliceIdPattern = checklistToken === null ? FCP_CHECKLIST_SLICE_ID_PATTERN : `${escapeRegExp(checklistToken)}-S\\d+`;
    const fcpSliceIdRe = new RegExp(`^${fcpSliceIdPattern}$`, 'u');
    const sliceIdRe = isFcpPackage ? fcpSliceIdRe : CHECKLIST_SLICE_ID_RE;
    const sliceIdPattern = isFcpPackage ? fcpSliceIdPattern : CHECKLIST_SLICE_ID_PATTERN;
    const fcpSourceFindingIdRe = checklistToken === null ? null : new RegExp(`^${escapeRegExp(checklistToken)}-SF\\d+$`, 'u');
    const sliceIdError = isFcpPackage
        ? 'checklist-linked FCP plans must keep `ready_now_slice` on an FCP package-scoped slice id'
        : 'checklist-linked plans must keep `ready_now_slice` on a package-scoped slice id';

    if (isFcpPackage) {
        if (hasFcpForbiddenImportedEvidence(packageDecomposition)) {
            errors.push(`checklist-linked FCP plans must not include ${FCP_FORBIDDEN_EVIDENCE_MESSAGE} in \`## Package Decomposition\``);
        }
        if (extractChecklistPackageFieldBlock(packageDecomposition, '`package_issue_ids`') !== null) {
            errors.push('checklist-linked FCP plans must use `source_finding_ids`, not `package_issue_ids`');
        }
        if (extractChecklistPackageFieldBlock(packageDecomposition, '`exact_issue_ids`') !== null) {
            errors.push('checklist-linked FCP plans must use `source_finding_ids`, not `exact_issue_ids`');
        }
    }

    const requiredFields = [
        '`package_id`',
        '`checklist_token`',
        packageIssueField,
        '`slice_table`',
        '`coverage_check`',
        '`recommended_slice_order`',
        '`parallel_execution_policy`',
    ];

    for (const field of requiredFields) {
        const hasInlineValue = parseInlineField(packageDecomposition, field) !== null;
        const hasBlockValue = extractChecklistPackageFieldBlock(packageDecomposition, field) !== null;
        if (!hasInlineValue && !hasBlockValue) {
            errors.push(`checklist-linked plans must include ${field} in \`## Package Decomposition\``);
        }
    }

    let packageSourceFindingIds = [];
    if (isFcpPackage) {
        const packageSourceFindingBlock = extractChecklistPackageFieldBlock(packageDecomposition, '`source_finding_ids`');
        packageSourceFindingIds = extractChecklistFieldValues(packageSourceFindingBlock);
        if (packageSourceFindingIds.length === 0) {
            errors.push('checklist-linked FCP plans must list at least one `source_finding_ids` value');
        }
        if (fcpSourceFindingIdRe !== null) {
            const invalidPackageSourceFinding = packageSourceFindingIds.some((id) => !fcpSourceFindingIdRe.test(id));
            if (invalidPackageSourceFinding) {
                errors.push(`checklist-linked FCP plans must use source_finding_ids matching \`${checklistToken}-SF#\``);
            }
        }
    }

    const readyNowSlice = getRequiredInlineScalarFieldValue(
        packageDecomposition,
        '`ready_now_slice`',
        errors,
        'checklist-linked plans must include `ready_now_slice` in `## Package Decomposition`',
        '`ready_now_slice` must be an inline scalar value in `## Package Decomposition`'
    );
    const readyNowState = parseInlineField(packageDecomposition, '`ready_now_state`');
    const blockedUntil = parseInlineField(packageDecomposition, '`blocked_until`');
    const hasBlockedReadyNowState = readyNowState?.toLowerCase().startsWith('blocked') === true && blockedUntil !== null;
    const readyNowSliceIsNone = readyNowSlice === 'none';
    if (readyNowSliceIsNone && !hasBlockedReadyNowState) {
        errors.push('`ready_now_slice` may be `none` only when `ready_now_state` is blocked and `blocked_until` is set');
    } else if (readyNowSlice !== null && !readyNowSliceIsNone && !sliceIdRe.test(readyNowSlice)) {
        errors.push(sliceIdError);
    }

    const sliceTableBlock = extractChecklistPackageFieldBlock(packageDecomposition, '`slice_table`', [
        '`coverage_check`',
        '`coverage_ledger`',
        '`execution_waves`',
        '`recommended_slice_order`',
        '`ready_now_slice`',
        '`ready_now_execution_unit`',
        '`parallel_execution_policy`',
    ]);
    const sliceSections = sliceTableBlock === null ? [] : getChecklistSliceSections(sliceTableBlock, sliceIdPattern);
    const declaredSliceIds = new Set(sliceSections.map((sliceSection) => sliceSection.sliceId));
    if (sliceTableBlock !== null) {
        if (sliceSections.length === 0) {
            errors.push('`slice_table` must define at least one package-scoped slice section');
        }

        if (
            readyNowSlice !== null &&
            !readyNowSliceIsNone &&
            sliceSections.length > 0 &&
            !declaredSliceIds.has(readyNowSlice)
        ) {
            errors.push('`ready_now_slice` must reference a declared `slice_table` slice');
        }

        for (const sliceSection of sliceSections) {
            const requiredSliceFields = [
                '`goal`',
                '`areas/files`',
                sliceIssueField,
                '`verification`',
                '`dependencies`',
                '`stop_condition`',
                '`handoff_condition`',
                '`parallel_justification`',
            ];

            for (const field of requiredSliceFields) {
                const hasInlineValue = parseInlineField(sliceSection.content, field) !== null;
                const hasBlockValue = extractChecklistPackageFieldBlock(sliceSection.content, field) !== null;
                if (!hasInlineValue && !hasBlockValue) {
                    errors.push(`${sliceSection.sliceId} in \`slice_table\` must include ${field}`);
                }
            }

            if (isFcpPackage) {
                const sliceSourceFindingBlock = extractChecklistPackageFieldBlock(sliceSection.content, '`source_finding_ids`');
                const sliceSourceFindingIds = extractChecklistFieldValues(sliceSourceFindingBlock);
                if (sliceSourceFindingIds.length === 0) {
                    errors.push(`${sliceSection.sliceId} in \`slice_table\` must list at least one \`source_finding_ids\` value`);
                }
                if (fcpSourceFindingIdRe !== null) {
                    const invalidSliceSourceFinding = sliceSourceFindingIds.some((id) => !fcpSourceFindingIdRe.test(id));
                    if (invalidSliceSourceFinding) {
                        errors.push(`${sliceSection.sliceId} in \`slice_table\` must use source_finding_ids matching \`${checklistToken}-SF#\``);
                    }
                }
                const unknownSliceSourceFinding = sliceSourceFindingIds.some((id) => !packageSourceFindingIds.includes(id));
                if (unknownSliceSourceFinding) {
                    errors.push(`${sliceSection.sliceId} in \`slice_table\` must use source_finding_ids declared at package level`);
                }
            }

            const hasSerialOnly = parseInlineField(sliceSection.content, '`serial_only`') !== null;
            const hasParallelGroup = parseInlineField(sliceSection.content, '`parallel_group`') !== null;
            if (!hasSerialOnly && !hasParallelGroup) {
                errors.push(`${sliceSection.sliceId} in \`slice_table\` must include either \`serial_only\` or \`parallel_group\``);
            } else if (hasSerialOnly && hasParallelGroup) {
                errors.push(`${sliceSection.sliceId} in \`slice_table\` cannot include both \`serial_only\` and \`parallel_group\``);
            }
        }
    }

    const readyNowExecutionUnit = getRequiredInlineScalarFieldValue(
        packageDecomposition,
        '`ready_now_execution_unit`',
        errors,
        'checklist-linked plans must include `ready_now_execution_unit` in `## Package Decomposition`',
        '`ready_now_execution_unit` must be an inline scalar value in `## Package Decomposition`'
    );
    const readyNowExecutionUnitIsNone = readyNowExecutionUnit === 'none';
    const hasBlockedReadyNowPointers = hasBlockedReadyNowState &&
        readyNowSliceIsNone &&
        readyNowExecutionUnitIsNone;
    if (readyNowExecutionUnitIsNone && !hasBlockedReadyNowState) {
        errors.push('`ready_now_execution_unit` may be `none` only when `ready_now_state` is blocked and `blocked_until` is set');
    }
    const hasMixedBlockedReadyNowPointers = hasBlockedReadyNowState &&
        (readyNowSliceIsNone || readyNowExecutionUnitIsNone) &&
        !hasBlockedReadyNowPointers;
    if (hasMixedBlockedReadyNowPointers) {
        errors.push('blocked ready-now plans must set both `ready_now_slice` and `ready_now_execution_unit` to `none`');
    }
    const shouldValidateReadyNowGraph = !hasMixedBlockedReadyNowPointers;
    const executionWavesBlock = extractChecklistPackageFieldBlock(packageDecomposition, '`execution_waves`');
    const isWaveScoped = executionWavesBlock !== null || (
        shouldValidateReadyNowGraph &&
        readyNowExecutionUnit !== null &&
        readyNowSlice !== null &&
        !hasBlockedReadyNowPointers &&
        readyNowExecutionUnit !== readyNowSlice
    );

    if (isWaveScoped && executionWavesBlock === null) {
        errors.push(
            'checklist-linked plans without `execution_waves` must point `ready_now_execution_unit` at the same slice as `ready_now_slice`'
        );
    }

    if (executionWavesBlock !== null) {
        const waveEntries = getExecutionWaveEntries(executionWavesBlock);
        if (waveEntries.length === 0) {
            errors.push('each `execution_waves` entry must record `absorb_now_scope` and `replan_triggers`');
        }

        for (const waveEntry of waveEntries) {
            const normalizedWaveEntry = waveEntry.content.replace(/`([^`]+)`/gu, '$1');
            const requiredWaveMarkers = ['wave_id', 'slice_ids', 'completion_condition', 'absorb_now_scope', 'replan_triggers'];
            const missingWaveMarkers = requiredWaveMarkers.filter((marker) => !normalizedWaveEntry.includes(marker));
            if (missingWaveMarkers.length > 0) {
                errors.push('each `execution_waves` entry must record `absorb_now_scope` and `replan_triggers`');
                break;
            }
        }

        if (sliceTableBlock !== null) {
            const hasUnknownWaveSliceId = waveEntries.some((waveEntry) =>
                getDeclaredExecutionWaveSliceIds(waveEntry.content, sliceIdPattern).some((sliceId) => !declaredSliceIds.has(sliceId))
            );
            if (hasUnknownWaveSliceId) {
                errors.push('`execution_waves` slice_ids must reference declared `slice_table` slices');
            }
        }

        const waveIds = waveEntries.map((entry) => entry.waveId);
        if (
            readyNowExecutionUnit !== null &&
            shouldValidateReadyNowGraph &&
            !hasBlockedReadyNowPointers &&
            waveIds.length > 0 &&
            !waveIds.includes(readyNowExecutionUnit)
        ) {
            errors.push('`ready_now_execution_unit` must match one declared `wave_id` when `execution_waves` are present');
        }
        if (
            readyNowExecutionUnit !== null &&
            readyNowSlice !== null &&
            shouldValidateReadyNowGraph &&
            !hasBlockedReadyNowPointers
        ) {
            const selectedWave = waveEntries.find((entry) => entry.waveId === readyNowExecutionUnit) ?? null;
            if (selectedWave !== null) {
                const firstDeclaredSlice = getDeclaredExecutionWaveSliceIds(selectedWave.content, sliceIdPattern)[0] ?? null;
                if (firstDeclaredSlice !== null && readyNowSlice !== firstDeclaredSlice) {
                    errors.push('`ready_now_slice` must match the first declared `slice_id` in the selected `ready_now_execution_unit` wave');
                }
            }
        }

        const coverageLedgerBlock = extractChecklistPackageFieldBlock(packageDecomposition, '`coverage_ledger`');
        if (coverageLedgerBlock === null) {
            errors.push('wave-scoped checklist-linked plans must include `coverage_ledger` in `## Package Decomposition`');
        } else {
            const normalizedLedger = coverageLedgerBlock.replace(/`([^`]+)`/gu, '$1').toLowerCase();
            if (!normalizedLedger.includes('slice_id')) {
                errors.push('`coverage_ledger` must map each existing package issue to exactly one `slice_id`');
            }
            if (!normalizedLedger.includes('execution_unit') && !normalizedLedger.includes('wave_id')) {
                errors.push('`coverage_ledger` must map each existing package issue to exactly one execution unit');
            }
            if (
                !normalizedLedger.includes('default survivor disposition') &&
                !normalizedLedger.includes('final owner') &&
                !normalizedLedger.includes('survivor disposition')
            ) {
                errors.push(
                    '`coverage_ledger` must record the default survivor disposition or final owner for any issue that survives its execution unit'
                );
            }
        }
    }

    return errors;
}

function getChecklistLinkedPackageContext(content) {
    const packageDecomposition = extractFirstMatchingMarkdownSection(content, ['Package Decomposition']);
    if (packageDecomposition === null) {
        return {
            isFcpPackage: false,
            checklistToken: null,
            sourceFindingIds: [],
        };
    }

    const checklistToken = parseInlineField(packageDecomposition, '`checklist_token`');
    const isFcpPackage = checklistToken !== null && FCP_CHECKLIST_TOKEN_RE.test(checklistToken);
    const sourceFindingIds = isFcpPackage
        ? extractChecklistFieldValues(extractChecklistPackageFieldBlock(packageDecomposition, '`source_finding_ids`'))
        : [];

    return {
        isFcpPackage,
        checklistToken,
        sourceFindingIds,
    };
}

function getPriorityExitIssueBlocks(section) {
    const lines = section.split(/\r?\n/u);
    const blocks = [];
    let currentBlock = [];

    for (const line of lines) {
        const isIssueHeader = PRIORITY_EXIT_ISSUE_HEADER_RE.test(line);
        const isTopLevelListItem = /^[ \t]*(?:[-*]|\d+\.)[ \t]+\S/u.test(line);
        const isNestedListItem = /^(?: {2,}|\t+)(?:[-*]|\d+\.)[ \t]+\S/u.test(line);

        if (isIssueHeader) {
            if (currentBlock.length > 0) {
                blocks.push(currentBlock.join('\n'));
            }
            currentBlock = [line];
            continue;
        }

        if (currentBlock.length > 0 && isTopLevelListItem && !isNestedListItem) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [];
        }

        if (currentBlock.length > 0) {
            currentBlock.push(line);
        }
    }

    if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
    }

    return blocks;
}

function getPriorityExitIssueBlockHeader(block) {
    return block.split(/\r?\n/u)[0]?.match(PRIORITY_EXIT_ISSUE_HEADER_RE)?.[1] ?? null;
}

function getPriorityExitErrors(section, { isFcpPackage = false, checklistToken = null, sourceFindingIds = [] } = {}) {
    const errors = [];
    const issueBlocks = getPriorityExitIssueBlocks(section);

    if (isFcpPackage && hasFcpForbiddenImportedEvidence(section)) {
        errors.push(`FCP priority-exit readiness must not include ${FCP_FORBIDDEN_EVIDENCE_MESSAGE}`);
    }

    if (issueBlocks.length === 0) {
        errors.push(
            isFcpPackage
                ? 'priority-exit readiness section must name each mapped FCP source_finding_id'
                : 'priority-exit readiness section must name each mapped imported issue by exact issue id'
        );
    } else {
        if (isFcpPackage) {
            const declaredSourceFindingIds = new Set(sourceFindingIds);
            const sourceFindingIdRe = checklistToken === null
                ? /^FCP-(?:\d+|EXIT)-SF\d+$/u
                : new RegExp(`^${escapeRegExp(checklistToken)}-SF\\d+$`, 'u');
            const hasInvalidSourceFindingHeader = issueBlocks.some((block) => {
                const header = getPriorityExitIssueBlockHeader(block);
                if (header === null || !sourceFindingIdRe.test(header)) {
                    return true;
                }

                return declaredSourceFindingIds.size > 0 && !declaredSourceFindingIds.has(header);
            });
            if (hasInvalidSourceFindingHeader) {
                errors.push('FCP priority-exit readiness must use declared source_finding_id headers, not imported issue ids');
            }
        }

        const missingDisposition = issueBlocks.some((block) => !PRIORITY_EXIT_DISPOSITION_RE.test(block));
        if (missingDisposition) {
            errors.push('priority-exit readiness section must record exact disposition tokens for mapped imported issues');
        }

        const deferredWithoutSingleOwner = issueBlocks.some((block) => {
            if (!PRIORITY_EXIT_DEFERRED_RE.test(block)) {
                return false;
            }

            return Array.from(block.matchAll(PRIORITY_EXIT_FINAL_OWNER_RE)).length !== 1;
        });
        if (deferredWithoutSingleOwner) {
            errors.push('priority-exit readiness must assign exactly one final owner to each deferred or split imported issue');
        }

        const deferredWithoutRevisitTrigger = issueBlocks.some((block) => {
            if (!PRIORITY_EXIT_DEFERRED_RE.test(block)) {
                return false;
            }

            return !PRIORITY_EXIT_REVISIT_TRIGGER_RE.test(block);
        });
        if (deferredWithoutRevisitTrigger) {
            errors.push('priority-exit readiness must include a revisit trigger for each deferred or split imported issue');
        }
    }

    if (
        !PRIORITY_EXIT_SECURITY_RE.test(section)
        || !PRIORITY_EXIT_SECURITY_DISPOSITION_RE.test(section)
    ) {
        errors.push('priority-exit readiness section must record a P0/security-gate disposition before the next priority advances');
    }

    if (!PRIORITY_EXIT_NEXT_PRIORITY_GATE_RE.test(section)) {
        errors.push('priority-exit readiness section must name the blocking next-priority or P#-EXIT gate');
    }

    return errors;
}

function isArchiveSectionSummaryPath(filePath) {
    return filePath.startsWith('docs/archive/plans/') && filePath.endsWith('section-summary.md');
}

function isTrackedFollowUpValue(value) {
    if (value === 'none') {
        return true;
    }

    return value
        .split(/\s*,\s*/u)
        .map((entry) => entry.replace(/^`(.+)`$/u, '$1').trim())
        .every((entry) => {
            const normalized = entry.toLowerCase();
            return /^(agents\.md|ARCHITECTURE_CLEANUP_CHECKLIST\.md|docs\/[A-Za-z0-9/_-]+(?:\.md|\/))$/u.test(entry) &&
                !normalized.startsWith('docs/runs/') &&
                !normalized.startsWith('docs/agentic/evals/baselines/');
        });
}

function isLocalHoldingConvention(value) {
    return value.startsWith('docs/runs/<date>-harness-ingestion-triage/');
}

export function parseSkillMirrorManifest(content) {
    const entries = [];

    for (const rawLine of content.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        }

        const match = line.match(/^(global):([a-z0-9][a-z0-9-]*)$/u);
        if (match === null) {
            throw new Error(`Invalid skill mirror manifest entry: ${line}`);
        }

        entries.push({
            source: match[1],
            skill: match[2],
        });
    }

    return entries;
}

export function extractChecklistPlanPaths(content) {
    return Array.from(content.matchAll(/^[^\n]*\bplan\s*:\s*(docs\/(?:plans|archive\/plans)\/[^\s),]+\.md)/gimu))
        .map((match) => match[1])
        .filter((relativePath) => !relativePath.includes('<'));
}

export function classifyChecklistPlanPathStatus({ exists, tracked }) {
    if (tracked) {
        return exists ? 'tracked' : 'missing-tracked';
    }

    return exists ? 'untracked' : 'missing-untracked';
}

export function buildChecklistPlanPathMessages(entries, { mode = 'strict' } = {}) {
    const errors = [];
    const warnings = [];
    const seenMessages = new Set();

    for (const { relativePath, status } of entries) {
        if (status === 'tracked') {
            continue;
        }

        if (status === 'missing-tracked') {
            const message = `Checklist references missing tracked plan path: ${relativePath}`;
            if (!seenMessages.has(message)) {
                seenMessages.add(message);
                if (mode === 'workspace') {
                    warnings.push(message);
                } else {
                    errors.push(message);
                }
            }
            continue;
        }

        if (status === 'missing-untracked') {
            const message = `Checklist references untracked plan path: ${relativePath} (missing from workspace and not tracked)`;
            if (!seenMessages.has(message)) {
                seenMessages.add(message);
                warnings.push(message);
            }
            continue;
        }

        const message = `Checklist references untracked plan path: ${relativePath} (exists locally but is not tracked)`;
        if (seenMessages.has(message)) {
            continue;
        }

        seenMessages.add(message);
        warnings.push(message);
    }

    return { errors, warnings };
}

export function renderSessionPromptSet(entries = SESSION_PROMPT_INVENTORY) {
    return entries
        .flatMap(({ file, linkText, description }) => [
            `- [\`${linkText}\`](./${file})`,
            `  - ${description}`,
        ])
        .join('\n');
}

export function renderEvalPromptInventory(entries = EVAL_PROMPT_INVENTORY) {
    return entries
        .flatMap(({ file, linkText, title }) => [
            `- [\`${linkText}\`](./prompts/${file})`,
            `  - ${title}`,
        ])
        .join('\n');
}

export function replaceManagedSection(content, { startMarker, endMarker, replacement }) {
    const lines = content.split(/\r?\n/u);
    const startIndex = lines.indexOf(startMarker);
    const endIndex = lines.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        throw new Error(`Managed section markers not found or invalid: ${startMarker} / ${endMarker}`);
    }

    return [
        ...lines.slice(0, startIndex + 1),
        replacement,
        ...lines.slice(endIndex),
    ].join('\n');
}

export function extractHarnessIngestionTriage(content) {
    const section = extractMarkdownSection(content, 'Harness Ingestion Triage');
    if (section === null) {
        return {
            status: null,
            recommendedAction: null,
            why: null,
            trackedFollowUp: null,
            localOnlyHoldingNote: null,
            revisitTrigger: null,
            errors: ['missing required section: Harness Ingestion Triage'],
        };
    }

    const triage = {
        status: parseInlineField(section, 'status'),
        recommendedAction: parseInlineField(section, 'recommended action'),
        why: parseInlineField(section, 'why'),
        trackedFollowUp: parseInlineField(section, 'tracked follow-up'),
        localOnlyHoldingNote: parseInlineField(section, 'local-only holding note'),
        revisitTrigger: parseInlineField(section, 'revisit trigger'),
        errors: [],
    };

    if (triage.status === null) {
        triage.errors.push('missing required triage field: status');
    } else if (!HARNESS_INGESTION_TRIAGE_STATUSES.includes(triage.status)) {
        triage.errors.push(
            `invalid harness-ingestion triage status: ${triage.status} (expected one of: ${HARNESS_INGESTION_TRIAGE_STATUSES.join(', ')})`
        );
    }

    if (triage.recommendedAction === null) {
        triage.errors.push('missing required triage field: recommended action');
    } else if (!HARNESS_INGESTION_TRIAGE_ACTIONS.includes(triage.recommendedAction)) {
        triage.errors.push(
            `invalid harness-ingestion recommended action: ${triage.recommendedAction} (expected one of: ${HARNESS_INGESTION_TRIAGE_ACTIONS.join(', ')})`
        );
    }

    if (triage.why === null || triage.why.length === 0) {
        triage.errors.push('missing required triage field: why');
    }

    if (triage.trackedFollowUp === null || triage.trackedFollowUp.length === 0) {
        triage.errors.push('missing required triage field: tracked follow-up');
    } else if (!isTrackedFollowUpValue(triage.trackedFollowUp)) {
        triage.errors.push(
            'harness-ingestion tracked follow-up must point at tracked docs (or `none`), not local-only artifacts'
        );
    }

    if (triage.localOnlyHoldingNote === null || triage.localOnlyHoldingNote.length === 0) {
        triage.errors.push('missing required triage field: local-only holding note');
    }

    if (triage.revisitTrigger === null || triage.revisitTrigger.length === 0) {
        triage.errors.push('missing required triage field: revisit trigger');
    }

    if (triage.errors.length > 0) {
        return triage;
    }

    if (triage.status === 'none') {
        if (triage.recommendedAction !== 'none') {
            triage.errors.push('status `none` must keep recommended action set to `none`');
        }
        if (triage.trackedFollowUp !== 'none') {
            triage.errors.push('status `none` must keep tracked follow-up set to `none`');
        }
        if (triage.localOnlyHoldingNote !== 'none') {
            triage.errors.push('status `none` must keep local-only holding note set to `none`');
        }
        if (triage.revisitTrigger !== 'none') {
            triage.errors.push('status `none` must keep revisit trigger set to `none`');
        }
        return triage;
    }

    if (triage.recommendedAction === 'none') {
        triage.errors.push('non-`none` harness-ingestion status must name a non-`none` recommended action');
    }

    if (triage.status === 'deferred') {
        if (!isLocalHoldingConvention(triage.localOnlyHoldingNote)) {
            triage.errors.push(
                'deferred harness-ingestion triage must point at the local-only holding-note convention under docs/runs/<date>-harness-ingestion-triage/'
            );
        }
        if (triage.revisitTrigger === 'none') {
            triage.errors.push('deferred harness-ingestion triage must name a non-`none` revisit trigger');
        }
        return triage;
    }

    if (triage.trackedFollowUp === 'none') {
        triage.errors.push(
            `status \`${triage.status}\` with recommended action \`${triage.recommendedAction}\` must name tracked follow-up docs`
        );
    }

    return triage;
}

export function checkArchiveSectionSummaryConformance({ filePath, content }) {
    if (!isArchiveSectionSummaryPath(filePath)) {
        return {
            filePath,
            isSectionSummary: false,
            errors: [],
            triage: null,
        };
    }

    const triage = extractHarnessIngestionTriage(content);
    return {
        filePath,
        isSectionSummary: true,
        errors: triage.errors,
        triage,
    };
}

export function buildHarnessIngestionReport(entries) {
    const actionableEntries = entries.filter(({ status }) => status === 'pending' || status === 'deferred');
    if (actionableEntries.length === 0) {
        return 'No archived section summaries currently require harness-ingestion follow-up.';
    }

    return [
        'Pending harness-ingestion follow-up:',
        ...actionableEntries.flatMap((entry) => {
            const lines = [
                `- ${entry.filePath} :: ${entry.status} :: ${entry.recommendedAction} :: ${entry.trackedFollowUp}`,
                `  Why: ${entry.why}`,
            ];
            if (entry.status === 'deferred') {
                lines.push(`  Local-only note: ${entry.localOnlyHoldingNote}`);
                lines.push(`  Revisit: ${entry.revisitTrigger}`);
            }
            return lines;
        }),
    ].join('\n');
}

export function checkPlanConformance({ filePath, content }) {
    const fileName = filePath.split('/').pop() ?? filePath;
    const hasActiveMarker = hasActivePlanMarker(content);
    const isSerious =
        fileName !== 'README.md' &&
        !fileName.includes('risk-register') &&
        filePath.startsWith('docs/plans/') &&
        hasActiveMarker;

    if (!isSerious) {
        return {
            filePath,
            isSerious: false,
            missingSections: [],
            errors: [],
        };
    }

    const missingSections = PLAN_SECTION_RULES.filter(
        (rule) => extractPlanSectionContent(content, rule) === null
    ).map(({ label }) => label);

    const errors = [];
    const taskFamilyMatch = content.match(/^\*\*Task family:\*\*\s*(.+?)\s*$/imu);
    const taskFamily = taskFamilyMatch?.[1]?.trim() ?? null;
    if (taskFamily === null) {
        errors.push('missing required plan classification field: **Task family:**');
    } else if (!VALID_TASK_FAMILIES.has(taskFamily)) {
        errors.push(
            `invalid task family classification: ${taskFamily} (expected one of: ${Array.from(VALID_TASK_FAMILIES).join(', ')})`
        );
    }

    const cleanupSubtypeMatch = content.match(/^\*\*Cleanup subtype:\*\*\s*(.+?)\s*$/imu);
    const cleanupSubtype = cleanupSubtypeMatch?.[1]?.trim() ?? null;
    if (taskFamily === 'cleanup/refactor') {
        if (cleanupSubtype === null) {
            errors.push('cleanup/refactor plans must declare **Cleanup subtype:**');
        } else if (!VALID_CLEANUP_SUBTYPES.has(cleanupSubtype)) {
            errors.push(
                `invalid cleanup subtype classification: ${cleanupSubtype} (expected one of: ${Array.from(VALID_CLEANUP_SUBTYPES).join(', ')})`
            );
        }
    } else if (taskFamily === 'feature/design' && cleanupSubtype !== null) {
        errors.push('feature/design plans must not declare **Cleanup subtype:**');
    } else if (cleanupSubtype !== null && taskFamily !== null) {
        errors.push('**Cleanup subtype:** is only valid when **Task family:** is cleanup/refactor');
    }

    const checklistPackageContext = taskFamily === 'cleanup/refactor' && cleanupSubtype === 'checklist-linked'
        ? getChecklistLinkedPackageContext(content)
        : null;

    if (taskFamily === 'cleanup/refactor' && cleanupSubtype === 'checklist-linked') {
        errors.push(...getChecklistLinkedPackagePlanErrors(content));
    }

    for (const rule of PLAN_SECTION_CONTENT_RULES) {
        const section = extractPlanSectionContent(content, rule);
        if (section !== null && section.trim().length === 0) {
            errors.push(rule.error);
        }
    }

    const filesInScope = extractPlanSectionContent(content, {
        patterns: [/^## Files In Scope$/im, /^## Allowed File Changes$/im],
    });
    if (filesInScope !== null && !PLAN_LIST_ENTRY_RE.test(filesInScope)) {
        errors.push('files in scope section must contain at least one concrete entry');
    }

    const filesOutOfScope = extractPlanSectionContent(content, {
        patterns: [/^## Files Out Of Scope$/im],
    });
    if (filesOutOfScope !== null && !PLAN_LIST_ENTRY_RE.test(filesOutOfScope)) {
        errors.push('files out of scope section must contain at least one concrete entry');
    }

    const requiredSkills = extractPlanSectionContent(content, {
        patterns: [/^## Required Skills$/im, /^\*\*Required Skills:\*\*/im],
    });
    if (requiredSkills !== null) {
        if (!/\bexecution-plan-authoring\b/u.test(requiredSkills)) {
            errors.push('required skills section must include `execution-plan-authoring` for active serious plans');
        }
        if (/\bwriting-plans\b/u.test(requiredSkills)) {
            errors.push('required skills section must not include legacy `writing-plans` for active serious plans');
        }
    }

    const verificationCommands = extractPlanSectionContent(content, {
        patterns: [/^## Verification Commands$/im],
    });
    if (verificationCommands !== null) {
        if (!hasExactVerificationClassificationMarker(verificationCommands)) {
            errors.push('verification commands section must classify verification strategy with one exact plan-standard marker');
        }
        if (!PLAN_RUN_LINE_RE.test(verificationCommands)) {
            errors.push('verification commands section must contain at least one command-looking `Run:` line');
        }
        if (!PLAN_EXPECTED_LINE_RE.test(verificationCommands)) {
            errors.push('verification commands section must contain at least one expected-result `Expected:` line');
        }
    }

    const priorityExitReadiness = extractFirstMatchingMarkdownSection(content, ['Priority-Exit Readiness']);
    if (priorityExitReadiness !== null) {
        if (priorityExitReadiness.trim().length === 0) {
            errors.push('priority-exit readiness section must contain substantive content when present');
        } else {
            errors.push(...getPriorityExitErrors(priorityExitReadiness, checklistPackageContext ?? undefined));
        }
    }

    return {
        filePath,
        isSerious: true,
        missingSections,
        errors,
        taskFamily,
        cleanupSubtype,
    };
}

export function hasActivePlanMarker(content) {
    const lines = content.split(/\r?\n/u);
    let fenceChar = null;

    for (const line of lines) {
        const trimmedEnd = line.trimEnd();
        const trimmedStart = trimmedEnd.trimStart();

        if (/^(?: {4}|\t)/u.test(line)) {
            continue;
        }

        const fenceMatch = /^(?<fence>`{3,}|~{3,})/u.exec(trimmedStart);
        if (fenceMatch !== null) {
            const nextFenceChar = fenceMatch.groups?.fence?.[0] ?? null;
            fenceChar = fenceChar === nextFenceChar ? null : nextFenceChar;
            continue;
        }

        if (fenceChar !== null) {
            continue;
        }

        if (/^##\s+/u.test(trimmedStart)) {
            break;
        }

        if (trimmedEnd === ACTIVE_PLAN_MARKER) {
            return true;
        }
    }

    return false;
}
