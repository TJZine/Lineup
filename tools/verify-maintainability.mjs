import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FILE_SHAPE_ALLOWLIST_START = '<!-- file-shape-guardrails:start -->';
export const FILE_SHAPE_ALLOWLIST_END = '<!-- file-shape-guardrails:end -->';
export const SOFT_LINE_THRESHOLD = 500;
export const HARD_LINE_THRESHOLD = 800;

const COUNTED_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html']);
const EXPECTED_HEADERS = ['path', 'baseline lines', 'rationale', 'growth/decomposition trigger'];

function normalizeRepoPath(filePath) {
    return filePath.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function hasTestSegment(relativePath) {
    return normalizeRepoPath(relativePath).split('/').includes('__tests__');
}

function isTestFilename(relativePath) {
    return path.posix.basename(normalizeRepoPath(relativePath)).includes('.test.');
}

export function isProductionSourcePath(relativePath) {
    const normalized = normalizeRepoPath(relativePath);
    if (!normalized.startsWith('src/')) {
        return false;
    }
    if (hasTestSegment(normalized) || isTestFilename(normalized)) {
        return false;
    }
    return COUNTED_EXTENSIONS.has(path.posix.extname(normalized));
}

export function countLogicalLines(content) {
    if (content.length === 0) {
        return 0;
    }

    const normalized = content.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
    const lines = normalized.split('\n');
    if (normalized.endsWith('\n')) {
        lines.pop();
    }
    return lines.length;
}

function walkFiles(dir, repoRoot, files) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(fullPath, repoRoot, files);
        } else if (entry.isFile()) {
            files.push(normalizeRepoPath(path.relative(repoRoot, fullPath)));
        }
    }
}

export function collectProductionFiles(repoRoot) {
    const srcRoot = path.join(repoRoot, 'src');
    if (!existsSync(srcRoot)) {
        return [];
    }

    const files = [];
    walkFiles(srcRoot, repoRoot, files);
    return files.filter(isProductionSourcePath).sort((left, right) => left.localeCompare(right));
}

export function collectProductionLineCounts(repoRoot) {
    return collectProductionFiles(repoRoot).map((relativePath) => {
        const content = readFileSync(path.join(repoRoot, relativePath), 'utf8');
        return {
            path: relativePath,
            lines: countLogicalLines(content),
        };
    });
}

export function getOversizedProductionFiles(repoRoot) {
    return collectProductionLineCounts(repoRoot).filter((file) => file.lines > SOFT_LINE_THRESHOLD);
}

function splitMarkdownRow(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
        return null;
    }
    return trimmed
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
}

function stripMarkdownCode(value) {
    return value.replace(/^`([^`]+)`$/u, '$1').trim();
}

function parseBaselineLines(value) {
    const trimmed = value.trim();
    if (!/^[1-9]\d*$/u.test(trimmed)) {
        return null;
    }
    return Number.parseInt(trimmed, 10);
}

export function parseAllowlistMarkdown(markdown) {
    const errors = [];
    const start = markdown.indexOf(FILE_SHAPE_ALLOWLIST_START);
    const end = markdown.indexOf(FILE_SHAPE_ALLOWLIST_END);

    if (start < 0 || end < 0 || end <= start) {
        return {
            rows: [],
            errors: [
                `Missing maintainability allowlist block marked by ${FILE_SHAPE_ALLOWLIST_START} and ${FILE_SHAPE_ALLOWLIST_END}.`,
            ],
        };
    }

    const block = markdown.slice(start + FILE_SHAPE_ALLOWLIST_START.length, end);
    const tableRows = block
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('|') && line.endsWith('|'));

    if (tableRows.length < 2) {
        return { rows: [], errors: ['Maintainability allowlist block must contain a markdown table.'] };
    }

    const header = splitMarkdownRow(tableRows[0])?.map((cell) => cell.toLowerCase()) ?? [];
    if (header.length !== EXPECTED_HEADERS.length || !EXPECTED_HEADERS.every((cell, index) => header[index] === cell)) {
        errors.push(
            `Maintainability allowlist header must be: | ${EXPECTED_HEADERS.join(' | ')} |.`
        );
    }

    const separator = splitMarkdownRow(tableRows[1]);
    if (
        separator === null ||
        separator.length !== EXPECTED_HEADERS.length ||
        !separator.every((cell) => /^:?-{3,}:?$/u.test(cell))
    ) {
        errors.push('Maintainability allowlist table must include a valid markdown separator row.');
    }

    const rows = [];
    const seenPaths = new Set();
    for (let index = 2; index < tableRows.length; index += 1) {
        const lineNumber = index + 1;
        const cells = splitMarkdownRow(tableRows[index]);
        if (cells === null || cells.length !== EXPECTED_HEADERS.length) {
            errors.push(`Malformed maintainability allowlist row ${lineNumber}: expected ${EXPECTED_HEADERS.length} columns.`);
            continue;
        }

        const [rawPath, rawBaseline, rationale, trigger] = cells;
        const filePath = normalizeRepoPath(stripMarkdownCode(rawPath));
        const baselineLines = parseBaselineLines(rawBaseline);

        if (!filePath) {
            errors.push(`Malformed maintainability allowlist row ${lineNumber}: path is required.`);
        } else if (seenPaths.has(filePath)) {
            errors.push(`Duplicate maintainability allowlist row for ${filePath}.`);
        }
        seenPaths.add(filePath);

        if (baselineLines === null || baselineLines <= SOFT_LINE_THRESHOLD) {
            errors.push(
                `Malformed maintainability allowlist row for ${filePath || `row ${lineNumber}`}: baseline lines must be an integer greater than ${SOFT_LINE_THRESHOLD}.`
            );
        }

        if (rationale.trim().length === 0) {
            errors.push(`Malformed maintainability allowlist row for ${filePath || `row ${lineNumber}`}: rationale is required.`);
        }

        if (trigger.trim().length === 0) {
            errors.push(
                `Malformed maintainability allowlist row for ${filePath || `row ${lineNumber}`}: growth/decomposition trigger is required.`
            );
        }

        rows.push({
            path: filePath,
            baselineLines: baselineLines ?? 0,
            rationale: rationale.trim(),
            trigger: trigger.trim(),
        });
    }

    return { rows, errors };
}

function hasHardOverageTrigger(trigger) {
    return /\b(?:decomposition|revisit)\b/iu.test(trigger);
}

export function verifyMaintainability(options = {}) {
    const repoRoot = options.repoRoot ?? process.cwd();
    const allowlistPath = options.allowlistPath ?? path.join(repoRoot, 'docs/architecture/file-shape-guardrails.md');
    const errors = [];

    if (!existsSync(allowlistPath)) {
        return {
            errors: [`Missing maintainability allowlist document: ${path.relative(repoRoot, allowlistPath)}`],
            oversizedFiles: getOversizedProductionFiles(repoRoot),
            rows: [],
        };
    }

    const allowlistMarkdown = readFileSync(allowlistPath, 'utf8');
    const { rows, errors: parseErrors } = parseAllowlistMarkdown(allowlistMarkdown);
    errors.push(...parseErrors);

    const productionFiles = new Map(
        collectProductionLineCounts(repoRoot).map((file) => [file.path, file.lines])
    );
    const oversizedFiles = [...productionFiles.entries()]
        .map(([filePath, lines]) => ({ path: filePath, lines }))
        .filter((file) => file.lines > SOFT_LINE_THRESHOLD)
        .sort((left, right) => left.path.localeCompare(right.path));
    const rowsByPath = new Map(rows.map((row) => [row.path, row]));

    for (const row of rows) {
        if (!isProductionSourcePath(row.path)) {
            errors.push(`Allowlist row points to a non-production path: ${row.path}`);
            continue;
        }

        const fullPath = path.join(repoRoot, row.path);
        if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
            errors.push(`Allowlist row points to a deleted or renamed path: ${row.path}`);
            continue;
        }

        const currentLines = productionFiles.get(row.path);
        if (currentLines === undefined) {
            errors.push(`Allowlist row is not countable as production source: ${row.path}`);
            continue;
        }

        if (currentLines <= SOFT_LINE_THRESHOLD) {
            errors.push(
                `Allowlist row for ${row.path} is stale: current line count ${currentLines} is at or below ${SOFT_LINE_THRESHOLD}.`
            );
        }

        if (currentLines > row.baselineLines) {
            errors.push(
                `Production file ${row.path} grew beyond its baseline: ${currentLines} lines current vs ${row.baselineLines} recorded.`
            );
        }

        if (currentLines > HARD_LINE_THRESHOLD && !hasHardOverageTrigger(row.trigger)) {
            errors.push(
                `Production file ${row.path} is ${currentLines} lines and requires an explicit decomposition/revisit trigger.`
            );
        }
    }

    for (const file of oversizedFiles) {
        if (!rowsByPath.has(file.path)) {
            const triggerRequirement = file.lines > HARD_LINE_THRESHOLD
                ? ' with an explicit decomposition/revisit trigger'
                : '';
            errors.push(
                `Production file ${file.path} is ${file.lines} lines and needs an allowlist row${triggerRequirement}.`
            );
        }
    }

    return {
        errors,
        oversizedFiles,
        rows,
    };
}

export function formatAllowlistMarkdown(files) {
    const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));
    const rows = sortedFiles.map((file) => (
        `| \`${file.path}\` | ${file.lines} | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |`
    ));

    return [
        '| Path | Baseline lines | Rationale | Growth/decomposition trigger |',
        '| --- | ---: | --- | --- |',
        ...rows,
    ].join('\n');
}

export function parseCliArgs(argv) {
    const options = {
        repoRoot: process.cwd(),
        allowlistPath: null,
        printAllowlist: false,
    };
    let allowlistRaw = null;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--root') {
            const value = argv[index + 1];
            if (value === undefined) {
                throw new Error('Missing value for --root.');
            }
            options.repoRoot = path.resolve(value);
            index += 1;
        } else if (arg === '--allowlist') {
            const value = argv[index + 1];
            if (value === undefined) {
                throw new Error('Missing value for --allowlist.');
            }
            allowlistRaw = value;
            index += 1;
        } else if (arg === '--print-allowlist') {
            options.printAllowlist = true;
        } else {
            throw new Error(`Unknown verify-maintainability option: ${arg}`);
        }
    }

    options.allowlistPath = allowlistRaw === null
        ? path.join(options.repoRoot, 'docs/architecture/file-shape-guardrails.md')
        : path.resolve(options.repoRoot, allowlistRaw);
    return options;
}

function runCli() {
    try {
        const options = parseCliArgs(process.argv.slice(2));
        if (options.printAllowlist) {
            console.log(formatAllowlistMarkdown(getOversizedProductionFiles(options.repoRoot)));
            return;
        }

        const result = verifyMaintainability(options);
        if (result.errors.length > 0) {
            console.error('Maintainability verification failed:');
            for (const error of result.errors) {
                console.error(`- ${error}`);
            }
            process.exitCode = 1;
            return;
        }

        console.log(`Maintainability verification passed (${result.oversizedFiles.length} oversized production baselines checked).`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Maintainability verification failed: ${message}`);
        process.exitCode = 1;
    }
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPoint === fileURLToPath(import.meta.url)) {
    runCli();
}
