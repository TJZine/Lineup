import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const verifierPath = path.resolve(process.cwd(), 'tools/verify-docs.mjs');
const VERIFY_DOCS_SYNC_TIMEOUT_MS = 15_000;
const VERIFY_DOCS_SYNC_MAX_BUFFER = 10 * 1024 * 1024;

export function formatSyncFailure(
    command: string,
    args: string[],
    result: ReturnType<typeof spawnSync>
): string {
    const status = typeof result.status === 'number'
        ? `status=${result.status}`
        : result.signal
            ? `signal=${result.signal}`
            : 'status=unknown';
    const stdout = String(result.stdout ?? '').trim();
    const stderr = String(result.stderr ?? '').trim();

    if (result.error) {
        return `${command} ${args.join(' ')} failed before exit (${status}): ${result.error.message}\nstdout:\n${stdout}\n\nstderr:\n${stderr}`;
    }

    const errorOutput = stderr || stdout || `exit ${status}`;
    return `${command} ${args.join(' ')} failed (${status}): ${errorOutput}`;
}

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

export type VerifyDocsTestContext = {
    tempRoots: string[];
};

export function loadPromptInventoriesFromHarnessDocsLib(): PromptInventories {
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
        timeout: VERIFY_DOCS_SYNC_TIMEOUT_MS,
        maxBuffer: VERIFY_DOCS_SYNC_MAX_BUFFER,
    });

    if (result.error || result.status !== 0) {
        throw new Error(
            `Failed to load expected prompt inventories from harness-docs-lib.mjs: ${formatSyncFailure(
                process.execPath,
                ['--input-type=module', '--eval', script],
                result
            )}`
        );
    }

    return JSON.parse(result.stdout) as PromptInventories;
}

let cachedPromptInventories: PromptInventories | null = null;

export function getPromptInventories(): PromptInventories {
    if (cachedPromptInventories) {
        return cachedPromptInventories;
    }

    cachedPromptInventories = loadPromptInventoriesFromHarnessDocsLib();
    return cachedPromptInventories;
}

export function getExpectedEvalPromptFiles(): string[] {
    return getPromptInventories().expectedEvalPromptFiles;
}

export function getExpectedSessionPromptFiles(): string[] {
    return getPromptInventories().expectedSessionPromptFiles;
}

export function getRequiredRepoLocalSkills(): string[] {
    return getPromptInventories().requiredRepoLocalSkills;
}

export function getRequiredRepoLocalSkillFiles(): string[] {
    return getPromptInventories().requiredRepoLocalSkillFiles;
}

export function getSkillMirrorManifestPath(): string {
    return getPromptInventories().skillMirrorManifestPath;
}

export function getSessionPromptSetStartMarker(): string {
    return getPromptInventories().sessionPromptSetStartMarker;
}

export function getSessionPromptSetEndMarker(): string {
    return getPromptInventories().sessionPromptSetEndMarker;
}

export function getEvalPromptInventoryStartMarker(): string {
    return getPromptInventories().evalPromptInventoryStartMarker;
}

export function getEvalPromptInventoryEndMarker(): string {
    return getPromptInventories().evalPromptInventoryEndMarker;
}

export function getRenderedSessionPromptSet(): string {
    return getPromptInventories().renderedSessionPromptSet;
}

export function getRenderedEvalPromptInventory(): string {
    return getPromptInventories().renderedEvalPromptInventory;
}

export function getRequiredFiles(): string[] {
    return [
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
        getSkillMirrorManifestPath(),
    ];
}

export function writeRepoFile(repoRoot: string, relativePath: string, content = '# Placeholder\n'): void {
    const fullPath = path.join(repoRoot, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
}

export function writeValidRepoLocalSkillFixtures(repoRoot: string): void {
    const requiredRepoLocalSkillFiles = getRequiredRepoLocalSkillFiles();
    const requiredRepoLocalSkills = getRequiredRepoLocalSkills();

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

export function buildChecklistLinkedPackageDecomposition({
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

export function writeValidSkillMirrorFixture(repoRoot: string): void {
    const skillMirrorManifestPath = getSkillMirrorManifestPath();

    writeRepoFile(repoRoot, skillMirrorManifestPath, 'global:brainstorming\n');
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

export function writeValidSessionPromptFixture(repoRoot: string): void {
    const sessionPromptSetStartMarker = getSessionPromptSetStartMarker();
    const renderedSessionPromptSet = getRenderedSessionPromptSet();
    const sessionPromptSetEndMarker = getSessionPromptSetEndMarker();
    const expectedSessionPromptFiles = getExpectedSessionPromptFiles();

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

export function writeValidEvalPromptFixture(repoRoot: string): void {
    const evalPromptInventoryStartMarker = getEvalPromptInventoryStartMarker();
    const renderedEvalPromptInventory = getRenderedEvalPromptInventory();
    const evalPromptInventoryEndMarker = getEvalPromptInventoryEndMarker();

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

export function writeMutatedEvalPromptFixture(repoRoot: string): void {
    const renderedEvalPromptInventory = getRenderedEvalPromptInventory();
    const evalPromptInventoryStartMarker = getEvalPromptInventoryStartMarker();
    const evalPromptInventoryEndMarker = getEvalPromptInventoryEndMarker();
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

export function writeRoleWorkflowClaimFixture(repoRoot: string): void {
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
const CODEX_MODEL_PLANNER = 'gpt-5.5';

export function writeValidCodexRoleConfigFixture(
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
            'model_reasoning_effort = "medium"',
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

export function createRepoFixture(overrides: Partial<Record<string, string>> = {}): string {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'lineup-verify-docs-'));
    const requiredFiles = getRequiredFiles();
    const expectedEvalPromptFiles = getExpectedEvalPromptFiles();
    try {
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
    } catch (error) {
        rmSync(repoRoot, { recursive: true, force: true });
        throw error;
    }
}

export function runVerifier(
    repoRoot: string,
    args: string[] = [],
    env: NodeJS.ProcessEnv | undefined = undefined
): ReturnType<typeof spawnSync> {
    const result = spawnSync(process.execPath, [verifierPath, ...args], {
        cwd: repoRoot,
        encoding: 'utf8',
        env,
        timeout: VERIFY_DOCS_SYNC_TIMEOUT_MS,
        maxBuffer: VERIFY_DOCS_SYNC_MAX_BUFFER,
    });
    if (result.error) {
        throw new Error(formatSyncFailure(process.execPath, [verifierPath, ...args], result));
    }
    return result;
}

export function runGit(args: string[], repoRoot: string, env: NodeJS.ProcessEnv | undefined = undefined): void {
    const result = spawnSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        env,
        timeout: VERIFY_DOCS_SYNC_TIMEOUT_MS,
        maxBuffer: VERIFY_DOCS_SYNC_MAX_BUFFER,
    });
    if (result.error || result.status !== 0) {
        throw new Error(formatSyncFailure('git', args, result));
    }
}
