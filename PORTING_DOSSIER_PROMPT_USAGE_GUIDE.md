# Porting Dossier Prompt Usage Guide

## What You Have Now

- `PORTING_DOSSIER_AGENT_PLAN.md`: markdown-first, highly explicit execution prompt.
- `PORTING_DOSSIER_AGENT_PLAN_JSON_FIRST.md`: JSON-first variant with machine-checkable structure.
- `PORTING_DOSSIER_REVIEW_AGENT_PROMPT.md`: strict review/audit gate prompt for dossier QA.

## Which One Should You Use?

Use this decision rule:

1. Use `PORTING_DOSSIER_AGENT_PLAN_JSON_FIRST.md` when:
- the agent is weaker/inconsistent,
- you need auditability and scripted validation,
- you want fewer narrative mistakes and better citation discipline.

2. Use `PORTING_DOSSIER_AGENT_PLAN.md` when:
- the agent is strong and reliable,
- you need faster drafting and human-readable output first,
- you do not need strict machine validation.

3. Best default for this project:
- Prefer **JSON-first** for phases `00`-`12`.
- Keep markdown-first for review readability and final packaging.

## Recommended Three-Pass Workflow (Best Practice)

### Pass A (Extraction + Validation)

Use `PORTING_DOSSIER_AGENT_PLAN_JSON_FIRST.md`.

Expected outputs:
- `port_dossier/_json/*.json` canonical files
- `port_dossier/*.md` rendered files
- `port_dossier/_json/MANIFEST.json` counts + status

Goal:
- maximize correctness, coverage, and citation integrity.

### Pass B (Independent Review Gate)

Use `PORTING_DOSSIER_REVIEW_AGENT_PROMPT.md`.

Goal:
- catch structural, evidence, semantic, and cross-file issues,
- assign severities (`S0`-`S3`),
- produce pass/fail report before editorial polish.

### Pass C (Editorial/Decision Pass)

Use `PORTING_DOSSIER_AGENT_PLAN.md`.

Goal:
- tighten narrative clarity,
- improve migration sequencing and risk explanation,
- keep all claims anchored to existing evidence IDs (no new uncited claims).

## Practical Session Instructions

In a new Codex session, paste this in order:
1. `PORTING_DOSSIER_AGENT_PLAN_JSON_FIRST.md`
2. Then add:  
   `Execute phases 0-12 in JSON-first mode. Do not start phase 13 until validation passes and missing evidence/questions are resolved or explicitly logged.`

After Pass A finishes, run a second session with:
1. `PORTING_DOSSIER_REVIEW_AGENT_PROMPT.md`
2. Then add:  
   `Audit the dossier and output only findings with severities, required fixes, and final PASS/FAIL verdict.`

After Pass B fixes are applied, run a third session with:
1. `PORTING_DOSSIER_AGENT_PLAN.md`
2. Then add:  
   `Use existing /port_dossier and /port_dossier/_json outputs to improve readability and migration decisions without changing factual claims unless adding new citations.`

## Single-Session Alternative (If Time-Constrained)

If you must do one session only:
1. Use `PORTING_DOSSIER_AGENT_PLAN_JSON_FIRST.md`.
2. Require markdown rendering during each phase.
3. Run review checks from `PORTING_DOSSIER_REVIEW_AGENT_PROMPT.md` at end of the same session.
4. Skip heavy prose polish until all files exist and validation gates pass.

## Quality Gates You Should Enforce Manually

1. Every required file exists (`00`-`13`, `OPEN_QUESTIONS`, and all JSON artifacts).
2. Every dossier file has a coverage table at the end.
3. Critical claims are cited and evidence IDs resolve.
4. `13_ANDROID_KOTLIN_BLUEPRINT` was created only after `00`-`12`.
5. `OPEN_QUESTIONS` contains all unresolved ambiguity.

## Tradeoffs

- JSON-first:
  - Pros: consistent, auditable, script-friendly, safer with weaker agents.
  - Cons: slower initial authoring, more rigid output discipline.
- Markdown-first:
  - Pros: faster to read/write, better natural narrative flow.
  - Cons: easier to miss citations/coverage and drift into ambiguity.

## Recommended Default for You

Use JSON-first as primary execution mode, then a strict review pass, then markdown-first editorial refinement.  
If only one prompt is used, use JSON-first and embed the review checklist before finishing.
