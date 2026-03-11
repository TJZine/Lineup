import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const verifierPath = path.resolve(process.cwd(), 'tools/verify-docs.mjs');

type PromptInventories = {
    expectedEvalPromptFiles: string[];
    expectedSessionPromptFiles: string[];
    skillMirrorManifestPath: string;
    sessionPromptSetStartMarker: string;
    sessionPromptSetEndMarker: string;
    evalPromptInventoryStartMarker: string;
    evalPromptInventoryEndMarker: string;
    renderedSessionPromptSet: string;
    renderedEvalPromptInventory: string;
};

function loadPromptInventoriesFromHarnessDocsLib(): PromptInventories {
    const harnessDocsLibPath = path.resolve(process.cwd(), 'tools/harness-docs-lib.mjs');
    const harnessDocsLibUrl = pathToFileURL(harnessDocsLibPath).href;
    const script = [
        `const lib = await import(${JSON.stringify(harnessDocsLibUrl)});`,
        'const payload = {',
        '  expectedEvalPromptFiles: lib.EXPECTED_EVAL_PROMPT_FILES,',
        '  expectedSessionPromptFiles: lib.EXPECTED_SESSION_PROMPT_FILES,',
        '  skillMirrorManifestPath: lib.SKILL_MIRROR_MANIFEST_PATH,',
        '  sessionPromptSetStartMarker: lib.SESSION_PROMPT_SET_START_MARKER,',
        '  sessionPromptSetEndMarker: lib.SESSION_PROMPT_SET_END_MARKER,',
        '  evalPromptInventoryStartMarker: lib.EVAL_PROMPT_INVENTORY_START_MARKER,',
        '  evalPromptInventoryEndMarker: lib.EVAL_PROMPT_INVENTORY_END_MARKER,',
        '  renderedSessionPromptSet: lib.renderSessionPromptSet(),',
        '  renderedEvalPromptInventory: lib.renderEvalPromptInventory(),',
        '};',
        'console.log(JSON.stringify(payload));',
    ].join('\n');

    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        const errorOutput = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
        throw new Error(`Failed to load expected prompt inventories from harness-docs-lib.mjs: ${errorOutput}`);
    }

    const parsed = JSON.parse(result.stdout) as PromptInventories;
    return parsed;
}

const {
    expectedEvalPromptFiles,
    expectedSessionPromptFiles,
    skillMirrorManifestPath,
    sessionPromptSetStartMarker,
    sessionPromptSetEndMarker,
    evalPromptInventoryStartMarker,
    evalPromptInventoryEndMarker,
    renderedSessionPromptSet,
    renderedEvalPromptInventory,
} = loadPromptInventoriesFromHarnessDocsLib();

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
    skillMirrorManifestPath,
];

function writeRepoFile(repoRoot: string, relativePath: string, content = '# Placeholder\n'): void {
    const fullPath = path.join(repoRoot, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
}

function writeValidSkillMirrorFixture(repoRoot: string): void {
    writeRepoFile(repoRoot, skillMirrorManifestPath, 'superpowers:brainstorming\n');
    writeRepoFile(
        repoRoot,
        'docs/agentic/skill-strategy.md',
        [
            '# Skill Strategy',
            '',
            `Tracked mirror allowlist: ${skillMirrorManifestPath}`,
            '',
            '- `brainstorming`',
            '',
        ].join('\n')
    );
    writeRepoFile(
        repoRoot,
        'scripts/sync_agent_skills.sh',
        `#!/usr/bin/env bash\nskill_manifest_path="${skillMirrorManifestPath}"\n`
    );
}

function writeValidSessionPromptFixture(repoRoot: string): void {
    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/README.md',
        [
            '# Session Prompt Launchers',
            '',
            '## Prompt Set',
            '',
            sessionPromptSetStartMarker,
            renderedSessionPromptSet,
            sessionPromptSetEndMarker,
            '',
            '## Routing (Authoritative)',
            '',
            '| Task Type | Use This Path | Prompt Family | Notes |',
            '|---|---|---|---|',
            '| cleanup/refactor | checklist cleanup | `cleanup-*` | Tier 3 uses cleanup-loop. |',
            '| feature/design | net-new capability | `feature-plan` + `feature-implement` + `feature-review` | Tier 2 feature flow uses tracked launchers. |',
            '| mixed | split slices explicitly | route by primary intent | Keep cleanup scoped to cleanup work. |',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/AGENTIC_DEV_WORKFLOW.md',
        [
            '# Workflow',
            '',
            'Route task family before choosing a tier.',
            '',
            'A final `P#-W#` plan must include a `Priority-exit readiness` section, assign a single final owner to each deferred or split follow-up item, and record any exact `P0` security issue ids before starting or planning the next priority.',
            'No `P(n+1)` checklist item, plan, or implementation work may open while `P#-EXIT` is unresolved.',
            '',
            '[cleanup-plan](./agentic/session-prompts/cleanup-plan.md)',
            '[cleanup-review](./agentic/session-prompts/cleanup-review.md)',
            '[feature-plan](./agentic/session-prompts/feature-plan.md)',
            '[feature-implement](./agentic/session-prompts/feature-implement.md)',
            '[feature-review](./agentic/session-prompts/feature-review.md)',
            '',
            'Feature Tier 2 work should use planner (`feature-plan`) -> reviewer (`feature-review`) -> implementer (`feature-implement`) -> reviewer (`feature-review`).',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'ARCHITECTURE_CLEANUP_CHECKLIST.md',
        [
            '# Checklist',
            '',
            '## Execution Hygiene',
            '',
            '- Disposition vocabulary:',
            '  - `owned follow-up`: assign one single final owner.',
            '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
            '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
            '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
            '- Cleanup slice execution template:',
            '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
            '- Priority exit command checklist:',
            '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
            '',
            '- [ ] `P1-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P2-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P3-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P4-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P5-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P6-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P7-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [ ] `P8-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/plan-authoring-standard.md',
        [
            '# Plan Standard',
            '',
            '- The exact `P#-EXIT` checklist update must be named.',
            '- Every deferred item needs an exact issue id, a single final owner, and a revisit trigger.',
            '',
        ].join('\n')
    );

    for (const prompt of expectedSessionPromptFiles) {
        writeRepoFile(repoRoot, `docs/agentic/session-prompts/${prompt}`);
    }

    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/cleanup-plan.md',
        [
            '# Cleanup Plan (Fixture)',
            '',
            '- Include `Priority-exit readiness` when the plan claims priority closeout.',
            '- Assign a single final owner to every deferred or split follow-up item.',
            '- Record exact `P0` security issue ids and the `P#-EXIT` checklist update.',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/cleanup-implement.md',
        [
            '# Cleanup Implement (Fixture)',
            '',
            '- Prepare the `P#-EXIT` evidence and checklist update in the same pass.',
            '- Include any deferred or split items with their exact issue id, single final owner, and reason and revisit trigger.',
            '- Ask for a `priority-exit review` when the task closes a priority and do not start `P(n+1)` work in the same session.',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/cleanup-review.md',
        [
            '# Cleanup Review (Fixture)',
            '',
            '- `owned follow-up` means one single final owner.',
            '- Every deferred item needs a revisit trigger.',
            '- `security triage` must say `no open P0 security findings` or list the exact `P0` security issue ids still open/deferred.',
            '- A `priority-exit review` must ensure no `P(n+1)` plan or implementation work is being approved while `P#-EXIT` is still unresolved.',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/feature-implement.md',
        [
            '# Feature Implement (Fixture)',
            '',
            '- Support approved-plan execution and remediation/fix execution.',
            '- Use the handoff ARTIFACT as the fix-session input for listed implementation defects.',
            '- If the findings show planning or decision defects, send the work back to `lineup-feature-plan` before coding.',
            '- For the outgoing review handoff, set ARTIFACT to the patched implementation artifact or diff target so review inspects the actual changes.',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/feature-review.md',
        [
            '# Feature Review (Fixture)',
            '',
            '- Route planning or boundary defects to `lineup-feature-plan`.',
            '- Route localized implementation defects to `lineup-feature-implement`.',
            '- Include the findings artifact in `ARTIFACT` for the next session.',
            '',
        ].join('\n')
    );
}

function writeValidEvalPromptFixture(repoRoot: string): void {
    writeRepoFile(
        repoRoot,
        'docs/agentic/evals/README.md',
        [
            '# Agent Evals',
            '',
            '## Prompt Inventory',
            '',
            evalPromptInventoryStartMarker,
            renderedEvalPromptInventory,
            evalPromptInventoryEndMarker,
            '',
        ].join('\n')
    );
}

function writeMutatedEvalPromptFixture(repoRoot: string): void {
    const mutatedEvalPromptInventory = renderedEvalPromptInventory.replace(
        /11 Plex Subtitle Policy/u,
        '11 Plex Subtitle Policy (MUTATED)'
    );
    expect(mutatedEvalPromptInventory).toContain('(MUTATED)');

    writeRepoFile(
        repoRoot,
        'docs/agentic/evals/README.md',
        [
            '# Agent Evals',
            '',
            '## Prompt Inventory',
            '',
            evalPromptInventoryStartMarker,
            mutatedEvalPromptInventory,
            evalPromptInventoryEndMarker,
            '',
        ].join('\n')
    );
}

function writeRoleWorkflowClaimFixture(repoRoot: string): void {
    const workflowPath = path.join(repoRoot, 'docs/AGENTIC_DEV_WORKFLOW.md');
    const existingWorkflow = readFileSync(workflowPath, 'utf8').trimEnd();
    const roleSection = [
        '## Multi-Agent Usage',
        '',
        '- Repo-defined Codex roles are tracked in `.codex/config.toml`.',
        '- Role configs live under `.codex/agents/*.toml`.',
        '',
    ].join('\n');

    if (existingWorkflow.includes(roleSection.trim())) {
        return;
    }

    writeRepoFile(
        repoRoot,
        'docs/AGENTIC_DEV_WORKFLOW.md',
        [
            existingWorkflow,
            '',
            roleSection,
        ].join('\n')
    );
}

const CODEX_MODEL_SPARK = 'gpt-5.3-codex-spark';
const CODEX_MODEL_DEFAULT = 'gpt-5.3-codex';
const CODEX_MODEL_FALLBACK = 'gpt-5.1-codex-max';
const CODEX_MODEL_MONITOR_FALLBACK = 'gpt-5.1';

function writeValidCodexRoleConfigFixture(
    repoRoot: string,
    overrides: { maxDepth?: number } = {}
): void {
    const maxDepth = overrides.maxDepth ?? 1;
    writeRepoFile(
        repoRoot,
        '.codex/config.toml',
        [
            '[agents]',
            'max_threads = 4',
            `max_depth = ${maxDepth}`,
            '',
            '[agents.explorer]',
            'description = "Explorer"',
            'config_file = "agents/explorer.toml"',
            '',
            '[agents.explorer_fallback]',
            'description = "Explorer fallback"',
            'config_file = "agents/explorer-fallback.toml"',
            '',
            '[agents.reviewer]',
            'description = "Reviewer"',
            'config_file = "agents/reviewer.toml"',
            '',
            '[agents.docs_researcher]',
            'description = "Docs researcher"',
            'config_file = "agents/docs-researcher.toml"',
            '',
            '[agents.worker]',
            'description = "Worker"',
            'config_file = "agents/worker.toml"',
            '',
            '[agents.monitor]',
            'description = "Monitor"',
            'config_file = "agents/monitor.toml"',
            '',
            '[agents.monitor_fallback]',
            'description = "Monitor fallback"',
            'config_file = "agents/monitor-fallback.toml"',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        '.codex/agents/explorer.toml',
        `model = "${CODEX_MODEL_SPARK}"\nsandbox_mode = "read-only"\n`
    );
    writeRepoFile(
        repoRoot,
        '.codex/agents/explorer-fallback.toml',
        `model = "${CODEX_MODEL_FALLBACK}"\nsandbox_mode = "read-only"\n`
    );
    writeRepoFile(
        repoRoot,
        '.codex/agents/reviewer.toml',
        `model = "${CODEX_MODEL_DEFAULT}"\nsandbox_mode = "read-only"\n`
    );
    writeRepoFile(
        repoRoot,
        '.codex/agents/docs-researcher.toml',
        `model = "${CODEX_MODEL_DEFAULT}"\nsandbox_mode = "read-only"\n`
    );
    writeRepoFile(repoRoot, '.codex/agents/worker.toml', `model = "${CODEX_MODEL_DEFAULT}"\n`);
    writeRepoFile(
        repoRoot,
        '.codex/agents/monitor.toml',
        `model = "${CODEX_MODEL_SPARK}"\nsandbox_mode = "read-only"\n`
    );
    writeRepoFile(
        repoRoot,
        '.codex/agents/monitor-fallback.toml',
        `model = "${CODEX_MODEL_MONITOR_FALLBACK}"\nsandbox_mode = "read-only"\n`
    );
}

function createRepoFixture(
    overrides: Partial<Record<string, string>> = {},
): string {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-'));

    for (const file of requiredFiles) {
        writeRepoFile(repoRoot, file);
    }

    writeRepoFile(repoRoot, 'docs/runs/_template/Plan.md');
    writeRepoFile(repoRoot, 'docs/runs/_template/Prompt.md');
    writeRepoFile(repoRoot, 'docs/runs/_template/Implement.md');
    writeRepoFile(repoRoot, 'docs/runs/_template/Documentation.md');
    writeRepoFile(repoRoot, 'docs/development/setup.md');
    writeRepoFile(repoRoot, 'docs/development/debugging.md');
    writeRepoFile(repoRoot, 'docs/development/subtitles.md');
    writeRepoFile(repoRoot, 'docs/development/testing.md');
    writeValidSkillMirrorFixture(repoRoot);
    writeValidSessionPromptFixture(repoRoot);
    writeValidEvalPromptFixture(repoRoot);

    for (const prompt of expectedEvalPromptFiles) {
        writeRepoFile(repoRoot, `docs/agentic/evals/prompts/${prompt}`);
    }

    for (const [relativePath, content] of Object.entries(overrides)) {
        writeRepoFile(repoRoot, relativePath, content);
    }

    runGit(['init', '-q'], repoRoot);
    runGit(['config', 'user.email', 'verify-docs@test.local'], repoRoot);
    runGit(['config', 'user.name', 'Verify Docs Test'], repoRoot);
    runGit(['add', '.'], repoRoot);

    return repoRoot;
}

function runVerifier(
    repoRoot: string,
    args: string[] = [],
    env: NodeJS.ProcessEnv | undefined = undefined
): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [verifierPath, ...args], {
        cwd: repoRoot,
        encoding: 'utf8',
        env,
    });
}

function runGit(args: string[], repoRoot: string, env: NodeJS.ProcessEnv | undefined = undefined): void {
    const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', env });
    if (result.error || result.status !== 0) {
        throw new Error(
            `git ${args.join(' ')} failed (status=${result.status ?? 'unknown'}):\n` +
            `stdout:\n${String(result.stdout)}\n\nstderr:\n${String(result.stderr)}`
        );
    }
}

describe('verify-docs', () => {
    const tempRoots: string[] = [];

    afterEach(() => {
        for (const tempRoot of tempRoots.splice(0)) {
            chmodSync(path.join(tempRoot, 'docs/AGENTIC_DEV_WORKFLOW.md'), 0o644);
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('fails when docs/development/testing.md contains a broken tracked link', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\n[Broken](./missing-guide.md)\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('docs/development/testing.md');
        expect(result.stderr).toContain('./missing-guide.md');
    });

    it('fails when eval README managed prompt-inventory section is out of sync', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeMutatedEvalPromptFixture(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Eval README managed prompt-inventory section is out of sync');
    });

    it('fails when a tracked doc links to a local-only run artifact', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\n[Local run](../runs/2026-03-06-smoke/Plan.md)\n',
            'docs/runs/2026-03-06-smoke/Plan.md': '# Local run artifact\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('local-only');
        expect(result.stderr).toContain('docs/development/testing.md');
    });

    it('fails when one tracked doc contains multiple raw local-only baseline references', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': [
                '# Testing',
                '',
                'First raw artifact: docs/agentic/evals/baselines/2026-03-06-a.md',
                'Second raw artifact: docs/agentic/evals/baselines/2026-03-06-b.md',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('docs/agentic/evals/baselines/2026-03-06-a.md');
        expect(result.stderr).toContain('docs/agentic/evals/baselines/2026-03-06-b.md');
    });

    it('allows placeholder local-only paths that do not point to concrete artifacts', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': [
                '# Testing',
                '',
                '- Keep raw artifacts local-only under `docs/agentic/evals/baselines/<run-id>.md`.',
                '- Keep run bundles local-only under `docs/runs/<date>-<topic>/Plan.md`.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('allows links to tracked docs/runs template surfaces', () => {
        const repoRoot = createRepoFixture({
            'docs/runs/README.md': '# Runs\n\n[Template](./_template)\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when a tracked markdown file cannot be read', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        chmodSync(path.join(repoRoot, 'docs/AGENTIC_DEV_WORKFLOW.md'), 0);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('read');
        expect(result.stderr).toContain('docs/AGENTIC_DEV_WORKFLOW.md');
    });

    it('fails when docs/runs/_template is missing', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        rmSync(path.join(repoRoot, 'docs/runs/_template'), { recursive: true, force: true });

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Missing required control-plane directory: docs/runs/_template');
    });

    it('fails when workflow claims tracked codex roles but .codex/config.toml is missing', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Missing tracked Codex role config: .codex/config.toml');
    });

    it('passes the routing checks when role workflow claims are layered onto an otherwise valid workflow fixture', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when only workflow-harness-review documents tracked codex roles and .codex/config.toml is missing', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/workflow-harness-review.md': [
                '# Workflow Harness Review',
                '',
                '- Inspect `.codex/config.toml` and `.codex/agents/` as tracked control-plane surfaces.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Missing tracked Codex role config: .codex/config.toml');
    });

    it('fails when codex role workflow markers are split across tracked workflow docs and .codex/config.toml is missing', () => {
        const repoRoot = createRepoFixture({
            'docs/AGENTIC_DEV_WORKFLOW.md': [
                '# Workflow',
                '',
                'Route task family before choosing a tier.',
                '',
                '[cleanup-plan](./agentic/session-prompts/cleanup-plan.md)',
                '[cleanup-review](./agentic/session-prompts/cleanup-review.md)',
                '[feature-plan](./agentic/session-prompts/feature-plan.md)',
                '[feature-implement](./agentic/session-prompts/feature-implement.md)',
                '[feature-review](./agentic/session-prompts/feature-review.md)',
                '',
                'Feature Tier 2 work should use planner (`feature-plan`) -> reviewer (`feature-review`) -> implementer (`feature-implement`) -> reviewer (`feature-review`).',
                '',
                '- Repo-defined Codex roles are tracked in `.codex/config.toml`.',
                '',
            ].join('\n'),
            'docs/agentic/session-prompts/workflow-harness-review.md': [
                '# Workflow Harness Review',
                '',
                '- Inspect the tracked role files under `.codex/agents/` during harness audits.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Missing tracked Codex role config: .codex/config.toml');
    });

    it('fails when a declared codex role config_file path does not exist', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        rmSync(path.join(repoRoot, '.codex/agents/monitor-fallback.toml'));

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role config file declared in .codex/config.toml is missing: .codex/agents/monitor-fallback.toml'
        );
    });

    it('fails when required codex roles are missing from tracked config', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/config.toml',
            [
                '[agents]',
                'max_threads = 4',
                'max_depth = 1',
                '',
                '[agents.explorer]',
                'description = "Explorer"',
                'config_file = "agents/explorer.toml"',
                '',
                '[agents.worker]',
                'description = "Worker"',
                'config_file = "agents/worker.toml"',
                '',
            ].join('\n')
        );
        writeRepoFile(repoRoot, '.codex/agents/explorer.toml', 'model = "gpt-5.3-codex-spark"\n');
        writeRepoFile(repoRoot, '.codex/agents/worker.toml', 'model = "gpt-5.3-codex"\n');

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Missing required Codex agent role declarations in .codex/config.toml');
        expect(result.stderr).toContain('explorer_fallback');
        expect(result.stderr).toContain('monitor_fallback');
    });

    it('fails when a declared codex role config file exists locally but is not tracked', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);
        runGit(['rm', '--cached', '.codex/agents/monitor.toml'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role config file declared in .codex/config.toml is not tracked: .codex/agents/monitor.toml'
        );
    });

    it('fails when a read-only codex role omits read-only sandbox_mode', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(repoRoot, '.codex/agents/reviewer.toml', 'model = "gpt-5.3-codex"\n');

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Read-only Codex role config must set sandbox_mode = "read-only": .codex/agents/reviewer.toml'
        );
    });

    it('fails when tracked codex config allows deeper nested agent spawning than repo policy', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot, { maxDepth: 2 });

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Tracked Codex role config must set agents.max_depth = 1 to preserve conservative nesting'
        );
    });

    it('ignores non-decision markdown links in the decisions index', () => {
        const repoRoot = createRepoFixture({
            'docs/decisions/README.md': [
                '# Decisions',
                '',
                '- [Real decision](./2026-03-06-real-decision.md)',
                '- [Plans README](../plans/README.md)',
                '',
            ].join('\n'),
            'docs/decisions/2026-03-06-real-decision.md': '# Real decision\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('workspace mode warns but does not fail for untracked checklist plan refs with draft content', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '- Cleanup slice execution template:',
                '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
                '- Priority exit command checklist:',
                '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
                '',
                '- [x] Example done item (plan: docs/archive/plans/example-summary.md)',
                '- [ ] Local draft item (plan: docs/plans/example-draft.md)',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
            'docs/archive/plans/example-summary.md': [
                '# Example Summary',
                '',
                'Tracked summary placeholder.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-draft.md', '# Draft scratch plan\n');

        const result = runVerifier(repoRoot, ['--workspace']);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed with warnings:');
        expect(result.stdout).toContain('docs/plans/example-draft.md');
        expect(result.stdout).not.toContain('missing required serious-plan sections');
    });

    it('strict mode warns but does not fail for untracked checklist plan refs with draft content', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '- Cleanup slice execution template:',
                '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
                '- Priority exit command checklist:',
                '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
                '',
                '- [x] Example done item (plan: docs/archive/plans/example-summary.md)',
                '- [ ] Local draft item (plan: docs/plans/example-draft.md)',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
            'docs/archive/plans/example-summary.md': [
                '# Example Summary',
                '',
                'Tracked summary placeholder.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-draft.md', '# Draft scratch plan\n');

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed with warnings:');
        expect(result.stdout).toContain('docs/plans/example-draft.md');
        expect(result.stderr).not.toContain('Checklist references untracked plan path');
    });

    it('deduplicates repeated checklist diagnostics when multiple items share one plan path', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '- Cleanup slice execution template:',
                '  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice',
                '- Priority exit command checklist:',
                '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
                '',
                '- [ ] Local draft item A (plan: docs/plans/example-draft.md)',
                '- [ ] Local draft item B (plan: docs/plans/example-draft.md)',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-draft.md', '# Draft scratch plan\n');

        const result = runVerifier(repoRoot, ['--workspace']);
        const stdout = String(result.stdout);

        expect(result.status).toBe(0);
        expect(stdout).toContain('Documentation verification passed with warnings:');
        expect(stdout.match(/example-draft\.md/g)?.length).toBe(1);
    });

    it('deduplicates tracked-plan git errors when git is unavailable', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        const missingGitBinDir = path.join(repoRoot, 'no-git-bin');
        mkdirSync(missingGitBinDir, { recursive: true });
        const env = { ...process.env, PATH: missingGitBinDir };

        const result = runVerifier(repoRoot, [], env);
        const stderr = String(result.stderr);

        expect(result.status).toBe(1);
        expect(stderr).toContain('list tracked plan files via git');
        expect(stderr.match(/list tracked plan files via git/g)?.length).toBe(1);
    });

    it('fails fast when git fixture bootstrap fails', () => {
        const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-git-fail-'));
        try {
            const missingGitBinDir = path.join(repoRoot, 'no-git-bin');
            mkdirSync(missingGitBinDir, { recursive: true });
            const env = { ...process.env, PATH: missingGitBinDir };

            expect(() => runGit(['status'], repoRoot, env)).toThrow(/git status failed/u);
        } finally {
            rmSync(repoRoot, { recursive: true, force: true });
        }
    });

    it('does not emit plan-related diagnostics when tracked-plan lookup fails', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '- [ ] Local draft item (plan: docs/plans/example-draft.md)',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-draft.md', '# Draft scratch plan\n');

        const missingGitBinDir = path.join(repoRoot, 'no-git-bin');
        mkdirSync(missingGitBinDir, { recursive: true });
        const env = { ...process.env, PATH: missingGitBinDir };

        const result = runVerifier(repoRoot, [], env);
        const stderr = String(result.stderr);

        expect(result.status).toBe(1);
        expect(stderr).toContain('list tracked plan files via git');
        expect(stderr).not.toContain('Checklist references untracked plan path');
        expect(stderr).not.toContain('missing required serious-plan sections');
    });

    it('fails when an archived section summary omits the harness-ingestion triage block', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);
        writeRepoFile(
            repoRoot,
            'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
            ['# Priority 7 Example Section Summary', '', 'Tracked summary placeholder.', ''].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [x] Example done item (plan: docs/archive/plans/2026-03-11-priority-7-example-section-summary.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('harness-ingestion triage');
        expect(result.stderr).toContain('2026-03-11-priority-7-example-section-summary.md');
    });

    it('fails when an archived section summary defers harness ingestion without the local holding convention', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);
        writeRepoFile(
            repoRoot,
            'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
            [
                '# Priority 7 Example Section Summary',
                '',
                '## Harness Ingestion Triage',
                '',
                '- status: `deferred`',
                '- recommended action: `targeted-eval`',
                '- why: Interesting but not durable yet.',
                '- tracked follow-up: `none`',
                '- local-only holding note: `none`',
                '- revisit trigger: `none`',
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [x] Example done item (plan: docs/archive/plans/2026-03-11-priority-7-example-section-summary.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('local-only holding-note convention');
        expect(result.stderr).toContain('revisit trigger');
    });

    it('fails when an archived section summary requests a harness update loop without tracked follow-up paths', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);
        writeRepoFile(
            repoRoot,
            'docs/archive/plans/2026-03-11-priority-7-example-section-summary.md',
            [
                '# Priority 7 Example Section Summary',
                '',
                '## Harness Ingestion Triage',
                '',
                '- status: `pending`',
                '- recommended action: `harness-update-loop`',
                '- why: The same verifier blind spot appeared across multiple work units.',
                '- tracked follow-up: `none`',
                '- local-only holding note: `none`',
                '- revisit trigger: `none`',
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [x] Example done item (plan: docs/archive/plans/2026-03-11-priority-7-example-section-summary.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('tracked follow-up');
        expect(result.stderr).toContain('harness-update-loop');
    });

    it('fails when feature implement prompt omits the re-plan stop condition for remediation findings', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-implement.md': [
                '# Feature Implement',
                '',
                '- Use the review handoff artifact to drive a focused fix session.',
                '- Keep implementation fixes scoped to the reviewed defects.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('feature-implement prompt doc');
    });

    it('fails when feature implement only references patched artifacts outside outgoing-review handoff context', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-implement.md': [
                '# Feature Implement',
                '',
                '- Support approved-plan execution and remediation/fix execution.',
                '- Use the handoff ARTIFACT as the fix-session input for listed implementation defects.',
                '- Note: the patched diff target and reviewed commit contain the actual changes.',
                '- If the findings show planning or decision defects, send the work back to lineup-feature-plan before coding.',
                '- For the outgoing review handoff, set ARTIFACT for the next session.',
                '- Keep the fix session scoped to the listed implementation defects.',
                '- Do not widen scope while implementing remediation findings.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('points the outgoing review handoff');
    });

    it('fails when feature implement mentions lineup-feature-plan without an explicit re-plan trigger', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-implement.md': [
                '# Feature Implement',
                '',
                '- Support approved-plan execution and remediation/fix execution.',
                '- Use the handoff ARTIFACT as the fix-session input for listed implementation defects.',
                '- Read lineup-feature-plan before coding when task context is unclear.',
                '- Keep implementation fixes scoped to the listed implementation defects.',
                '- For the next review handoff, point ARTIFACT at the patched diff target rather than the old findings note.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('feature-implement prompt doc');
    });

    it('passes when feature implement outgoing handoff explicitly forbids reusing the findings artifact', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-implement.md': [
                '# Feature Implement',
                '',
                '- Support approved-plan execution and remediation/fix execution.',
                '- Use the handoff ARTIFACT as the fix-session input for listed implementation defects.',
                '- If the findings show planning or decision defects, send the work back to lineup-feature-plan before coding.',
                '- For the outgoing review handoff, set ARTIFACT to the reviewed commit containing the actual changes.',
                "- For the outgoing review handoff, never reuse the findings artifact as ARTIFACT.",
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when feature implement outgoing handoff keeps ARTIFACT pointed at the findings artifact', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-implement.md': [
                '# Feature Implement',
                '',
                '- Support approved-plan execution and remediation/fix execution.',
                '- Use the handoff ARTIFACT as the fix-session input for listed implementation defects.',
                '- If the findings show planning or decision defects, send the work back to lineup-feature-plan before coding.',
                '- For the outgoing review handoff, set ARTIFACT to the patched diff target so review sees the actual changes.',
                '- For the outgoing review handoff, keep ARTIFACT set to the findings artifact.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('contradictory outgoing review guidance');
    });

    it('fails when feature review prompt omits the implementation-vs-replan remediation split', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-review.md': [
                '# Feature Review',
                '',
                '- Route implementation findings to lineup-feature-implement.',
                '- Include the findings artifact in ARTIFACT.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('feature-review prompt doc');
    });

    it('fails when feature review names lineup-feature-plan without explaining the plan-side routing case', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-review.md': [
                '# Feature Review',
                '',
                '- Use ARTIFACT while reviewing the implementation.',
                '- The available handoff launchers are lineup-feature-plan and lineup-feature-implement.',
                '- Route localized implementation defects to lineup-feature-implement.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('feature-review prompt doc');
    });

    it('fails when feature review spreads routing markers across the doc without attaching them to the launcher lines', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-review.md': [
                '# Feature Review',
                '',
                '- Use ARTIFACT while reviewing the implementation.',
                '- Planning or boundary concerns need escalation before more coding.',
                '- The available handoff launchers are lineup-feature-plan and lineup-feature-implement.',
                '- Localized implementation defects, bugs, and missing tests need follow-up work.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('feature-review prompt doc');
    });

    it('passes when remediation prompts use equivalent wording without sample findings filenames', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-implement.md': [
                '# Feature Implement',
                '',
                '- Support both approved-plan execution and review-driven defect remediation.',
                '- Read the handoff ARTIFACT and keep the fix session scoped to the listed implementation defects.',
                '- If the findings show planning, decision, or boundary defects, send the work back to lineup-feature-plan before coding.',
                '- For the next review handoff, point ARTIFACT at the patched diff target rather than the old findings note.',
                '',
            ].join('\n'),
            'docs/agentic/session-prompts/feature-review.md': [
                '# Feature Review',
                '',
                '- For implementation reviews, route planning, decision, or boundary defects to lineup-feature-plan.',
                '- Route localized implementation defects to lineup-feature-implement.',
                '- Include the relevant findings artifact in ARTIFACT for the next session.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when tracked feature routing docs omit feature-implement from the feature workflow', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/README.md': [
                '# Session Prompt Launchers',
                '',
                '## Prompt Set',
                '',
                sessionPromptSetStartMarker,
                renderedSessionPromptSet,
                sessionPromptSetEndMarker,
                '',
                '## Routing (Authoritative)',
                '',
                'cleanup/refactor',
                'feature/design',
                'mixed',
                'feature-plan',
                'feature-review',
                '',
            ].join('\n'),
            'docs/AGENTIC_DEV_WORKFLOW.md': [
                '# Workflow',
                '',
                'Route task family before choosing a tier.',
                '',
                '[cleanup-plan](./agentic/session-prompts/cleanup-plan.md)',
                '[cleanup-review](./agentic/session-prompts/cleanup-review.md)',
                '[feature-plan](./agentic/session-prompts/feature-plan.md)',
                '[feature-review](./agentic/session-prompts/feature-review.md)',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('feature-implement');
    });

    it('fails when README mentions feature-implement outside the routing row but omits it from the feature/design path', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/README.md': [
                '# Session Prompt Launchers',
                '',
                '## Prompt Set',
                '',
                sessionPromptSetStartMarker,
                renderedSessionPromptSet,
                sessionPromptSetEndMarker,
                '',
                '## Routing (Authoritative)',
                '',
                '| Task Type | Use This Path | Prompt Family | Notes |',
                '|---|---|---|---|',
                '| cleanup/refactor | checklist cleanup | `cleanup-*` | Tier 3 uses cleanup-loop. |',
                '| feature/design | net-new capability | `feature-plan` + `feature-review` | Tier 2 feature flow uses tracked launchers. |',
                '| mixed | split slices explicitly | route by primary intent | Keep cleanup scoped to cleanup work. |',
                '',
                '## Invocation',
                '',
                '- `lineup-feature-plan`',
                '- `lineup-feature-implement`',
                '- `lineup-feature-review`',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('feature/design routing row');
    });

    it('fails when workflow lists feature-implement as a launcher but omits it from the Tier 2 feature sequence', () => {
        const repoRoot = createRepoFixture({
            'docs/AGENTIC_DEV_WORKFLOW.md': [
                '# Workflow',
                '',
                'Route task family before choosing a tier.',
                '',
                '## Session Launchers',
                '',
                '- [cleanup-plan](./agentic/session-prompts/cleanup-plan.md)',
                '- [cleanup-review](./agentic/session-prompts/cleanup-review.md)',
                '- [feature-plan](./agentic/session-prompts/feature-plan.md)',
                '- [feature-implement](./agentic/session-prompts/feature-implement.md)',
                '- [feature-review](./agentic/session-prompts/feature-review.md)',
                '',
                'Feature Tier 2 work should use planner (`feature-plan`) -> reviewer (`feature-review`) -> reviewer (`feature-review`).',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Feature Tier 2 workflow sequence');
    });

    it('fails when feature implement prompt uses the incoming findings artifact as the outgoing review target', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-implement.md': [
                '# Feature Implement',
                '',
                '- Support approved-plan execution and remediation/fix execution.',
                '- Use the handoff ARTIFACT as the fix-session input for listed implementation defects.',
                '- Route planning or decision defects back to `lineup-feature-plan` before coding.',
                '- In the outgoing review handoff, keep ARTIFACT set to the remediation findings artifact.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('outgoing review handoff');
    });

    it('fails when feature implement prompt mixes a patched-diff handoff with contradictory findings-artifact reuse', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-implement.md': [
                '# Feature Implement',
                '',
                '- Support approved-plan execution and remediation/fix execution.',
                '- Use the handoff ARTIFACT as the fix-session input for listed implementation defects.',
                '- Route planning or decision defects back to `lineup-feature-plan` before coding.',
                '- For the next review handoff, point ARTIFACT at the patched diff target so review inspects the actual changes.',
                '- To preserve history, keep ARTIFACT set to the incoming remediation findings artifact in the outgoing review handoff.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('contradictory outgoing review guidance');
    });

    it('fails when cleanup-plan omits the priority-exit readiness ownership/security contract', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-plan.md': [
                '# Cleanup Plan',
                '',
                '- Include verification commands.',
                '- Include rollback notes.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-plan prompt doc');
    });

    it('fails when cleanup-review omits single-owner or revisit-trigger priority-exit guidance', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-review.md': [
                '# Cleanup Review',
                '',
                '- Verify mapped imported issues are resolved or deferred.',
                '- Run a priority-exit review before moving to the next priority.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-review prompt doc');
    });

    it('fails when cleanup-review omits P0-scoped security triage guidance', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-review.md': [
                '# Cleanup Review',
                '',
                '- `owned follow-up` means one single final owner.',
                '- Every deferred item needs a revisit trigger.',
                '- `security triage` may say `none open` or list the exact security issue ids still open/deferred.',
                '- A `priority-exit review` must ensure no `P(n+1)` plan or implementation work is being approved while `P#-EXIT` is still unresolved.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-review prompt doc');
    });

    it('fails when cleanup-implement omits the priority-exit readiness ownership markers', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-implement.md': [
                '# Cleanup Implement',
                '',
                '- Execute the approved plan.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-implement prompt doc');
    });

    it('fails when cleanup-implement omits exact issue ids and deferral metadata for deferred items', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-implement.md': [
                '# Cleanup Implement',
                '',
                '- Prepare the `P#-EXIT` evidence and checklist update.',
                '- For any deferred/split item, name one single final owner.',
                '- Run a priority-exit review before moving to the next priority.',
                '- Do not start `P(n+1)` work in the same session.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-implement prompt doc');
    });

    it('accepts cleanup-implement guidance that uses canonical single final owner markers', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-implement.md': [
                '# Cleanup Implement',
                '',
                '- Prepare the `P#-EXIT` evidence and checklist update.',
                '- For any deferred/split item, name the exact issue id, one single final owner, and the reason and revisit trigger.',
                '- Run a priority-exit review before moving to the next priority.',
                '- Do not start `P(n+1)` work in the same session.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
    });

    it('fails when the checklist does not repeat the required exit-enforcement line for every priority', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '- [ ] `P3-EXIT`',
                '- [ ] `P4-EXIT`',
                '- [ ] `P5-EXIT`',
                '- [ ] `P6-EXIT`',
                '- [ ] `P7-EXIT`',
                '- [ ] `P8-EXIT`',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Checklist doc is missing the required line inside `P2-EXIT` block');
    });

    it('fails when a checklist repeats the exit requirement globally but omits it inside a specific `P#-EXIT` block', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - other: no exit marker here',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Checklist doc is missing the required line inside `P2-EXIT` block');
    });

    it('fails when the cleanup slice execution template uses generic security wording', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '- Cleanup slice execution template:',
                '  - `security triage`: `none open`, or the deferred/resolved security findings for this slice',
                '- Priority exit command checklist:',
                '  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins',
                '',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P2-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Checklist doc is missing required cleanup-slice security marker');
    });

    it('fails when `P2-EXIT` is mentioned in `P1-EXIT` prose before the real heading', () => {
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': [
                '# Checklist',
                '',
                '## Execution Hygiene',
                '',
                '- Disposition vocabulary:',
                '  - `owned follow-up`: assign one single final owner.',
                '  - `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids.',
                '  - `priority-exit review`: the blocking review before `P(n+1)` work, plan, or checklist progress.',
                '- Closeout rule: do not start, plan, or mark progress on `P(n+1)` work until the current priority\'s `P#-EXIT` record is complete.',
                '',
                '- [ ] `P1-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '  - note: revisit `P2-EXIT` before shipping',
                '- [ ] `P2-EXIT`',
                '  - other: no exit marker here',
                '- [ ] `P3-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P4-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P5-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P6-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P7-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '- [ ] `P8-EXIT`',
                '  - required: record every mapped imported issue with an exact disposition',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Checklist doc is missing the required line inside `P2-EXIT` block');
    });
});
