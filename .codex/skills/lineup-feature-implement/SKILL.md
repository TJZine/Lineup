---
name: lineup-feature-implement
description: Use when the user explicitly asks for lineup-feature-implement, invokes the matching Lineup fresh-session launcher workflow, or wants this exact reusable launcher as a skill.
---

# Lineup Feature Implement

This skill is the skill-based replacement for the legacy prompt file `/Users/tristan/.codex/prompts/lineup-feature-implement.md`.

Use the prompt body below as the authoritative workflow instructions for this skill invocation.

Use this only from the Lineup repo.

Read these files in order:

1. `/Users/tristan/Software/Lineup/agents.md`
2. `/Users/tristan/Software/Lineup/docs/agentic/document-map.md`
3. `/Users/tristan/Software/Lineup/docs/AGENTIC_DEV_WORKFLOW.md`
4. `/Users/tristan/Software/Lineup/docs/agentic/session-prompts/feature-implement.md`

Then follow the tracked launcher exactly. Keep repo-specific policy in the repo docs, not in this global prompt.

After invoking this launcher, accept either:
- a pasted `NEXT_SESSION_HANDOFF` block, or
- one short follow-up naming the approved plan path or active run bundle plus the target feature scope, for example `Implement docs/plans/2026-03-27-settings-diagnostics-redesign.md.`
