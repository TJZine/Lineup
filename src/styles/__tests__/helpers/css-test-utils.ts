import fs from 'node:fs';
import path from 'node:path';

export const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const CSS_IMPORT_PATTERN =
    /^\s*@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)['"]?\s*\)?[^;]*;\s*$/gm;

const readComposedCssFile = (filePath: string, stack: string[]): string => {
    const css = fs.readFileSync(filePath, 'utf8');

    return css.replace(CSS_IMPORT_PATTERN, (_statement, specifier: string) => {
        const importPath = path.resolve(path.dirname(filePath), specifier);
        if (stack.includes(importPath)) {
            throw new Error(`Circular CSS import detected: ${[...stack, importPath].join(' -> ')}`);
        }

        return readComposedCssFile(importPath, [...stack, importPath]);
    });
};

export const readComposedCss = (relativePath: string): string => {
    const absolutePath = path.join(process.cwd(), relativePath);
    return readComposedCssFile(absolutePath, [absolutePath]);
};

const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSelector = (selector: string): string => selector.replace(/\s+/g, ' ').trim();

const skipComment = (css: string, index: number): number => {
    const commentEnd = css.indexOf('*/', index + 2);
    if (commentEnd === -1) {
        throw new Error('Unterminated CSS comment');
    }

    return commentEnd + 2;
};

const skipString = (css: string, index: number): number => {
    const quote = css[index];
    let cursor = index + 1;
    while (cursor < css.length) {
        if (css[cursor] === '\\') {
            cursor += 2;
            continue;
        }

        if (css[cursor] === quote) {
            return cursor + 1;
        }

        cursor += 1;
    }

    throw new Error(`Unterminated CSS string starting at index ${index}`);
};

const findMatchingBrace = (css: string, openBrace: number): number => {
    let depth = 1;
    let cursor = openBrace + 1;

    while (cursor < css.length) {
        if (css.startsWith('/*', cursor)) {
            cursor = skipComment(css, cursor);
            continue;
        }

        if (css[cursor] === '"' || css[cursor] === "'") {
            cursor = skipString(css, cursor);
            continue;
        }

        if (css[cursor] === '{') {
            depth += 1;
        } else if (css[cursor] === '}') {
            depth -= 1;
            if (depth === 0) {
                return cursor + 1;
            }
        }

        cursor += 1;
    }

    throw new Error('CSS block missing closing brace');
};

export const splitSelectorList = (selectorList: string): string[] => {
    const selectors: string[] = [];
    let currentSelector = '';
    let cursor = 0;
    let parenDepth = 0;
    let bracketDepth = 0;

    while (cursor < selectorList.length) {
        if (selectorList.startsWith('/*', cursor)) {
            const commentEnd = skipComment(selectorList, cursor);
            currentSelector += selectorList.slice(cursor, commentEnd);
            cursor = commentEnd;
            continue;
        }

        if (selectorList[cursor] === '"' || selectorList[cursor] === "'") {
            const stringEnd = skipString(selectorList, cursor);
            currentSelector += selectorList.slice(cursor, stringEnd);
            cursor = stringEnd;
            continue;
        }

        const char = selectorList[cursor];
        if (char === '(') {
            parenDepth += 1;
        } else if (char === ')' && parenDepth > 0) {
            parenDepth -= 1;
        } else if (char === '[') {
            bracketDepth += 1;
        } else if (char === ']' && bracketDepth > 0) {
            bracketDepth -= 1;
        } else if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
            const normalizedSelector = normalizeSelector(currentSelector);
            if (normalizedSelector.length > 0) {
                selectors.push(normalizedSelector);
            }
            currentSelector = '';
            cursor += 1;
            continue;
        }

        currentSelector += char;
        cursor += 1;
    }

    const normalizedSelector = normalizeSelector(currentSelector);
    if (normalizedSelector.length > 0) {
        selectors.push(normalizedSelector);
    }

    return selectors;
};

export const blockFor = (css: string, selector: string): string => {
    const wantedSelector = normalizeSelector(selector);
    let cursor = 0;
    let ruleStart = 0;

    while (cursor < css.length) {
        if (css.startsWith('/*', cursor)) {
            cursor = skipComment(css, cursor);
            ruleStart = cursor;
            continue;
        }

        if (css[cursor] === '"' || css[cursor] === "'") {
            cursor = skipString(css, cursor);
            continue;
        }

        if (css[cursor] === '{') {
            const selectorList = css.slice(ruleStart, cursor).trim();
            const blockEnd = findMatchingBrace(css, cursor);

            if (selectorList.startsWith('@')) {
                const nestedBlock = css.slice(cursor + 1, blockEnd - 1);

                try {
                    return blockFor(nestedBlock, selector);
                } catch (error) {
                    if (!(error instanceof Error) || !error.message.startsWith('Selector block not found:')) {
                        throw error;
                    }
                }

                cursor = blockEnd;
                ruleStart = cursor;
                continue;
            }

            const selectors = splitSelectorList(selectorList);

            if (selectors.includes(wantedSelector)) {
                return css.slice(ruleStart, blockEnd).trimStart();
            }

            cursor = blockEnd;
            ruleStart = cursor;
            continue;
        }

        cursor += 1;
    }

    throw new Error(`Selector block not found: ${selector}`);
};

export const declarationValue = (block: string, property: string): string => {
    const propertyPattern = escapeRegExp(property);
    const regex = new RegExp(`(^|\\n)\\s*${propertyPattern}\\s*:\\s*([^;]+);`, 'm');
    const match = block.match(regex);
    if (!match || typeof match[2] !== 'string') {
        throw new Error(`Property not found: ${property}`);
    }
    return match[2].replace(/\s+/g, ' ').trim();
};
