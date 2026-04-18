import { Dirent, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

jest.mock('../bootstrap', () => ({
    installLineupBootstrap: jest.fn(),
}));

const INDEX_FILE_PATH = join(__dirname, '..', 'index.ts');
const SOURCE_ROOT = join(__dirname, '..');
const CSS_IMPORT_SPECIFIER_PATTERN =
    /^(?:"([^"]+\.css)"|'([^']+\.css)'|url\(\s*(?:"([^"]+\.css)"|'([^']+\.css)'|([^'")\s;]+\.css))\s*\))/i;
const STYLESHEET_SEAM_FILE_NAMES = new Set(['styles.css', 'shell.css']);

function getStylesheetImportSpecifiersFromSource(sourceText: string, filePath = INDEX_FILE_PATH): string[] {
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const specifiers: string[] = [];

    sourceFile.statements.forEach((statement) => {
        if (!ts.isImportDeclaration(statement)) {
            return;
        }

        if (statement.importClause) {
            return;
        }

        if (!ts.isStringLiteral(statement.moduleSpecifier)) {
            return;
        }

        const specifier = statement.moduleSpecifier.text;
        if (specifier.endsWith('.css')) {
            specifiers.push(specifier);
        }
    });

    return specifiers;
}

function getIndexStylesheetImportSpecifiers(): string[] {
    return getStylesheetImportSpecifiersFromSource(readFileSync(INDEX_FILE_PATH, 'utf8'));
}

function toTestModuleSpecifier(indexImportSpecifier: string): string {
    if (!indexImportSpecifier.startsWith('./')) {
        throw new Error(
            `toTestModuleSpecifier expected a ./ stylesheet specifier from ${INDEX_FILE_PATH}, got: ${indexImportSpecifier}`
        );
    }

    return `../${indexImportSpecifier.slice(2)}`;
}

function mockIndexStylesheetImports(): void {
    getIndexStylesheetImportSpecifiers().forEach((specifier) => {
        jest.doMock(toTestModuleSpecifier(specifier), () => ({}));
    });
}

function getStylesheetSeamFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry: Dirent) => {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            return getStylesheetSeamFiles(entryPath);
        }

        return STYLESHEET_SEAM_FILE_NAMES.has(entry.name) ? [entryPath] : [];
    });
}

function normalizeSourceRelativeStylesheetPath(filePath: string): string {
    return relative(SOURCE_ROOT, resolve(SOURCE_ROOT, filePath)).replace(/\\/g, '/');
}

function isCssImportBoundary(contents: string, index: number): boolean {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const character = contents.charAt(cursor);
        if (/\s/.test(character)) {
            continue;
        }

        if (character === '/' && cursor > 0 && contents.charAt(cursor - 1) === '*') {
            const commentStart = contents.lastIndexOf('/*', cursor - 1);
            if (commentStart === -1) {
                return false;
            }

            cursor = commentStart;
            continue;
        }

        return character === ';' || character === '{' || character === '}';
    }

    return true;
}

function getStandaloneCssImportPath(rule: string): string | null {
    const trimmedRule = rule.trim();
    if (!trimmedRule.startsWith('@import')) {
        return null;
    }

    const remainder = trimmedRule.slice('@import'.length).trimStart();
    const specifierMatch = remainder.match(CSS_IMPORT_SPECIFIER_PATTERN);
    if (!specifierMatch) {
        return null;
    }

    const trailingQualifiers = remainder.slice(specifierMatch[0].length).trim();
    if (!trailingQualifiers.endsWith(';')) {
        return null;
    }

    return specifierMatch[1] ?? specifierMatch[2] ?? specifierMatch[3] ?? specifierMatch[4] ?? specifierMatch[5] ?? null;
}

function getStandaloneCssImportPaths(contents: string): string[] {
    const imports: string[] = [];
    let cursor = 0;
    let blockDepth = 0;

    while (cursor < contents.length) {
        if (contents.startsWith('/*', cursor)) {
            const commentEnd = contents.indexOf('*/', cursor + 2);
            cursor = commentEnd === -1 ? contents.length : commentEnd + 2;
            continue;
        }

        const quote = contents.charAt(cursor);
        if (quote === '"' || quote === "'") {
            cursor += 1;

            while (cursor < contents.length) {
                if (contents.charAt(cursor) === '\\') {
                    cursor += 2;
                    continue;
                }

                if (contents.charAt(cursor) === quote) {
                    cursor += 1;
                    break;
                }

                cursor += 1;
            }

            continue;
        }

        const character = contents.charAt(cursor);
        if (character === '{') {
            blockDepth += 1;
            cursor += 1;
            continue;
        }

        if (character === '}') {
            blockDepth = Math.max(0, blockDepth - 1);
            cursor += 1;
            continue;
        }

        if (
            blockDepth === 0 &&
            contents.slice(cursor, cursor + '@import'.length).toLowerCase() === '@import' &&
            isCssImportBoundary(contents, cursor)
        ) {
            let rule = '@import';
            cursor += '@import'.length;

            while (cursor < contents.length) {
                if (contents.startsWith('/*', cursor)) {
                    const commentEnd = contents.indexOf('*/', cursor + 2);
                    cursor = commentEnd === -1 ? contents.length : commentEnd + 2;
                    continue;
                }

                const ruleCharacter = contents.charAt(cursor);
                rule += ruleCharacter;
                cursor += 1;

                if (ruleCharacter === '"' || ruleCharacter === "'") {
                    while (cursor < contents.length) {
                        rule += contents.charAt(cursor);

                        if (contents.charAt(cursor) === '\\') {
                            cursor += 1;
                            if (cursor < contents.length) {
                                rule += contents.charAt(cursor);
                                cursor += 1;
                            }
                            continue;
                        }

                        const isClosingQuote = contents.charAt(cursor) === ruleCharacter;
                        cursor += 1;
                        if (isClosingQuote) {
                            break;
                        }
                    }

                    continue;
                }

                if (ruleCharacter === ';') {
                    const importedSpecifier = getStandaloneCssImportPath(rule);
                    if (importedSpecifier) {
                        imports.push(importedSpecifier);
                    }
                    break;
                }
            }

            continue;
        }

        cursor += 1;
    }

    return imports;
}

function getComposedLeafStylesheetTargetsFor(seamFilePaths: string[]): Set<string> {
    const composedLeafTargets = new Set<string>();

    seamFilePaths.forEach((seamFilePath) => {
        const normalizedSeamPath = normalizeSourceRelativeStylesheetPath(seamFilePath);
        const seamAbsolutePath = resolve(SOURCE_ROOT, normalizedSeamPath);
        const seamDirectory = dirname(seamAbsolutePath);
        const seamContents = readFileSync(seamAbsolutePath, 'utf8');

        for (const importedSpecifier of getStandaloneCssImportPaths(seamContents)) {
            composedLeafTargets.add(
                relative(SOURCE_ROOT, resolve(seamDirectory, importedSpecifier)).replace(/\\/g, '/')
            );
        }
    });

    return composedLeafTargets;
}

function getForbiddenCompositionRootStylesheetImportsFor(
    importSpecifiers: string[],
    seamFilePaths: string[]
): string[] {
    const composedLeafTargets = getComposedLeafStylesheetTargetsFor(seamFilePaths);

    return importSpecifiers.filter((specifier) => {
        const normalizedSpecifier = normalizeSourceRelativeStylesheetPath(specifier);
        return composedLeafTargets.has(normalizedSpecifier);
    });
}

function getForbiddenCompositionRootStylesheetImports(): string[] {
    return getForbiddenCompositionRootStylesheetImportsFor(
        getIndexStylesheetImportSpecifiers(),
        getStylesheetSeamFiles(SOURCE_ROOT)
    );
}

describe('getForbiddenCompositionRootStylesheetImportsFor', () => {
    const tempRoots: string[] = [];

    afterEach(() => {
        tempRoots.splice(0).forEach((tempRoot) => {
            rmSync(tempRoot, { force: true, recursive: true });
        });
    });

    function createStylesheetFixtureFiles(files: Record<string, string>): string {
        const tempRoot = mkdtempSync(join(tmpdir(), 'lineup-index-test-'));
        tempRoots.push(tempRoot);

        Object.entries(files).forEach(([relativeFilePath, contents]) => {
            const absoluteFilePath = join(tempRoot, relativeFilePath);
            mkdirSync(dirname(absoluteFilePath), { recursive: true });
            writeFileSync(absoluteFilePath, contents);
        });

        return relative(SOURCE_ROOT, tempRoot).replace(/\\/g, '/');
    }

    it.each([
        {
            name: 'allows barrel and root seam imports',
            files: {
                'styles/styles.css': "@import './theme.css';\n",
                'styles/theme.css': 'body {}\n',
                'app-shell/shell.css': "@import './content.css';\n",
                'app-shell/content.css': '.shell {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/styles.css', '__ROOT__/app-shell/shell.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css', '__ROOT__/app-shell/shell.css'],
            expected: [],
        },
        {
            name: 'forbids only leaf imports explicitly composed by seam files',
            files: {
                'styles/styles.css': "@import './theme.css';\n",
                'styles/theme.css': 'body {}\n',
                'shell/shell.css': "@import './content.css';\n",
                'shell/content.css': '.shell {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css', '__ROOT__/shell/shell.css'],
            expected: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
        },
        {
            name: 'forbids seam leaf imports composed through url() syntax',
            files: {
                'styles/styles.css': "@import url('./theme.css');\n",
                'styles/theme.css': 'body {}\n',
                'shell/shell.css': "@import url('./content.css');\n",
                'shell/content.css': '.shell {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css', '__ROOT__/shell/shell.css'],
            expected: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
        },
        {
            name: 'forbids seam leaf imports composed through bare url() syntax',
            files: {
                'styles/styles.css': '@import url(./theme.css);\n',
                'styles/theme.css': 'body {}\n',
                'shell/shell.css': '@import url(./content.css);\n',
                'shell/content.css': '.shell {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css', '__ROOT__/shell/shell.css'],
            expected: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
        },
        {
            name: 'forbids seam leaf imports composed through qualified url() syntax',
            files: {
                'styles/styles.css': '@import url("./theme.css") layer(base);\n',
                'styles/theme.css': 'body {}\n',
                'shell/shell.css': '@import url("./content.css") screen and (min-width: 1px);\n',
                'shell/content.css': '.shell {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css', '__ROOT__/shell/shell.css'],
            expected: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
        },
        {
            name: 'forbids seam leaf imports composed through qualified string syntax',
            files: {
                'styles/styles.css': '@import "./theme.css" layer(base);\n',
                'styles/theme.css': 'body {}\n',
                'shell/shell.css': '@import "./content.css" screen and (min-width: 1px);\n',
                'shell/content.css': '.shell {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css', '__ROOT__/shell/shell.css'],
            expected: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
        },
        {
            name: 'forbids seam leaf imports composed through comma-qualified string syntax',
            files: {
                'styles/styles.css': '@import "./theme.css" screen, print;\n',
                'styles/theme.css': 'body {}\n',
                'shell/shell.css': '@import "./content.css" projection, tv;\n',
                'shell/content.css': '.shell {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css', '__ROOT__/shell/shell.css'],
            expected: ['__ROOT__/styles/theme.css', '__ROOT__/shell/content.css'],
        },
        {
            name: 'ignores commented-out seam imports when collecting composed leaf targets',
            files: {
                'styles/styles.css': '/* @import url(./theme.css); */\n',
                'styles/theme.css': 'body {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css'],
            expected: [],
        },
        {
            name: 'ignores @import text inside css string literals',
            files: {
                'styles/styles.css': '.shell::before { content: "@import url(./theme.css);"; }\n',
                'styles/theme.css': 'body {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css'],
            expected: [],
        },
        {
            name: 'allows unrelated sibling css when it is not composed by a seam file',
            files: {
                'styles/styles.css': "@import './theme.css';\n",
                'styles/theme.css': 'body {}\n',
                'styles/unrelated.css': '.free {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css', '__ROOT__/styles/unrelated.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css'],
            expected: ['__ROOT__/styles/theme.css'],
        },
        {
            name: 'allows unrelated shell.css siblings when they are not composed by that seam file',
            files: {
                'styles/shell.css': "@import './shell.chrome.css';\n",
                'styles/shell.chrome.css': '.chrome {}\n',
                'styles/tokens.css': ':root {}\n',
                'styles/themes.css': 'body {}\n',
            },
            importSpecifiers: [
                '__ROOT__/styles/shell.chrome.css',
                '__ROOT__/styles/tokens.css',
                '__ROOT__/styles/themes.css',
            ],
            seamFilePaths: ['__ROOT__/styles/shell.css'],
            expected: ['__ROOT__/styles/shell.chrome.css'],
        },
        {
            name: 'normalizes equivalent paths before applying the policy',
            files: {
                'styles/styles.css': "@import './theme.css';\n",
                'styles/theme.css': 'body {}\n',
                'shell/shell.css': "@import './content.css';\n",
                'shell/content.css': '.shell {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/./theme.css', '__ROOT__/shell/panels/../content.css'],
            seamFilePaths: ['__ROOT__/styles/./styles.css', '__ROOT__/shell/./shell.css'],
            expected: ['__ROOT__/styles/./theme.css', '__ROOT__/shell/panels/../content.css'],
        },
        {
            name: 'preserves real imports when comment delimiter tokens appear inside css string literals',
            files: {
                'styles/styles.css':
                    '.shell::before { content: "/* pretend comment */"; }\n@import "./theme.css";\n.shell::after { content: "*/ trailing token /*"; }\n',
                'styles/theme.css': 'body {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css'],
            expected: ['__ROOT__/styles/theme.css'],
        },
        {
            name: 'detects top-level imports that immediately follow block comments',
            files: {
                'styles/styles.css': '/* theme boundary */@import "./theme.css";\n',
                'styles/theme.css': 'body {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css'],
            expected: ['__ROOT__/styles/theme.css'],
        },
        {
            name: 'detects multiline standalone imports that terminate with a semicolon',
            files: {
                'styles/styles.css': '@import\n    url("./theme.css")\n    screen and (min-width: 1px);\n',
                'styles/theme.css': 'body {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css'],
            expected: ['__ROOT__/styles/theme.css'],
        },
        {
            name: 'ignores @import text nested inside css blocks',
            files: {
                'styles/styles.css': '@media screen {\n  @import "./theme.css";\n}\n',
                'styles/theme.css': 'body {}\n',
            },
            importSpecifiers: ['__ROOT__/styles/theme.css'],
            seamFilePaths: ['__ROOT__/styles/styles.css'],
            expected: [],
        },
    ])('$name', ({ files, importSpecifiers, seamFilePaths, expected }) => {
        const fixtureRoot = createStylesheetFixtureFiles(files);
        const resolveFixturePath = (filePath: string): string => filePath.replace('__ROOT__', fixtureRoot);

        expect(
            getForbiddenCompositionRootStylesheetImportsFor(
                importSpecifiers.map(resolveFixturePath),
                seamFilePaths.map(resolveFixturePath)
            )
        ).toEqual(expected.map(resolveFixturePath));
    });
});

describe('src/index', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('installs the lineup bootstrap exactly once on module import', () => {
        mockIndexStylesheetImports();

        let installLineupBootstrap!: jest.Mock;
        jest.isolateModules(() => {
            installLineupBootstrap = (require('../bootstrap') as {
                installLineupBootstrap: jest.Mock;
            }).installLineupBootstrap;
            require('../index');
        });
        expect(installLineupBootstrap).toHaveBeenCalledTimes(1);
    });

    it('detects package-internal split stylesheet leaf imports from the composition root', () => {
        expect(getForbiddenCompositionRootStylesheetImports()).toEqual([]);
    });

    it('extracts side-effect stylesheet imports when inline comments surround valid statements', () => {
        const sourceText = `
            import './styles/base.css'; // trailing comment
            /* leading block comment */ import './styles/theme.css';
            import './bootstrap';
            import { installLineupBootstrap } from './bootstrap';
        `;

        expect(getStylesheetImportSpecifiersFromSource(sourceText, 'index-fixture.ts')).toEqual([
            './styles/base.css',
            './styles/theme.css',
        ]);
    });
});
