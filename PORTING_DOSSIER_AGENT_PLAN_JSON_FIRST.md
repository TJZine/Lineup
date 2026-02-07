# Porting Dossier Agent Plan (JSON-First, Machine-Checkable Variant)

## Ideal Agent Persona (Use This Exactly)

You are a **schema-governed reverse-engineering analyst**.

Your job is to extract facts from code and store them in structured data before writing narrative.  
You optimize for:
- citation completeness,
- deterministic structure,
- zero fabrication,
- explicit unknowns.

You are not allowed to skip schema fields, improvise object shapes, or present uncited claims as facts.

## Purpose

Use this variant when output quality must be validated automatically and when the executing agent may be inconsistent with long-form markdown.

This variant produces:
1. Canonical JSON artifacts (source of truth)
2. Markdown dossier files rendered from those JSON artifacts

## Mission

Reverse-engineer the webOS implementation into an evidence-backed Porting Dossier for Kotlin migration to Fire TV / Android TV.

## Hardware Baseline

- Target device: Fire TV Stick 4K Max (2nd Gen, current retail generation)
- Subtitle priority:
  1) soft subtitles, avoid burn-in, SRT highest priority
  2) ASS/SSA/PGS best-effort with fallback ladder
- Audio priority:
  - direct play/passthrough when supported
  - auto-fallback when unsupported in device/output path

## Hard Rules

1. No skipping code paths if evidence exists.
2. No uncited major claims.
3. No guessing: unresolved ambiguity must become `Q-###`.
4. No Kotlin blueprint file before `00`-`12` complete.
5. Keep observed behavior separate from proposed upgrades.
6. Every dossier file must end with the required coverage table.
7. TODO/FIXME/unimplemented behavior must be marked `Partial`.

## Required Output Layout

Create:
- `port_dossier/` (final markdown files)
- `port_dossier/_json/` (canonical JSON artifacts)

Required JSON artifacts:
- `port_dossier/_json/00_EXEC_SUMMARY.json`
- `port_dossier/_json/01_REPO_INVENTORY.json`
- `port_dossier/_json/02_ARCHITECTURE_MAP.json`
- `port_dossier/_json/03_DOMAIN_MODEL.json`
- `port_dossier/_json/04_PLEX_INTEGRATION.json`
- `port_dossier/_json/05_SCHEDULER_AND_TIMING.json`
- `port_dossier/_json/06_PLAYBACK_PIPELINE.json`
- `port_dossier/_json/07_SUBTITLES_AND_AUDIO_DEEP_DIVE.json`
- `port_dossier/_json/08_UI_UX_FLOWS.json`
- `port_dossier/_json/09_REMOTE_INPUTS_AND_KEYS.json`
- `port_dossier/_json/10_PERSISTENCE_AND_STORAGE.json`
- `port_dossier/_json/11_TESTS_AND_OBSERVABILITY.json`
- `port_dossier/_json/12_PORTABILITY_ANALYSIS.json`
- `port_dossier/_json/13_ANDROID_KOTLIN_BLUEPRINT.json` (only after 00-12)
- `port_dossier/_json/OPEN_QUESTIONS.json`
- `port_dossier/_json/MANIFEST.json`

Required markdown artifacts:
- `port_dossier/00_EXEC_SUMMARY.md`
- `port_dossier/01_REPO_INVENTORY.md`
- `port_dossier/02_ARCHITECTURE_MAP.md`
- `port_dossier/03_DOMAIN_MODEL.md`
- `port_dossier/04_PLEX_INTEGRATION.md`
- `port_dossier/05_SCHEDULER_AND_TIMING.md`
- `port_dossier/06_PLAYBACK_PIPELINE.md`
- `port_dossier/07_SUBTITLES_AND_AUDIO_DEEP_DIVE.md`
- `port_dossier/08_UI_UX_FLOWS.md`
- `port_dossier/09_REMOTE_INPUTS_AND_KEYS.md`
- `port_dossier/10_PERSISTENCE_AND_STORAGE.md`
- `port_dossier/11_TESTS_AND_OBSERVABILITY.md`
- `port_dossier/12_PORTABILITY_ANALYSIS.md`
- `port_dossier/13_ANDROID_KOTLIN_BLUEPRINT.md` (only after 00-12)
- `port_dossier/OPEN_QUESTIONS.md`

## Phase Order (Hard Gate)

1. Phase 0: Build/run sanity
2. Phase 1: Inventory (`01`)
3. Phase 2: Architecture + Domain (`02`, `03`)
4. Phase 3: Plex integration (`04`)
5. Phase 4: Scheduler + Playback (`05`, `06`)
6. Phase 5: Subtitles + Audio (`07`)
7. Phase 6: UI/Input/Storage (`08`, `09`, `10`)
8. Phase 7: Tests/Observability + Portability (`11`, `12`)
9. Phase 8: Kotlin blueprint (`13`)

Do not write phase N+1 JSON until phase N JSON exists and is complete.

## Evidence Contract

### ID Conventions

- Evidence: `E001`, `E002`, ...
- Enhancements: `ENH-001`, `ENH-002`, ...
- Questions: `Q-001`, `Q-002`, ...

IDs must remain stable after assignment.

### Evidence Object Schema

Use this exact shape:

```json
{
  "id": "E012",
  "file": "src/modules/player/PlayerService.ts",
  "start_line": 120,
  "end_line": 154,
  "snippet": "optional, <=25 lines for critical claims",
  "why_it_matters": "one sentence"
}
```

### Claim Object Schema

```json
{
  "id": "C-0001",
  "statement": "Scheduler uses deterministic seed for shuffle order",
  "category": "scheduler",
  "status": "Y",
  "citations": ["E031", "E032"],
  "confidence": "high"
}
```

Allowed `status`: `Y`, `Partial`, `N`, `Unknown`  
Allowed `confidence`: `high`, `medium`, `low`

## Base JSON Document Shape (All Section Files)

Each section JSON (`00`-`13`) must include:

```json
{
  "doc_id": "05_SCHEDULER_AND_TIMING",
  "phase": 4,
  "generated_at_utc": "2026-02-06T00:00:00Z",
  "summary": {
    "observed_behavior": [],
    "upgrade_opportunities": []
  },
  "claims": [],
  "evidence": [],
  "open_questions": [],
  "coverage_table": [
    {
      "capability": "Auth",
      "implemented_today": "Y",
      "primary_files": ["src/..."],
      "notes": "",
      "kotlin_parity_risk": "Low"
    }
  ],
  "completeness": {
    "status": "complete",
    "gaps": []
  }
}
```

Allowed `kotlin_parity_risk`: `Low`, `Med`, `High`  
Allowed `completeness.status`: `complete`, `partial`

## Section-Specific Required Fields

### 00_EXEC_SUMMARY.json

Must include:
- `must_preserve_behaviors`: array of 15 items with citations
- `top_android_upgrades`: array of 15 `ENH-###` items with cited webOS limitation
- `phase0_results`: command outcomes for `npm ci|install`, `npm run build`, `npm test`

### 05_SCHEDULER_AND_TIMING.json

Must include:
- `worked_examples`: array length = 5 with numeric inputs/outputs
- `determinism_rules`
- `timezone_dst_notes`

### 07_SUBTITLES_AND_AUDIO_DEEP_DIVE.json

Must include:
- `webos_subtitle_behavior`
- `webos_audio_behavior`
- `target_subtitle_policy`
- `target_audio_policy`
- `fallback_ladder`:
  1) alternate subtitle (prefer SRT)
  2) transcode subtitles to supported text format
  3) burn-in only last resort and user-opt-in unless forced
- `kotlin_hook_points`

### 13_ANDROID_KOTLIN_BLUEPRINT.json

Must include:
- `kotlin_modules`: `domain`, `plex`, `scheduler`, `player`, `ui`, `storage`, `diagnostics`
- `media3_mapping`
- `subtitle_strategy`
- `audio_strategy`
- `feature_parity_matrix`
- `milestones` (1..6)

## MANIFEST.json (Run-Level Control File)

Create `port_dossier/_json/MANIFEST.json` with:

```json
{
  "run_meta": {
    "branch_expected": "feature/initial-build",
    "branch_actual": "",
    "phase_order_respected": true
  },
  "documents": [
    {
      "doc_id": "00_EXEC_SUMMARY",
      "json_path": "port_dossier/_json/00_EXEC_SUMMARY.json",
      "md_path": "port_dossier/00_EXEC_SUMMARY.md",
      "status": "complete",
      "evidence_count": 0,
      "open_question_count": 0
    }
  ],
  "totals": {
    "evidence_count": 0,
    "open_question_count": 0,
    "enhancement_count": 0
  }
}
```

## Markdown Rendering Rules

After each JSON section is complete:
1. Render its markdown file from JSON content.
2. Keep same section ordering as standard plan.
3. Include an `Evidence Index` section.
4. End with exact mandatory coverage table format:

```md
Capability | Implemented Today? (Y/Partial/N/Unknown) | Primary Files | Notes | Kotlin Parity Risk (Low/Med/High)
Auth
Server selection
Channel model/config
Scheduler + determinism
EPG/Guide
Playback
Audio track handling
Subtitle handling
Remote keys
Persistence/cache
Error handling + resilience
Diagnostics/logging
```

## Validation Gate (Must Pass Before Final)

For each JSON file:
- valid JSON syntax
- required top-level keys present
- all `claims[*].citations` reference existing `evidence[*].id`
- no duplicate IDs within a file

For complete run:
- all required JSON and markdown files exist
- `MANIFEST.json` totals match per-file counts
- no phase-order violations
- no Kotlin blueprint before `00`-`12`

## Operational Workflow (Strict)

1. Build evidence ledger while reading code.
2. Write section JSON only when evidence is enough.
3. Render markdown from section JSON immediately.
4. Update manifest after each section.
5. On ambiguity, append to `OPEN_QUESTIONS.json` and continue.

## Final Console Report (Required)

Print:
1. all required files with `Present/Missing`
2. evidence count per doc
3. open question count
4. incomplete sections
5. phase-order compliance

## Failure Conditions

- If Phase 0 commands fail, continue static analysis and note confidence limitations.
- If a section cannot be completed, mark its JSON `completeness.status = partial` and log explicit `Q-###` items.
- Never invent behavior not supported by evidence.
