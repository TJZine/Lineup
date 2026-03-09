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
];

export const EXPECTED_SESSION_PROMPT_FILES = SESSION_PROMPT_INVENTORY.map(({ file }) => file);
export const EXPECTED_EVAL_PROMPT_FILES = EVAL_PROMPT_INVENTORY.map(({ file }) => file);

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
