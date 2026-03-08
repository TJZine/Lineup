import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
    EVAL_PROMPT_INVENTORY_END_MARKER,
    EVAL_PROMPT_INVENTORY_START_MARKER,
    renderEvalPromptInventory,
    renderSessionPromptSet,
    replaceManagedSection,
    SESSION_PROMPT_SET_END_MARKER,
    SESSION_PROMPT_SET_START_MARKER,
} from './harness-docs-lib.mjs';

const repoRoot = process.cwd();

function syncFile(relativePath, { startMarker, endMarker, replacement }) {
    const fullPath = path.join(repoRoot, relativePath);
    const current = readFileSync(fullPath, 'utf8');
    const updated = replaceManagedSection(current, { startMarker, endMarker, replacement });

    if (updated !== current) {
        writeFileSync(fullPath, updated);
    }
}

syncFile('docs/agentic/session-prompts/README.md', {
    startMarker: SESSION_PROMPT_SET_START_MARKER,
    endMarker: SESSION_PROMPT_SET_END_MARKER,
    replacement: renderSessionPromptSet(),
});

syncFile('docs/agentic/evals/README.md', {
    startMarker: EVAL_PROMPT_INVENTORY_START_MARKER,
    endMarker: EVAL_PROMPT_INVENTORY_END_MARKER,
    replacement: renderEvalPromptInventory(),
});

console.log('Harness docs synced.');
