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

Read `AGENTS.md` and this runbook. Then load only the task-relevant sources:

- `docs/architecture/CURRENT_STATE.md`: ownership, hotspots, runtime flow
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`: active checklist-linked cleanup only
- `docs/design/ui-design-language.md`: UI language and TV interaction
- `docs/api/plex-integration.md`: Plex contracts
- `docs/agentic/codanna-playbook.md`: Codanna query/fallback detail
- active `docs/plans/**`: only when marked active for the current workstream
- `.agents/skills/**`: only skills whose descriptions match the task

Historical plans, baseline summaries, detector state, `docs/runs/**`, and archived
material are evidence, never current task authority.

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
| High | public contract, hotspot, Plex/security/persistence, broad UI/runtime, cross-session | explicit plan + implementation + one independent final review | `npm run verify` plus surface-specific proof |

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
- High risk gets one independent final review by default.
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
- write candidates: approved units with exact files, invariants, verification,
  stop conditions, and no overlap with another writer.

A Sol planner may hand an explicitly eligible, low-ambiguity, cheap-to-verify unit
to `worker_luna`. The plan must name exact files, invariants, verification, and stop
conditions. The main agent reviews the diff, integrates it, and reruns the proof.

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
- do not grow hotspots when an existing focused owner can carry the work;
- preserve one public shape per operation and explicit side-effect criticality;
- reject compatibility wrappers, fallback APIs, speculative helpers, and new
  dependencies unless the task proves they are needed;
- test stable public seams, not private helpers or giant snapshots;
- update current architecture, public contract, or checklist status in the same
  pass when the changed behavior makes those docs stale.

If ownership, product intent, security behavior, or a public contract is unclear,
stop and resolve it before implementation.

## Verification

Choose the smallest proof that covers the changed surface:

- logic-only: focused tests, `npm run typecheck`, and relevant lint;
- UI/navigation/Orchestrator/Plex/runtime/build: `npm run verify` plus any manual
  or device proof required by the task;
- workflow/control-plane-only: `npm run verify:docs` and `git diff --check`;
- docs outside the control plane: link/source inspection and the smallest relevant
  docs check.

`npm run verify:docs` validates only structural invariants: required entrypoints,
tracked skill/config presence, TOML parseability and role safety, local Markdown
links, and minimal active-plan metadata. It must not assert exact prose or encode a
second copy of workflow policy.

Never claim platform, visual, device, or runtime proof that was not run. Full-suite
verification does not replace a targeted reproduction or manual acceptance check.

## Plans And Handoffs

Tracked plans are inactive unless they clearly declare active status for the current
workstream. An active plan needs only:

- status and task family;
- goal/non-goals;
- owner seam and files in/out;
- invariants and public contracts;
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
2. run fresh risk-matched verification and read the result;
3. inspect `git status --short`, the diff stat, and the task-owned diff;
4. preserve and report unrelated user changes;
5. adjudicate material reviewer findings;
6. state residual risk or unavailable proof accurately.

Only stage, commit, push, or open a PR when requested. Keep commits focused.

## Harness Maintenance

Treat every workflow component as a hypothesis about what the current model cannot
reliably do alone. When models or tooling change, remove one non-load-bearing
component at a time and compare representative tasks on outcome correctness,
escaped defects, rework rounds, agent passes, wall time, and observed token/cost
data when available.

Do not add a new role, verifier rule, launcher, eval artifact, or authority document
without a concrete recurring failure it prevents and a removal/revisit trigger.
