# Agentic Development Workflow

Canonical operating runbook for Lineup. `AGENTS.md` is the short entrypoint;
this file owns workflow, routing, verification, and handoff policy.

## Principles

- Use the smallest high-signal context that can safely complete the task.
- Default to one capable agent with direct access to source and verification.
- Add planning, delegation, or independent review only when risk or measured
  failures justify the extra pass.
- Enforce architecture and public contracts mechanically; do not mechanically
  freeze explanatory prose.
- Treat current source and executable proof as stronger than stale plans,
  detector output, or historical summaries.
- Keep prompts and tools direct, bounded, and easy to inspect. Avoid hidden state,
  duplicated policy, compatibility scaffolding, and speculative abstractions.

These principles follow current first-party guidance from
[OpenAI Harness Engineering](https://openai.com/index/harness-engineering/),
[OpenAI AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[OpenAI Skills](https://learn.chatgpt.com/docs/build-skills),
[OpenAI Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[Anthropic Harness Design](https://www.anthropic.com/engineering/harness-design-long-running-apps),
[Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
and [Anthropic Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents).

## Authority And Context Routing

Use `AGENTS.md` and the relevant sections of this runbook. Load task-relevant
sections of these sources and inspect affected owners and callers. Expand reading
when a dependency, invariant, or contract remains unclear; do not omit a changed
boundary merely to reduce context:

- `docs/architecture/CURRENT_STATE.md`: ownership, hotspots, runtime flow
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`: active checklist-linked cleanup only
- `docs/design/ui-design-language.md`: UI language and TV interaction
- `docs/api/plex-integration.md`: Plex contracts
- `docs/agentic/codanna-playbook.md`: Codanna query/fallback detail
- active `docs/plans/**`: only when marked active for the current workstream
- `.agents/skills/**`: only skills whose descriptions match the task

Historical plans, baseline summaries, detector state, `docs/runs/**`, and archived
material are evidence, never current task authority.

Select boundary skills by the responsibility or contract being changed. Data
origin alone does not require another skill: formatting a Plex-derived label does
not change Plex policy, and a store with UI callers does not necessarily change UI
lifecycle. Reuse existing task context; consult a peer only for an affected boundary
whose guidance is not already established. Skills add local invariants and proof
examples; this runbook owns verification gates, review, and delegation policy.

## Commands

Bootstrap:

```bash
nvm install
npm ci
```

Core gates:

```bash
npm run typecheck
npm run lint
npm run lint:css
npm run test:all
npm run verify
npm run verify:docs
```

Use quiet output on success where supported. Preserve detailed diagnostics on
failure; do not feed hundreds of passing test names back into agent context.

## Task Routing

Choose the task family and risk before editing.

| Risk | Typical work | Default workflow | Proof |
| --- | --- | --- | --- |
| Low | docs, comments, tiny isolated cleanup | one agent | focused check + diff audit |
| Medium | bounded feature, bug fix, internal refactor | one agent plans and implements | focused tests + type/lint as applicable |
| High | public contract, hotspot, Plex/security/persistence, broad UI/runtime, cross-session, or material workflow/control-plane change affecting entrypoints, routing, skills, roles, or verifier scope | explicit plan when needed + implementation; independent review when a concrete consequential risk warrants it | surface-specific proof; for control-plane changes, `npm run verify:docs`, `git diff --check`, and a direct consistency check of materially changed operative guidance |

Escalate only when the lower tier would materially weaken reliability.

### Planning

- Use `update_plan` for live state.
- Use a light execution brief for single-session work that needs explicit scope,
  owners, invariants, proof, and stop conditions.
- Create or refresh `docs/plans/**` only for durable cross-session memory or when
  explicitly requested.
- Use a separate planner only for unresolved seams, genuinely large multi-boundary
  work, or a durable handoff. Do not require a planner for routine implementation.
- Do not write pseudo-code for ordinary local choices.

### Review

- Low risk has no mandatory independent review.
- Medium risk gets an independent review only when novelty, blast radius, weak
  coverage, or hard-to-observe behavior justifies it.
- Use one independent review when requested or when a consequential risk benefits
  from a second assessment: novel security/data-loss boundaries, complex
  concurrency or lifecycle changes, broad contract migrations, or weak proof of
  changed behavior. State the concrete reason before dispatch. The high-risk label,
  file size, or location alone does not require a reviewer.
- Review a plan separately only when its seam or public contract is expensive to
  get wrong before implementation.
- Re-review only after a material finding or material review-surface change. Do
  not require both same-reviewer closure and a second fresh clean gate for an
  unchanged artifact.
- Reviewers stay read-only, lead with concrete findings, and avoid style-only
  commentary.

### Delegation

Default to one agent. Delegate when work is independent and the expected benefit
exceeds coordination cost:

- good read-only candidates: focused exploration, official documentation,
  adversarial review, test/log analysis, long waits;
- write candidates: approved units with a clear owner/write boundary, invariants,
  verification, stop conditions, and no overlap with another writer. Require exact
  files only for concurrent writers or sensitive shared surfaces.

Use `worker_luna` by default for a bounded delegated unit when the outcome, owner
seam, contracts, acceptance criteria, and direct proof are clear, including work
that needs repository comprehension, exact-file discovery, and routine local coding
judgment. The worker may add focused tests and diagnose failures caused by its
implementation. Use `worker` when the same settled bounded unit needs material
local design judgment, cross-boundary comprehension, complex diagnosis, or proof
interpretation. Return unresolved product, ownership, public-contract, architecture,
or proof decisions to planning. Plans describe risk and constraints rather than
permanently binding a model; the controller selects the current role at dispatch.
The main agent reviews the diff, integrates it, and confirms current proof under
Verification below. An approved write boundary may be established by the main agent
within the user's task; it is not a separate user approval gate.

The main agent owns decisions, integration, and final verification. Keep depth at
one. Return concise findings rather than raw transcripts.

For genuinely large multi-unit work, explicitly use the
`large-task-orchestration` skill. The main task remains the authoritative
controller and integrates checkpointed, decision-complete units. Reuse a completed
worker only for adjacent work with the same owner and contracts; use a fresh worker
when the seam or assumptions change, and a fresh read-only reviewer for required
independent final review. Give that reviewer a bounded task/diff/proof/risk packet
without the implementation transcript. Treat six threads as a cap rather than a
target and keep delegation depth at one.

## Boundary Guardrails

For every non-trivial change:

- keep `src/App.ts` and `src/Orchestrator.ts` as composition roots;
- keep storage, Plex transport/auth, UI focus/navigation, and lifecycle policy in
  their documented owners;
- choose ownership by cohesion: keep behavior with the owner when it shares the
  same invariants, state, lifecycle, dependency direction, and reason to change;
- extract only a distinct present-day responsibility, lifecycle/resource owner,
  trust boundary, policy, translation, or real consumer; line count, private-test
  access, speculative reuse, and preferred patterns are not sufficient reasons;
- reject both responsibility accumulation and pass-through fragmentation;
- preserve one public shape per operation and explicit side-effect criticality;
- reject compatibility wrappers, fallback APIs, speculative helpers, and new
  dependencies unless the task proves they are needed;
- test stable public seams, not private helpers or giant snapshots;
- update current architecture, public contract, or checklist status in the same
  pass when the changed behavior makes those docs stale.

Complete authorized work through implementation, verification, and repair of
failures caused by the change. Resolve routine ownership, local design, and proof
questions from current source, tests, relevant authority, and task decisions.
Ask only when investigation leaves a consequential product, security, data-loss,
public-contract, or scope choice outside existing authorization. New UI direction
and material changes to approved design remain collaborative decisions.

Workers return decisions outside their boundary to the main agent; the main agent
resolves them within the user's task before escalating to the user. Conflicting
stale prose alone does not require confirmation when current intent is established.
Continue independent work while a required decision is pending.

Production LOC and named hotspots are attention signals. For behavior or ownership
changes in a large owner, inspect the affected lifecycle, callers, and invariants;
expand to the whole owner when needed. Record a brief cohesion decision when adding
or moving responsibilities. The 500/800 thresholds do not themselves require a
reviewer, a written disposition, or an extraction. Use the Review criteria above.

## Verification

Choose the smallest proof that covers the changed surface:

Use behavior and contract impact to select the gate. Comments, formatting, and
demonstrably nonbehavioral edits may use focused structural/static checks even in
UI, runtime, or hotspot files; briefly explain why broader verification adds no
relevant proof. Inspect affected owners, callers, contracts, and existing tests
before narrowing a gate. Uncertain behavior or integration impact retains the
stronger gate below.

- logic-only: focused tests, `npm run typecheck`, and relevant lint;
- UI/navigation/Orchestrator/Plex/runtime/build behavior: `npm run verify` plus any manual
  or device proof required by the task;
- architecture attention evidence: `npm run verify:maintainability`; this reports
  production files over 500/800 lines but does not decide or enforce extraction;
- workflow/control-plane-only: `npm run verify:docs` and `git diff --check`;
- docs outside the control plane: link/source inspection and the smallest relevant
  docs check.

`npm run verify:docs` validates structural invariants: required authority
entrypoints, present skill metadata, declared role paths, TOML parseability and role
safety, local Markdown links, and minimal active-plan metadata. It does not require
a fixed skill or role roster. It must not assert exact prose or encode a second
copy of workflow policy.

Verification remains current when its output was inspected and the checked code,
inputs, dependencies, and relevant environment are unchanged. Reuse that evidence,
including workers' observed results. Rerun affected checks when edits or integration
invalidate it, and add integration proof for interactions the unit checks did not
cover. Do not repeat an unchanged clean gate solely at closeout.

Never claim platform, visual, device, or runtime proof that was not run. Full-suite
verification does not replace a targeted reproduction or manual acceptance check.

### Command Evidence And Suite Selection

The scripts in `package.json` and Jest configurations define executable scope:

| Command | Evidence |
| --- | --- |
| `npm test` / `npm run test:unit` | Same unit suite; excludes tool, contract/policy, and type-contract tests |
| `npm run test:coverage` | Unit suite with coverage thresholds; includes the unit run |
| `npm run test:contracts` | Contract/policy and `types.test.ts` suites under `jest.contracts.config.js` |
| `npm run test:tools` / `npm run test:node-tools` | Separate TypeScript and Node tooling suites |
| `npm run test:all` | Unit, contract, and both tooling suites; no coverage threshold or build proof |
| `npm run verify:architecture` | ESLint plus advisory maintainability evidence; includes `lint` |
| `npm run verify` | Typecheck, architecture/CSS lint, unit coverage, contract/tooling suites, docs structure, lean bundle analysis, and dev build |
| `npm run verify:quick` | Typecheck plus `test:all`; does not replace the behavior gate above |

Use the matching suite command with a focused test path (for example,
`npm run test:contracts -- --runTestsByPath path/to/example.contract.test.ts`).
Check discovery before claiming focused proof. Do not habitually run `test:all`,
`lint`, or typecheck immediately before an unchanged `verify`; those checks are
included. A targeted reproduction may still add evidence that the aggregate lacks.

`verify:bundle` builds the lean analyzed profile unless `--skip-build` is supplied;
use that flag only with a current analyzed artifact. The final `build` in `verify`
checks the distinct dev profile and leaves dev output in `dist`. CI instead checks
the lean candidate, removes analyzer metadata, verifies release contents/digest,
and packages that candidate. Local aggregate success is not release-artifact or
device proof. Preserve both profiles and reuse artifacts only under currentness
rules above.

## Plans And Handoffs

Tracked plans are inactive unless they clearly declare active status for the current
workstream. An active plan needs only:

- status and task family;
- goal/non-goals;
- owner seam and likely files or allowed write boundary; exact files only when
  concurrent writers or sensitive shared surfaces need collision protection;
- invariants and public contracts;
- acceptance criteria;
- verification and stop/replan triggers;
- progress/decisions when work spans sessions.

Archive or mark a plan historical when it closes. Do not require package maps,
execution-wave schemas, coverage ledgers, source-finding identifiers, or repeated
policy prose unless the specific task genuinely needs them.

When handing off, report the exact next action, relevant artifact, files, proof
already run, and blockers. Do not create a handoff artifact when the work is done.

## Closeout

Before claiming completion:

1. confirm the requested outcome and authority-doc updates;
2. confirm current risk-matched verification and inspect its results;
3. inspect `git status --short`, the diff stat, and the task-owned diff;
4. preserve and report unrelated user changes;
5. adjudicate material reviewer findings;
6. state residual risk or unavailable proof accurately.

Only stage, commit, push, or open a PR when requested. Keep commits focused.

## Harness Maintenance

Treat every workflow component as a hypothesis about what the current model cannot
reliably do alone. Revisit components against current first-party guidance,
representative independent benchmark evidence, and observed repository failures;
remove non-load-bearing machinery one component at a time.

Do not add a new role, verifier rule, launcher, eval artifact, or authority document
without a concrete recurring failure it prevents and a removal/revisit trigger.
