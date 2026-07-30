import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

type Finding = { file: string; receiver?: string; property?: string; scope?: string };
const EPG_CACHE_STORE_EXCEPTION =
    'src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts|store|_loadedRangeKeyByChannel';
const SLEEP_HELPER_EXCEPTIONS = new Set([
    'src/__tests__/helpers.ts|flushPromisesAndMacrotask',
    'src/__tests__/helpers.ts|withTestTimeout',
]);

const jestOwnedFiles = (): string[] =>
    execFileSync('rg', ['--files', 'src', '-g', '*.ts', '-g', '*.tsx'], {
        cwd: process.cwd(),
        encoding: 'utf8',
    })
        .split('\n')
        .filter(
            (file) =>
                !file.startsWith('src/__tests__/tools/')
                && (
                    file.includes('/__tests__/')
                    || /\.test\.tsx?$/.test(file)
                )
        )
        .sort();

const propertyName = (node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | null => {
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    const argument = node.argumentExpression;
    return argument && ts.isStringLiteralLike(argument) ? argument.text : null;
};

const assertionInfo = (
    expression: ts.Expression
): { receiver: string | null; suspicious: boolean } => {
    let current = expression;
    let suspicious = false;
    while (
        ts.isParenthesizedExpression(current)
        || ts.isAsExpression(current)
        || ts.isTypeAssertionExpression(current)
        || ts.isNonNullExpression(current)
    ) {
        if (!ts.isParenthesizedExpression(current)) suspicious = true;
        current = current.expression;
    }
    return {
        receiver: ts.isIdentifier(current) ? current.text : null,
        suspicious,
    };
};

const timerName = (expression: ts.Expression): string | null => {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (ts.isElementAccessExpression(expression)) {
        const argument = expression.argumentExpression;
        return argument && ts.isStringLiteralLike(argument) ? argument.text : null;
    }
    return null;
};

const isTimerCall = (node: ts.Node): node is ts.CallExpression => {
    if (!ts.isCallExpression(node)) return false;
    const timer = timerName(node.expression);
    const callback = node.arguments[0];
    return (
        (timer === 'setTimeout' || timer === 'setInterval')
        && callback !== undefined
        && (
            ts.isIdentifier(callback)
            || ts.isArrowFunction(callback)
            || ts.isFunctionExpression(callback)
        )
    );
};

const namedScope = (node: ts.Node): string => {
    for (let current: ts.Node | undefined = node; current; current = current.parent) {
        if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
        if (
            (ts.isArrowFunction(current) || ts.isFunctionExpression(current))
            && ts.isVariableDeclaration(current.parent)
            && ts.isIdentifier(current.parent.name)
        ) {
            return current.parent.name.text;
        }
        if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    }
    return '<inline>';
};

const isInsidePromise = (node: ts.Node): boolean => {
    for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
        if (
            ts.isNewExpression(current)
            && ts.isIdentifier(current.expression)
            && current.expression.text === 'Promise'
        ) {
            return true;
        }
    }
    return false;
};

const scanSource = (
    file: string,
    source: string
): { privateProbes: Finding[]; sleeps: Finding[] } => {
    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const aliases = new Set<string>();
    const privateProbes: Finding[] = [];
    const sleeps: Finding[] = [];

    let changed = true;
    while (changed) {
        changed = false;
        const discoverAliases = (node: ts.Node): void => {
            if (
                ts.isVariableDeclaration(node)
                && ts.isIdentifier(node.name)
                && node.initializer
            ) {
                const info = assertionInfo(node.initializer);
                if ((info.suspicious || (info.receiver && aliases.has(info.receiver)))
                    && !aliases.has(node.name.text)) {
                    aliases.add(node.name.text);
                    changed = true;
                }
            }
            ts.forEachChild(node, discoverAliases);
        };
        discoverAliases(sourceFile);
    }

    type LocalBinding = ts.VariableDeclaration | ts.FunctionDeclaration | ts.ParameterDeclaration;
    const bindings = new Map<ts.Node, Map<string, LocalBinding>>();
    const addBinding = (scope: ts.Node, name: string, declaration: LocalBinding): void => {
        const scopeBindings = bindings.get(scope) ?? new Map<string, LocalBinding>();
        scopeBindings.set(name, declaration);
        bindings.set(scope, scopeBindings);
    };
    const nearestBlockScope = (node: ts.Node): ts.Block | ts.SourceFile | null => {
        for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
            if (ts.isBlock(current) || ts.isSourceFile(current)) return current;
        }
        return null;
    };
    const discoverBindings = (node: ts.Node): void => {
        if (
            ts.isFunctionDeclaration(node)
            && node.name
        ) {
            const scope = nearestBlockScope(node);
            if (scope) addBinding(scope, node.name.text, node);
        } else if (
            ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
        ) {
            const scope = nearestBlockScope(node);
            if (scope) addBinding(scope, node.name.text, node);
        } else if (
            ts.isParameter(node)
            && ts.isIdentifier(node.name)
            && ts.isFunctionLike(node.parent)
        ) {
            addBinding(node.parent, node.name.text, node);
        }
        ts.forEachChild(node, discoverBindings);
    };
    discoverBindings(sourceFile);

    const resolveBinding = (name: string, use: ts.Node): LocalBinding | null => {
        for (let current: ts.Node | undefined = use; current; current = current.parent) {
            const binding = bindings.get(current)?.get(name);
            if (binding) return binding;
        }
        return null;
    };

    const bindingUsesTimer = (binding: LocalBinding, seen: Set<LocalBinding>): boolean => {
        if (seen.has(binding) || ts.isParameter(binding)) return false;
        seen.add(binding);

        if (ts.isVariableDeclaration(binding)) {
            const initializer = binding.initializer;
            if (!initializer) return false;
            if (ts.isIdentifier(initializer)) {
                const target = resolveBinding(initializer.text, initializer);
                return target ? bindingUsesTimer(target, seen) : false;
            }
            if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) {
                return false;
            }
            return functionUsesTimer(initializer, seen);
        }
        return functionUsesTimer(binding, seen);
    };

    const functionUsesTimer = (
        callback: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration,
        seen: Set<LocalBinding>
    ): boolean => {
        let found = false;
        const visitCallback = (node: ts.Node): void => {
            if (found) return;
            if (
                node !== callback
                && (
                    ts.isArrowFunction(node)
                    || ts.isFunctionExpression(node)
                    || ts.isFunctionDeclaration(node)
                )
            ) {
                return;
            }
            if (isTimerCall(node)) {
                found = true;
                return;
            }
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
                const called = resolveBinding(node.expression.text, node);
                if (called && bindingUsesTimer(called, new Set(seen))) {
                    found = true;
                    return;
                }
            }
            ts.forEachChild(node, visitCallback);
        };
        visitCallback(callback);
        return found;
    };

    const visit = (node: ts.Node): void => {
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
            const property = propertyName(node);
            const info = assertionInfo(node.expression);
            if (
                property
                && /^_[^_]/.test(property)
                && (info.suspicious || (info.receiver !== null && aliases.has(info.receiver)))
            ) {
                privateProbes.push({
                    file,
                    receiver: info.receiver ?? '<expression>',
                    property,
                });
            }
        }
        if (isTimerCall(node) && isInsidePromise(node)) {
            sleeps.push({ file, scope: namedScope(node) });
        }
        if (
            ts.isNewExpression(node)
            && ts.isIdentifier(node.expression)
            && node.expression.text === 'Promise'
            && node.arguments?.[0]
            && ts.isIdentifier(node.arguments[0])
        ) {
            const callback = resolveBinding(node.arguments[0].text, node);
            if (callback && bindingUsesTimer(callback, new Set())) {
                sleeps.push({ file, scope: namedScope(node) });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return { privateProbes, sleeps };
};

describe('test anti-pattern contracts', () => {
    it.each([
        ['as assertion', `(target as unknown as { _secret: string })._secret`],
        ['angle-bracket assertion', `(<{ _secret: string }><unknown>target)._secret`],
        ['non-null assertion', `target!._secret`],
        ['element access', `(target as unknown as { _secret: string })['_secret']`],
        ['asserted alias', `const mutable = target as unknown as { _secret: string }; mutable._secret`],
        ['chained alias', `const mutable = target as unknown as { _secret: string }; const alias = mutable; alias['_secret']`],
    ])('detects private probes through %s', (_label, source) => {
        expect(scanSource('synthetic.test.ts', source).privateProbes).toHaveLength(1);
    });

    it.each([
        ['identifier timer and callback', `const sleep = () => new Promise((resolve) => setTimeout(resolve, 1));`],
        ['property timer', `const sleep = () => new Promise((resolve) => globalThis.setTimeout(resolve, 1));`],
        ['element timer', `const sleep = () => new Promise((resolve) => globalThis['setTimeout'](resolve, 1));`],
        ['interval', `const wait = () => new Promise((resolve) => setInterval(resolve, 1));`],
        ['arrow callback', `const sleep = () => new Promise<void>(() => setTimeout(() => undefined, 1));`],
        ['direct await', `async function run() { await new Promise((resolve) => setTimeout(resolve, 1)); }`],
        ['local callback wrapper', `const wait = (resolve: () => void) => setTimeout(resolve, 1); const sleep = () => new Promise(wait);`],
        ['function callback wrapper', `function wait(resolve: () => void) { setTimeout(resolve, 1); } new Promise(wait);`],
        ['simple callback alias', `const wait = (resolve: () => void) => setTimeout(resolve, 1); const alias = wait; new Promise(alias);`],
        [
            'nested local scheduling wrapper',
            `const wait = (resolve: () => void) => {
                const schedule = (callback: () => void) => setTimeout(callback, 1);
                schedule(resolve);
            };
            new Promise(wait);`,
        ],
    ])('detects Promise timer sleeps through %s', (_label, source) => {
        expect(scanSource('synthetic.test.ts', source).sleeps).toHaveLength(1);
    });

    it.each([
        ['class-owned private state', `class Fake { private _value = 1; read() { return this._value; } }`],
        ['double-underscore global', `globalThis.__LINEUP__`],
        ['public assertion', `(target as { value: string }).value`],
        ['fake-timer scheduling', `setTimeout(() => { ready = true; }, 100)`],
        ['non-timer Promise', `new Promise((resolve) => queueMicrotask(resolve))`],
        ['unused timer callback wrapper', `const wait = (resolve: () => void) => setTimeout(resolve, 1); wait(done);`],
        ['non-timer callback wrapper', `const wait = (resolve: () => void) => queueMicrotask(resolve); new Promise(wait);`],
        ['timer wrapper passed elsewhere', `const wait = (resolve: () => void) => setTimeout(resolve, 1); register(wait);`],
        [
            'shadowed non-timer Promise callback',
            `const wait = (resolve: () => void) => setTimeout(resolve, 1);
            function run() {
                const wait = (resolve: () => void) => queueMicrotask(resolve);
                return new Promise(wait);
            }`,
        ],
        [
            'method-parameter shadowed Promise callback',
            `const wait = (resolve: () => void) => setTimeout(resolve, 1);
            class Runner {
                run(wait: (resolve: () => void) => void) {
                    return new Promise(wait);
                }
            }`,
        ],
        [
            'constructor-parameter shadowed Promise callback',
            `const wait = (resolve: () => void) => setTimeout(resolve, 1);
            class Runner {
                constructor(wait: (resolve: () => void) => void) {
                    new Promise(wait);
                }
            }`,
        ],
    ])('ignores %s', (_label, source) => {
        expect(scanSource('synthetic.test.ts', source)).toEqual({
            privateProbes: [],
            sleeps: [],
        });
    });

    it('discovers outside suites and non-tools test support files', () => {
        expect(jestOwnedFiles()).toEqual(
            expect.arrayContaining([
                'src/platform/webosPlatformServices.test.ts',
                'src/__tests__/helpers.ts',
                'src/__tests__/fixtures/preparedPlaybackStream.ts',
            ])
        );
        expect(jestOwnedFiles()).not.toContain('src/__tests__/tools/packageWebos.test.ts');
    });

    it('enforces the worktree Jest surface with only the exact owner exceptions', () => {
        const scans = jestOwnedFiles().map((file) =>
            scanSource(file, fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
        );
        const privateKeys = scans.flatMap(({ privateProbes }) =>
            privateProbes.map(({ file, receiver, property }) => `${file}|${receiver}|${property}`)
        );
        const sleepKeys = scans.flatMap(({ sleeps }) =>
            sleeps.map(({ file, scope }) => `${file}|${scope}`)
        );

        expect(privateKeys).toEqual([EPG_CACHE_STORE_EXCEPTION]);
        expect(sleepKeys.filter((key) => !SLEEP_HELPER_EXCEPTIONS.has(key))).toEqual([]);
        expect(sleepKeys.filter((key) => SLEEP_HELPER_EXCEPTIONS.has(key))).toEqual([
            'src/__tests__/helpers.ts|flushPromisesAndMacrotask',
            'src/__tests__/helpers.ts|withTestTimeout',
        ]);
    });
});
