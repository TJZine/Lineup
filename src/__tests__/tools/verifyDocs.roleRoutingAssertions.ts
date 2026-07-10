import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
    type VerifyDocsTestContext,
    createRepoFixture,
    getRenderedSessionPromptSet,
    runGit,
    runVerifier,
    getSessionPromptSetEndMarker,
    getSessionPromptSetStartMarker,
    writeRepoFile,
    writeRoleWorkflowClaimFixture,
    writeValidCodexRoleConfigFixture,
} from './verifyDocsTestHelpers';

export function registerVerifyDocsRoleRoutingAssertions({ tempRoots }: VerifyDocsTestContext): void {
    const renderedSessionPromptSet = getRenderedSessionPromptSet();
    const sessionPromptSetStartMarker = getSessionPromptSetStartMarker();
    const sessionPromptSetEndMarker = getSessionPromptSetEndMarker();

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

    it('keeps the tracked worker_luna role aligned with the tracked role model policy', () => {
        const workerLunaConfig = readFileSync(
            path.join(process.cwd(), '.codex/agents/worker-luna.toml'),
            'utf8'
        );
        expect(workerLunaConfig).toContain('model = "gpt-5.6-luna"');
        expect(workerLunaConfig).toContain('model_reasoning_effort = "xhigh"');
    });

    it('fails when the session prompt README drops the explicit planner/worker/reviewer role mapping', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        const readmePath = path.join(repoRoot, 'docs/agentic/session-prompts/README.md');
        const readme = readFileSync(readmePath, 'utf8').replace(
            [
                'Tracked role intent:',
                '',
                '- run `cleanup-plan.md` and `feature-plan.md` with the tracked `planner` role by default; use `planner_deep` for Tier 3, hotspot, priority-exit, cross-boundary, unresolved architecture/product seam, or security-adjacent planning',
                '- run `cleanup-implement.md` and `feature-implement.md` with the tracked `worker` role by default; use `worker_luna` only when an approved `CURRENT_EXECUTION_PACKET` explicitly declares the unit eligible as bounded, exact, and cheap to verify',
                '- route Tier 3 cleanup-loop.md implementation passes through the tracked cleanup_worker role only unless an approved execution packet explicitly names `worker_luna` for a bounded exact cheap-to-verify subunit',
                '- keep `cleanup-review.md`, `feature-review.md`, and `workflow-harness-review.md` read-only under the tracked `reviewer` role for normal review, with `maintainability_reviewer` for maintainability-only review and `architecture_reviewer` for hotspot/boundary/security-adjacent architecture review',
                '',
            ].join('\n'),
            ''
        );
        writeFileSync(readmePath, readme, 'utf8');

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Session prompt README must keep the tracked role intent explicit: planner/planner_deep for planning launchers, worker/worker_luna for eligible implementers, cleanup_worker for Tier 3 cleanup-loop implementation passes, reviewer plus specialized read-only reviewer roles for review launchers.'
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

    it('fails when worker_luna does not use its approved worker-luna config path', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        const configPath = path.join(repoRoot, '.codex/config.toml');
        writeFileSync(
            configPath,
            readFileSync(configPath, 'utf8').replace(
                'config_file = "agents/worker-luna.toml"',
                'config_file = "agents/worker.toml"'
            ),
            'utf8'
        );
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role worker_luna must use config_file="agents/worker-luna.toml" in .codex/config.toml'
        );
    });

    it('fails when a role config omits its exact CONFIGURED ROLE marker', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/agents/cleanup-worker.toml',
            'model = "gpt-5.6-sol"\nmodel_reasoning_effort = "medium"\ndeveloper_instructions = """\nOwn one bounded cleanup-loop implementation write scope at a time.\nMake the smallest defensible cleanup change inside the approved execution unit.\nUse this role only for Tier 3 cleanup-loop implementation passes; leave general implementation routing to the worker role.\n"""\n'
        );
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role config is missing exact CONFIGURED ROLE marker for cleanup_worker: .codex/agents/cleanup-worker.toml'
        );
    });

    it('fails when current role guidance mentions retired worker_54_high routing', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        const readmePath = path.join(repoRoot, 'docs/agentic/session-prompts/README.md');
        writeFileSync(
            readmePath,
            `${readFileSync(readmePath, 'utf8')}\nUse worker_54_high for bounded implementation.\n`,
            'utf8'
        );
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Current Codex role guidance must not mention retired role worker_54_high: docs/agentic/session-prompts/README.md'
        );
    });

    it('scans every active launcher from the session-prompt manifest for retired roles', () => {
        const activeLaunchers = [
            'cleanup-plan.md',
            'cleanup-implement.md',
            'cleanup-review.md',
            'cleanup-loop.md',
            'feature-plan.md',
            'feature-implement.md',
            'feature-review.md',
            'workflow-harness-review.md',
        ];

        for (const launcher of activeLaunchers) {
            const repoRoot = createRepoFixture();
            tempRoots.push(repoRoot);
            writeRoleWorkflowClaimFixture(repoRoot);
            writeValidCodexRoleConfigFixture(repoRoot);

            const relativePath = `docs/agentic/session-prompts/${launcher}`;
            const launcherPath = path.join(repoRoot, relativePath);
            writeFileSync(
                launcherPath,
                `${readFileSync(launcherPath, 'utf8')}\nUse worker_terra for this launcher.\n`,
                'utf8'
            );
            runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

            const result = runVerifier(repoRoot);
            expect(result.status).toBe(1);
            expect(result.stderr).toContain(
                `Current Codex role guidance must not mention retired role worker_terra: ${relativePath}`
            );
        }
    });

    it('fails when tracked codex config redeclares retired worker_54_high', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        const configPath = path.join(repoRoot, '.codex/config.toml');
        writeFileSync(
            configPath,
            `${readFileSync(configPath, 'utf8')}\n[agents.worker_54_high]\ndescription = "Retired worker"\nconfig_file = "agents/worker-luna.toml"\n`,
            'utf8'
        );
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Tracked Codex role config must not mention retired role worker_54_high: .codex/config.toml'
        );
    });

    it('fails when an agent role config mentions retired worker_54_high guidance', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        const workerPath = path.join(repoRoot, '.codex/agents/worker.toml');
        writeFileSync(
            workerPath,
            readFileSync(workerPath, 'utf8').replace(
                '"""\n',
                '"""\nDo not delegate this unit to worker_54_high.\n'
            ),
            'utf8'
        );
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'Codex role config must not mention retired role worker_54_high: .codex/agents/worker.toml'
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

    it('allows maintainers to tune planner reasoning effort without failing role verification', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/agents/planner.toml',
            'model = "gpt-5.5"\nmodel_reasoning_effort = "medium"\ndeveloper_instructions = """\nBegin your first assistant response with `CONFIGURED ROLE: planner` on its own line. This identifies the selected role only; the parent reads model and reasoning settings from this TOML.\nOwn bounded planning work, not product-code implementation.\nUse write access only for planning artifacts, scoped workflow docs, and execution-ready handoffs that the parent explicitly requested.\nDo the discovery needed to freeze the plan, surface unresolved seams early, and leave implementation to the worker role unless the parent narrows the scope to a planning-surface edit.\n"""\n'
        );
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stderr).not.toContain('model_reasoning_effort');
    });

    it('fails when the planner role loses its planning-only boundary instructions', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/agents/planner.toml',
            'model = "gpt-5.5"\nmodel_reasoning_effort = "high"\ndeveloper_instructions = """\nPlan when useful.\n"""\n'
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

    it('allows maintainers to tune cleanup_worker reasoning effort without failing role verification', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/agents/cleanup-worker.toml',
            'model = "gpt-5.5"\nmodel_reasoning_effort = "high"\ndeveloper_instructions = """\nBegin your first assistant response with `CONFIGURED ROLE: cleanup_worker` on its own line. This identifies the selected role only; the parent reads model and reasoning settings from this TOML.\nOwn one bounded cleanup-loop implementation write scope at a time.\nMake the smallest defensible cleanup change inside the approved execution unit, avoid unrelated edits, and validate the changed behavior before returning.\nUse this role only for Tier 3 cleanup-loop implementation passes; leave general implementation routing to the worker role.\n"""\n'
        );
        runGit(['add', '.codex/config.toml', '.codex/agents'], repoRoot);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(0);
        expect(result.stderr).not.toContain('model_reasoning_effort');
    });

    it('fails when the cleanup_worker role loses its cleanup-loop-only boundary instructions', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        writeRoleWorkflowClaimFixture(repoRoot);
        writeValidCodexRoleConfigFixture(repoRoot);
        writeRepoFile(
            repoRoot,
            '.codex/agents/cleanup-worker.toml',
            'model = "gpt-5.5"\nmodel_reasoning_effort = "medium"\ndeveloper_instructions = """\nOwn one bounded write scope at a time.\n"""\n'
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

    it('fails when cleanup/refactor routing row omits deep planner and specialized reviewer routing', () => {
        const repoRoot = createRepoFixture();
        tempRoots.push(repoRoot);

        const readmePath = path.join(repoRoot, 'docs/agentic/session-prompts/README.md');
        const readme = readFileSync(readmePath, 'utf8').replace(
            /\| cleanup\/refactor \|[^\n]+/u,
            '| cleanup/refactor | checklist cleanup | `cleanup-*` | Tier 3 uses cleanup-loop with planner + cleanup_worker + reviewer. |'
        );
        writeRepoFile(repoRoot, 'docs/agentic/session-prompts/README.md', readme);

        const result = runVerifier(repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('cleanup/refactor routing row');
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
}
