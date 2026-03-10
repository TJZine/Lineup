import fs from 'node:fs';
import path from 'node:path';

export const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

export const blockFor = (css: string, selector: string): string => {
    const selectorPattern = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match selector blocks even when the selector is part of a grouped selector list.
    // Keep this resilient to formatting changes (commas/newlines/indentation).
    const match = css.match(new RegExp(`(^|\\n)\\s*${selectorPattern}\\s*(?:,\\s*)?[^\\{]*\\{[\\s\\S]*?\\}`, 'm'));
    if (!match) {
        throw new Error(`Selector block not found: ${selector}`);
    }
    return match[0];
};

export const declarationValue = (block: string, property: string): string => {
    const regex = new RegExp(`${property}\\s*:\\s*([^;]+);`);
    const match = block.match(regex);
    if (!match || typeof match[1] !== 'string') {
        throw new Error(`Property not found: ${property}`);
    }
    return match[1].replace(/\s+/g, ' ').trim();
};

