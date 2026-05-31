---
name: lineup-cleanup-implement
description: Use when the user explicitly asks for lineup-cleanup-implement, invokes the matching Lineup fresh-session launcher workflow, or wants this exact reusable launcher as a skill.
---

# Lineup Cleanup Implement

This skill is the skill-based replacement for the legacy `lineup-cleanup-implement.md` launcher.

Use the prompt body below as the authoritative workflow instructions for this skill invocation.

Use this only from the Lineup repo.

Read these files in order:

1. `docs/AGENTIC_DEV_WORKFLOW.md`
2. `agents.md`
3. `docs/agentic/session-prompts/cleanup-implement.md`

Then follow the tracked launcher exactly. Keep repo-specific policy in the repo docs, not in this repo-local skill.

After invoking this launcher, provide either:

- a pasted `NEXT_SESSION_HANDOFF` block, or
- one short follow-up message naming the approved plan path and exact checklist item, for example `Implement docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`

If you use the short follow-up form, the session should treat that message as the execution surface and not wait for a formal handoff block.
