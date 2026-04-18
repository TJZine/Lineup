import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const verifierPath = path.resolve(process.cwd(), 'tools/verify-docs.mjs');

type PromptInventories = {
    expectedEvalPromptFiles: string[];
    expectedSessionPromptFiles: string[];
    requiredRepoLocalSkills: string[];
    requiredRepoLocalSkillFiles: string[];
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
        '  requiredRepoLocalSkills: lib.REQUIRED_REPO_LOCAL_SKILLS,',
        '  requiredRepoLocalSkillFiles: lib.REQUIRED_REPO_LOCAL_SKILL_FILES,',
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
    requiredRepoLocalSkills,
    requiredRepoLocalSkillFiles,
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

function writeValidRepoLocalSkillFixtures(repoRoot: string): void {
    for (const [index, relativePath] of requiredRepoLocalSkillFiles.entries()) {
        const skill = requiredRepoLocalSkills[index];
        writeRepoFile(
            repoRoot,
            relativePath,
            [
                '---',
                `name: ${skill}`,
                'description: Test fixture repo-local skill.',
                '---',
                '',
                `# ${skill}`,
                '',
            ].join('\n')
        );
    }
}

function buildChecklistLinkedPackageDecomposition({
    readyNowSlice = 'P1-W1-S1',
    readyNowExecutionUnit = readyNowSlice,
    executionWaves = '',
    coverageLedger = '',
}: {
    readyNowSlice?: string;
    readyNowExecutionUnit?: string;
    executionWaves?: string;
    coverageLedger?: string;
} = {}): string {
    return [
        '## Package Decomposition',
        '',
        '- `package_id`: `pkg_example_cleanup`',
        '- `checklist_token`: `P1-W1`',
        '- `package_issue_ids`:',
        '  - `review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes`',
        '- `slice_table`:',
        '',
        `### \`${readyNowSlice}\` Example Slice`,
        '',
        '- `goal`: retire the package-owned seam without widening scope',
        '- `areas/files`:',
        '  - `docs/agentic/plan-authoring-standard.md`',
        '- `exact_issue_ids`:',
        '  - `review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes`',
        '- `verification`:',
        '  - `npm run verify:docs`',
        '- `dependencies`: none',
        '- `stop_condition`: stop if the approved seam widens',
        '- `handoff_condition`: hand off once review is clean',
        '- `serial_only`: true',
        '- `parallel_justification`: keep the execution unit serial',
        '- `coverage_check`:',
        '  - every existing package issue is mapped to one slice-owned execution path',
        ...(coverageLedger.length > 0 ? [coverageLedger] : []),
        ...(executionWaves.length > 0 ? [executionWaves] : []),
        '- `recommended_slice_order`:',
        `  1. \`${readyNowSlice}\``,
        `- \`ready_now_slice\`: \`${readyNowSlice}\``,
        `- \`ready_now_execution_unit\`: \`${readyNowExecutionUnit}\``,
        '- `parallel_execution_policy`: serial',
        '',
    ].join('\n');
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
        'agents.md',
        [
            '# Agents',
            '',
            'Use [`docs/AGENTIC_DEV_WORKFLOW.md`](./docs/AGENTIC_DEV_WORKFLOW.md) for the operating runbook.',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/document-map.md',
        [
            '# Agent Control Plane Document Map',
            '',
            '> Compatibility stub. The authoritative control-plane map now lives in [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles).',
            '',
            'Keep this file only for inbound compatibility from older plans, prompts, or tracked links. Do not treat it as a second authority surface.',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/README.md',
        [
            '# Session Prompt Launchers',
            '',
            'Authority, read order, and document precedence now live in [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md). [`docs/agentic/document-map.md`](../document-map.md) remains only as a compatibility stub for older inbound links.',
            '',
            '## Prompt Set',
            '',
            sessionPromptSetStartMarker,
            renderedSessionPromptSet,
            sessionPromptSetEndMarker,
            '',
            'Tracked role intent:',
            '',
            '- run `cleanup-plan.md` and `feature-plan.md` with the tracked `planner` role',
            '- run `cleanup-implement.md` and `feature-implement.md` with the tracked `worker` role',
            '- route Tier 3 cleanup-loop.md implementation passes through the tracked cleanup_worker role only',
            '- keep `cleanup-review.md`, `feature-review.md`, and `workflow-harness-review.md` read-only under the tracked `reviewer` role',
            '',
            '## Routing (Authoritative)',
            '',
            '| Task Type | Use This Path | Prompt Family | Notes |',
            '|---|---|---|---|',
            '| cleanup/refactor | checklist cleanup | `cleanup-*` | Tier 3 uses cleanup-loop with planner + cleanup_worker + reviewer. |',
            '| feature/design | net-new capability | `feature-plan` + `feature-implement` + `feature-review` | Tier 2 feature flow uses tracked launchers. |',
            '| mixed | split slices explicitly | route by primary intent | Keep cleanup scoped to cleanup work. |',
            '',
            '- For checklist-linked package work, `execution_unit` is the execution/review surface and `slice_table` remains the atomic ownership map.',
            '- Require `ready_now_execution_unit` for checklist-linked package work.',
            '- Require `execution_waves` and `coverage_ledger` only when the approved execution unit spans multiple slices.',
            '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
            '',
            '## Invocation',
            '',
            'Each launcher should:',
            '',
            '1. confirm the current repo is Lineup',
            '2. load [`agents.md`](../../../agents.md) and [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)',
            '3. load the matching file in this directory',
            '4. use the tracked role that matches the launcher intent (`planner` for planning, `worker` for implementation, `reviewer` for review)',
            '   cleanup-loop is the exception: Tier 3 cleanup implementation inside that loop routes to cleanup_worker while Tier 2 cleanup and feature implementation stay on worker',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/AGENTIC_DEV_WORKFLOW.md',
        [
            '# Workflow',
            '',
            '## Authority And Document Roles',
            '',
            'Use this file as the single operating runbook.',
            '',
            '## Document Precedence',
            '',
            '- this file for operating workflow, precedence, and where-to-look-next',
            '- [`agents.md`](../agents.md) for entrypoint defaults only',
            '- [`docs/agentic/codanna-playbook.md`](./agentic/codanna-playbook.md)',
            '- [`docs/agentic/session-prompts/README.md`](./agentic/session-prompts/README.md)',
            '- [`docs/architecture/CURRENT_STATE.md`](./architecture/CURRENT_STATE.md)',
            '- [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md)',
            '- [`docs/plans/`](./plans/README.md)',
            '- [`docs/archive/plans/`](./archive/plans/README.md)',
            '- [`docs/runs/`](./runs/README.md)',
            '- [`docs/agentic/skill-strategy.md`](./agentic/skill-strategy.md)',
            '- [`docs/agentic/evals/README.md`](./agentic/evals/README.md)',
            '- [`docs/agentic/evals-roadmap.md`](./agentic/evals-roadmap.md)',
            '- [`docs/agentic/evals/baseline-summaries/`](./agentic/evals/baseline-summaries/README.md)',
            '- [`docs/agentic/historical-plan-corpus-review.md`](./agentic/historical-plan-corpus-review.md)',
            '- [`docs/agentic/plan-authoring-standard.md`](./agentic/plan-authoring-standard.md)',
            '- [`docs/agentic/doc-gardening-checklist.md`](./agentic/doc-gardening-checklist.md)',
            '- [`docs/agentic/phase-2-steady-state-plan.md`](./agentic/phase-2-steady-state-plan.md)',
            '',
            'Route task family before choosing a tier.',
            '',
            '- For cleanup/refactor work, choose `checklist-linked` or `standalone remediation` before selecting a tier.',
            '- Record whether cleanup work is `checklist-linked` or `standalone remediation` before freezing the plan.',
            '- For checklist-linked package work, `execution_unit` is the execution/review surface and `slice_table` remains the atomic ownership map.',
            '- For checklist-linked package work, `ready_now_execution_unit` is required and `execution_waves` are optional unless one approved wave spans multiple slices.',
            '- `coverage_ledger` stays execution-only and wave review is the default approval gate for a coherent approved batch.',
            '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
            '- Once a delegated `planner` pass is active, keep it authoritative for plan authoring until it finishes, explicitly blocks, fails, or is abandoned after wait/status-check/wait with no usable progress signal.',
            '- While that delegated planner is active, limit controller-side inspection to explicit blocker or seam resolution; do not do competing local plan drafting or redundant planning discovery.',
            '',
            'A final `P#-W#` plan must include a `Priority-exit readiness` section, assign a single final owner to each deferred or split follow-up item, and record any exact `P0` security issue ids before starting or planning the next priority.',
            'No `P(n+1)` checklist item, plan, or implementation work may open while `P#-EXIT` is unresolved.',
            'Update the checklist only for `checklist-linked` cleanup work; for `standalone remediation`, no checklist update applies unless the task is intentionally promoted.',
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
            '- For checklist-linked package work, `slice_table` remains the atomic ownership map. `execution_unit` is the execution/review surface.',
            '- Require `ready_now_execution_unit`, and require `execution_waves`, `coverage_ledger`, `absorb_now_scope`, and `replan_triggers` only for wave-scoped execution.',
            '- Absorb now only when newly discovered residue stays within the same approved execution unit goal.',
            '- Replan required when current-source proof shows a new owner.',
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
            '- Run this launcher with the tracked write-capable `planner` role. The role is for bounded planning discovery, tracked plan artifacts, and execution-ready handoffs, not product-code implementation.',
            '- Keep write activity confined to planning surfaces unless the parent explicitly narrows the task to a workflow/control-plane planning-doc edit.',
            '- Include `Priority-exit readiness` when the plan claims priority closeout.',
            '- Assign a single final owner to every deferred or split follow-up item.',
            '- Record exact `P0` security issue ids and the `P#-EXIT` checklist update.',
            '- Mark cleanup work as `checklist-linked` or `standalone remediation` before freezing the plan.',
            '- Only `checklist-linked` work should claim priority closeout.',
            '- For checklist-linked package work, require `ready_now_execution_unit`.',
            '- Require `execution_waves`, `coverage_ledger`, `absorb_now_scope`, and `replan_triggers` only for wave-scoped execution.',
            '- Include Package Decomposition decisions with `ready_now_execution_unit`, `ready_now_slice`, and `parallel_execution_policy` in the output contract.',
            '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/cleanup-loop.md',
        [
            '# Cleanup Loop (Fixture)',
            '',
            '- For the delegated planning pass, use the tracked write-capable `planner` role.',
            '- Once delegated planning starts, that planner is the authoritative plan author until it finishes, explicitly blocks, fails, or is abandoned only after a long wait, a direct status check, and a follow-up wait that still produces no usable progress signal.',
            '- While that planner pass is active, the controller must not do planner-grade repo discovery, redundant package-local scoping, issue reconciliation, or tracked plan drafting locally; limit controller-side inspection to the minimum needed to answer an explicit blocker question or resolve a controller-only seam decision.',
            '- The main thread must not author the execution-grade `checklist-linked` package plan itself just because it now has enough local context.',
            '- Use `execution-unit-select` for checklist-linked package work.',
            '- Read `ready_now_execution_unit` before implementation starts.',
            '- For Tier 3 `cleanup-loop` implementation passes, use the tracked `cleanup_worker` role instead of `worker`.',
            '- When a wave is selected, the controller stays inside that wave until its completion condition is met.',
            '- Wave review is the default approval gate for that coherent approved batch.',
            '- Each implemented approved execution unit or standalone execution target has a clean implementation review loop.',
            '- If the completed checklist-linked execution unit closes the final planned `P#-W#` item, finish the `P#-EXIT` evidence before closeout.',
            '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
            '- Use `planner` for bounded planning artifacts, `cleanup_worker` for Tier 3 `cleanup-loop` implementation write passes, `worker` for general implementation outside that loop, and `reviewer` for adversarial review passes.',
            '- Do not treat planner latency, controller curiosity, or newly gathered local context as a valid reason to reclaim planning.',
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
            '- For `standalone remediation`, state that no checklist update applies.',
            '- Execute one approved `execution_unit` at a time.',
            '- Absorb now only when newly discovered residue stays within the same approved execution unit goal.',
            '- Replan required when current-source proof shows a new owner.',
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
            '- Review the approved `execution_unit` and keep slice-level accounting is still mandatory inside that unit.',
            '- Confirm wave review is acting as the default approval gate for coherent approved batches.',
            '',
        ].join('\n')
    );

    writeRepoFile(
        repoRoot,
        'docs/agentic/session-prompts/feature-plan.md',
        [
            '# Feature Plan (Fixture)',
            '',
            '- Run this launcher with the tracked write-capable `planner` role. Use that role for bounded planning discovery, tracked plan artifacts, and execution-ready handoffs rather than product-code implementation.',
            '- Keep write activity confined to planning surfaces unless the parent explicitly narrows the task to a workflow/control-plane planning-doc edit.',
            '- Keep the authoritative execution steps aligned in `update_plan`.',
            '- Preserve the repo verification gate expectations.',
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
const CODEX_MODEL_PLANNER = 'gpt-5.4';

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
            '[agents.planner]',
            'description = "Planner"',
            'config_file = "agents/planner.toml"',
            '',
            '[agents.worker]',
            'description = "Worker"',
            'config_file = "agents/worker.toml"',
            '',
            '[agents.cleanup_worker]',
            'description = "Cleanup-loop-specific implementer for approved Tier 3 cleanup-loop implementation passes."',
            'config_file = "agents/cleanup-worker.toml"',
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
    writeRepoFile(
        repoRoot,
        '.codex/agents/planner.toml',
        [
            `model = "${CODEX_MODEL_PLANNER}"`,
            'model_reasoning_effort = "high"',
            'developer_instructions = """',
            'Own bounded planning work, not product-code implementation.',
            'Use write access only for planning artifacts, scoped workflow docs, and execution-ready handoffs that the parent explicitly requested.',
            'Do the discovery needed to freeze the plan, surface unresolved seams early, and leave implementation to the worker role unless the parent narrows the scope to a planning-surface edit.',
            '"""',
            '',
        ].join('\n')
    );
    writeRepoFile(repoRoot, '.codex/agents/worker.toml', `model = "${CODEX_MODEL_DEFAULT}"\n`);
    writeRepoFile(
        repoRoot,
        '.codex/agents/cleanup-worker.toml',
        [
            `model = "${CODEX_MODEL_PLANNER}"`,
            'model_reasoning_effort = "high"',
            'developer_instructions = """',
            'Own one bounded cleanup-loop implementation write scope at a time.',
            'Make the smallest defensible cleanup change inside the approved execution unit, avoid unrelated edits, and validate the changed behavior before returning.',
            'Use this role only for Tier 3 cleanup-loop implementation passes; leave general implementation routing to the worker role.',
            '"""',
            '',
        ].join('\n')
    );
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
    writeValidRepoLocalSkillFixtures(repoRoot);
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

    it('fails when agents.md routes authority back through document-map.md', () => {
        const repoRoot = createRepoFixture({
            'agents.md': [
                '# Agents',
                '',
                'Use [`docs/agentic/document-map.md`](./docs/agentic/document-map.md) for document precedence.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('agents.md must point to docs/AGENTIC_DEV_WORKFLOW.md');
        expect(result.stderr).toContain('agents.md must not send readers to docs/agentic/document-map.md');
    });

    it('fails when document-map.md is not reduced to a compatibility stub', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/document-map.md': [
                '# Agent Control Plane Document Map',
                '',
                'This file defines precedence directly.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('document-map.md is missing required compatibility-stub marker');
    });

    it('fails when document-map.md grows guidance beyond the compatibility stub', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/document-map.md': [
                '# Agent Control Plane Document Map',
                '',
                '> Compatibility stub. The authoritative control-plane map now lives in [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles).',
                '',
                'Current truth reminders:',
                '',
                '- [`docs/architecture/CURRENT_STATE.md`](../architecture/CURRENT_STATE.md) is the current architecture truth surface.',
                '',
                'Keep this file only for inbound compatibility from older plans, prompts, or tracked links. Do not treat it as a second authority surface.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('document-map.md must remain a minimal compatibility stub');
    });

    it('fails when a launcher prompt still requires document-map.md in its read order', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-plan.md': [
                '# Cleanup Plan',
                '',
                '## Read Order',
                '',
                '1. [`agents.md`](../../../agents.md)',
                '2. [`docs/agentic/document-map.md`](../document-map.md)',
                '3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)',
                '',
                '- Run this launcher with the tracked write-capable `planner` role. The role is for bounded planning discovery, tracked plan artifacts, and execution-ready handoffs, not product-code implementation.',
                '- Keep write activity confined to planning surfaces unless the parent explicitly narrows the task to a workflow/control-plane planning-doc edit.',
                '- Include `Priority-exit readiness` when the plan claims priority closeout.',
                '- Assign a single final owner to every deferred or split follow-up item.',
                '- Record exact `P0` security issue ids and the `P#-EXIT` checklist update.',
                '- Mark cleanup work as `checklist-linked` or `standalone remediation` before freezing the plan.',
                '- Only `checklist-linked` work should claim priority closeout.',
                '- Require `ready_now_execution_unit` for checklist-linked package work.',
                '- Require `execution_waves`, `coverage_ledger`, `absorb_now_scope`, and `replan_triggers` only for wave-scoped execution.',
                '- Include Package Decomposition decisions with `ready_now_execution_unit`, `ready_now_slice`, and `parallel_execution_policy` in the output contract.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('docs/agentic/session-prompts/cleanup-plan.md must not require docs/agentic/document-map.md');
    });

    it('allows launcher docs to mention document-map.md only as a compatibility stub', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-plan.md': [
                '# Cleanup Plan',
                '',
                'Read [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md) first.',
                'If an older inbound link mentions [`docs/agentic/document-map.md`](../document-map.md), treat it as a compatibility stub only.',
                '',
                '- Run this launcher with the tracked write-capable `planner` role. The role is for bounded planning discovery, tracked plan artifacts, and execution-ready handoffs, not product-code implementation.',
                '- Keep write activity confined to planning surfaces unless the parent explicitly narrows the task to a workflow/control-plane planning-doc edit.',
                '- Include `Priority-exit readiness` when the plan claims priority closeout.',
                '- Assign a single final owner to every deferred or split follow-up item.',
                '- Record exact `P0` security issue ids and the `P#-EXIT` checklist update.',
                '- Mark cleanup work as `checklist-linked` or `standalone remediation` before freezing the plan.',
                '- Only `checklist-linked` work should claim priority closeout.',
                '- Require `ready_now_execution_unit` for checklist-linked package work.',
                '- Require `execution_waves`, `coverage_ledger`, `absorb_now_scope`, and `replan_triggers` only for wave-scoped execution.',
                '- Include Package Decomposition decisions with `ready_now_execution_unit`, `ready_now_slice`, and `parallel_execution_policy` in the output contract.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('allows launcher docs to explicitly forbid loading document-map.md in read order', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-plan.md': [
                '# Cleanup Plan',
                '',
                'Read [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md) first.',
                'Do not load [`docs/agentic/document-map.md`](../document-map.md) in launcher read order; keep legacy links pointed there but use the workflow doc instead.',
                '',
                '- Run this launcher with the tracked write-capable `planner` role. The role is for bounded planning discovery, tracked plan artifacts, and execution-ready handoffs, not product-code implementation.',
                '- Keep write activity confined to planning surfaces unless the parent explicitly narrows the task to a workflow/control-plane planning-doc edit.',
                '- Include `Priority-exit readiness` when the plan claims priority closeout.',
                '- Assign a single final owner to every deferred or split follow-up item.',
                '- Record exact `P0` security issue ids and the `P#-EXIT` checklist update.',
                '- Mark cleanup work as `checklist-linked` or `standalone remediation` before freezing the plan.',
                '- Only `checklist-linked` work should claim priority closeout.',
                '- Require `ready_now_execution_unit` for checklist-linked package work.',
                '- Require `execution_waves`, `coverage_ledger`, `absorb_now_scope`, and `replan_triggers` only for wave-scoped execution.',
                '- Include Package Decomposition decisions with `ready_now_execution_unit`, `ready_now_slice`, and `parallel_execution_policy` in the output contract.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when workflow precedence still puts agents.md ahead of the runbook', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        const workflowPath = path.join(repoRoot, 'docs/AGENTIC_DEV_WORKFLOW.md');
        const workflow = readFileSync(workflowPath, 'utf8').replace(
            [
                '## Document Precedence',
                '',
                '- this file for operating workflow, precedence, and where-to-look-next',
                '- [`agents.md`](../agents.md) for entrypoint defaults only',
            ].join('\n'),
            [
                '## Document Precedence',
                '',
                '- [`agents.md`](../agents.md) for entrypoint defaults only',
                '- this file for operating workflow, precedence, and where-to-look-next',
            ].join('\n')
        );
        writeFileSync(workflowPath, workflow, 'utf8');

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Workflow doc must give docs/AGENTIC_DEV_WORKFLOW.md higher precedence than agents.md');
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

    it('fails when a tracked doc links to a concrete .agents artifact', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\n[Local agent note](../../.agents/run-logs/session.md)\n',
            '.agents/run-logs/session.md': '# Local agent note\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Tracked doc docs/development/testing.md links to local-only artifact');
        expect(result.stderr).toContain('../../.agents/run-logs/session.md');
    });

    it('fails when a tracked doc contains a raw .agents literal path', () => {
        const repoRoot = createRepoFixture({
            'docs/development/testing.md': '# Testing\n\nRaw local agent artifact: .agents/run-logs/session.md\n',
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('.agents/run-logs/session.md');
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

    it('fails when a required repo-local canonical skill file is missing', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        rmSync(path.join(repoRoot, '.codex/skills/verification-strategy'), { recursive: true, force: true });

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Missing required repo-local canonical skill `verification-strategy`: .codex/skills/verification-strategy/SKILL.md'
        );
    });

    it('fails when a required repo-local canonical skill file exists locally but is not tracked', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        runGit(['rm', '--cached', '--quiet', '.codex/skills/verification-strategy/SKILL.md'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Required repo-local canonical skill is not tracked: .codex/skills/verification-strategy/SKILL.md'
        );
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

    it('fails when the session prompt README drops the explicit planner/worker/reviewer role mapping', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        const readmePath = path.join(repoRoot, 'docs/agentic/session-prompts/README.md');
        const readme = readFileSync(readmePath, 'utf8').replace(
            [
                'Tracked role intent:',
                '',
                '- run `cleanup-plan.md` and `feature-plan.md` with the tracked `planner` role',
                '- run `cleanup-implement.md` and `feature-implement.md` with the tracked `worker` role',
                '- route Tier 3 cleanup-loop.md implementation passes through the tracked cleanup_worker role only',
                '- keep `cleanup-review.md`, `feature-review.md`, and `workflow-harness-review.md` read-only under the tracked `reviewer` role',
                '',
            ].join('\n'),
            ''
        );
        writeFileSync(readmePath, readme, 'utf8');

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Session prompt README must keep the tracked role intent explicit: planner for planning launchers, worker for general implementers, cleanup_worker only for Tier 3 cleanup-loop implementation passes, reviewer read-only for review launchers.'
        );
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
        expect(result.stderr).toContain('planner');
        expect(result.stderr).toContain('cleanup_worker');
        expect(result.stderr).toContain('monitor_fallback');
    });

    it('fails when the planner role does not preserve the tracked gpt-5.4 high contract', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(repoRoot, '.codex/agents/planner.toml', 'model = "gpt-5.4"\nmodel_reasoning_effort = "medium"\n');

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role config is missing required planner contract line (model_reasoning_effort = "high"): .codex/agents/planner.toml'
        );
    });

    it('fails when the planner role loses its planning-only boundary instructions', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/agents/planner.toml',
            'model = "gpt-5.4"\nmodel_reasoning_effort = "high"\ndeveloper_instructions = """\nPlan when useful.\n"""\n'
        );

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role config is missing required planner boundary marker (not product-code implementation): .codex/agents/planner.toml'
        );
        expect(result.stderr).toContain(
            'Codex role config is missing required planner boundary marker (leave implementation to the worker role): .codex/agents/planner.toml'
        );
    });

    it('fails when the cleanup_worker role does not preserve the tracked gpt-5.4 high contract', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/agents/cleanup-worker.toml',
            'model = "gpt-5.4"\nmodel_reasoning_effort = "medium"\n'
        );

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role config is missing required cleanup_worker contract line (model_reasoning_effort = "high"): .codex/agents/cleanup-worker.toml'
        );
    });

    it('fails when the cleanup_worker role loses its cleanup-loop-only boundary instructions', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/agents/cleanup-worker.toml',
            'model = "gpt-5.4"\nmodel_reasoning_effort = "high"\ndeveloper_instructions = """\nOwn one bounded write scope at a time.\n"""\n'
        );

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role config is missing required cleanup_worker boundary marker (tier 3 cleanup-loop implementation passes): .codex/agents/cleanup-worker.toml'
        );
        expect(result.stderr).toContain(
            'Codex role config is missing required cleanup_worker boundary marker (leave general implementation routing to the worker role): .codex/agents/cleanup-worker.toml'
        );
    });

    it('fails when the cleanup_worker declaration in .codex/config.toml widens beyond cleanup-loop implementation passes', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
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
                '[agents.planner]',
                'description = "Planner"',
                'config_file = "agents/planner.toml"',
                '',
                '[agents.worker]',
                'description = "Worker"',
                'config_file = "agents/worker.toml"',
                '',
                '[agents.cleanup_worker]',
                'description = "General Tier 3 cleanup implementer"',
                'config_file = "agents/cleanup-worker.toml"',
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

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role declaration is missing required cleanup_worker scope marker (cleanup-loop-specific implementer) in .codex/config.toml'
        );
        expect(result.stderr).toContain(
            'Codex role declaration is missing required cleanup_worker scope marker (approved tier 3 cleanup-loop implementation passes) in .codex/config.toml'
        );
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

    it('fails when a checklist-linked tracked plan omits the exact active marker', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(repoRoot, 'docs/plans/example-active.md', '# Example Implementation Plan\n\n**Goal:** Do the thing.\n');
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('docs/plans/example-active.md');
        expect(result.stderr).toContain('must include exact active plan marker');
        expect(result.stderr).not.toContain('missing required serious-plan sections');
    });

    it('fails when an active tracked plan omits the verification classification marker', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition(),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'verification commands section must classify verification strategy with one exact plan-standard marker'
        );
    });

    it('passes when a checklist-linked tracked plan uses the exact active marker and full serious-plan structure', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition(),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Documentation verification passed.');
    });

    it('fails when a checklist-linked tracked plan omits ready_now_execution_unit', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition().replace(
                    '- `ready_now_execution_unit`: `P1-W1-S1`\n',
                    ''
                ),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'docs/plans/example-active.md checklist-linked plans must include `ready_now_execution_unit` in `## Package Decomposition`'
        );
    });

    it('fails when a checklist-linked tracked plan omits required slice_table execution fields', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '**Task family:** cleanup/refactor',
                '**Cleanup subtype:** checklist-linked',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
                buildChecklistLinkedPackageDecomposition().replace(
                    '- `verification`:\n  - `npm run verify:docs`\n',
                    ''
                ),
                '',
            ].join('\n')
        );
        writeRepoFile(
            repoRoot,
            'ARCHITECTURE_CLEANUP_CHECKLIST.md',
            readFileSync(path.join(repoRoot, 'ARCHITECTURE_CLEANUP_CHECKLIST.md'), 'utf8') +
                '\n- [ ] Active item (plan: docs/plans/example-active.md)\n'
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'docs/plans/example-active.md P1-W1-S1 in `slice_table` must include `verification`'
        );
    });

    it('fails when an active tracked plan omits required classification fields', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRepoFile(
            repoRoot,
            'docs/plans/example-active.md',
            [
                '# Example Implementation Plan',
                '',
                '**Plan Status:** active',
                '',
                '**Goal:** Do the thing.',
                '',
                '**Architecture:** Keep the boundary explicit.',
                '',
                '## Non-Goals',
                '',
                '- No routing changes.',
                '',
                '## Required Reading',
                '',
                '- `docs/AGENTIC_DEV_WORKFLOW.md`',
                '',
                '## Required Skills',
                '',
                '- `execution-plan-authoring`',
                '',
                '## Codanna Discovery',
                '',
                '- `search_documents`: confirmed the right workflow docs.',
                '',
                '## Evidence To Preserve',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Allowed File Changes',
                '',
                '- `docs/agentic/plan-authoring-standard.md`',
                '',
                '## Files Out Of Scope',
                '',
                '- `src/App.ts`',
                '',
                '## Planner Self-Check',
                '',
                '- No hidden seam remains.',
                '',
                '## Architecture Seam Decision Gate',
                '',
                '- Chosen seam is explicit.',
                '',
                '## Verification Commands',
                '',
                '- Verification classification: `existing coverage sufficient`',
                '',
                '- Run: `npm run verify:docs`',
                '- Expected: `Documentation verification passed.`',
                '',
                '## Rollback Notes',
                '',
                '- Revert the doc change if the launcher contract becomes ambiguous.',
                '',
                '## Commit Checkpoints',
                '',
                '- `docs: refresh tracked plan contract`',
                '',
            ].join('\n')
        );
        runGit(['add', '.'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('missing required plan classification field: **Task family:**');
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

    it('fails when feature-plan omits the planning-surface write boundary for the planner role', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/feature-plan.md': [
                '# Feature Plan',
                '',
                '- Run this launcher with the tracked write-capable `planner` role. Use that role for bounded planning discovery, tracked plan artifacts, and execution-ready handoffs rather than product-code implementation.',
                '- Keep the authoritative execution steps aligned in `update_plan`.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'feature-plan prompt doc must keep planner write scope confined to planning surfaces unless the parent explicitly narrows the task to a planning-doc edit'
        );
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

    it('fails when cleanup-loop omits the execution-unit wave-review contract', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-loop.md': [
                '# Cleanup Loop',
                '',
                '- Use `execution-unit-select` for checklist-linked package work.',
                '- Read `ready_now_execution_unit` before implementation starts.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-loop prompt doc is missing required execution-unit orchestration marker');
        expect(result.stderr).toContain('wave review is the default approval gate');
    });

    it('fails when cleanup-plan omits execution-unit handoff guidance from the output contract', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-plan.md': [
                '# Cleanup Plan',
                '',
                '- Include `Priority-exit readiness` when the plan claims priority closeout.',
                '- Assign a single final owner to every deferred or split follow-up item.',
                '- Record exact `P0` security issue ids and the `P#-EXIT` checklist update.',
                '- Mark cleanup work as `checklist-linked` or `standalone remediation` before freezing the plan.',
                '- Only `checklist-linked` work should claim priority closeout.',
                '- For checklist-linked package work, require `ready_now_execution_unit`.',
                '- Require `execution_waves`, `coverage_ledger`, `absorb_now_scope`, and `replan_triggers` only for wave-scoped execution.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-plan prompt doc is missing required execution-unit planning marker');
        expect(result.stderr).toContain('package decomposition decisions with ready now execution unit');
    });

    it('fails when cleanup-loop omits execution-unit completion-gate guidance', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-loop.md': [
                '# Cleanup Loop',
                '',
                '- Use `execution-unit-select` for checklist-linked package work.',
                '- Read `ready_now_execution_unit` before implementation starts.',
                '- When a wave is selected, the controller stays inside that wave until its completion condition is met.',
                '- Wave review is the default approval gate for that coherent approved batch.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-loop prompt doc is missing required execution-unit orchestration marker');
        expect(result.stderr).toContain('each implemented approved execution unit or standalone execution target has a clean implementation review loop');
    });

    it('fails when cleanup-loop omits delegated-planner authority and no-competing-local-planning guidance', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-loop.md': [
                '# Cleanup Loop',
                '',
                '- For the delegated planning pass, use the tracked write-capable `planner` role.',
                '- Use `execution-unit-select` for checklist-linked package work.',
                '- Read `ready_now_execution_unit` before implementation starts.',
                '- When a wave is selected, the controller stays inside that wave until its completion condition is met.',
                '- Wave review is the default approval gate for that coherent approved batch.',
                '- Each implemented approved execution unit or standalone execution target has a clean implementation review loop.',
                '- If the completed checklist-linked execution unit closes the final planned `P#-W#` item, finish the `P#-EXIT` evidence before closeout.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '- Use `planner` for bounded planning artifacts, `worker` for implementation write passes, and `reviewer` for adversarial review passes.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-loop prompt doc is missing required execution-unit orchestration marker');
        expect(result.stderr).toContain('planner is the authoritative plan author until it finishes, explicitly blocks, fails, or is abandoned');
        expect(result.stderr).toContain('must not do planner-grade repo discovery, redundant package-local scoping, issue reconciliation, or tracked plan drafting locally');
        expect(result.stderr).toContain('minimum needed to answer an explicit blocker question or resolve a controller-only seam decision');
    });

    it('fails when cleanup-loop omits cleanup_worker routing for Tier 3 implementation passes', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-loop.md': [
                '# Cleanup Loop',
                '',
                '- For the delegated planning pass, use the tracked write-capable `planner` role.',
                '- Once delegated planning starts, that planner is the authoritative plan author until it finishes, explicitly blocks, fails, or is abandoned only after a long wait, a direct status check, and a follow-up wait that still produces no usable progress signal.',
                '- While that planner pass is active, the controller must not do planner-grade repo discovery, redundant package-local scoping, issue reconciliation, or tracked plan drafting locally; limit controller-side inspection to the minimum needed to answer an explicit blocker question or resolve a controller-only seam decision.',
                '- The main thread must not author the execution-grade `checklist-linked` package plan itself just because it now has enough local context.',
                '- Use `execution-unit-select` for checklist-linked package work.',
                '- Read `ready_now_execution_unit` before implementation starts.',
                '- Spawn or resume a persistent tracked `worker` implementation subagent using the approved plan and selected execution scope.',
                '- When a wave is selected, the controller stays inside that wave until its completion condition is met.',
                '- Wave review is the default approval gate for that coherent approved batch.',
                '- Each implemented approved execution unit or standalone execution target has a clean implementation review loop.',
                '- If the completed checklist-linked execution unit closes the final planned `P#-W#` item, finish the `P#-EXIT` evidence before closeout.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '- Use `planner` for bounded planning artifacts, `worker` for implementation write passes, and `reviewer` for adversarial review passes.',
                '- Do not treat planner latency, controller curiosity, or newly gathered local context as a valid reason to reclaim planning.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-loop prompt doc is missing required execution-unit orchestration marker');
        expect(result.stderr).toContain('for tier 3 cleanup-loop implementation passes, use the tracked cleanup worker role instead of worker');
    });

    it('fails when cleanup-loop allows controller-side reclaim because it has enough local context', () => {
        const repoRoot = createRepoFixture({
            'docs/agentic/session-prompts/cleanup-loop.md': [
                '# Cleanup Loop',
                '',
                '- For the delegated planning pass, use the tracked write-capable `planner` role.',
                '- Once delegated planning starts, that planner is the authoritative plan author until it finishes, explicitly blocks, fails, or is abandoned only after a long wait, a direct status check, and a follow-up wait that still produces no usable progress signal.',
                '- While that planner pass is active, the controller must not do planner-grade repo discovery, redundant package-local scoping, issue reconciliation, or tracked plan drafting locally; limit controller-side inspection to the minimum needed to answer an explicit blocker question or resolve a controller-only seam decision.',
                '- The main thread may author the execution-grade `checklist-linked` package plan itself once it now has enough local context.',
                '- Use `execution-unit-select` for checklist-linked package work.',
                '- Read `ready_now_execution_unit` before implementation starts.',
                '- When a wave is selected, the controller stays inside that wave until its completion condition is met.',
                '- Wave review is the default approval gate for that coherent approved batch.',
                '- Each implemented approved execution unit or standalone execution target has a clean implementation review loop.',
                '- If the completed checklist-linked execution unit closes the final planned `P#-W#` item, finish the `P#-EXIT` evidence before closeout.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '- Use `planner` for bounded planning artifacts, `worker` for implementation write passes, and `reviewer` for adversarial review passes.',
                '- Do not treat planner latency, controller curiosity, or newly gathered local context as a valid reason to reclaim planning.',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup-loop prompt doc is missing required execution-unit orchestration marker');
        expect(result.stderr).toContain('must not author the execution-grade checklist-linked package plan itself just because it now has enough local context');
    });

    it('fails when workflow omits delegated-planner authority or blocker-only inspection guidance', () => {
        const repoRoot = createRepoFixture({
            'docs/AGENTIC_DEV_WORKFLOW.md': [
                '# Workflow',
                '',
                'Route task family before choosing a tier.',
                '',
                '- For checklist-linked package work, `execution_unit` is the execution/review surface and `slice_table` remains the atomic ownership map.',
                '- For checklist-linked package work, `ready_now_execution_unit` is required and `execution_waves` are optional unless one approved wave spans multiple slices.',
                '- `coverage_ledger` stays execution-only and wave review is the default approval gate for a coherent approved batch.',
                '- Large-package execution should review coherent retirement batches, not one tiny fix at a time.',
                '',
                '[cleanup-plan](./agentic/session-prompts/cleanup-plan.md)',
                '[cleanup-review](./agentic/session-prompts/cleanup-review.md)',
                '[feature-plan](./agentic/session-prompts/feature-plan.md)',
                '[feature-implement](./agentic/session-prompts/feature-implement.md)',
                '[feature-review](./agentic/session-prompts/feature-review.md)',
                '',
                'Feature Tier 2 work should use planner (`feature-plan`) -> reviewer (`feature-review`) -> implementer (`feature-implement`) -> reviewer (`feature-review`).',
                '',
            ].join('\n'),
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Workflow doc is missing required execution-unit marker');
        expect(result.stderr).toContain('delegated planner pass is active, keep it authoritative for plan authoring until it finishes, explicitly blocks, fails, or is abandoned after wait/status-check/wait with no usable progress signal');
        expect(result.stderr).toContain('limit controller-side inspection to explicit blocker or seam resolution');
        expect(result.stderr).toContain('do not do competing local plan drafting or redundant planning discovery');
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
                '- For standalone remediation, state that no checklist update applies.',
                '- Execute one approved `execution_unit` at a time.',
                '- Absorb now only when newly discovered residue stays within the same approved execution unit goal.',
                '- Replan required when current-source proof shows a new owner.',
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

    it('fails when a checklist mini-record uses a non-canonical Status token', () => {
        const checklistContent = [
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
            '## Mini-Record Contract',
            '',
            '- `Status`: `not started`, `in progress`, `blocked`, or `completed`',
            '',
            '- [ ] `P1-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [x] `P2-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: complete',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: next owner',
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
        ].join('\n');
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': checklistContent,
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Checklist mini-record `Status` must be one of: `not started`, `in progress`, `blocked`, `completed`'
        );
        expect(result.stderr).toContain('found `complete`');
    });

    it('accepts canonical checklist mini-record Status tokens', () => {
        const checklistContent = [
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
            '## Mini-Record Contract',
            '',
            '- `Status`: `not started`, `in progress`, `blocked`, or `completed`',
            '',
            '- [ ] `P1-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [x] `P2-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: completed',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: next owner',
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
        ].join('\n');
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': checklistContent,
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
    });

    it('ignores non-mini-record `Status` examples outside `P#-EXIT` blocks', () => {
        const checklistContent = [
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
            '## Mini-Record Contract',
            '',
            '- `Status`: `not started`, `in progress`, `blocked`, or `completed`',
            '- Example:',
            '  - Status: complete',
            '',
            '- [ ] `P1-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- [x] `P2-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: completed',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: next owner',
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
        ].join('\n');
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': checklistContent,
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
    });

    it('fails when a later `P10-EXIT` mini-record uses a non-canonical Status token', () => {
        const checklistContent = [
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
            '## Mini-Record Contract',
            '',
            '- `Status`: `not started`, `in progress`, `blocked`, or `completed`',
            '',
            '- [x] `P9-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: completed',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: next owner',
            '- [x] `P10-EXIT`',
            '  - required: record every mapped imported issue with an exact disposition',
            '- Status: complete',
            '- Plan: local-only',
            '- Last touched: 2026-04-18',
            '- Verification: not run',
            '- Follow-ups: none yet',
            '- Handoff: checklist complete only when this gate is satisfied',
            '',
        ].join('\n');
        const repoRoot = createRepoFixture({
            'ARCHITECTURE_CLEANUP_CHECKLIST.md': checklistContent,
        });
        tempRoots.push(repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Checklist mini-record `Status` must be one of: `not started`, `in progress`, `blocked`, `completed`'
        );
        expect(result.stderr).toContain('found `complete`');
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
