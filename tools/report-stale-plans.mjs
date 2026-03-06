import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const planDir = path.join(repoRoot, 'docs/plans');

function parseArgs(argv) {
    const options = {
        maxAgeDays: 7,
        today: new Date(),
    };

    for (const arg of argv) {
        if (arg.startsWith('--max-age-days=')) {
            options.maxAgeDays = Number.parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--today=')) {
            options.today = new Date(`${arg.split('=')[1]}T00:00:00Z`);
        }
    }

    return options;
}

function parseDatePrefix(fileName) {
    const match = fileName.match(/^(\d{4}-\d{2}-\d{2})-/);
    if (!match) {
        return null;
    }

    return new Date(`${match[1]}T00:00:00Z`);
}

function ageInDays(olderDate, newerDate) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((newerDate.getTime() - olderDate.getTime()) / millisecondsPerDay);
}

const { maxAgeDays, today } = parseArgs(process.argv.slice(2));

if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0) {
    console.error(`Invalid --max-age-days value: ${maxAgeDays}`);
    process.exit(1);
}

if (Number.isNaN(today.getTime())) {
    console.error('Invalid --today value. Use YYYY-MM-DD.');
    process.exit(1);
}

if (!existsSync(planDir)) {
    console.error('Missing docs/plans directory.');
    process.exit(1);
}

const candidates = readdirSync(planDir)
    .filter((fileName) => fileName.endsWith('.md') && fileName !== 'README.md')
    .map((fileName) => {
        const planDate = parseDatePrefix(fileName);
        if (planDate === null || Number.isNaN(planDate.getTime())) {
            return null;
        }

        return {
            ageDays: ageInDays(planDate, today),
            fileName,
        };
    })
    .filter((candidate) => candidate !== null && candidate.ageDays > maxAgeDays)
    .sort((left, right) => right.ageDays - left.ageDays);

if (candidates.length === 0) {
    console.log(`No archive-review candidates older than ${maxAgeDays} day(s).`);
    process.exit(0);
}

console.log(`Archive-review candidates older than ${maxAgeDays} day(s):`);
for (const candidate of candidates) {
    console.log(`- docs/plans/${candidate.fileName} (${candidate.ageDays} day(s) old)`);
}
console.log('');
console.log('Review task status and tracked references before archiving.');
