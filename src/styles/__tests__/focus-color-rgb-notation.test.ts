/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.join(process.cwd(), 'src');
const BAD_PATTERN = /rgb\(var\(--focus-color-rgb\)\s*\/\s*/g;

function walkCssFiles(dir: string, out: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkCssFiles(fullPath, out);
            continue;
        }
        if (entry.isFile() && fullPath.endsWith('.css')) {
            out.push(fullPath);
        }
    }
    return out;
}

describe('focus-color-rgb notation', () => {
    it('does not use modern rgb(... / alpha) with comma-separated --focus-color-rgb tokens', () => {
        const cssFiles = walkCssFiles(SRC_DIR);

        const offenders: string[] = [];
        for (const filePath of cssFiles) {
            const text = fs.readFileSync(filePath, 'utf8');
            if (BAD_PATTERN.test(text)) {
                offenders.push(path.relative(process.cwd(), filePath));
            }
            BAD_PATTERN.lastIndex = 0;
        }

        expect(offenders).toEqual([]);
    });
});

