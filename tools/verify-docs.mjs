import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseToml } from 'smol-toml';

const root = process.cwd();
const errors = [];
const requiredFiles = [
    'AGENTS.md',
    'docs/AGENTIC_DEV_WORKFLOW.md',
    'docs/architecture/CURRENT_STATE.md',
    'docs/agentic/session-prompts/README.md',
    '.codex/config.toml',
];
const requiredReadOnlyRoles = new Set(['explorer', 'reviewer', 'docs_researcher', 'monitor']);
const roleContracts = new Map([
    ['explorer', { configFile: 'agents/explorer.toml', models: ['gpt-5.3-codex-spark'] }],
    ['reviewer', { configFile: 'agents/reviewer.toml', models: ['gpt-5.6-sol', 'gpt-5.5'] }],
    ['docs_researcher', { configFile: 'agents/docs-researcher.toml', models: ['gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4-mini'] }],
    ['planner', { configFile: 'agents/planner.toml', models: ['gpt-5.6-sol', 'gpt-5.5'] }],
    ['worker', { configFile: 'agents/worker.toml', models: ['gpt-5.6-sol', 'gpt-5.5'] }],
    ['worker_sol_low', { configFile: 'agents/worker-sol-low.toml', models: ['gpt-5.6-sol'] }],
    ['worker_luna', { configFile: 'agents/worker-luna.toml', models: ['gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4-mini'] }],
    ['monitor', { configFile: 'agents/monitor.toml', models: ['gpt-5.3-codex-spark'] }],
]);
const supportedReasoningEfforts = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const roleDeclarationKeys = new Set(['description', 'config_file']);
const roleConfigKeys = new Set([
    'model',
    'model_reasoning_effort',
    'sandbox_mode',
    'developer_instructions',
]);

function read(relativePath) {
    try {
        return readFileSync(path.join(root, relativePath), 'utf8');
    } catch (error) {
        errors.push(`${relativePath}: cannot read (${error.message})`);
        return null;
    }
}

function trackedFiles(pattern) {
    try {
        const args = pattern ? ['ls-files', pattern] : ['ls-files'];
        return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
            .split('\n')
            .filter(Boolean);
    } catch (error) {
        errors.push(`git ls-files failed for ${pattern}: ${error.message}`);
        return [];
    }
}

function workingFiles(pattern) {
    try {
        return execFileSync(
            'git',
            ['ls-files', '--cached', '--others', '--exclude-standard', '--', pattern],
            { cwd: root, encoding: 'utf8' }
        )
            .split('\n')
            .filter(Boolean);
    } catch (error) {
        errors.push(`git working-file discovery failed for ${pattern}: ${error.message}`);
        return [];
    }
}

function checkRequiredFiles() {
    const tracked = new Set(trackedFiles());
    for (const relativePath of requiredFiles) {
        if (!existsSync(path.join(root, relativePath))) {
            errors.push(`missing required file: ${relativePath}`);
        } else if (!tracked.has(relativePath)) {
            errors.push(`required file is not tracked: ${relativePath}`);
        }
    }
}

function checkMarkdownLinks() {
    const tracked = new Set(trackedFiles());
    const markdownFiles = trackedFiles('*.md').filter(
        (file) =>
            existsSync(path.join(root, file)) &&
            !file.startsWith('docs/archive/') &&
            !file.startsWith('docs/runs/') &&
            !file.startsWith('docs/agentic/evals/baseline-summaries/')
    );
    const linkPattern = /\[[^\]]*\]\(([^)]+)\)/gu;

    for (const file of markdownFiles) {
        const content = read(file);
        if (content === null) continue;

        for (const match of content.matchAll(linkPattern)) {
            let target = match[1].trim().split(/\s+["']/u, 1)[0].replace(/^<|>$/gu, '');
            if (
                target.startsWith('#') ||
                target.startsWith('http://') ||
                target.startsWith('https://') ||
                target.startsWith('mailto:') ||
                target.startsWith('app://') ||
                target.includes('${') ||
                target.includes('<')
            ) {
                continue;
            }

            try {
                target = decodeURIComponent(target.split('#', 1)[0]);
            } catch {
                errors.push(`${file}: malformed local link ${match[1]}`);
                continue;
            }
            if (!target) continue;
            const resolved = path.resolve(root, path.dirname(file), target);
            if (!existsSync(resolved)) {
                errors.push(`${file}: broken local link ${match[1]}`);
                continue;
            }
            if (lstatSync(resolved).isFile()) {
                const relativeTarget = path.relative(root, resolved).split(path.sep).join('/');
                if (!tracked.has(relativeTarget)) {
                    errors.push(`${file}: local link has wrong case or targets an untracked file: ${match[1]}`);
                }
            }
        }
    }
}

function checkSkills() {
    const skillFiles = workingFiles('.agents/skills/*/SKILL.md');
    if (skillFiles.length === 0) errors.push('no repo-local skills found');

    for (const file of skillFiles) {
        const content = read(file);
        if (content === null) continue;
        const frontmatter = content.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? '';
        const name = frontmatter.match(/^name:\s*([a-z0-9-]+)\s*$/mu)?.[1];
        if (!name) errors.push(`${file}: missing or invalid skill name`);
        if (!/^description:\s*(?:\S|>)/mu.test(frontmatter)) {
            errors.push(`${file}: missing skill description`);
        }
    }

    for (const file of workingFiles('.agents/skills/*/agents/openai.yaml')) {
        const content = read(file);
        if (content === null) continue;
        const skillName = file.split('/').at(-3);
        if (!skillFiles.includes(`.agents/skills/${skillName}/SKILL.md`)) {
            errors.push(`${file}: launcher has no matching skill`);
        }
        if (/\t/u.test(content)) errors.push(`${file}: YAML must not contain tabs`);
        const interfaceValues = {};
        for (const field of ['display_name', 'short_description', 'default_prompt']) {
            const value = content.match(new RegExp(`^  ${field}:\\s*"([^"]+)"\\s*$`, 'mu'))?.[1];
            if (!value) {
                errors.push(`${file}: missing quoted interface.${field}`);
            } else {
                interfaceValues[field] = value;
            }
        }
        if (!/^interface:\s*$/mu.test(content)) errors.push(`${file}: missing interface mapping`);
        const shortDescription = interfaceValues.short_description;
        if (shortDescription && (shortDescription.length < 25 || shortDescription.length > 64)) {
            errors.push(`${file}: interface.short_description must be 25-64 characters`);
        }
        if (interfaceValues.default_prompt && !interfaceValues.default_prompt.includes(`$${skillName}`)) {
            errors.push(`${file}: interface.default_prompt must mention $${skillName}`);
        }
        if (requiresExplicitInvocation(skillName) && !hasExplicitOnlyPolicy(content)) {
            errors.push(`${file}: explicit-only launcher must set allow_implicit_invocation: false`);
        } else if (/^policy:\s*$/mu.test(content) && !/^  allow_implicit_invocation:\s*(?:true|false)\s*$/mu.test(content)) {
            errors.push(`${file}: policy must declare boolean allow_implicit_invocation`);
        }
    }
}

export function requiresExplicitInvocation(skillName) {
    return skillName.startsWith('lineup-') || skillName === 'large-task-orchestration';
}

export function hasExplicitOnlyPolicy(content) {
    return (
        /^policy:\s*$/mu.test(content) &&
        /^  allow_implicit_invocation:\s*false\s*$/mu.test(content)
    );
}

export function isValidMaxDepth(value) {
    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 1
    );
}

export function isValidMaxThreads(value) {
    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 6
    );
}

function isTomlTable(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseConfigToml(content, relativePath, validationErrors) {
    try {
        return parseToml(content);
    } catch {
        validationErrors.push(`codex-config: invalid TOML: ${relativePath}`);
        return null;
    }
}

function inspectRegularFile(fullPath, relativePath, category, validationErrors) {
    try {
        const stats = lstatSync(fullPath);
        if (stats.isSymbolicLink() || !stats.isFile()) {
            validationErrors.push(`${category}: file must be regular and non-symlink: ${relativePath}`);
            return false;
        }
        return true;
    } catch {
        validationErrors.push(`${category}: file is missing or unreadable: ${relativePath}`);
        return false;
    }
}

function listTrackedCodexFiles(repoRoot, validationErrors) {
    try {
        return new Set(
            execFileSync('git', ['ls-files', '--', '.codex/config.toml', '.codex/agents'], {
                cwd: repoRoot,
                encoding: 'utf8',
            })
                .split('\n')
                .filter(Boolean)
        );
    } catch {
        validationErrors.push('codex-config: cannot inspect tracked files');
        return null;
    }
}

function isSupportedModelEffort(model, effort) {
    return model !== 'gpt-5.4-mini' || effort === 'low' || effort === 'medium';
}

export function validateCodexRoleConfig(repoRoot) {
    const validationErrors = [];
    const configRelativePath = '.codex/config.toml';
    const configPath = path.join(repoRoot, configRelativePath);

    if (!inspectRegularFile(configPath, configRelativePath, 'codex-config: primary-file', validationErrors)) {
        return validationErrors;
    }

    try {
        const resolvedRoot = realpathSync(repoRoot);
        const resolvedConfig = realpathSync(configPath);
        const expectedConfig = path.join(resolvedRoot, '.codex', 'config.toml');
        if (resolvedConfig !== expectedConfig) {
            validationErrors.push('codex-config: primary-file must resolve within repository .codex');
            return validationErrors;
        }
    } catch {
        validationErrors.push('codex-config: primary-file cannot be resolved safely');
        return validationErrors;
    }

    const tracked = listTrackedCodexFiles(repoRoot, validationErrors);
    if (tracked === null) return validationErrors;
    if (!tracked.has(configRelativePath)) {
        validationErrors.push('codex-config: primary-file is not tracked');
        return validationErrors;
    }

    let configText;
    try {
        configText = readFileSync(configPath, 'utf8');
    } catch {
        validationErrors.push('codex-config: primary-file cannot be read');
        return validationErrors;
    }
    const config = parseConfigToml(configText, configRelativePath, validationErrors);
    if (config === null) return validationErrors;

    const agents = config.agents;
    if (!isTomlTable(agents)) {
        validationErrors.push('codex-config: agents table is missing or invalid');
        return validationErrors;
    }
    if (!isValidMaxDepth(agents.max_depth)) {
        validationErrors.push('codex-config: invalid max_depth');
    }
    if (!isValidMaxThreads(agents.max_threads)) {
        validationErrors.push('codex-config: invalid max_threads');
    }

    const declaredRoles = Object.keys(agents).filter(
        (key) => key !== 'max_threads' && key !== 'max_depth'
    );
    const missingRoles = [...roleContracts.keys()].filter((role) => !declaredRoles.includes(role));
    const unknownRoles = declaredRoles.filter((role) => !roleContracts.has(role)).sort();
    if (missingRoles.length > 0) {
        validationErrors.push(`codex-config: role-inventory missing: ${missingRoles.join(', ')}`);
    }
    if (unknownRoles.length > 0) {
        validationErrors.push(`codex-config: role-inventory unknown: ${unknownRoles.join(', ')}`);
    }

    const resolvedAgentsRoot = path.join(realpathSync(repoRoot), '.codex', 'agents');
    for (const [role, contract] of roleContracts) {
        const declaration = agents[role];
        if (!isTomlTable(declaration)) {
            if (declaration !== undefined) {
                validationErrors.push(`codex-config: declaration shape invalid: ${role}`);
            }
            continue;
        }
        const unknownDeclarationKeys = Object.keys(declaration).filter(
            (key) => !roleDeclarationKeys.has(key)
        );
        if (unknownDeclarationKeys.length > 0) {
            validationErrors.push(`codex-config: declaration keys unsupported: ${role}`);
        }
        if (typeof declaration.description !== 'string' || declaration.description.trim() === '') {
            validationErrors.push(`codex-config: declaration description invalid: ${role}`);
        }
        if (declaration.config_file !== contract.configFile) {
            validationErrors.push(`codex-config: declaration config_file invalid: ${role}`);
            continue;
        }

        const roleRelativePath = `.codex/${contract.configFile}`;
        const rolePath = path.join(repoRoot, roleRelativePath);
        if (!inspectRegularFile(rolePath, roleRelativePath, 'codex-config: role-path', validationErrors)) {
            continue;
        }
        try {
            const resolvedRolePath = realpathSync(rolePath);
            if (!resolvedRolePath.startsWith(`${resolvedAgentsRoot}${path.sep}`)) {
                validationErrors.push(`codex-config: role-path escapes .codex/agents: ${role}`);
                continue;
            }
        } catch {
            validationErrors.push(`codex-config: role-path cannot be resolved safely: ${role}`);
            continue;
        }
        if (!tracked.has(roleRelativePath)) {
            validationErrors.push(`codex-config: role-path is not tracked: ${role}`);
            continue;
        }

        let roleText;
        try {
            roleText = readFileSync(rolePath, 'utf8');
        } catch {
            validationErrors.push(`codex-config: role-path cannot be read: ${role}`);
            continue;
        }
        const roleConfig = parseConfigToml(roleText, roleRelativePath, validationErrors);
        if (!isTomlTable(roleConfig)) continue;

        const unknownRoleKeys = Object.keys(roleConfig).filter((key) => !roleConfigKeys.has(key));
        if (unknownRoleKeys.length > 0) {
            validationErrors.push(`codex-config: role keys unsupported: ${role}`);
        }
        if (typeof roleConfig.model !== 'string' || !contract.models.includes(roleConfig.model)) {
            validationErrors.push(`codex-config: role model unsupported: ${role}`);
        }
        if (
            typeof roleConfig.model_reasoning_effort !== 'string' ||
            !supportedReasoningEfforts.has(roleConfig.model_reasoning_effort)
        ) {
            validationErrors.push(`codex-config: role effort unsupported: ${role}`);
        } else if (
            typeof roleConfig.model === 'string' &&
            contract.models.includes(roleConfig.model) &&
            !isSupportedModelEffort(roleConfig.model, roleConfig.model_reasoning_effort)
        ) {
            validationErrors.push(`codex-config: role model-effort combination unsupported: ${role}`);
        }
        if (requiredReadOnlyRoles.has(role)) {
            if (roleConfig.sandbox_mode !== 'read-only') {
                validationErrors.push(`codex-config: role sandbox unsupported: ${role}`);
            }
        } else if (Object.hasOwn(roleConfig, 'sandbox_mode')) {
            validationErrors.push(`codex-config: role sandbox unsupported: ${role}`);
        }
        if (typeof roleConfig.developer_instructions !== 'string') {
            validationErrors.push(`codex-config: role developer_instructions invalid: ${role}`);
        }
    }

    return validationErrors;
}

function checkRoleConfig() {
    errors.push(...validateCodexRoleConfig(root));
}

function checkActivePlans() {
    for (const file of trackedFiles('docs/plans/*.md').filter((file) => !file.endsWith('/README.md'))) {
        const content = read(file);
        if (content === null) continue;
        const firstLines = content.split('\n').slice(0, 40).join('\n');
        if (!/(?:\*\*Plan Status:\*\*\s*active|^Status:\s*Active\s*$)/imu.test(firstLines)) continue;
        for (const marker of ['goal', 'verification']) {
            if (!new RegExp(`^#{1,3}\\s+.*${marker}`, 'imu').test(content)) {
                errors.push(`${file}: active plan missing ${marker} section`);
            }
        }
    }
}

function main() {
    checkRequiredFiles();
    checkMarkdownLinks();
    checkSkills();
    checkRoleConfig();
    checkActivePlans();

    if (errors.length > 0) {
        for (const error of errors) console.error(`- ${error}`);
        console.error(`Documentation verification failed with ${errors.length} error(s).`);
        process.exit(1);
    }

    console.log('Documentation structure verified.');
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath !== null && pathToFileURL(entryPath).href === import.meta.url) main();
