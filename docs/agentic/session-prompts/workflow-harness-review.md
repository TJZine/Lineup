# Workflow Harness Review Launcher

Use this prompt when you want an adversarial review of the entire Lineup agent workflow, control plane, skills topology, eval surface, and review loop.

This is not a style pass. It is a production-readiness audit for whether the repo harness is likely to produce reliable, low-slop agent behavior over time.

Run this launcher through the workflow-harness review path with the read-only `reviewer` role by default. Add an optional `maintainability_reviewer` sidecar only when prompt bloat, slop, file shape, or maintainability is a specific review target.

## Review Goal

Determine whether the Lineup harness is:

- simple enough to stay usable
- explicit enough for fresh-session execution
- mechanically enforced enough to resist drift
- measured enough to detect regressions
- strict enough to prevent architectural leakage and technical debt
- aligned with current best-practice guidance from OpenAI and Anthropic

## External Benchmark Sources

As of 2026-03-09, review against these sources and treat them as explicit benchmark criteria:

1. OpenAI, [`Codex Workflows`](https://developers.openai.com/codex/workflows/) (accessed March 9, 2026)
   - workflow prompts should carry explicit context notes, task framing, and concrete verification expectations
   - Codex CLI work usually needs explicit path/file references instead of relying on implied local context
   - agents should report the commands they ran and the results they observed after checks
2. OpenAI, [`Codex Multi-agents`](https://developers.openai.com/codex/multi-agent/) (accessed March 9, 2026)
   - role definitions should stay narrow, opinionated, and easy to route correctly
   - shallow delegation is the default; `agents.max_depth = 1` is the conservative baseline
   - read-only explorer/reviewer/docs roles are the expected pattern, not broad write access by default
3. Anthropic, [`Claude Code sub-agents`](https://code.claude.com/docs/en/sub-agents/) (accessed March 9, 2026)
   - subagents should have focused responsibilities, explicit tool access, and independent permissions
   - project subagents should be checked into version control when they are part of the durable workflow
   - read-only reviewer-style subagents are a first-class best-practice pattern
4. OpenAI, [`Harness engineering: leveraging Codex in an agent-first world`](https://openai.com/index/harness-engineering/) (February 11, 2026)
   - the repo's stable policy file should act as a map, not an encyclopedia
   - repository docs should be the system of record
   - plans should be first-class artifacts
   - knowledge surfaces should be mechanically validated
   - recurring doc gardening and garbage collection should exist
   - agents should use normal repo tools directly rather than human copy-paste glue
5. Anthropic, [`Building Effective AI Agents`](https://www.anthropic.com/engineering/building-effective-agents) (December 19, 2024)
   - prefer simple composable workflows over unnecessary framework complexity
   - keep planning transparent
   - invest in the agent-computer interface through clear tool and workflow design
   - add complexity only when it clearly improves outcomes
6. Anthropic, [`Demystifying evals for AI agents`](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (January 9, 2026)
   - practice eval-driven development
   - define success early
   - keep eval ownership close to the product/domain work
   - use evals as a routine workflow-quality signal, not an afterthought

Do not reward Lineup for matching these sources cosmetically. Evaluate whether the repo actually embodies the behaviors they recommend.

Lineup stable policy file: `agents.md`

## Quick-Start (Light Review)

For a light harness review (aim: ~15-25 minutes total), read these and then jump to the Required Review Axes:

- [`agents.md`](../../../agents.md) (skim, ~3-5m): stable policy map and defaults
- [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md) (deep, ~8-12m): operating runbook, precedence, and verification gates
- [`tools/verify-docs.mjs`](../../../tools/verify-docs.mjs) (skim, ~3-5m): mechanical enforcement surface (what is actually checked)

## Required Read Order

### Core (must-read for a full review)

Rationale: these define the authority surfaces, how work is routed, and what is mechanically enforced.

1. [`agents.md`](../../../agents.md) (deep, ~8-12m): stable policy and global defaults
2. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md) (deep, ~12-18m): workflow, precedence, routing, and verification expectations
3. [`docs/agentic/codanna-playbook.md`](../codanna-playbook.md) (deep, ~8-12m): Codanna-first discovery and fallback rules
4. [`docs/agentic/skill-strategy.md`](../skill-strategy.md) (skim, ~5-8m): skill topology
5. [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md) (deep, ~10-15m): single plan-standard authority surface, including `Universal Plan Core` and `Cleanup Overlay`
6. [`docs/agentic/historical-plan-corpus-review.md`](../historical-plan-corpus-review.md) (skim, ~5-8m): common failure modes and what to avoid repeating
7. [`docs/agentic/evals/README.md`](../evals/README.md) (deep, ~10-15m): eval protocol, ownership, and what is measured
8. [`docs/agentic/evals/rubric.md`](../evals/rubric.md) (deep, ~8-12m): scoring criteria and definitions
9. [`docs/agentic/evals-roadmap.md`](../evals-roadmap.md) (skim, ~5-8m): planned eval surfaces and prioritization
10. [`tools/verify-docs.mjs`](../../../tools/verify-docs.mjs) (deep, ~8-12m): exact checks and failure modes

### Supporting context (read as needed)

Rationale: these validate the core workflow against steady-state plans, architecture reality, and maintenance discipline.

11. [`docs/agentic/doc-gardening-checklist.md`](../doc-gardening-checklist.md) (skim, ~5-8m): maintenance and garbage-collection expectations
12. [`docs/agentic/phase-2-steady-state-plan.md`](../phase-2-steady-state-plan.md) (skim, ~5-10m): medium-term harness shape
13. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md) (deep, ~10-15m): current product/architecture truth surface
14. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md) (skim, ~8-12m): active cleanup status and hotspots
15. [`docs/plans/README.md`](../../plans/README.md) (skim, ~3-5m): how active tracked plans are organized
16. [`docs/archive/plans/README.md`](../../archive/plans/README.md) (skim, ~3-5m): how completed/superseded plans are archived
17. [`docs/runs/README.md`](../../runs/README.md) (skim, ~3-5m): local-only run bundles and promotion rules

Also inspect the tracked session launchers in this directory and the repo-local tracked skill surfaces under [`.agents/skills/`](../../../.agents/skills/).

## Required Review Axes

### 1. Control-Plane Shape

Check whether Lineup has a clear and minimal control plane:

- stable policy
- one operating runbook
- one current architecture truth surface
- one active backlog/status surface
- plan surfaces with clear active vs archived roles
- local-only execution artifacts kept out of tracked truth

Flag:

- duplicate authority
- conflicting precedence
- missing source-of-truth boundaries
- stale docs that still look authoritative
- unnecessary workflow sprawl

### 2. Simplicity Versus Over-Orchestration

Check whether the harness is using the simplest workflow that still gives reliable outcomes.

Flag:

- steps that add ceremony without clear risk reduction
- extra prompt layers that duplicate repo docs
- unnecessary role proliferation
- role configs that over-expand write-capable roles or imply automatic failover without explicit fallback roles
- places where reusable prompts should stay generic
- places where the repo should use a task-specific run bundle instead

Also flag the opposite failure:

- places where the workflow is too loose for risky work and should be more explicit

### 3. Transparency And Fresh-Session Execution

Check whether a new session can safely execute the workflow without hidden context.

Flag:

- plans that depend on tacit knowledge
- launcher prompts that assume prior chat memory
- docs that omit read order, stop conditions, or verification expectations
- archived or local-only material that the active workflow still depends on

### 4. Agent-Computer Interface Quality

Review whether the repo gives agents a clear working interface:

- repo docs are readable and discoverable
- Codanna-first discovery is clearly explained
- tool choice and fallback rules are explicit
- worktree usage is clear for isolated execution
- verification commands are concrete
- review prompts tell the agent what good and bad behavior actually look like

Flag:

- vague tool instructions
- missing fallback behavior
- steps that force manual copying instead of discoverable repo context
- ambiguity around tracked versus local-only surfaces

### 5. Mechanical Enforcement

Check whether important workflow rules are actually enforced.

Review:

- [`tools/verify-docs.mjs`](../../../tools/verify-docs.mjs)
- tracked Codex role config in [`.codex/config.toml`](../../../.codex/config.toml) and [`.codex/agents/`](../../../.codex/agents/)
- tracked-vs-local rules
- required control-plane files
- session-prompt validation coverage
- docs cross-linking expectations

Flag:

- workflow claims that are not mechanically checked anywhere
- verifier gaps that allow drift in critical docs
- verifier gaps that allow role-declaration drift, missing role config files, or read-only-role contract drift
- checks that are too weak to catch real entropy
- checks that are so strict they create noise without protecting quality
- local run-bundle path drift that makes `docs/runs/...` artifacts look like `docs/plans/...` in handoffs or required-reading sections

### 6. Plan And Execution Quality

Check whether the workflow enforces high-quality plans and bounded execution.

Review:

- plan-authoring standard
- archive policy
- corpus-review trigger
- session prompts for planning and implementation

Flag:

- missing Codanna impact gates
- weak rollback expectations
- scope ambiguity
- local-only dependencies in tracked plans
- failure to turn strong historical work into reusable standards or eval seeds
- detector-backed closeout plans that rely on `No open issues matching` without an explicit current-code source audit or ownership proof when reconciling checklist state

### 7. Eval Maturity

Check whether Lineup is actually set up for eval-driven improvement.

Review:

- eval prompt inventory
- rubric
- scorecard template
- roadmap
- corpus review

Flag:

- evals that do not reflect real repo risks
- gaps between documented failure modes and eval coverage
- prompts that are too synthetic or too vague
- missing ownership or maintenance rules
- places where eval outputs could pollute tracked docs

### 8. Garbage Collection And Tech Debt Resistance

Check whether the repo will stay healthy after the cleanup effort stabilizes.

Review:

- doc-gardening cadence
- archive rules
- corpus-review updates
- phase-2 steady-state plan
- skill topology

Flag:

- places where stale guidance will accumulate
- places where agents may continue copying cleanup-era patterns after the cleanup is over
- missing steady-state transition triggers
- missing cleanup loops for docs, prompts, or skills

### 9. Review And Verification Loop

Check whether the repo is likely to catch bad changes before they compound.

Review:

- default Plan -> Code -> Review loop
- implementation review guidance
- CodeRabbit/Oxlint/verify-docs interactions if relevant to the reviewed docs
- risk-based verification rules

Flag:

- claims of rigor without concrete checks
- review prompts that encourage shallow commentary instead of bug finding
- missing verification depth for hotspot, UI, Plex, or orchestration work
- multi-agent guidance that normalizes unnecessary spawning, deep nesting, or unnecessary waiting
- feedback loops that are documented but not practically usable

## Required Findings Format

Output findings first, ordered by severity.

For each finding include:

1. severity
2. affected file or workflow surface
3. the concrete risk
4. why it matters for agent effectiveness or codebase health
5. the exact fix or adjustment you recommend
6. which external benchmark principle it maps to

After findings, include:

- open questions or assumptions
- a short strengths section naming what Lineup is already doing well
- a short prioritized improvement list with the next 3 highest-value changes only

## Review Rules

- prioritize contradictions, drift risks, missing enforcement, and workflow inefficiency over style
- do not suggest adding complexity unless it clearly improves reliability
- do not reward duplicated documentation
- do not suggest local-only artifacts become tracked unless there is a strong reason
- explicitly flag stale benchmark references and stale date-bound claims
- do not ignore places where the harness could create future AI slop or technical debt
- explicitly flag gaps that encourage technical debt or AI slop
- if no material findings remain, say so explicitly and still note the top residual risks
