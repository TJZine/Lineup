---
name: parallel-sidecars
description: Use when a Lineup task has optional read-only sidecars, blocking documentation research, adversarial review, or long waits that can be delegated without handing off implementation ownership.
---

# Parallel Sidecars

## Overview

  Use this skill to delegate bounded read-only sidecars, documentation research, review passes, or wait states to the
  tracked Codex role set.

  Default to no delegation. Delegate only when the sidecar is real, scoped, and materially improves reliability,
  throughput, context hygiene, or source quality.

## Use This Skill For

- Focused code or repo-doc discovery that does not take over implementation ownership
- Adversarial review of a plan, diff, or workflow artifact after the main session already knows the target
- External documentation or source-backed research through `docs_researcher` when the research scope is explicit and
  the output should be a compact evidence packet or structured research report
- Long waits, polling, or status checks through `monitor`

## Do Not Use This Skill For

- Immediate blocking implementation, planning, or repo-discovery work that belongs in the main thread, `planner`, or
  `explorer`
- Tasks with overlapping write scopes
- Unresolved planning, routing, or ownership decisions
- Broad exploratory fan-out because the controller has not thought through the problem yet
- Small convenience questions that do not materially improve reliability, throughput, context hygiene, or source
  quality
- Any edit that should stay local or should instead use `bounded-worker-execution`

## Decision Gate

  Delegate only when all of these are true:

  1. the main session already knows the exact sub-question, research brief, or output it needs
  2. the sidecar can finish without changing the next local write scope
  3. the sidecar can run with one tracked role
  4. delegating it will materially improve reliability, throughput, context hygiene, or source quality
  5. either the main session has meaningful non-overlapping work to do immediately, or the delegated result is a
  substantial read-only research input that is worth isolating from the main thread's context

  If any item is false, keep the work local.

## Role Routing

- `explorer`
  - focused repo discovery, symbol tracing, implementation reconnaissance
- `explorer_fallback`
  - same job as `explorer` when the primary explorer path is unavailable or constrained
- `reviewer`
  - adversarial review for correctness, regressions, security, and missing tests
- `maintainability_reviewer`
  - read-only code-health, slop, file-shape, test-brittleness, and maintainability review; no style-only blocking
- `architecture_reviewer`
  - read-only hotspot, owner-seam, cross-module coupling, persistence, Plex, UI composition/focus/navigation, public contract, priority-exit, and security-adjacent architecture review
- `docs_researcher`
  - external documentation and source-backed research; may run as a parallel sidecar or as a blocking research pass
  when the research result is the next needed input
- `monitor`
  - waits, polling, background verification, status checks
- `monitor_fallback`
  - same job as `monitor` when the primary monitor path is unavailable or constrained

  Do not route edits through read-only roles.

  If the task needs a write-capable sidecar, stop and decide whether `bounded-worker-execution` applies instead.

## Dispatch Pattern

  1. Decide whether delegation is justified at all.
  2. Write one exact ask or bounded research brief.
     - one problem, or one explicit multi-question research scope
     - one role
     - one concrete output shape
  3. Pass only the context the sidecar needs.
     - relevant files
     - plan path or diff target
     - exact question, research scope, or source family to answer
  4. Keep implementation and planning ownership local unless the sidecar is intentionally handling a substantial
  blocking research pass.
  5. Wait only when the next local step truly depends on the sidecar result.
  6. Verify the sidecar output locally before treating it as truth.

## Documentation / Research Sidecar

  Use `docs_researcher` for read-only external documentation or source-backed research when the task has a clear
  research scope and should return either a compact evidence packet or a structured research report.

  Good uses:

- official API, framework, browser/platform, or tool documentation checks
- source-backed comparisons for current guidance or version-specific behavior
- Plex API, webOS/browser compatibility, dependency, security, or workflow-source research
- larger research reports when the research question is explicit and the report will inform a later planning or
  implementation decision

  Avoid:

- trivial lookups that are faster inline
- vague open-ended browsing without a deliverable
- repo discovery or codebase analysis, which belongs to local discovery or `explorer`
- implementation planning, which belongs to the main thread or `planner`
- any edit or write-capable task

  Research packets and reports inform the main session; they do not replace local verification for architecture,
  security, dependency, auth/token, persistence, or platform-critical decisions.

  Small targeted lookups should return:

  ```text
  DOCS_RESEARCH_PACKET
  QUESTION:
  SOURCES_CHECKED:
  FINDINGS:
  VERSION_OR_DATE_NOTES:
  LINEUP_IMPLICATION:
  CONFLICTS_OR_UNCERTAINTY:
  LOCAL_VERIFICATION_REQUIRED: yes/no + why
  ```

  Larger research passes should return a DOCS_RESEARCH_REPORT with the same evidence fields expanded into a structured
  report, including source links, conflicts, implications for Lineup, and remaining open questions.

  ## Prompt Shape

  Use a prompt that makes the sidecar's contract explicit:

  - task
  - exact artifact(s), source family, or documentation scope to inspect
  - constraints
  - expected output
  - explicit read-only or no-edit reminder when the role is read-only

  Example:

  Research current official Vite guidance for production build targets relevant to Lineup.

  Scope:
  - official Vite docs only
  - focus on browser target defaults, legacy browser support, and build output implications

  Return:
  - DOCS_RESEARCH_PACKET
  - source links
  - version/date notes
  - Lineup implications
  - whether local verification is required before changing config

  Do not edit files.

  ## Common Mistakes

  - Delegating because multi-agent feels impressive rather than useful
  - Sending implementation or planning ownership to a sidecar
  - Giving a sidecar a fuzzy brief like "look around and see what you think"
  - Using docs_researcher for trivial lookups that are faster inline
  - Treating a research packet as final proof for security, auth/token, dependency, persistence, architecture, or
    platform-critical claims
  - Using multiple sidecars where one focused sidecar or local work would do
  - Trusting a sidecar conclusion without checking the cited files or sources when the decision is high-risk
  - Turning optional sidecars into default ceremony for routine work
