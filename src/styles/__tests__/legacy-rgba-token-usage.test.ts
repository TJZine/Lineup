/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.join(process.cwd(), 'src');
const BAD_PATTERN = /rgba\(\s*var\(\s*--(?:scrim-tint-rgb|color-primary-rgb)(?!-)[^)]*\)\s*,/g;

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

describe('legacy rgba token usage', () => {
    it('does not use space-separated scrim/color-primary RGB tokens with rgba(...)', () => {
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
