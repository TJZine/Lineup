---
name: lineup-cleanup-plan
description: Use when the user explicitly asks for lineup-cleanup-plan, invokes the matching Lineup fresh-session launcher workflow, or wants this exact reusable launcher as a skill.
---

# Lineup Cleanup Plan

This skill is the skill-based replacement for the legacy `lineup-cleanup-plan.md` launcher.

Use the prompt body below as the authoritative workflow instructions for this skill invocation.

Use this only from the Lineup repo.

Read these files in order:

1. `AGENTS.md`
2. `docs/agentic/document-map.md`
3. `docs/AGENTIC_DEV_WORKFLOW.md`
4. `docs/agentic/session-prompts/cleanup-plan.md`

Then follow the tracked launcher exactly. Keep repo-specific policy in the repo docs, not in this repo-local skill.

After invoking this launcher, provide either:

- a pasted `NEXT_SESSION_HANDOFF` block, or
- one short follow-up message naming the exact checklist item, for example `We are working on ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`

If you use the short follow-up form, the session should treat that message as the active scope selector and derive the remaining context from the tracked launcher docs.
