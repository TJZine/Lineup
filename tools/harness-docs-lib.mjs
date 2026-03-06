export const SKILL_MIRROR_MANIFEST_PATH = 'docs/agentic/skill-mirror-allowlist.txt';

export const EXPECTED_SESSION_PROMPT_FILES = [
    'cleanup-plan.md',
    'cleanup-implement.md',
    'cleanup-review.md',
    'cleanup-loop.md',
    'workflow-harness-review.md',
];

export const EXPECTED_EVAL_PROMPT_FILES = [
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
    '12-architecture-doc-refresh.md',
    '13-risk-tiered-orchestration-and-local-only-absorption.md',
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
