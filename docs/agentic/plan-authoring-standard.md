# Plan Authoring Standard

Use a tracked plan only for durable cross-session memory or when explicitly
requested. Routine work stays in `update_plan`; bounded single-session work may use
a light execution brief.

## Required Core

An active tracked plan should state:

- active status and task family;
- goal and non-goals;
- current owner seam;
- files in scope and out of scope;
- invariants and public contracts;
- verification commands and expected outcomes;
- stop/replan triggers;
- progress and decision notes when work spans sessions.

Cleanup plans should additionally state whether behavior is preserved and what
long-term owner shape replaces the debt. Checklist-linked work should name the
checklist item, but does not need package maps, wave schemas, coverage ledgers, or
source-finding identifiers unless the task itself benefits from them.

## Detail Budget

Freeze decisions that are expensive to get wrong. Do not pre-write helper names,
routine control flow, test scaffolds, or full patches. Use examples only for fragile
contracts or payloads.

Only one plan should own a workstream. Amend it when assumptions change; do not
create a second master plan. Mark it historical or archive it when complete.
