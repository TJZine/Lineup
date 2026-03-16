export const SKILL_MIRROR_MANIFEST_PATH = 'docs/agentic/skill-mirror-allowlist.txt';

export const SESSION_PROMPT_SET_START_MARKER = '<!-- BEGIN MANAGED SESSION PROMPT SET -->';
export const SESSION_PROMPT_SET_END_MARKER = '<!-- END MANAGED SESSION PROMPT SET -->';
export const EVAL_PROMPT_INVENTORY_START_MARKER = '<!-- BEGIN MANAGED EVAL PROMPT INVENTORY -->';
export const EVAL_PROMPT_INVENTORY_END_MARKER = '<!-- END MANAGED EVAL PROMPT INVENTORY -->';

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
        description: 'Tier 3 controller session for high-risk work',
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

function parseInlineField(section, label) {
    const pattern = new RegExp(`^- ${escapeRegExp(label)}:\\s*(.+)$`, 'mu');
    const match = pattern.exec(section);
    if (match === null) {
        return null;
    }

    return match[1].trim().replace(/`([^`]+)`/gu, '$1').trim();
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

        const match = line.match(/^(superpowers|global):([a-z0-9][a-z0-9-]*)$/u);
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
    return Array.from(content.matchAll(/plan:\s*(docs\/(?:plans|archive\/plans)\/[^\s)]+\.md)/gu))
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
    const isSerious = fileName !== 'README.md' && !fileName.includes('risk-register');

    if (!isSerious) {
        return {
            filePath,
            isSerious: false,
            missingSections: [],
        };
    }

    const missingSections = PLAN_SECTION_RULES.filter(
        ({ patterns }) => !patterns.some((pattern) => pattern.test(content))
    ).map(({ label }) => label);

    return {
        filePath,
        isSerious: true,
        missingSections,
    };
}
