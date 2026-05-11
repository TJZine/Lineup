---
name: lineup-cleanup-review
description: Use when the user explicitly asks for lineup-cleanup-review, invokes the matching Lineup fresh-session launcher workflow, or wants this exact reusable launcher as a skill.
---

# Lineup Cleanup Review

This skill is the skill-based replacement for the legacy prompt file `/Users/tristan/.codex/prompts/lineup-cleanup-review.md`.

Use the prompt body below as the authoritative workflow instructions for this skill invocation.

Use this only from the Lineup repo.

Read these files in order:

1. `/Users/tristan/Software/Lineup/agents.md`
2. `/Users/tristan/Software/Lineup/docs/agentic/document-map.md`
3. `/Users/tristan/Software/Lineup/docs/AGENTIC_DEV_WORKFLOW.md`
4. `/Users/tristan/Software/Lineup/docs/agentic/session-prompts/cleanup-review.md`

Then follow the tracked launcher exactly. Keep repo-specific policy in the repo docs, not in this global prompt.

After invoking this launcher, provide either:

- a pasted `NEXT_SESSION_HANDOFF` block, or
- one short follow-up message naming the exact artifact under review and checklist linkage when relevant, for example `Review docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`

If you use the short follow-up form, the session should treat that message as the review target and derive the remaining context from the tracked launcher docs.

