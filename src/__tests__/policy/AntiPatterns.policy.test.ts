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

const sourceFiles = (directory: string): string[] => {
    const files: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...sourceFiles(absolutePath));
        } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
            files.push(path.relative(process.cwd(), absolutePath).split(path.sep).join('/'));
        }
    }
    return files.sort();
};

const jestOwnedFiles = (): string[] =>
    sourceFiles(path.join(process.cwd(), 'src')).filter(
        (file) =>
            !file.startsWith('src/__tests__/tools/')
            && (
                file.includes('/__tests__/')
                || /\.test\.tsx?$/.test(file)
            )
    );

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
    const privateProbes: Finding[] = [];
    const sleeps: Finding[] = [];

    type LocalBinding = ts.VariableDeclaration | ts.FunctionDeclaration | ts.ParameterDeclaration;
    const bindings = new Map<ts.Node, Map<string, LocalBinding>>();
    const addBinding = (scope: ts.Node, name: string, declaration: LocalBinding): void => {
        const scopeBindings = bindings.get(scope) ?? new Map<string, LocalBinding>();
        scopeBindings.set(name, declaration);
        bindings.set(scope, scopeBindings);
    };
    const nearestLexicalScope = (node: ts.Node): ts.Node | null => {
        for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
            if (
                ts.isBlock(current)
                || ts.isSourceFile(current)
                || ts.isForStatement(current)
                || ts.isForInStatement(current)
                || ts.isForOfStatement(current)
                || ts.isCatchClause(current)
                || ts.isCaseBlock(current)
            ) {
                return current;
            }
        }
        return null;
    };
    const discoverBindings = (node: ts.Node): void => {
        if (
            ts.isFunctionDeclaration(node)
            && node.name
        ) {
            const scope = nearestLexicalScope(node);
            if (scope) addBinding(scope, node.name.text, node);
        } else if (
            ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
        ) {
            const scope = nearestLexicalScope(node);
            if (scope) addBinding(scope, node.name.text, node);
        } else if (
            ts.isParameter(node)
            && ts.isIdentifier(node.name)
        ) {
            if (ts.isFunctionLike(node.parent) || ts.isCatchClause(node.parent)) {
                addBinding(node.parent, node.name.text, node);
            }
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

    const suspiciousBindings = new Set<LocalBinding>();
    let changed = true;
    while (changed) {
        changed = false;
        const discoverAliases = (node: ts.Node): void => {
            if (
                ts.isVariableDeclaration(node)
                && ts.isIdentifier(node.name)
                && !suspiciousBindings.has(node)
            ) {
                if (node.type?.kind === ts.SyntaxKind.AnyKeyword) {
                    suspiciousBindings.add(node);
                    changed = true;
                } else if (node.initializer) {
                    const info = assertionInfo(node.initializer);
                    const receiverBinding = info.receiver
                        ? resolveBinding(info.receiver, node.initializer)
                        : null;
                    if (
                        info.suspicious
                        || (receiverBinding !== null && suspiciousBindings.has(receiverBinding))
                    ) {
                        suspiciousBindings.add(node);
                        changed = true;
                    }
                }
            }
            ts.forEachChild(node, discoverAliases);
        };
        discoverAliases(sourceFile);
    }

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
            const receiverBinding = info.receiver
                ? resolveBinding(info.receiver, node.expression)
                : null;
            if (
                property
                && /^_[^_]/.test(property)
                && (
                    info.suspicious
                    || (receiverBinding !== null && suspiciousBindings.has(receiverBinding))
                )
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
        ['typed-any alias', `const sutAny: any = target; sutAny._secret`],
        ['chained typed-any alias', `const sutAny: any = target; const alias = sutAny; alias['_secret']`],
        [
            'suite-owned typed-any alias assigned in beforeEach',
            `let sutAny: any;
            beforeEach(() => { sutAny = target; });
            it('probes', () => { sutAny._secret; });`,
        ],
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
        [
            'for initializer shadow with outer binding restoration',
            `const wait = (resolve: () => void) => setTimeout(resolve, 1);
            for (let wait = (resolve: () => void) => queueMicrotask(resolve); ready; ) {
                new Promise(wait);
            }
            new Promise(wait);`,
        ],
        [
            'for-in shadow with outer binding restoration',
            `const wait = (resolve: () => void) => setTimeout(resolve, 1);
            for (const wait in callbacks) {
                new Promise(wait);
            }
            new Promise(wait);`,
        ],
        [
            'for-of shadow with outer binding restoration',
            `const wait = (resolve: () => void) => setTimeout(resolve, 1);
            for (const wait of callbacks) {
                new Promise(wait);
            }
            new Promise(wait);`,
        ],
        [
            'catch shadow with outer binding restoration',
            `const wait = (resolve: () => void) => setTimeout(resolve, 1);
            try { run(); } catch (wait) {
                new Promise(wait);
            }
            new Promise(wait);`,
        ],
        [
            'switch shadow with outer binding restoration',
            `const wait = (resolve: () => void) => setTimeout(resolve, 1);
            switch (value) {
                case 1:
                    const wait = (resolve: () => void) => queueMicrotask(resolve);
                    new Promise(wait);
                    break;
            }
            new Promise(wait);`,
        ],
        [
            'for-scoped timer without leaking into the outer binding',
            `const wait = (resolve: () => void) => queueMicrotask(resolve);
            for (let wait = (resolve: () => void) => setTimeout(resolve, 1); ready; ) {
                new Promise(wait);
            }
            new Promise(wait);`,
        ],
        [
            'switch-scoped timer without leaking into the outer binding',
            `const wait = (resolve: () => void) => queueMicrotask(resolve);
            switch (value) {
                case 1:
                    const wait = (resolve: () => void) => setTimeout(resolve, 1);
                    new Promise(wait);
                    break;
            }
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
        ['public typed private-looking property', `const typed: { _secret: string } = target; typed._secret`],
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
