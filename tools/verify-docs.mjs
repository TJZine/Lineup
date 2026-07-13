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

export function distributionContractErrors({ installation, readme, workflow }) {
    const contractErrors = [];
    const normalizeProse = (content) => content
        .replace(/^>\s?/gmu, '')
        .replace(/([^\n])\n(?!\n)/gu, '$1 ');
    const normalizedInstallation = normalizeProse(installation);
    const normalizedReadme = normalizeProse(readme);
    const installationPolicy = /Lineup does not currently publish a prebuilt IPK on GitHub\s+Releases(?:\s+or the LG\s+Content Store)?\./iu;
    const readmePolicy = /No prebuilt Lineup IPK is currently published on GitHub\s+Releases\./iu;
    if (!installationPolicy.test(normalizedInstallation)) {
        contractErrors.push('installation must state that GitHub Releases has no prebuilt IPK');
    }
    const remainingInstallation = normalizedInstallation.replace(installationPolicy, '');
    const remainingReadme = normalizedReadme.replace(readmePolicy, '');
    const releaseAcquisitionClaim = /(?:(?:Lineup|IPK|package|artifact)\b[^\n.]{0,180}\b(?:GitHub\s+|Lineup\s+)?Releases\b|(?:GitHub\s+|Lineup\s+)Releases\b[^\n.]{0,180}\b(?:Lineup|IPK|package|artifact)\b)/iu;
    const lineupReleasesLink = /\]\(https:\/\/github\.com\/TJZine\/Lineup\/releases(?:[/?#][^)]*)?\)/iu;
    if (
        releaseAcquisitionClaim.test(remainingInstallation) ||
        releaseAcquisitionClaim.test(remainingReadme) ||
        lineupReleasesLink.test(remainingInstallation) ||
        lineupReleasesLink.test(remainingReadme)
    ) {
        contractErrors.push('public docs must not direct users to a nonexistent Lineup Release');
    }
    for (const requiredSourceStep of [
        'npm ci',
        'npm install -g @webos-tools/cli@3.2.5',
        'npm run package:webos',
        'packages/com.lineup.app_<VERSION>_all.ipk',
    ]) {
        if (!installation.includes(requiredSourceStep)) {
            contractErrors.push(`installation source path missing: ${requiredSourceStep}`);
        }
    }
    for (const requiredActionsDetail of ['webos-ipk', 'seven days', 'branch is **main**']) {
        if (!installation.includes(requiredActionsDetail)) {
            contractErrors.push(`installation Actions path missing: ${requiredActionsDetail}`);
        }
    }
    if (!readmePolicy.test(normalizedReadme)) {
        contractErrors.push('README must state the no-prebuilt distribution policy');
    }
    for (const workflowContract of [
        'name: webos-ipk',
        'path: packages/*.ipk',
        'retention-days: 7',
        "if: github.ref == 'refs/heads/main' && github.event_name == 'push'",
    ]) {
        if (!workflow.includes(workflowContract)) {
            contractErrors.push(`CI no longer supports documented Actions detail: ${workflowContract}`);
        }
    }
    return contractErrors;
}

function checkDistributionContract() {
    const installation = read('docs/getting-started/installation.md');
    const readme = read('README.md');
    const workflow = read('.github/workflows/ci.yml');
    if (installation === null || readme === null || workflow === null) return;
    errors.push(...distributionContractErrors({ installation, readme, workflow }));
}

export function pqrHandoffContractErrors(checklist) {
    const contractErrors = [];
    const handoff = checklist.match(
        /^## Fresh-Session Handoff\s*$([\s\S]*?)^## /mu
    )?.[1] ?? '';
    if (!/Next safe start:\s+`PQR-EXIT` is the sole open PQR cleanup gate/iu.test(handoff)) {
        contractErrors.push('fresh-session handoff must route to sole open PQR-EXIT');
    }
    if (/`PQR-1` is the next cleanup start/iu.test(handoff)) {
        contractErrors.push('fresh-session handoff must not route to completed PQR-1');
    }
    for (let packageNumber = 1; packageNumber <= 7; packageNumber += 1) {
        const completedHeading = new RegExp(
            `^### \\[x\\] \`PQR-${packageNumber}\``,
            'mu'
        );
        if (!completedHeading.test(checklist)) {
            contractErrors.push(`PQR-${packageNumber} must remain complete`);
        }
    }
    if (!/^### \[ \] `PQR-EXIT`/mu.test(checklist)) {
        contractErrors.push('PQR-EXIT must remain open');
    }
    return contractErrors;
}

function checkPqrHandoffContract() {
    const checklist = read('ARCHITECTURE_CLEANUP_CHECKLIST.md');
    if (checklist === null) return;
    errors.push(...pqrHandoffContractErrors(checklist));
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

function safeRolePath(relativePath) {
    if (!/^agents\/[a-z0-9_.-]+\.toml$/iu.test(relativePath)) return null;
    const codexRoot = realpathSync(path.join(root, '.codex'));
    const candidate = path.join(root, '.codex', relativePath);
    if (!existsSync(candidate) || !lstatSync(candidate).isFile()) return null;
    const resolved = realpathSync(candidate);
    return resolved.startsWith(`${codexRoot}${path.sep}`) ? candidate : null;
}

function checkRoleConfig() {
    const configText = read('.codex/config.toml');
    if (configText === null) return;

    let config;
    try {
        config = parseToml(configText);
    } catch (error) {
        errors.push(`.codex/config.toml: invalid TOML (${error.message})`);
        return;
    }

    const agents = config.agents;
    if (!agents || typeof agents !== 'object') {
        errors.push('.codex/config.toml: missing [agents]');
        return;
    }
    if (!isValidMaxDepth(agents.max_depth)) {
        errors.push('.codex/config.toml: max_depth must be a finite non-negative integer <= 1');
    }

    const tracked = new Set(trackedFiles());
    for (const [role, declaration] of Object.entries(agents)) {
        if (role === 'max_threads' || role === 'max_depth') continue;
        const configFile = declaration?.config_file;
        if (typeof configFile !== 'string') {
            errors.push(`role ${role}: missing config_file`);
            continue;
        }
        const rolePath = safeRolePath(configFile);
        if (rolePath === null) {
            errors.push(`role ${role}: invalid or missing config file ${configFile}`);
            continue;
        }
        const trackedRolePath = `.codex/${configFile}`;
        if (!tracked.has(trackedRolePath)) errors.push(`role ${role}: config is not tracked`);
        try {
            const roleConfig = parseToml(readFileSync(rolePath, 'utf8'));
            if (requiredReadOnlyRoles.has(role) && roleConfig.sandbox_mode !== 'read-only') {
                errors.push(`role ${role}: must use sandbox_mode = "read-only"`);
            }
            if (typeof roleConfig.developer_instructions !== 'string') {
                errors.push(`role ${role}: missing developer_instructions`);
            }
        } catch (error) {
            errors.push(`role ${role}: invalid TOML (${error.message})`);
        }
    }
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
    checkDistributionContract();
    checkPqrHandoffContract();
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
