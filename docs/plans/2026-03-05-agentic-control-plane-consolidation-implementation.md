# Agentic Control Plane Consolidation Implementation Plan

> **Execution note:** Follow the current repo workflow and execute this plan task-by-task.

**Goal:** Consolidate Lineup's agent workflow docs into a tighter control plane with explicit precedence, Codanna-first discovery guidance, a canonical current-architecture doc, and a documented phase-2 steady-state transition.

**Architecture:** Keep `agents.md` as the stable policy layer, keep one operational runbook, add a document map that defines precedence and archiving rules, establish one canonical architecture truth doc, and document both current eval guidance and the post-cleanup transition plan. Avoid reintroducing a repo-local `CODEX.md`.

**Tech Stack:** Markdown documentation, Codex/Codanna workflow, repo-local skills, Antigravity skill mirrors.

---

## Task 1: Define the control-plane document map

**Files:**
- Create: `docs/agentic/document-map.md`
- Modify: `docs/AGENTIC_DEV_WORKFLOW.md`
- Modify: `agents.md`

**Step 1: Write the new control-plane map**

- Define document classes: stable policy, runbook, Codanna playbook, current architecture truth, active backlog, plans, skills, historical decisions, archives.
- Define precedence order and conflict resolution rules.
- Add garbage-collection rules so stale guidance is archived or rewritten instead of silently coexisting.

**Step 2: Tighten the workflow doc**

- Make `docs/AGENTIC_DEV_WORKFLOW.md` the single operational runbook.
- Reference the document map instead of repeating policy across multiple docs.

**Step 3: Update repo instructions**

- Point `agents.md` at the new document map and Codanna playbook.
- Keep policy concise; avoid duplicating long workflow prose in `agents.md`.

## Task 2: Make Codanna a first-class documented workflow tool

**Files:**
- Create: `docs/agentic/codanna-playbook.md`
- Modify: `agents.md`
- Modify: `docs/AGENTIC_DEV_WORKFLOW.md`

**Step 1: Add the Codanna playbook**

- Document the discovery order, query-shaping rules, impact-analysis pattern, and `rg` fallback.
- Include concrete query examples tied to Lineup hotspots and boundaries.

**Step 2: Wire it into the workflow**

- Make Codanna references explicit in `agents.md` and the workflow doc so it remains the default evidence/discovery path.

## Task 3: Establish a canonical current-architecture truth

**Files:**
- Create: `docs/architecture/CURRENT_STATE.md`
- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/modules.md`
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

**Step 1: Write the current-state architecture doc**

- Capture the real composition roots, module boundaries, persistent-state owners, and current hotspots.
- Link the cleanup backlog as the active change queue.

**Step 2: Turn existing architecture docs into entry/reference docs**

- Make `README.md` the architecture entry point.
- Make `modules.md` a current module inventory/reference instead of a stale high-level narrative.

**Step 3: Wire the cleanup checklist to the new architecture truth**

- Add the new Plex boundary skill where relevant.
- Reference the canonical current-state doc so backlog work points to the right architecture baseline.

## Task 4: Add evaluation and phase-2 transition guidance

**Files:**
- Create: `docs/agentic/evals-roadmap.md`
- Create: `docs/agentic/phase-2-steady-state-plan.md`
- Modify: `docs/agentic/skill-strategy.md`
- Modify: `docs/development/testing.md`

**Step 1: Write a lightweight eval roadmap**

- Define a small regression set for the repo-specific failure modes already identified.
- Keep it lightweight and prompt-driven for now rather than fully automated.

**Step 2: Write the phase-2 transition plan**

- Define the conditions for moving from cleanup-era guidance to steady-state invariants.
- Specify which skills/docs should be tightened once the backlog stabilizes.

**Step 3: Link the new guidance**

- Update the skill strategy and testing guide so the evals and phase-2 plan are part of the documented workflow.

## Task 5: Verify the resulting topology

**Files:**
- Review only

**Step 1: Validate the document topology**

Run: `rg -n "source of truth|document map|Codanna|CURRENT_STATE|phase-2|eval" agents.md docs ARCHITECTURE_CLEANUP_CHECKLIST.md`
Expected: the new control-plane docs and links are discoverable.

**Step 2: Validate no duplicate repo-local Codex globals were added**

Run: `find .codex/skills .agent/skills -maxdepth 2 -name SKILL.md | sort`
Expected: `.codex/skills/` remains Lineup-only; `.agent/skills/` contains the mirrored set.

**Step 3: Commit**

```bash
git add agents.md ARCHITECTURE_CLEANUP_CHECKLIST.md docs/AGENTIC_DEV_WORKFLOW.md docs/architecture/README.md docs/architecture/modules.md docs/architecture/CURRENT_STATE.md docs/agentic/document-map.md docs/agentic/codanna-playbook.md docs/agentic/evals-roadmap.md docs/agentic/phase-2-steady-state-plan.md docs/agentic/skill-strategy.md docs/development/testing.md docs/plans/2026-03-05-agentic-control-plane-consolidation-implementation.md
git commit -m "docs: consolidate agentic control plane"
```
