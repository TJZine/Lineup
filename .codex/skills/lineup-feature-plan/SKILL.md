---
name: lineup-feature-plan
description: Use when the user explicitly asks for lineup-feature-plan, invokes the matching Lineup fresh-session launcher workflow, or wants this exact reusable launcher as a skill.
---

# Lineup Feature Plan

This skill is the skill-based replacement for the legacy prompt file `/Users/tristan/.codex/prompts/lineup-feature-plan.md`.

Use the prompt body below as the authoritative workflow instructions for this skill invocation.

Use this only from the Lineup repo.

Read these files in order:

1. `/Users/tristan/Software/Lineup/agents.md`
2. `/Users/tristan/Software/Lineup/docs/agentic/document-map.md`
3. `/Users/tristan/Software/Lineup/docs/AGENTIC_DEV_WORKFLOW.md`
4. `/Users/tristan/Software/Lineup/docs/agentic/session-prompts/feature-plan.md`

Then follow the tracked launcher exactly. Keep repo-specific policy in the repo docs, not in this global prompt.

After invoking this launcher, accept either:
- a pasted `NEXT_SESSION_HANDOFF` block, or
- one short follow-up naming the exact feature/design scope, plan seed, or run-bundle context, for example `We are planning the Settings diagnostics redesign as feature/design work.`
